import { describe, it, expect, beforeEach, vi } from 'vitest'

type Series = { created_at: string; delta_pct: number; session_inventory_id: string }[]

const { seriesMock, lastInterventionMock, savedInterventions } = vi.hoisted(() => ({
  seriesMock: { value: [] as Series },
  lastInterventionMock: { value: null as { created_at: string } | null },
  savedInterventions: [] as any[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Mock the server client to return the cooldown lookup result.
vi.mock('@/lib/supabase/server', () => {
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(function chain() {
          return {
            eq: vi.fn(function chain2() {
              return {
                eq: vi.fn(function chain3() {
                  return {
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                          data: lastInterventionMock.value,
                          error: null,
                        })),
                      })),
                    })),
                  }
                }),
              }
            }),
          }
        }),
      })),
      insert: vi.fn((row: any) => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { id: `iv${savedInterventions.length + 1}` },
            error: null,
          })),
        })),
      })),
    })),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }
  return { createClient: vi.fn(async () => client) }
})

// Mock the shared helper so we control what getRecentCoachDeltaSeries returns.
vi.mock('@/lib/analytics/shared/coach-domain', async () => {
  const actual: any = await vi.importActual('@/lib/analytics/shared/coach-domain')
  return {
    ...actual,
    getRecentCoachDeltaSeries: vi.fn(async () => seriesMock.value),
  }
})

// Mock the save action so we can assert on what's written.
vi.mock('@/lib/actions/ai-coach.actions', () => ({
  saveCoachIntervention: vi.fn(async (input: any) => {
    savedInterventions.push(input)
    return { success: true, data: { id: `iv${savedInterventions.length}` } }
  }),
}))

import { evaluateAndFirePattern } from '../rolling-pattern-trigger'

function makeSeries(deltaPct: number): Series {
  return [
    { delta_pct: deltaPct, session_inventory_id: 's1', created_at: '2026-04-20T12:00:00Z' },
    { delta_pct: deltaPct, session_inventory_id: 's2', created_at: '2026-04-20T11:00:00Z' },
    { delta_pct: deltaPct, session_inventory_id: 's3', created_at: '2026-04-20T10:00:00Z' },
  ]
}

describe('evaluateAndFirePattern', () => {
  beforeEach(() => {
    seriesMock.value = []
    lastInterventionMock.value = null
    savedInterventions.length = 0
    vi.clearAllMocks()
  })

  it('3 consecutive -12% deltas fire a rolling_pattern intervention', async () => {
    seriesMock.value = makeSeries(-12)
    const res = await evaluateAndFirePattern('u1', 'endurance', 'mc1')
    expect(res.fired).toBe(true)
    expect(savedInterventions).toHaveLength(1)
    expect(savedInterventions[0]).toMatchObject({
      microcycleId: 'mc1',
      triggerType: 'rolling_pattern',
      coachDomain: 'endurance',
    })
    expect(savedInterventions[0].patternSignal).toMatchObject({
      direction: 'under',
      workoutIds: ['s1', 's2', 's3'],
    })
  })

  it('3 consecutive +12% deltas fire an over-performance rolling_pattern', async () => {
    seriesMock.value = makeSeries(12)
    const res = await evaluateAndFirePattern('u1', 'endurance', 'mc1')
    expect(res.fired).toBe(true)
    expect(savedInterventions[0].patternSignal.direction).toBe('over')
  })

  it('cooldown blocks second fire within 7 days', async () => {
    seriesMock.value = makeSeries(-12)
    // Last fire was 2 days ago — cooldown not cleared (7-day window).
    lastInterventionMock.value = {
      created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    }
    const res = await evaluateAndFirePattern('u1', 'endurance', 'mc1')
    expect(res.fired).toBe(false)
    expect(savedInterventions).toHaveLength(0)
  })

  it('mixed directions return no pattern, no fire', async () => {
    seriesMock.value = [
      { delta_pct: -12, session_inventory_id: 's1', created_at: '2026-04-20T12:00:00Z' },
      { delta_pct: 11, session_inventory_id: 's2', created_at: '2026-04-20T11:00:00Z' },
      { delta_pct: -13, session_inventory_id: 's3', created_at: '2026-04-20T10:00:00Z' },
    ]
    const res = await evaluateAndFirePattern('u1', 'endurance', 'mc1')
    expect(res.fired).toBe(false)
    expect(savedInterventions).toHaveLength(0)
  })

  it('deltas below threshold (< 10%) do not fire', async () => {
    seriesMock.value = makeSeries(-8)
    const res = await evaluateAndFirePattern('u1', 'endurance', 'mc1')
    expect(res.fired).toBe(false)
    expect(savedInterventions).toHaveLength(0)
  })

  it('fires when last intervention was > 7 days ago (cooldown cleared)', async () => {
    seriesMock.value = makeSeries(-12)
    lastInterventionMock.value = {
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    }
    const res = await evaluateAndFirePattern('u1', 'endurance', 'mc1')
    expect(res.fired).toBe(true)
    expect(savedInterventions).toHaveLength(1)
  })
})
