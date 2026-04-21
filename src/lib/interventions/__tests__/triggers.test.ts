import { describe, it, expect } from 'vitest'
import { shouldFireBlockEnd } from '../block-end-trigger'
import { shouldFireRollingPattern } from '../rolling-pattern-trigger'

describe('trigger gates', () => {
  it('shouldFireBlockEnd: true if any coach has >5% mean magnitude', () => {
    expect(shouldFireBlockEnd({ coach: 'strength', meanMagnitudePct: 7 })).toBe(true)
    expect(shouldFireBlockEnd({ coach: 'strength', meanMagnitudePct: 3 })).toBe(false)
  })
  it('shouldFireRollingPattern: false when cooldown not cleared', () => {
    const now = new Date('2026-04-20T00:00:00Z')
    const recentFiring = new Date('2026-04-18T00:00:00Z').toISOString()
    expect(shouldFireRollingPattern({
      lastFiredAt: recentFiring, now, hasPatternSignal: true,
    })).toBe(false)
    expect(shouldFireRollingPattern({
      lastFiredAt: null, now, hasPatternSignal: true,
    })).toBe(true)
    expect(shouldFireRollingPattern({
      lastFiredAt: null, now, hasPatternSignal: false,
    })).toBe(false)
  })
})
