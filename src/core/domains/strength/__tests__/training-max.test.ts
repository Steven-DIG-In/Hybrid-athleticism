import { describe, it, expect } from 'vitest'
import { trainingMaxFromCapability } from '../training-max'

describe('trainingMaxFromCapability', () => {
  it('uses currentValueKg directly when source is a training max (recalibration)', () => {
    const tm = trainingMaxFromCapability({
      key: 'back_squat', label: 'Back Squat', currentValueKg: 86.5,
      source: 'recalibration', updatedAt: 't', evidence: {},
    })
    expect(tm).toBe(86.5)
  })

  it('uses currentValueKg directly for manual/test sources', () => {
    expect(trainingMaxFromCapability({ key: 'x', label: 'x', currentValueKg: 100, source: 'manual', updatedAt: 't', evidence: {} })).toBe(100)
    expect(trainingMaxFromCapability({ key: 'x', label: 'x', currentValueKg: 100, source: 'test', updatedAt: 't', evidence: {} })).toBe(100)
  })

  it('converts a raw onboarding value to a training max via the skill (e1RM x 0.9 at 1 rep)', () => {
    // skill: reps=1 → effectiveReps=1 → estimated1RM=weightKg (no formula), trainingMax=100*0.9=90.0
    const tm = trainingMaxFromCapability({
      key: 'back_squat', label: 'Back Squat', currentValueKg: 100,
      source: 'onboarding', updatedAt: 't', evidence: {},
    })
    expect(tm).toBeCloseTo(90.0, 1)
  })
})
