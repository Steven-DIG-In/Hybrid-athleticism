import { describe, it, expect } from 'vitest'
import { interferenceCheckerSkill } from '../domains/shared/interference-checker'

describe('interference-checker skill', () => {
  it('has correct metadata', () => {
    expect(interferenceCheckerSkill.name).toBe('interference-checker')
    expect(interferenceCheckerSkill.domain).toBe('shared')
    expect(interferenceCheckerSkill.tier).toBe(1)
  })

  it('returns clean with no violations for empty sessions', () => {
    const result = interferenceCheckerSkill.execute({ sessions: [] })
    expect(result.violations).toHaveLength(0)
    expect(result.isClean).toBe(true)
  })

  it('returns clean when sessions are well-spaced', () => {
    const result = interferenceCheckerSkill.execute({
      sessions: [
        { date: '2024-01-01T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: false },
        { date: '2024-01-03T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: false },
        { date: '2024-01-02T08:00:00Z', modality: 'CARDIO', domain: 'endurance', isHeavyLegs: false },
        { date: '2024-01-04T08:00:00Z', modality: 'CARDIO', domain: 'endurance', isHeavyLegs: false },
      ],
    })
    expect(result.isClean).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('flags strength_spacing when two LIFTING sessions are less than 48 hours apart', () => {
    const result = interferenceCheckerSkill.execute({
      sessions: [
        { date: '2024-01-01T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: false },
        { date: '2024-01-02T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: false },
      ],
    })
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].type).toBe('strength_spacing')
    expect(result.violations[0].hoursGap).toBe(24)
    expect(result.isClean).toBe(false)
  })

  it('does not flag strength_spacing when LIFTING sessions are exactly 48 hours apart', () => {
    const result = interferenceCheckerSkill.execute({
      sessions: [
        { date: '2024-01-01T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: false },
        { date: '2024-01-03T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: false },
      ],
    })
    expect(result.violations).toHaveLength(0)
    expect(result.isClean).toBe(true)
  })

  it('flags cardio_spacing when two CARDIO sessions are less than 24 hours apart', () => {
    const result = interferenceCheckerSkill.execute({
      sessions: [
        { date: '2024-01-01T08:00:00Z', modality: 'CARDIO', domain: 'endurance', isHeavyLegs: false },
        { date: '2024-01-01T18:00:00Z', modality: 'CARDIO', domain: 'endurance', isHeavyLegs: false },
      ],
    })
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].type).toBe('cardio_spacing')
    expect(result.violations[0].hoursGap).toBe(10)
    expect(result.isClean).toBe(false)
  })

  it('flags legs_before_run when heavy leg LIFTING and CARDIO are on the same day', () => {
    const result = interferenceCheckerSkill.execute({
      sessions: [
        { date: '2024-01-01T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: true },
        { date: '2024-01-01T17:00:00Z', modality: 'CARDIO', domain: 'endurance', isHeavyLegs: false },
      ],
    })
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].type).toBe('legs_before_run')
    expect(result.isClean).toBe(false)
  })

  it('does not flag legs_before_run when LIFTING has no heavy legs', () => {
    const result = interferenceCheckerSkill.execute({
      sessions: [
        { date: '2024-01-01T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: false },
        { date: '2024-01-01T17:00:00Z', modality: 'CARDIO', domain: 'endurance', isHeavyLegs: false },
      ],
    })
    const legsViolations = result.violations.filter(v => v.type === 'legs_before_run')
    expect(legsViolations).toHaveLength(0)
  })

  it('does not flag legs_before_run when heavy legs lifting and cardio are on different days', () => {
    const result = interferenceCheckerSkill.execute({
      sessions: [
        { date: '2024-01-01T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: true },
        { date: '2024-01-02T08:00:00Z', modality: 'CARDIO', domain: 'endurance', isHeavyLegs: false },
      ],
    })
    const legsViolations = result.violations.filter(v => v.type === 'legs_before_run')
    expect(legsViolations).toHaveLength(0)
  })

  it('can detect multiple violations across a full week', () => {
    const result = interferenceCheckerSkill.execute({
      sessions: [
        { date: '2024-01-01T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: true },
        { date: '2024-01-01T17:00:00Z', modality: 'CARDIO', domain: 'endurance', isHeavyLegs: false }, // legs_before_run
        { date: '2024-01-02T08:00:00Z', modality: 'LIFTING', domain: 'strength', isHeavyLegs: false }, // strength_spacing (24h)
      ],
    })
    expect(result.violations.length).toBeGreaterThanOrEqual(2)
    expect(result.isClean).toBe(false)
  })
})
