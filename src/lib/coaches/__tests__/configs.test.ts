import { describe, it, expect } from 'vitest'
import { coachRegistry } from '../index'
import { skillRegistry } from '@/lib/skills'

describe('Coach configs', () => {
  it('registers all 6 coaches', () => {
    expect(coachRegistry.getAllCoaches()).toHaveLength(6)
  })

  it('has 2 always-active coaches (mobility, recovery)', () => {
    const alwaysActive = coachRegistry.getAlwaysActiveCoaches()
    expect(alwaysActive).toHaveLength(2)
    const ids = alwaysActive.map(c => c.id)
    expect(ids).toContain('mobility')
    expect(ids).toContain('recovery')
  })

  it('has 4 selectable coaches', () => {
    expect(coachRegistry.getSelectableCoaches()).toHaveLength(4)
  })

  it('every assigned skill exists in the skill registry', () => {
    for (const coach of coachRegistry.getAllCoaches()) {
      for (const skillName of coach.assignedSkills) {
        expect(skillRegistry.getSkill(skillName), `${coach.id} references unknown skill: ${skillName}`).toBeDefined()
      }
    }
  })

  it('every coach has non-empty persona fields', () => {
    for (const coach of coachRegistry.getAllCoaches()) {
      expect(coach.persona.name.length).toBeGreaterThan(0)
      expect(coach.persona.bio.length).toBeGreaterThan(0)
      expect(coach.persona.voiceGuidelines.length).toBeGreaterThan(0)
    }
  })

  it('every coach has governance tiers defined', () => {
    for (const coach of coachRegistry.getAllCoaches()) {
      expect(coach.governance.tier1Auto.length).toBeGreaterThan(0)
      expect(coach.governance.tier2CoachDecides.length).toBeGreaterThan(0)
      expect(coach.governance.tier3AthleteConfirms.length).toBeGreaterThan(0)
    }
  })

  it('signal weights are all between 0 and 1', () => {
    for (const coach of coachRegistry.getAllCoaches()) {
      for (const [key, value] of Object.entries(coach.checkIn.signalWeights)) {
        expect(value, `${coach.id}.${key}`).toBeGreaterThanOrEqual(0)
        expect(value, `${coach.id}.${key}`).toBeLessThanOrEqual(1)
      }
    }
  })
})
