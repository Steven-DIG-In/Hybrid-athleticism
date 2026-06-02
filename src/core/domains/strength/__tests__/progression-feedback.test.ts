import { describe, it, expect } from 'vitest'
import { nextSetRecommendation } from '../progression-feedback'

describe('nextSetRecommendation', () => {
  it('recommends an increase when reps beat target with RIR to spare', () => {
    const rec = nextSetRecommendation({
      exerciseName: 'Back Squat',
      prescribed: { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      actual: { actualWeightKg: 85, actualReps: 8, rirActual: 3 },
    })
    expect(rec).not.toBeNull()
    expect(rec!.adjustment).toBe('increase')
    expect(rec!.nextWeightKg).toBeGreaterThan(85)
  })

  it('returns null when the set is unlogged or has no prescribed weight', () => {
    expect(nextSetRecommendation({
      exerciseName: 'Cable Fly',
      prescribed: { targetWeightKg: null, targetReps: 12, targetRir: 1 },
      actual: { actualWeightKg: 20, actualReps: 12, rirActual: 1 },
    })).toBeNull()
    expect(nextSetRecommendation({
      exerciseName: 'Back Squat',
      prescribed: { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      actual: { actualWeightKg: null, actualReps: null, rirActual: null },
    })).toBeNull()
  })
})
