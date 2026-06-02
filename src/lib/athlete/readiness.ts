// Optional, never-fabricated readiness. Today the wearable + self-report tables are
// empty, so this returns { status: 'UNKNOWN' } unless a self-report exists. When one
// does, it delegates to the existing recovery-scorer skill.

import { createClient } from '@/lib/supabase/server'
import { recoveryScorerSkill } from '@/lib/skills/domains/recovery/recovery-scorer'
import { recoveryCoachConfig } from '@/lib/coaches/configs/recovery'
import type { Readiness } from '@/lib/types/athlete-state.types'

export async function getReadiness(
  userId: string,
): Promise<Readiness | { status: 'UNKNOWN' }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_self_reports')
    .select('sleep_quality, energy_level, stress_level, motivation, soreness, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error

  const latest = (data ?? [])[0]
  if (!latest) return { status: 'UNKNOWN' }

  try {
    const result = recoveryScorerSkill.execute({
      avgRpeDeviation: 0,
      avgRirDeviation: 0,
      completionRate: 1,
      missedSessions: 0,
      earlyCompletion: false,
      selfReport: {
        sleepQuality: latest.sleep_quality ?? 3,
        energyLevel: latest.energy_level ?? 3,
        stressLevel: latest.stress_level ?? 3,
        motivation: latest.motivation ?? 3,
        avgSoreness: 3,
      },
      signalWeights: recoveryCoachConfig.checkIn.signalWeights,
    })

    return {
      status: result.status,
      score: result.score,
      rationale: 'Derived from latest self-report.',
    }
  } catch (e) {
    console.error('[getReadiness] recovery scorer failed:', e)
    return { status: 'UNKNOWN' }
  }
}
