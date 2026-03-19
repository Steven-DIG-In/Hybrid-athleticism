import { describe, it, expect } from 'vitest'
import { conditioningScalerSkill } from '../domains/conditioning/conditioning-scaler'

describe('conditioning-scaler skill', () => {
  it('has correct metadata', () => {
    expect(conditioningScalerSkill.name).toBe('conditioning-scaler')
    expect(conditioningScalerSkill.domain).toBe('conditioning')
    expect(conditioningScalerSkill.tier).toBe(1)
  })

  it('beginner EMOM has longer rest than advanced EMOM', () => {
    const beginner = conditioningScalerSkill.execute({ format: 'EMOM', fitnessLevel: 'beginner' })
    const advanced = conditioningScalerSkill.execute({ format: 'EMOM', fitnessLevel: 'advanced' })
    expect(beginner!.restSeconds).toBeGreaterThan(advanced!.restSeconds)
  })

  it('beginner EMOM: 30w/30r, 8 rounds, 50%', () => {
    const result = conditioningScalerSkill.execute({ format: 'EMOM', fitnessLevel: 'beginner' })
    expect(result).not.toBeNull()
    expect(result!.workSeconds).toBe(30)
    expect(result!.restSeconds).toBe(30)
    expect(result!.rounds).toBe(8)
    expect(result!.loadPercentage).toBe(50)
  })

  it('advanced EMOM: 45w/15r, 16 rounds, 70%', () => {
    const result = conditioningScalerSkill.execute({ format: 'EMOM', fitnessLevel: 'advanced' })
    expect(result!.workSeconds).toBe(45)
    expect(result!.restSeconds).toBe(15)
    expect(result!.rounds).toBe(16)
    expect(result!.loadPercentage).toBe(70)
  })

  it('AMRAP beginner has more total time than advanced (scales down)', () => {
    const beginner = conditioningScalerSkill.execute({ format: 'AMRAP', fitnessLevel: 'beginner' })
    const advanced = conditioningScalerSkill.execute({ format: 'AMRAP', fitnessLevel: 'advanced' })
    expect(beginner!.workSeconds).toBeGreaterThan(advanced!.workSeconds)
  })

  it('AMRAP always has 1 round', () => {
    expect(conditioningScalerSkill.execute({ format: 'AMRAP', fitnessLevel: 'beginner' })!.rounds).toBe(1)
    expect(conditioningScalerSkill.execute({ format: 'AMRAP', fitnessLevel: 'intermediate' })!.rounds).toBe(1)
    expect(conditioningScalerSkill.execute({ format: 'AMRAP', fitnessLevel: 'advanced' })!.rounds).toBe(1)
  })

  it('TABATA always uses 20w/10r', () => {
    const beginner = conditioningScalerSkill.execute({ format: 'TABATA', fitnessLevel: 'beginner' })
    const intermediate = conditioningScalerSkill.execute({ format: 'TABATA', fitnessLevel: 'intermediate' })
    const advanced = conditioningScalerSkill.execute({ format: 'TABATA', fitnessLevel: 'advanced' })
    for (const result of [beginner, intermediate, advanced]) {
      expect(result!.workSeconds).toBe(20)
      expect(result!.restSeconds).toBe(10)
    }
  })

  it('TABATA rounds increase with fitness level: 4, 6, 8', () => {
    expect(conditioningScalerSkill.execute({ format: 'TABATA', fitnessLevel: 'beginner' })!.rounds).toBe(4)
    expect(conditioningScalerSkill.execute({ format: 'TABATA', fitnessLevel: 'intermediate' })!.rounds).toBe(6)
    expect(conditioningScalerSkill.execute({ format: 'TABATA', fitnessLevel: 'advanced' })!.rounds).toBe(8)
  })

  it('INTERVAL beginner has longer rest than advanced', () => {
    const beginner = conditioningScalerSkill.execute({ format: 'INTERVAL', fitnessLevel: 'beginner' })
    const advanced = conditioningScalerSkill.execute({ format: 'INTERVAL', fitnessLevel: 'advanced' })
    expect(beginner!.restSeconds).toBeGreaterThan(advanced!.restSeconds)
  })

  it('load percentage increases with fitness level (50, 60, 70)', () => {
    const formats = ['EMOM', 'AMRAP', 'TABATA', 'INTERVAL'] as const
    for (const format of formats) {
      const beginner = conditioningScalerSkill.execute({ format, fitnessLevel: 'beginner' })
      const intermediate = conditioningScalerSkill.execute({ format, fitnessLevel: 'intermediate' })
      const advanced = conditioningScalerSkill.execute({ format, fitnessLevel: 'advanced' })
      expect(beginner!.loadPercentage).toBe(50)
      expect(intermediate!.loadPercentage).toBe(60)
      expect(advanced!.loadPercentage).toBe(70)
    }
  })

  it('unknown format cast returns null via schema bypass', () => {
    // The execute function handles unknown formats gracefully
    // We test by calling execute directly with a cast
    const result = conditioningScalerSkill.execute({
      format: 'UNKNOWN' as 'EMOM',
      fitnessLevel: 'beginner',
    })
    expect(result).toBeNull()
  })

  it('returns format name in output', () => {
    const result = conditioningScalerSkill.execute({ format: 'EMOM', fitnessLevel: 'beginner' })
    expect(result!.format).toBe('EMOM')
  })
})
