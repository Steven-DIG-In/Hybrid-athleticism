import { describe, it, expect } from 'vitest'
import { progressionEngineSkill } from '../domains/strength/progression-engine'

const base = {
  exerciseName: 'squat',
  prescribedWeightKg: 100,
  prescribedReps: 5,
  prescribedRpe: 8,
  actualWeightKg: 100,
  actualReps: 5,
  actualRpe: 8,
}

describe('progression-engine skill', () => {
  it('has correct metadata', () => {
    expect(progressionEngineSkill.name).toBe('progression-engine')
    expect(progressionEngineSkill.domain).toBe('strength')
    expect(progressionEngineSkill.tier).toBe(1)
  })

  it('increases weight when repsDelta >= 2 AND rpeDelta <= -1', () => {
    // actualReps = 7 (delta +2), actualRpe = 7 (delta -1) → increase
    const result = progressionEngineSkill.execute({
      ...base,
      actualReps: 7,
      actualRpe: 7,
    })
    expect(result.adjustment).toBe('increase')
    expect(result.nextWeightKg).toBe(105) // lower body 5kg increment
    expect(result.incrementKg).toBe(5)
  })

  it('uses 2.5kg increment for upper body exercises', () => {
    const result = progressionEngineSkill.execute({
      ...base,
      exerciseName: 'bench press',
      actualReps: 7,
      actualRpe: 7,
    })
    expect(result.adjustment).toBe('increase')
    expect(result.nextWeightKg).toBe(102.5)
    expect(result.incrementKg).toBe(2.5)
  })

  it('decreases weight when repsDelta <= -2', () => {
    const result = progressionEngineSkill.execute({
      ...base,
      actualReps: 3, // delta -2
      actualRpe: 8,
    })
    expect(result.adjustment).toBe('decrease')
    expect(result.nextWeightKg).toBe(95) // lower body -5kg
  })

  it('decreases when rpeDelta >= 2 AND repsDelta < 0', () => {
    const result = progressionEngineSkill.execute({
      ...base,
      actualReps: 4, // delta -1
      actualRpe: 10, // delta +2
    })
    expect(result.adjustment).toBe('decrease')
  })

  it('maintains weight when performance matches prescription', () => {
    const result = progressionEngineSkill.execute(base)
    expect(result.adjustment).toBe('maintain')
    expect(result.nextWeightKg).toBe(100)
    expect(result.incrementKg).toBe(0)
  })

  it('maintains when repsDelta >= 2 but rpeDelta > -1', () => {
    // repsDelta = +2 but rpeDelta = 0 → not increase (rpeDelta must be <= -1)
    const result = progressionEngineSkill.execute({
      ...base,
      actualReps: 7, // delta +2
      actualRpe: 8,  // delta 0
    })
    expect(result.adjustment).toBe('maintain')
  })

  it('includes exerciseName in output', () => {
    const result = progressionEngineSkill.execute(base)
    expect(result.exerciseName).toBe('squat')
  })

  it('includes a reason string in output', () => {
    const result = progressionEngineSkill.execute(base)
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('classifies deadlift as lower body', () => {
    const result = progressionEngineSkill.execute({
      ...base,
      exerciseName: 'deadlift',
      actualReps: 7,
      actualRpe: 7,
    })
    expect(result.incrementKg).toBe(5)
  })

  it('classifies lunge as lower body', () => {
    const result = progressionEngineSkill.execute({
      ...base,
      exerciseName: 'lunge',
      actualReps: 7,
      actualRpe: 7,
    })
    expect(result.incrementKg).toBe(5)
  })

  it('classifies hip thrust as lower body', () => {
    const result = progressionEngineSkill.execute({
      ...base,
      exerciseName: 'hip thrust',
      actualReps: 7,
      actualRpe: 7,
    })
    expect(result.incrementKg).toBe(5)
  })

  it('rejects missing required fields', () => {
    expect(() =>
      progressionEngineSkill.inputSchema.parse({ exerciseName: 'squat' }),
    ).toThrow()
  })
})
