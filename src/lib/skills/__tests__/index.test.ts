import { describe, it, expect } from 'vitest'
import { skillRegistry } from '../index'

describe('Global skill registry', () => {
  it('has all 11 skills registered', () => {
    expect(skillRegistry.getAllSkills()).toHaveLength(11)
  })

  it('has 3 strength skills', () => {
    expect(skillRegistry.getSkillsForDomain('strength')).toHaveLength(3)
  })

  it('has 2 hypertrophy skills', () => {
    expect(skillRegistry.getSkillsForDomain('hypertrophy')).toHaveLength(2)
  })

  it('has 2 endurance skills', () => {
    expect(skillRegistry.getSkillsForDomain('endurance')).toHaveLength(2)
  })

  it('has 1 conditioning skill', () => {
    expect(skillRegistry.getSkillsForDomain('conditioning')).toHaveLength(1)
  })

  it('has 1 recovery skill', () => {
    expect(skillRegistry.getSkillsForDomain('recovery')).toHaveLength(1)
  })

  it('has 2 shared skills', () => {
    expect(skillRegistry.getSkillsForDomain('shared')).toHaveLength(2)
  })
})
