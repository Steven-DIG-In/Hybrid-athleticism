import { createClient } from '@/lib/supabase/server'

export type AdherenceState = 'on_track' | 'off_track' | 'missed' | 'pending'

export interface HeatmapCell {
  training_day: number
  session_slot: number
  state: AdherenceState
  delta_magnitude_pct: number | null
  session_id: string | null
}

export interface SessionRow {
  training_day: number
  session_slot: number
  status: string
  delta_magnitude_pct: number | null
  session_id?: string | null
}

const OFF_TRACK_THRESHOLD = 10 // %

export function rollupHeatmapCells(rows: SessionRow[]): HeatmapCell[] {
  return rows.map(r => {
    let state: AdherenceState = 'pending'
    if (r.status === 'missed') state = 'missed'
    else if (r.status === 'completed') {
      state = (r.delta_magnitude_pct ?? 0) > OFF_TRACK_THRESHOLD ? 'off_track' : 'on_track'
    }
    return {
      training_day: r.training_day,
      session_slot: r.session_slot,
      state,
      delta_magnitude_pct: r.delta_magnitude_pct,
      session_id: r.session_id ?? null,
    }
  })
}

export async function currentBlockHeatmap(
  userId: string,
  mesocycleId: string,
  weekNumber: number,
) {
  const supabase = await createClient()
  // session_inventory has (mesocycle_id, week_number); no block_id column.
  const { data: inv } = await supabase
    .from('session_inventory')
    .select('id, training_day, session_slot, status')
    .eq('user_id', userId)
    .eq('mesocycle_id', mesocycleId)
    .eq('week_number', weekNumber)
    .order('training_day', { ascending: true })

  // performance_deltas is per-exercise, linked by session_inventory_id.
  // Compute per-session delta_magnitude_pct as mean of |per-exercise delta_pct|.
  const invIds = (inv ?? []).map(i => i.id)
  const { data: deltaRows } = invIds.length ? await supabase
    .from('performance_deltas')
    .select('session_inventory_id, prescribed_weight, actual_weight, prescribed_reps, actual_reps, prescribed_rpe, actual_rpe')
    .in('session_inventory_id', invIds) : { data: [] as any[] }

  const { computeExerciseDeltaPct } = await import('./shared/coach-domain')
  const magnitudesBySession = new Map<string, number[]>()
  for (const r of deltaRows ?? []) {
    const d = computeExerciseDeltaPct(r)
    if (d == null) continue
    const list = magnitudesBySession.get(r.session_inventory_id) ?? []
    list.push(Math.abs(d))
    magnitudesBySession.set(r.session_inventory_id, list)
  }

  const rows: SessionRow[] = (inv ?? []).map(i => {
    const mags = magnitudesBySession.get(i.id)
    const delta_magnitude_pct = mags && mags.length
      ? mags.reduce((a, b) => a + b, 0) / mags.length
      : null
    return {
      training_day: i.training_day,
      session_slot: i.session_slot,
      status: i.status,
      delta_magnitude_pct,
      session_id: i.id,
    }
  })
  return rollupHeatmapCells(rows)
}
