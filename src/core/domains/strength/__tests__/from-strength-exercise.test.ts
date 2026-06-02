import { describe, it, expect } from 'vitest'
import { fromStrengthExercise } from '../from-strength-exercise'

const base = {
  exerciseName: 'Back Squat', muscleGroup: 'Quads',
  category: 'primary_compound' as const, sets: 3, targetReps: 5,
  targetWeightKg: 85, targetRir: 2, notes: null,
}

describe('fromStrengthExercise', () => {
  it('maps core fields and marks formula-sourced when methodologySource is present', () => {
    const p = fromStrengthExercise({ ...base, methodologySource: '5/3/1 wk1: 5+ @ 85% TM' })
    expect(p).toMatchObject({
      exerciseName: 'Back Squat', muscleGroup: 'Quads', sets: 3, targetReps: 5,
      targetWeightKg: 85, targetRir: 2, category: 'primary_compound',
      source: 'formula', methodologySource: '5/3/1 wk1: 5+ @ 85% TM',
    })
  })

  it('marks ai-sourced when no methodologySource (accessory)', () => {
    const p = fromStrengthExercise({ ...base, exerciseName: 'Cable Fly', category: 'accessory' })
    expect(p.source).toBe('ai')
    expect(p.methodologySource).toBeUndefined()
  })

  it('preserves isBenchmarkTest', () => {
    const p = fromStrengthExercise({ ...base, isBenchmarkTest: true })
    expect(p.isBenchmarkTest).toBe(true)
  })
})
