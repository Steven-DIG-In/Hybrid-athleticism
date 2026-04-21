import { describe, it, expect } from 'vitest'
import { computeOffPlanTally, linkedDomainForModality } from '../off-plan-tally'

describe('off-plan-tally', () => {
  it('groups off-plan sessions by modality and flags count_toward_load', () => {
    const rows = [
      { modality: 'run', count_toward_load: true },
      { modality: 'run', count_toward_load: true },
      { modality: 'strength', count_toward_load: false },
      { modality: 'conditioning', count_toward_load: true },
    ]
    const t = computeOffPlanTally(rows)
    expect(t.byModality.run.count).toBe(2)
    expect(t.byModality.run.countTowardLoad).toBe(2)
    expect(t.byModality.strength.countTowardLoad).toBe(0)
    expect(t.total).toBe(4)
  })
  it('linkedDomainForModality maps modalities', () => {
    expect(linkedDomainForModality('run')).toBe('endurance')
    expect(linkedDomainForModality('ride')).toBe('endurance')
    expect(linkedDomainForModality('strength')).toBe('strength')
    expect(linkedDomainForModality('conditioning')).toBe('conditioning')
    expect(linkedDomainForModality('other')).toBeNull()
  })
})
