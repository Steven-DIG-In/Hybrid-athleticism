import { createClient } from '@/lib/supabase/server'

export interface DurationRow {
  coach_domain: string
  estimated: number
  actual: number
}

export interface CoachVariance {
  sessions: number
  totalEstimated: number
  totalActual: number
  overrunPct: number
}

export function aggregateDurationVariance(
  rows: DurationRow[]
): Record<string, CoachVariance> {
  const result: Record<string, CoachVariance> = {}
  for (const r of rows) {
    const c = result[r.coach_domain] ??= {
      sessions: 0, totalEstimated: 0, totalActual: 0, overrunPct: 0,
    }
    c.sessions += 1
    c.totalEstimated += r.estimated
    c.totalActual += r.actual
  }
  for (const c of Object.values(result)) {
    c.overrunPct = c.totalEstimated === 0
      ? 0
      : ((c.totalActual - c.totalEstimated) / c.totalEstimated) * 100
  }
  return result
}

export async function currentBlockVariance(
  userId: string,
  mesocycleId: string,
  weekNumber: number,
) {
  const supabase = await createClient()
  // session_inventory has (mesocycle_id, week_number); no block_id column.
  // Derive coach_domain from modality via modalityToCoachDomain.
  const { data } = await supabase
    .from('session_inventory')
    .select('modality, estimated_duration_minutes, workouts!inner(actual_duration_minutes)')
    .eq('user_id', userId)
    .eq('mesocycle_id', mesocycleId)
    .eq('week_number', weekNumber)
    .eq('status', 'completed')

  const { modalityToCoachDomain } = await import('./shared/coach-domain')
  const rows: DurationRow[] = ((data ?? []) as any[]).flatMap(x => {
    const coach = modalityToCoachDomain(x.modality)
    // workouts!inner can arrive as array or single object depending on PostgREST config.
    const workout = Array.isArray(x.workouts) ? x.workouts[0] : x.workouts
    const actual = workout?.actual_duration_minutes
    const estimated = x.estimated_duration_minutes
    if (!coach || estimated == null || actual == null) return []
    return [{ coach_domain: coach, estimated, actual }]
  })
  return aggregateDurationVariance(rows)
}
