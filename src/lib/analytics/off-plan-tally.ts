import { createClient } from '@/lib/supabase/server'

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

export function linkedDomainForModality(modality: string): string | null {
  switch (modality) {
    case 'run':
    case 'ride':
      return 'endurance'
    case 'strength':
      return 'strength'
    case 'conditioning':
      return 'conditioning'
    default:
      return null
  }
}

export async function currentBlockTally(userId: string, blockStart: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('off_plan_sessions')
    .select('modality, count_toward_load')
    .eq('user_id', userId).gte('logged_at', blockStart)
  return computeOffPlanTally((data ?? []) as any)
}
