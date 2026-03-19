// src/lib/coaches/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest'
import { CoachRegistry } from '../registry'
import type { CoachConfig } from '../types'

const mockConfig: CoachConfig = {
  id: 'strength',
  persona: { name: 'Test Coach', title: 'Strength', bio: 'test', voiceGuidelines: 'direct' },
  methodology: { philosophy: 'test', principles: ['lift heavy'], references: ['5/3/1'] },
  assignedSkills: ['531-progression', 'training-max-estimation'],
  checkIn: {
    assessmentPrompt: 'test',
    signalWeights: {
      rpeDeviation: 0.9, rirDeviation: 0.8, completionRate: 0.5,
      earlyCompletion: 0.3, missedSessions: 0.7, selfReportEnergy: 0.4,
      selfReportSoreness: 0.6, selfReportSleep: 0.3, selfReportStress: 0.2,
      selfReportMotivation: 0.3,
    },
  },
  governance: {
    tier1Auto: ['weight_progression'],
    tier2CoachDecides: ['exercise_swap'],
    tier3AthleteConfirms: ['add_remove_session'],
  },
  alwaysActive: false,
}

describe('CoachRegistry', () => {
  it('registers and retrieves a coach config', () => {
    const registry = new CoachRegistry()
    registry.register(mockConfig)
    expect(registry.getCoach('strength')?.persona.name).toBe('Test Coach')
  })

  it('returns all coaches', () => {
    const registry = new CoachRegistry()
    registry.register(mockConfig)
    expect(registry.getAllCoaches()).toHaveLength(1)
  })

  it('returns always-active coaches', () => {
    const registry = new CoachRegistry()
    registry.register(mockConfig)
    registry.register({ ...mockConfig, id: 'recovery', alwaysActive: true })
    expect(registry.getAlwaysActiveCoaches()).toHaveLength(1)
    expect(registry.getAlwaysActiveCoaches()[0].id).toBe('recovery')
  })

  it('returns selectable coaches', () => {
    const registry = new CoachRegistry()
    registry.register(mockConfig)
    registry.register({ ...mockConfig, id: 'recovery', alwaysActive: true })
    expect(registry.getSelectableCoaches()).toHaveLength(1)
    expect(registry.getSelectableCoaches()[0].id).toBe('strength')
  })
})
