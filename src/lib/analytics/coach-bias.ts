import { createClient } from '@/lib/supabase/server'

export type RAG = 'red' | 'amber' | 'green' | 'insufficient'

const RED_THRESHOLD = 10
const AMBER_THRESHOLD = 5
const MIN_SAMPLES = 3
const COOLDOWN_DAYS = 7

export function classifyRAG(deltaMagnitudesPct: number[]): RAG {
  if (deltaMagnitudesPct.length < MIN_SAMPLES) return 'insufficient'
  const mean = deltaMagnitudesPct.reduce((a, b) => a + b, 0) / deltaMagnitudesPct.length
  if (mean > RED_THRESHOLD) return 'red'
  if (mean > AMBER_THRESHOLD) return 'amber'
  return 'green'
}

export interface PatternSignal {
  direction: 'over' | 'under'
  workoutIds: string[]
  magnitudes: number[]
}

export function detectPattern(
  recentDeltas: { delta_pct: number; workout_id: string }[]
): PatternSignal | null {
  if (recentDeltas.length < 3) return null
  const last3 = recentDeltas.slice(0, 3)
  const allUnder = last3.every(d => d.delta_pct < -RED_THRESHOLD)
  const allOver = last3.every(d => d.delta_pct > RED_THRESHOLD)
  if (!allUnder && !allOver) return null
  return {
    direction: allOver ? 'over' : 'under',
    workoutIds: last3.map(d => d.workout_id),
    magnitudes: last3.map(d => Math.abs(d.delta_pct)),
  }
}

export function isCooldownClear(args: { lastFiredAt: string | null; now: Date }): boolean {
  if (!args.lastFiredAt) return true
  const elapsed = args.now.getTime() - new Date(args.lastFiredAt).getTime()
  return elapsed > COOLDOWN_DAYS * 24 * 3600 * 1000
}

export async function allCoachesRAG(userId: string) {
  const supabase = await createClient()
  const sinceIso = new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString()
  // performance_deltas has no coach_domain; derive via JOIN to session_inventory.
  const { data } = await supabase
    .from('performance_deltas')
    .select(`
      prescribed_weight, actual_weight,
      prescribed_reps, actual_reps,
      prescribed_rpe, actual_rpe,
      created_at,
      session_inventory:session_inventory_id (modality)
    `)
    .eq('user_id', userId).gte('created_at', sinceIso)

  const { modalityToCoachDomain, computeExerciseDeltaPct } = await import('./shared/coach-domain')
  const byCoach = new Map<string, number[]>()
  for (const r of (data ?? []) as any[]) {
    const modality = r.session_inventory?.modality
    const coach = modality ? modalityToCoachDomain(modality) : null
    if (!coach) continue
    const d = computeExerciseDeltaPct(r)
    if (d == null) continue
    const list = byCoach.get(coach) ?? []
    list.push(Math.abs(d))
    byCoach.set(coach, list)
  }
  const result: Record<string, RAG> = {}
  for (const [coach, deltas] of byCoach) result[coach] = classifyRAG(deltas)
  return result
}
