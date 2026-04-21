import { describe, it, expect } from 'vitest'
import { modalityToCoachDomain } from '../coach-domain'

describe('modalityToCoachDomain', () => {
  it('maps session_inventory.modality values to coach domain', () => {
    expect(modalityToCoachDomain('strength')).toBe('strength')
    expect(modalityToCoachDomain('hypertrophy')).toBe('hypertrophy')
    expect(modalityToCoachDomain('endurance')).toBe('endurance')
    expect(modalityToCoachDomain('run')).toBe('endurance')
    expect(modalityToCoachDomain('ride')).toBe('endurance')
    expect(modalityToCoachDomain('conditioning')).toBe('conditioning')
    expect(modalityToCoachDomain('metcon')).toBe('conditioning')
    expect(modalityToCoachDomain('mobility')).toBe('mobility')
    expect(modalityToCoachDomain('recovery')).toBe('recovery')
    expect(modalityToCoachDomain('unknown')).toBeNull()
  })

  it('maps uppercase workout_modality enum values to coach domain', () => {
    expect(modalityToCoachDomain('LIFTING')).toBe('strength')
    expect(modalityToCoachDomain('CARDIO')).toBe('endurance')
    expect(modalityToCoachDomain('RUCKING')).toBe('endurance')
    expect(modalityToCoachDomain('METCON')).toBe('conditioning')
    expect(modalityToCoachDomain('MOBILITY')).toBe('mobility')
  })
})
