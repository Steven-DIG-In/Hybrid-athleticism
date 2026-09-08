import { describe, it, expect } from 'vitest'
import { evaluateCheckInTrigger, ALLOCATION_WINDOW_DAYS } from '../trigger'

const START = new Date('2026-09-01T09:00:00Z')
const days = (n: number) => new Date(START.getTime() + n * 24 * 60 * 60 * 1000)

function evaluate(over: Partial<Parameters<typeof evaluateCheckInTrigger>[0]> = {}) {
  return evaluateCheckInTrigger({
    status: 'open',
    totalAllocated: 4,
    completed: 0,
    allocationStart: START,
    now: days(1),
    ...over,
  })
}

describe('evaluateCheckInTrigger', () => {
  it('is not due mid-week with sessions outstanding', () => {
    const d = evaluate({ completed: 2, now: days(3) })
    expect(d.due).toBe(false)
    expect(d.reason).toBe('Trigger conditions not yet met')
  })

  it('is due as soon as every allocated session is completed', () => {
    const d = evaluate({ completed: 4, now: days(3) })
    expect(d.due).toBe(true)
    expect(d.reason).toBe('All allocated sessions completed')
    expect(d.missedSessions).toBe(0)
  })

  it('flags early completion only when the window has NOT elapsed', () => {
    expect(evaluate({ completed: 4, now: days(3) }).earlyCompletion).toBe(true)
    // Finished everything, but not until after the window closed — no bonus signal.
    expect(evaluate({ completed: 4, now: days(9) }).earlyCompletion).toBe(false)
  })

  it('is due once the allocation window elapses, and counts what was missed', () => {
    const d = evaluate({ completed: 1, now: days(ALLOCATION_WINDOW_DAYS) })
    expect(d.due).toBe(true)
    expect(d.reason).toContain('window elapsed')
    expect(d.missedSessions).toBe(3)
    expect(d.earlyCompletion).toBe(false)
  })

  it('treats the window boundary as inclusive', () => {
    const justBefore = ALLOCATION_WINDOW_DAYS - 0.001
    expect(evaluate({ now: days(justBefore) }).due).toBe(false)
    expect(evaluate({ now: days(ALLOCATION_WINDOW_DAYS) }).due).toBe(true)
  })

  it('never reports negative missed sessions when more was completed than allocated', () => {
    const d = evaluate({ totalAllocated: 2, completed: 5, now: days(9) })
    expect(d.missedSessions).toBe(0)
  })

  it('is not due for a week with nothing allocated until the window elapses', () => {
    // totalAllocated 0 must not satisfy "all completed" — that would fire a check-in
    // for a week the athlete was never given any sessions in.
    expect(evaluate({ totalAllocated: 0, completed: 0, now: days(1) }).due).toBe(false)
    expect(evaluate({ totalAllocated: 0, completed: 0, now: days(8) }).due).toBe(true)
  })

  it('refuses to re-trigger a window that is already triggered or completed', () => {
    for (const status of ['triggered', 'completed'] as const) {
      const d = evaluate({ status, completed: 4, now: days(9) })
      expect(d.due).toBe(false)
      expect(d.reason).toContain(status)
    }
  })
})
