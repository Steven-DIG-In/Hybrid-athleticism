import { describe, it, expect } from 'vitest'
import { fiveThreeOneSkill } from '../domains/strength/531-progression'

describe('531-progression skill', () => {
  it('has correct metadata', () => {
    expect(fiveThreeOneSkill.name).toBe('531-progression')
    expect(fiveThreeOneSkill.domain).toBe('strength')
    expect(fiveThreeOneSkill.tier).toBe(1)
  })

  it('week 1: 3x5+ at 65/75/85%', () => {
    const result = fiveThreeOneSkill.execute({ trainingMaxKg: 100, weekInCycle: 1 })
    expect(result.weekLabel).toBe('5+')
    expect(result.sets).toHaveLength(3)
    expect(result.sets[0]).toEqual({ reps: 5, percentTM: 0.65, weightKg: 65, isAmrap: false })
    expect(result.sets[1]).toEqual({ reps: 5, percentTM: 0.75, weightKg: 75, isAmrap: false })
    expect(result.sets[2]).toEqual({ reps: 5, percentTM: 0.85, weightKg: 85, isAmrap: true })
  })

  it('week 2: 3x3+ at 70/80/90%', () => {
    const result = fiveThreeOneSkill.execute({ trainingMaxKg: 100, weekInCycle: 2 })
    expect(result.weekLabel).toBe('3+')
    expect(result.sets[2]).toEqual({ reps: 3, percentTM: 0.90, weightKg: 90, isAmrap: true })
  })

  it('week 3: 5/3/1+ at 75/85/95%', () => {
    const result = fiveThreeOneSkill.execute({ trainingMaxKg: 100, weekInCycle: 3 })
    expect(result.weekLabel).toBe('5/3/1')
    expect(result.sets[2]).toEqual({ reps: 1, percentTM: 0.95, weightKg: 95, isAmrap: true })
  })

  it('week 4: deload at 40/50/60%', () => {
    const result = fiveThreeOneSkill.execute({ trainingMaxKg: 100, weekInCycle: 4 })
    expect(result.weekLabel).toBe('Deload')
    expect(result.sets.every(s => !s.isAmrap)).toBe(true)
  })

  it('rounds to nearest 2.5kg', () => {
    const result = fiveThreeOneSkill.execute({ trainingMaxKg: 97, weekInCycle: 1 })
    expect(result.sets[0].weightKg).toBe(62.5)
    expect(result.sets[1].weightKg).toBe(72.5)
    expect(result.sets[2].weightKg).toBe(82.5)
  })

  it('validates input schema rejects negative weight', () => {
    expect(() => fiveThreeOneSkill.inputSchema.parse({ trainingMaxKg: -10, weekInCycle: 1 })).toThrow()
  })
})
