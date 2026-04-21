import { createClient } from '@/lib/supabase/server'
import { saveCoachIntervention } from '@/lib/actions/ai-coach.actions'
import { detectPattern, isCooldownClear } from '@/lib/analytics/coach-bias'
import type { CoachDomain } from '@/lib/analytics/shared/coach-domain'

export function shouldFireRollingPattern(args: {
  lastFiredAt: string | null
  now: Date
  hasPatternSignal: boolean
}): boolean {
  if (!args.hasPatternSignal) return false
  return isCooldownClear({ lastFiredAt: args.lastFiredAt, now: args.now })
}

/**
 * Evaluates the most recent 5 deltas for (user, coach) and fires a rolling_pattern
 * intervention if 3 consecutive same-direction >10% deltas are detected and
 * the 7-day per-coach cooldown has cleared.
 *
 * Caller supplies microcycleId (from the completing workout's microcycle_id)
 * because ai_coach_interventions has a NOT NULL constraint on that column.
 */
export async function evaluateAndFirePattern(
  userId: string,
  coachDomain: CoachDomain,
  microcycleId: string,
) {
  const supabase = await createClient()

  const { getRecentCoachDeltaSeries } = await import('@/lib/analytics/shared/coach-domain')
  const series = await getRecentCoachDeltaSeries(userId, coachDomain, { limit: 5 })

  const pattern = detectPattern(
    series.map(d => ({ delta_pct: d.delta_pct, workout_id: d.session_inventory_id })),
  )

  const { data: lastInt } = await supabase
    .from('ai_coach_interventions')
    .select('created_at')
    .eq('user_id', userId)
    .eq('coach_domain', coachDomain)
    .eq('trigger_type', 'rolling_pattern')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const fire = shouldFireRollingPattern({
    lastFiredAt: lastInt?.created_at ?? null,
    now: new Date(),
    hasPatternSignal: pattern !== null,
  })
  if (!fire || !pattern) return { fired: false as const }

  await saveCoachIntervention({
    microcycleId,
    triggerType: 'rolling_pattern',
    rationale: `${coachDomain} coach flag: ${pattern.direction}-performance pattern across 3 sessions (${pattern.magnitudes.map(m => m.toFixed(0) + '%').join(', ')}).`,
    coachDomain,
    patternSignal: pattern as unknown as Record<string, unknown>,
  })
  return { fired: true as const, pattern }
}
