export type CoachDomain = 'strength' | 'hypertrophy' | 'endurance' | 'conditioning' | 'mobility' | 'recovery'

export function modalityToCoachDomain(modality: string): CoachDomain | null {
  switch (modality.toLowerCase()) {
    case 'strength':
    case 'lifting':
      return 'strength'
    case 'hypertrophy':
      return 'hypertrophy'
    case 'endurance':
    case 'run':
    case 'ride':
    case 'cardio':
    case 'rucking':
      return 'endurance'
    case 'conditioning':
    case 'metcon':
      return 'conditioning'
    case 'mobility':
      return 'mobility'
    case 'recovery':
      return 'recovery'
    default:
      return null
  }
}

/**
 * Computes a per-exercise delta_pct from prescribed/actual values in
 * performance_deltas. Prefers weight, falls back to reps, then RPE.
 * Returns null when prescribed is missing or zero (undefined baseline).
 */
export function computeExerciseDeltaPct(row: {
  prescribed_weight: number | null
  actual_weight: number | null
  prescribed_reps: number | null
  actual_reps: number | null
  prescribed_rpe: number | null
  actual_rpe: number | null
}): number | null {
  if (row.prescribed_weight && row.actual_weight != null) {
    if (row.prescribed_weight === 0) return null
    return ((row.actual_weight - row.prescribed_weight) / row.prescribed_weight) * 100
  }
  if (row.prescribed_reps && row.actual_reps != null) {
    if (row.prescribed_reps === 0) return null
    return ((row.actual_reps - row.prescribed_reps) / row.prescribed_reps) * 100
  }
  if (row.prescribed_rpe && row.actual_rpe != null) {
    if (row.prescribed_rpe === 0) return null
    return ((row.actual_rpe - row.prescribed_rpe) / row.prescribed_rpe) * 100
  }
  return null
}

/**
 * Returns per-session average delta_pct for a user + coach domain, ordered
 * newest first. Each session's delta_pct is the mean of per-exercise deltas
 * (with sign preserved). `session_inventory_id` is included so UI can group /
 * navigate to the session. Used by domain pages, pattern detector, tests.
 *
 * Performs the JOIN that the raw `performance_deltas` table can't express
 * directly (no delta_pct, no coach_domain on the row).
 */
export async function getRecentCoachDeltaSeries(
  userId: string,
  coach: CoachDomain,
  opts: { limit?: number } = {},
): Promise<Array<{ created_at: string; delta_pct: number; session_inventory_id: string }>> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data } = await supabase
    .from('performance_deltas')
    .select(`
      session_inventory_id, created_at,
      prescribed_weight, actual_weight,
      prescribed_reps, actual_reps,
      prescribed_rpe, actual_rpe,
      session_inventory:session_inventory_id (modality)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const bySession = new Map<string, { created_at: string; deltas: number[] }>()
  for (const r of (data ?? []) as any[]) {
    const modality = r.session_inventory?.modality
    if (!modality || modalityToCoachDomain(modality) !== coach) continue
    const d = computeExerciseDeltaPct(r)
    if (d == null) continue
    const bucket = bySession.get(r.session_inventory_id) ?? { created_at: r.created_at as string, deltas: [] as number[] }
    bucket.deltas.push(d)
    bySession.set(r.session_inventory_id, bucket)
  }
  const series = Array.from(bySession.entries()).map(([session_inventory_id, b]) => ({
    session_inventory_id,
    created_at: b.created_at,
    delta_pct: b.deltas.reduce((a, c) => a + c, 0) / b.deltas.length,
  })).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return opts.limit ? series.slice(0, opts.limit) : series
}
