import { describe, it, expect } from 'vitest'
import { computeSetDelta } from '../plan-vs-actual'

describe('computeSetDelta', () => {
  it('computes weight/reps/rir deltas (actual - prescribed)', () => {
    const d = computeSetDelta(
      { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      { actualWeightKg: 82.5, actualReps: 6, rirActual: 1 },
    )
    expect(d).toEqual({ weightKg: -2.5, reps: 1, rir: -1, status: 'under' })
  })

  it('reports on_target when weight matches', () => {
    const d = computeSetDelta(
      { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      { actualWeightKg: 85, actualReps: 5, rirActual: 2 },
    )
    expect(d.status).toBe('on_target')
    expect(d.weightKg).toBe(0)
  })

  it('reports over when actual weight exceeds prescribed', () => {
    const d = computeSetDelta(
      { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      { actualWeightKg: 90, actualReps: 5, rirActual: 2 },
    )
    expect(d.status).toBe('over')
    expect(d.weightKg).toBe(5)
  })

  it('returns null deltas when an actual is missing', () => {
    const d = computeSetDelta(
      { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      { actualWeightKg: null, actualReps: null, rirActual: null },
    )
    expect(d).toEqual({ weightKg: null, reps: null, rir: null, status: 'unlogged' })
  })
})
