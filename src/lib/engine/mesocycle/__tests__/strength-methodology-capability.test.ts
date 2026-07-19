import { describe, it, expect, vi, beforeEach } from 'vitest'

// buildStrengthMethodologyContext resolves training maxes through
// resolveTrainingMaxForExercise, which reads profiles.training_maxes via an
// authenticated supabase client. Mock at that boundary.
//
// This file previously asserted that athlete_capabilities took precedence over
// profiles.training_maxes. That precedence was removed deliberately: the pool
// path never read capabilities at all, so the two readers disagreed and could
// drift. Capabilities are now a write-through mirror of training_maxes (see
// setTrainingMax), not an independent source.
const { getTrainingMaxMock } = vi.hoisted(() => ({ getTrainingMaxMock: vi.fn() }))
vi.mock('@/lib/actions/training-maxes.actions', () => ({
  getTrainingMax: getTrainingMaxMock,
}))

import { buildStrengthMethodologyContext } from '../context'

const profile = { strength_methodology: '531', lifting_experience: 'intermediate' }

beforeEach(() => getTrainingMaxMock.mockReset())

describe('buildStrengthMethodologyContext training-max sourcing', () => {
  it('uses the stored training max over the onboarding benchmark', async () => {
    getTrainingMaxMock.mockImplementation(async (name: string) =>
      name === 'Squat'
        ? { trainingMaxKg: 86.5, updatedAt: 't', source: 'recalibration' }
        : null
    )
    const benchmarks: any = [{ benchmark_name: 'Back Squat', value: 120, user_id: 'u', modality: 'LIFTING', unit: 'kg', source: 'self_reported', tested_at: null, created_at: 't', id: '1' }]
    const ctx = await buildStrengthMethodologyContext(profile as any, benchmarks, 1, 4, false, [])
    expect(ctx?.liftingProtocol).toContain('TM: 86.5kg')
    expect(ctx?.liftingProtocol).not.toContain('TM: 120')
  })

  it('falls back to a benchmark-derived TM when nothing is stored', async () => {
    getTrainingMaxMock.mockResolvedValue(null)
    const benchmarks: any = [{ benchmark_name: 'Back Squat', value: 100, user_id: 'u', modality: 'LIFTING', unit: 'kg', source: 'self_reported', tested_at: null, created_at: 't', id: '1' }]
    const ctx = await buildStrengthMethodologyContext(profile as any, benchmarks, 1, 4, false, [])
    expect(ctx?.liftingProtocol).toContain('Squat')
    expect(ctx?.liftingProtocol).toContain('TM:')
  })

  it('emits a lift with a stored TM even when it has no benchmark row', async () => {
    // Regression guard: the old `if (bm)` gate skipped the lift entirely, so a
    // freshly recalibrated max was unusable without an onboarding benchmark.
    getTrainingMaxMock.mockImplementation(async (name: string) =>
      name === 'OHP'
        ? { trainingMaxKg: 49.5, updatedAt: 't', source: 'recalibration' }
        : null
    )
    const ctx = await buildStrengthMethodologyContext(profile as any, [], 1, 4, false, [])
    expect(ctx?.liftingProtocol).toContain('OHP (TM: 49.5kg)')
  })

  it('skips a lift with neither a stored TM nor a benchmark', async () => {
    getTrainingMaxMock.mockResolvedValue(null)
    const ctx = await buildStrengthMethodologyContext(profile as any, [], 1, 4, false, [])
    expect(ctx?.liftingProtocol).toBeUndefined()
  })
})
