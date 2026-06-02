// The single entry point for Layer 1. Assembles the canonical AthleteState snapshot
// consumed identically by generation and execution. Pure helper so it
// can be imported by both the engine and server actions.

import { createClient } from '@/lib/supabase/server'
import { getCapabilities } from './capabilities.actions'
import { getReadiness } from './readiness'
import type { AthleteState } from '@/lib/types/athlete-state.types'

export async function getAthleteState(userId: string): Promise<AthleteState> {
  const supabase = await createClient()

  const [profileRes, injuriesRes, capabilities, readiness] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('athlete_injuries').select('*').eq('user_id', userId).eq('is_active', true),
    getCapabilities(userId),
    getReadiness(userId),
  ])

  if (profileRes.error || !profileRes.data) throw new Error('Could not load athlete profile')
  if (injuriesRes.error) throw new Error('Could not load athlete injuries')
  const p = profileRes.data as Record<string, any> // TODO: remove cast once DB types are regenerated

  return {
    identity: {
      age: p.age ?? null,
      sex: p.sex ?? null,
      bodyweightKg: p.bodyweight_kg ?? null,
      goalArchetype: p.goal_archetype ?? null,
      primaryGoal: p.primary_goal ?? null,
      experienceByModality: {
        lifting: p.lifting_experience ?? null,
        running: p.running_experience ?? null,
        rucking: p.rucking_experience ?? null,
        rowing: p.rowing_experience ?? null,
        swimming: p.swimming_experience ?? null,
        cycling: p.cycling_experience ?? null,
        conditioning: p.conditioning_experience ?? null,
      },
    },
    constraints: {
      injuries: injuriesRes.data ?? [],
      movementsToAvoid: p.movements_to_avoid ?? [],
      equipmentList: p.equipment_list ?? [],
      environment: p.primary_training_environment ?? null,
      availableDays: p.available_days ?? null,
      sessionDurationMinutes: p.session_duration_minutes ?? null,
    },
    capabilities,
    readiness,
  }
}
