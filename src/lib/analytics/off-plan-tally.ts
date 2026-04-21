import { createClient } from '@/lib/supabase/server'
import { modalityToCoachDomain } from './shared/coach-domain'

export interface OffPlanTally {
  total: number
  byModality: Record<string, { count: number; countTowardLoad: number }>
}

export function computeOffPlanTally(
  rows: { modality: string; count_toward_load: boolean }[]
): OffPlanTally {
  const byModality: OffPlanTally['byModality'] = {}
  for (const r of rows) {
    const m = byModality[r.modality] ??= { count: 0, countTowardLoad: 0 }
    m.count += 1
    if (r.count_toward_load) m.countTowardLoad += 1
  }
  return { total: rows.length, byModality }
}

/**
 * @deprecated Delegates to modalityToCoachDomain. Kept as a stable export surface
 * for the off-plan tally; prefer modalityToCoachDomain directly in new code.
 */
export function linkedDomainForModality(modality: string): string | null {
  return modalityToCoachDomain(modality)
}

export async function currentBlockTally(userId: string, blockStart: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('off_plan_sessions')
    .select('modality, count_toward_load')
    .eq('user_id', userId).gte('logged_at', blockStart)
  return computeOffPlanTally((data ?? []) as any)
}
