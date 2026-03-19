import { describe, it, expect } from 'vitest'
import { trainingMaxSkill } from '../domains/strength/training-max-estimation'

describe('training-max-estimation skill', () => {
  it('has correct metadata', () => {
    expect(trainingMaxSkill.name).toBe('training-max-estimation')
    expect(trainingMaxSkill.domain).toBe('strength')
    expect(trainingMaxSkill.tier).toBe(1)
  })

  it('single rep returns weight as 1RM', () => {
    const result = trainingMaxSkill.execute({ weightKg: 100, reps: 1 })
    expect(result.estimated1RM).toBe(100)
    expect(result.trainingMax).toBe(90)
  })

  it('multi-rep Epley formula', () => {
    // 1RM = 100 * (1 + 5/30) = 100 * 1.1667 = 116.67, TM = 116.67 * 0.9 = 105.0
    const result = trainingMaxSkill.execute({ weightKg: 100, reps: 5 })
    expect(result.estimated1RM).toBeCloseTo(116.67, 1)
    expect(result.trainingMax).toBeCloseTo(105, 0)
  })

  it('RPE adjustment matches equivalent reps', () => {
    // RPE 8 with 5 reps → effectiveReps = 5 + (10-8) = 7
    const withRpe = trainingMaxSkill.execute({ weightKg: 100, reps: 5, rpe: 8 })
    const withoutRpe = trainingMaxSkill.execute({ weightKg: 100, reps: 7 })
    expect(withRpe.estimated1RM).toBeCloseTo(withoutRpe.estimated1RM, 5)
    expect(withRpe.trainingMax).toBeCloseTo(withoutRpe.trainingMax, 5)
  })

  it('rejects zero weight', () => {
    expect(() => trainingMaxSkill.inputSchema.parse({ weightKg: 0, reps: 5 })).toThrow()
  })

  it('rejects negative weight', () => {
    expect(() => trainingMaxSkill.inputSchema.parse({ weightKg: -50, reps: 5 })).toThrow()
  })

  it('rejects zero reps', () => {
    expect(() => trainingMaxSkill.inputSchema.parse({ weightKg: 100, reps: 0 })).toThrow()
  })

  it('rejects negative reps', () => {
    expect(() => trainingMaxSkill.inputSchema.parse({ weightKg: 100, reps: -1 })).toThrow()
  })

  it('rounds trainingMax to nearest 0.5kg', () => {
    // 1RM = 80 * (1 + 3/30) = 80 * 1.1 = 88, TM = 88 * 0.9 = 79.2 → 79.0
    const result = trainingMaxSkill.execute({ weightKg: 80, reps: 3 })
    const remainder = (result.trainingMax * 2) % 1
    expect(remainder).toBeCloseTo(0, 5)
  })
})
