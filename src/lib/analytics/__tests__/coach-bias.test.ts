import { describe, it, expect } from 'vitest'
import { classifyRAG, detectPattern, isCooldownClear } from '../coach-bias'

describe('coach-bias', () => {
  it('classifyRAG: >10% mean delta is red, >5% amber, else green', () => {
    expect(classifyRAG([12, 14, 11])).toBe('red')
    expect(classifyRAG([6, 7, 8])).toBe('amber')
    expect(classifyRAG([2, 3, 1])).toBe('green')
  })
  it('classifyRAG: insufficient data returns insufficient', () => {
    expect(classifyRAG([])).toBe('insufficient')
    expect(classifyRAG([12])).toBe('insufficient')
  })
  it('detectPattern: 3+ consecutive same-direction >10% deltas flags', () => {
    const flag = detectPattern([
      { delta_pct: -12, workout_id: 'a' },
      { delta_pct: -14, workout_id: 'b' },
      { delta_pct: -11, workout_id: 'c' },
    ])
    expect(flag).not.toBeNull()
    expect(flag?.direction).toBe('under')
    expect(flag?.workoutIds).toEqual(['a', 'b', 'c'])
  })
  it('detectPattern: mixed directions return null', () => {
    const flag = detectPattern([
      { delta_pct: -12, workout_id: 'a' },
      { delta_pct: 14, workout_id: 'b' },
      { delta_pct: -11, workout_id: 'c' },
    ])
    expect(flag).toBeNull()
  })
  it('isCooldownClear: false within 7 days, true after', () => {
    const now = new Date('2026-04-20T12:00:00Z')
    const recent = new Date('2026-04-18T12:00:00Z').toISOString()
    const old = new Date('2026-04-10T12:00:00Z').toISOString()
    expect(isCooldownClear({ lastFiredAt: recent, now })).toBe(false)
    expect(isCooldownClear({ lastFiredAt: old, now })).toBe(true)
    expect(isCooldownClear({ lastFiredAt: null, now })).toBe(true)
  })
})
