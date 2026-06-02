import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../capabilities.actions', () => ({
  getCapabilities: vi.fn(async () => ({
    strength: [{ key: 'back_squat', label: 'Back Squat', currentValueKg: 120, source: 'onboarding', updatedAt: 't', evidence: {} }],
    endurance: [{ key: 'run_5k', label: 'Run 5km', currentValueSeconds: 1500, source: 'onboarding', updatedAt: 't', evidence: {} }],
  })),
}))
vi.mock('../readiness', () => ({ getReadiness: vi.fn(async () => ({ status: 'UNKNOWN' })) }))

vi.mock('@/lib/supabase/server', () => {
  const profile = {
    id: 'u1', age: 34, sex: 'MALE', bodyweight_kg: 82, goal_archetype: 'hybrid_fitness',
    primary_goal: 'general', lifting_experience: 'intermediate', running_experience: 'beginner',
    movements_to_avoid: ['behind_neck_press'], equipment_list: ['barbell'], primary_training_environment: 'home_gym',
    available_days: 5, session_duration_minutes: 60,
  }
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'profiles') return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: profile, error: null })) })) })) }
      if (table === 'athlete_injuries') return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [], error: null })) })) })) }
      throw new Error(`unexpected table ${table}`)
    }),
  }
  return { createClient: vi.fn(async () => client) }
})

import { getAthleteState } from '../get-athlete-state'

describe('getAthleteState', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assembles identity, constraints, distinct-typed capabilities, and optional readiness', async () => {
    const state = await getAthleteState('u1')
    expect(state.identity).toMatchObject({ age: 34, sex: 'MALE', bodyweightKg: 82, goalArchetype: 'hybrid_fitness' })
    expect(state.identity.experienceByModality.lifting).toBe('intermediate')
    expect(state.constraints.movementsToAvoid).toContain('behind_neck_press')
    expect(state.constraints.injuries).toEqual([])
    expect(state.capabilities.strength[0].currentValueKg).toBe(120)
    expect(state.capabilities.endurance[0].currentValueSeconds).toBe(1500)
    expect(state.readiness).toEqual({ status: 'UNKNOWN' })
  })
})
