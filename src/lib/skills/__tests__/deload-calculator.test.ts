import { describe, it, expect } from 'vitest'
import { deloadCalculatorSkill } from '../domains/shared/deload-calculator'

describe('deload-calculator skill', () => {
  it('has correct metadata', () => {
    expect(deloadCalculatorSkill.name).toBe('deload-calculator')
    expect(deloadCalculatorSkill.domain).toBe('shared')
    expect(deloadCalculatorSkill.tier).toBe(1)
  })

  it('strength deload: applies 60% intensity and 50% volume', () => {
    const result = deloadCalculatorSkill.execute({
      domain: 'strength',
      currentIntensity: 100,
      currentVolumeSets: 20,
    })
    expect(result.deloadIntensity).toBe(60)
    expect(result.deloadVolumeSets).toBe(10)
    expect(result.intensityMultiplier).toBe(0.6)
    expect(result.volumeMultiplier).toBe(0.5)
  })

  it('endurance deload: applies 70% intensity and 50% volume', () => {
    const result = deloadCalculatorSkill.execute({
      domain: 'endurance',
      currentIntensity: 200,
      currentVolumeSets: 10,
    })
    expect(result.deloadIntensity).toBe(140)
    expect(result.deloadVolumeSets).toBe(5)
    expect(result.intensityMultiplier).toBe(0.7)
  })

  it('hypertrophy deload: applies 60% intensity and 60% volume', () => {
    const result = deloadCalculatorSkill.execute({
      domain: 'hypertrophy',
      currentIntensity: 100,
      currentVolumeSets: 20,
    })
    expect(result.deloadIntensity).toBe(60)
    expect(result.deloadVolumeSets).toBe(12)
  })

  it('conditioning deload: applies 50% intensity and 50% volume', () => {
    const result = deloadCalculatorSkill.execute({
      domain: 'conditioning',
      currentIntensity: 80,
      currentVolumeSets: 16,
    })
    expect(result.deloadIntensity).toBe(40)
    expect(result.deloadVolumeSets).toBe(8)
  })

  it('mobility deload: no change (1.0 multipliers)', () => {
    const result = deloadCalculatorSkill.execute({
      domain: 'mobility',
      currentIntensity: 70,
      currentVolumeSets: 10,
    })
    expect(result.deloadIntensity).toBe(70)
    expect(result.deloadVolumeSets).toBe(10)
    expect(result.intensityMultiplier).toBe(1.0)
    expect(result.volumeMultiplier).toBe(1.0)
  })

  it('recovery domain: no change (1.0 multipliers)', () => {
    const result = deloadCalculatorSkill.execute({
      domain: 'recovery',
      currentIntensity: 50,
      currentVolumeSets: 8,
    })
    expect(result.deloadIntensity).toBe(50)
    expect(result.deloadVolumeSets).toBe(8)
  })

  it('custom multipliers override defaults', () => {
    const result = deloadCalculatorSkill.execute({
      domain: 'strength',
      currentIntensity: 100,
      currentVolumeSets: 20,
      customMultipliers: { intensity: 0.75, volume: 0.4 },
    })
    expect(result.deloadIntensity).toBe(75)
    expect(result.deloadVolumeSets).toBe(8)
    expect(result.intensityMultiplier).toBe(0.75)
    expect(result.volumeMultiplier).toBe(0.4)
  })

  it('returns the domain in output', () => {
    const result = deloadCalculatorSkill.execute({
      domain: 'strength',
      currentIntensity: 100,
      currentVolumeSets: 10,
    })
    expect(result.domain).toBe('strength')
  })
})
