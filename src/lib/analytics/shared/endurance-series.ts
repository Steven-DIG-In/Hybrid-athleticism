// Purpose-built delta series for /data/endurance. Unlike getRecentCoachDeltaSeries
// (strength-only; reads performance_deltas, which endurance sessions never populate),
// this reads completed CARDIO workouts' immutable endurance_prescription straight off
// `workouts`, joins their actual off `cardio_logs`, and runs the domain's
// computeEnduranceDelta per session — no persisted delta table for endurance exists.
//
// DeltaPoint matches PerformanceDeltaChart's `Point` type exactly
// (src/components/data/domain/PerformanceDeltaChart.tsx: `{ date: string; delta_pct: number }`).

import { computeEnduranceDelta } from '@/core/domains/endurance/plan-vs-actual'
import type { ActualEndurance, EnduranceDelta, PrescribedEndurance } from '@/core/domains/endurance/plan-vs-actual'
import { parseEndurancePrescription, toPrescribedEndurance } from '@/core/domains/endurance/plan-vs-actual.wiring'
import type { EnduranceModality } from '@/core/domains/endurance/prescription.types'

export interface DeltaPoint {
  date: string
  delta_pct: number
}

interface WorkoutRow {
  id: string
  completed_at: string | null
  endurance_prescription: unknown
}

interface CardioLogRow {
  workout_id: string
  distance_km: number | null
  duration_minutes: number | null
  avg_pace_sec_per_km: number | null
  avg_heart_rate_bpm: number | null
  perceived_effort_rpe: number | null
}

/**
 * Primary metric for the chart's single-number-per-session line:
 * - running: pace delta % (targetPaceSecPerKm is the precise, log-worthy target)
 * - everything else (rucking/rowing/swimming/cycling): duration delta % (those
 *   modalities are zone/HR-governed with no precise pace target this layer)
 *
 * Falls back to 0 when the governing target or actual field is missing on an
 * otherwise-logged session (e.g. a rucking log with no duration_minutes) so
 * that session still contributes one point rather than being dropped. Fully
 * unlogged sessions never reach here — they're filtered out upstream.
 */
function primaryDeltaPct(
  modality: EnduranceModality,
  prescribed: PrescribedEndurance,
  delta: EnduranceDelta,
): number {
  if (modality === 'running') {
    if (delta.paceDeltaSecPerKm == null || !prescribed.targetPaceSecPerKm) return 0
    return Number(((delta.paceDeltaSecPerKm / prescribed.targetPaceSecPerKm) * 100).toFixed(1))
  }
  if (delta.durationDeltaMin == null || !prescribed.targetDurationMin) return 0
  return Number(((delta.durationDeltaMin / prescribed.targetDurationMin) * 100).toFixed(1))
}

/**
 * Returns up to `limit` (default 20) DeltaPoints for a user's completed CARDIO
 * workouts, oldest-first (so the chart reads left-to-right chronologically).
 * Sessions with no matching `cardio_logs` actual (unlogged) are excluded — a
 * completed-but-unlogged workout must not render as an on-target dot at the
 * chart's midline. Contract: N completed-AND-LOGGED cardio sessions with a
 * prescription -> N points. Empty array when there are no qualifying sessions.
 */
export async function getRecentEnduranceDeltaSeries(
  userId: string,
  opts: { limit?: number } = {},
): Promise<DeltaPoint[]> {
  const limit = opts.limit ?? 20
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, completed_at, endurance_prescription')
    .eq('user_id', userId)
    .eq('modality', 'CARDIO')
    .eq('is_completed', true)
    .not('endurance_prescription', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit)

  const workoutList = (workouts ?? []) as WorkoutRow[]
  if (workoutList.length === 0) return []

  const workoutIds = workoutList.map(w => w.id)
  const { data: logs } = await supabase
    .from('cardio_logs')
    .select('workout_id, distance_km, duration_minutes, avg_pace_sec_per_km, avg_heart_rate_bpm, perceived_effort_rpe')
    .in('workout_id', workoutIds)

  const logByWorkout = new Map<string, CardioLogRow>()
  for (const l of (logs ?? []) as CardioLogRow[]) logByWorkout.set(l.workout_id, l)

  const points: DeltaPoint[] = []
  for (const w of workoutList) {
    if (!w.completed_at) continue
    const prescription = parseEndurancePrescription(w.endurance_prescription)
    if (!prescription) continue

    const log = logByWorkout.get(w.id)
    if (!log) continue // no matching cardio_logs actual -> computeEnduranceDelta would return
    // status: 'unlogged'; skip rather than emit a misleading on-target (delta_pct: 0) point.

    const actual: ActualEndurance = {
      distanceKm: log?.distance_km ?? null,
      durationMinutes: log?.duration_minutes ?? null,
      avgPaceSecPerKm: log?.avg_pace_sec_per_km ?? null,
      avgHeartRateBpm: log?.avg_heart_rate_bpm ?? null,
      perceivedEffortRpe: log?.perceived_effort_rpe ?? null,
    }

    const prescribed = toPrescribedEndurance(prescription)
    const delta = computeEnduranceDelta(prescribed, actual)
    points.push({
      date: w.completed_at.slice(0, 10),
      delta_pct: primaryDeltaPct(prescription.modality, prescribed, delta),
    })
  }

  // workoutList is newest-first (order by completed_at desc); reverse for the chart.
  return points.reverse()
}
