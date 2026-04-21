import { createClient } from '@/lib/supabase/server'
import { saveCoachIntervention } from '@/lib/actions/ai-coach.actions'
import { classifyRAG } from '@/lib/analytics/coach-bias'

const BLOCK_END_THRESHOLD = 5 // percent

export function shouldFireBlockEnd(
  args: { coach: string; meanMagnitudePct: number }
): boolean {
  return args.meanMagnitudePct > BLOCK_END_THRESHOLD
}

/**
 * Evaluates the completed block's per-coach mean delta magnitude and fires
 * a `block_end` intervention for any coach whose mean exceeds the threshold.
 *
 * Schema notes: session_inventory has (mesocycle_id, week_number) — no block_id.
 * performance_deltas is per-exercise — no delta_pct / coach_domain on the row;
 * both are derived via session_inventory.modality and computeExerciseDeltaPct.
 *
 * Caller (Task 7) supplies microcycleId because ai_coach_interventions has a
 * NOT NULL constraint on that column.
 */
export async function fireBlockEndInterventions(
  userId: string,
  mesocycleId: string,
  weekNumber: number,
  microcycleId: string,
) {
  const supabase = await createClient()

  const { data: inv } = await supabase
    .from('session_inventory')
    .select('id, modality')
    .eq('user_id', userId)
    .eq('mesocycle_id', mesocycleId)
    .eq('week_number', weekNumber)
    .eq('status', 'completed')

  const invRows = (inv ?? []) as { id: string; modality: string }[]
  if (invRows.length === 0) return
  const invIds = invRows.map(i => i.id)
  const modalityBySession = new Map<string, string>(invRows.map(i => [i.id, i.modality]))

  const { data: deltaRows } = await supabase
    .from('performance_deltas')
    .select('session_inventory_id, prescribed_weight, actual_weight, prescribed_reps, actual_reps, prescribed_rpe, actual_rpe')
    .in('session_inventory_id', invIds)

  const { computeExerciseDeltaPct, modalityToCoachDomain } = await import('@/lib/analytics/shared/coach-domain')

  const byCoach = new Map<string, { magnitudes: number[]; sessionIds: Set<string> }>()
  for (const r of (deltaRows ?? []) as any[]) {
    const modality = modalityBySession.get(r.session_inventory_id)
    if (!modality) continue
    const coach = modalityToCoachDomain(modality)
    if (!coach) continue
    const d = computeExerciseDeltaPct(r)
    if (d == null) continue
    const bucket = byCoach.get(coach) ?? { magnitudes: [], sessionIds: new Set<string>() }
    bucket.magnitudes.push(Math.abs(d))
    bucket.sessionIds.add(r.session_inventory_id)
    byCoach.set(coach, bucket)
  }

  for (const [coach, { magnitudes, sessionIds }] of byCoach) {
    if (magnitudes.length === 0) continue
    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length
    if (!shouldFireBlockEnd({ coach, meanMagnitudePct: mean })) continue
    const rag = classifyRAG(magnitudes)
    await saveCoachIntervention({
      microcycleId,
      triggerType: 'block_end',
      rationale: `Block-end review for ${coach}: mean delta magnitude ${mean.toFixed(1)}% (${rag}).`,
      coachDomain: coach,
      patternSignal: {
        sessionIds: Array.from(sessionIds),
        meanMagnitudePct: mean,
        rag,
      },
    })
  }
}
