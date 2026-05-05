import { createClient } from '@/lib/supabase/server'

export type OverrunSignalEvidence = {
  overrunSessions: Array<{
    workoutId: string
    estimatedMinutes: number
    actualMinutes: number
  }>
  avgOverrunMinutes: number
  avgOverrunPct: number
  sessionsConsidered: number
}

export type OverrunSignal = {
  shouldFire: boolean
  evidence: OverrunSignalEvidence
}

const SESSIONS_WINDOW = 3
const OVERRUN_PCT_THRESHOLD = 20
const OVERRUN_MIN_FLOOR = 8

const EMPTY_EVIDENCE: OverrunSignalEvidence = {
  overrunSessions: [],
  avgOverrunMinutes: 0,
  avgOverrunPct: 0,
  sessionsConsidered: 0,
}

/** Pure read-only signal evaluator. Returns whether the mid-block overrun
 *  banner should fire for the given user, plus the evidence backing it.
 *  Called on dashboard render. */
export async function evaluateOverrunSignal(userId: string): Promise<OverrunSignal> {
  const supabase = await createClient()

  // 1. Active mesocycle check
  const { data: activeMeso } = await supabase
    .from('mesocycles')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (!activeMeso) {
    return { shouldFire: false, evidence: EMPTY_EVIDENCE }
  }

  // 2. Suppression check — pending_planner_notes presence
  const { data: profile } = await supabase
    .from('profiles')
    .select('pending_planner_notes')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.pending_planner_notes != null) {
    return { shouldFire: false, evidence: EMPTY_EVIDENCE }
  }

  // 3. Fetch last N completed workouts
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, session_inventory_id, actual_duration_minutes, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .not('actual_duration_minutes', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(SESSIONS_WINDOW)

  const recentWorkouts = workouts ?? []
  if (recentWorkouts.length < SESSIONS_WINDOW) {
    return { shouldFire: false, evidence: EMPTY_EVIDENCE }
  }

  // 4. Pull matching inventory rows
  const inventoryIds = recentWorkouts
    .map((w: any) => w.session_inventory_id)
    .filter((id: string | null): id is string => id != null)
  if (inventoryIds.length < SESSIONS_WINDOW) {
    return { shouldFire: false, evidence: EMPTY_EVIDENCE }
  }
  const { data: inventory } = await supabase
    .from('session_inventory')
    .select('id, estimated_duration_minutes')
    .in('id', inventoryIds)
  const invById = new Map<string, any>()
  for (const inv of inventory ?? []) {
    invById.set(inv.id, inv)
  }

  // 5. Build per-session evidence (only sessions with both estimated + actual)
  const overrunSessions: OverrunSignalEvidence['overrunSessions'] = []
  for (const w of recentWorkouts) {
    const inv = invById.get(w.session_inventory_id)
    if (!inv?.estimated_duration_minutes || !w.actual_duration_minutes) continue
    overrunSessions.push({
      workoutId: w.id,
      estimatedMinutes: inv.estimated_duration_minutes,
      actualMinutes: w.actual_duration_minutes,
    })
  }
  if (overrunSessions.length < SESSIONS_WINDOW) {
    return { shouldFire: false, evidence: EMPTY_EVIDENCE }
  }

  // 6. Compute averages
  const totalOverrunMin = overrunSessions.reduce(
    (a, s) => a + (s.actualMinutes - s.estimatedMinutes), 0)
  const totalOverrunPct = overrunSessions.reduce(
    (a, s) => a + ((s.actualMinutes - s.estimatedMinutes) / s.estimatedMinutes) * 100, 0)
  const avgOverrunMinutes = Math.round((totalOverrunMin / overrunSessions.length) * 10) / 10
  const avgOverrunPct = Math.round((totalOverrunPct / overrunSessions.length) * 10) / 10

  const evidence: OverrunSignalEvidence = {
    overrunSessions,
    avgOverrunMinutes,
    avgOverrunPct,
    sessionsConsidered: overrunSessions.length,
  }

  // 7. Apply both thresholds
  const shouldFire =
    avgOverrunPct >= OVERRUN_PCT_THRESHOLD &&
    avgOverrunMinutes >= OVERRUN_MIN_FLOOR

  return { shouldFire, evidence }
}
