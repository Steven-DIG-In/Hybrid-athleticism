// src/lib/reports/__tests__/doctor-report-builder.test.ts
import { describe, it, expect } from 'vitest'
import { resolveWindow } from '../doctor-report-builder'

describe('resolveWindow', () => {
  it('6mo default', () => {
    const w = resolveWindow({ preset: '6mo', now: new Date('2026-04-20') })
    expect(w.start).toBe('2025-10-20')
    expect(w.end).toBe('2026-04-20')
    expect(w.preset).toBe('6mo')
  })
  it('3mo', () => {
    const w = resolveWindow({ preset: '3mo', now: new Date('2026-04-20') })
    expect(w.start).toBe('2026-01-20')
  })
  it('12mo', () => {
    const w = resolveWindow({ preset: '12mo', now: new Date('2026-04-20') })
    expect(w.start).toBe('2025-04-20')
  })
  it('custom uses provided range', () => {
    const w = resolveWindow({ preset: 'custom', start: '2025-12-01', end: '2026-03-31' })
    expect(w.start).toBe('2025-12-01')
    expect(w.end).toBe('2026-03-31')
  })
})
