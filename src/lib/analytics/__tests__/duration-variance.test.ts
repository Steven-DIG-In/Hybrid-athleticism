import { describe, it, expect } from 'vitest'
import { aggregateDurationVariance } from '../duration-variance'

describe('aggregateDurationVariance', () => {
  it('groups by coach and computes overrun %', () => {
    const rows = [
      { coach_domain: 'strength', estimated: 60, actual: 75 },
      { coach_domain: 'strength', estimated: 45, actual: 60 },
      { coach_domain: 'endurance', estimated: 60, actual: 55 },
    ]
    const agg = aggregateDurationVariance(rows)
    expect(agg.strength.overrunPct).toBeCloseTo(28.57, 1)  // (135-105)/105
    expect(agg.endurance.overrunPct).toBeCloseTo(-8.33, 1)
  })
})
