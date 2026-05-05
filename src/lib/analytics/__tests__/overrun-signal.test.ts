import { describe, it, expect, beforeEach, vi } from 'vitest'

const { fixtures } = vi.hoisted(() => ({
  fixtures: {
    activeMesocycle: null as any,
    profile: { id: 'u1', pending_planner_notes: null } as any,
    workouts: [] as any[],
    inventory: [] as any[],
  },
}))

vi.mock('@/lib/supabase/server', () => {
  const handler = (table: string) => {
    if (table === 'mesocycles') {
      return makeQuery(() => fixtures.activeMesocycle ? [fixtures.activeMesocycle] : [])
    }
    if (table === 'profiles') {
      return makeQuery(() => fixtures.profile ? [fixtures.profile] : [])
    }
    if (table === 'workouts') {
      return makeQuery(() => fixtures.workouts)
    }
    if (table === 'session_inventory') {
      return makeQuery(() => fixtures.inventory)
    }
    return makeQuery(() => [])
  }
  const client = {
    from: vi.fn(handler),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  }
  return { createClient: vi.fn(async () => client) }
})

function makeQuery(getRows: () => any[]) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    not: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: getRows()[0] ?? null, error: null })),
    single: vi.fn(async () => ({ data: getRows()[0] ?? null, error: null })),
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: getRows(), error: null }).then(resolve, reject),
  }
  return chain
}

import { evaluateOverrunSignal } from '../overrun-signal'

const USER = 'u1'

function resetFixtures() {
  fixtures.activeMesocycle = null
  fixtures.profile = { id: USER, pending_planner_notes: null }
  fixtures.workouts = []
  fixtures.inventory = []
}

function seedActive() {
  fixtures.activeMesocycle = { id: 'meso-1', user_id: USER, is_active: true, is_complete: false }
}

/** Adds an inventory row + matching workout pair with the given estimated/actual minutes. */
function seedSession(workoutId: string, estimated: number, actual: number) {
  const invId = `inv-${workoutId}`
  fixtures.inventory.push({
    id: invId, mesocycle_id: 'meso-1', user_id: USER,
    estimated_duration_minutes: estimated,
  })
  fixtures.workouts.push({
    id: workoutId, user_id: USER, session_inventory_id: invId,
    actual_duration_minutes: actual,
    completed_at: '2026-05-04T10:00:00Z',
  })
}

describe('evaluateOverrunSignal', () => {
  beforeEach(() => {
    resetFixtures()
    vi.clearAllMocks()
  })

  it('1: 3 sessions all under-budget → shouldFire false', async () => {
    seedActive()
    seedSession('w1', 60, 55)
    seedSession('w2', 60, 50)
    seedSession('w3', 60, 58)

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(false)
  })

  it('2: 3 sessions averaging +25%, +18 min → shouldFire true', async () => {
    seedActive()
    seedSession('w1', 60, 78)  // +30%, +18
    seedSession('w2', 60, 75)  // +25%, +15
    seedSession('w3', 60, 81)  // +35%, +21

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(true)
    expect(r.evidence.sessionsConsidered).toBe(3)
    expect(r.evidence.avgOverrunMinutes).toBeGreaterThanOrEqual(8)
    expect(r.evidence.avgOverrunPct).toBeGreaterThanOrEqual(20)
  })

  it('3: percentage above threshold but absolute below floor → shouldFire false', async () => {
    seedActive()
    // 15-min mobility flows running 20 min: 33% over, +5 min absolute (below 8 min floor)
    seedSession('w1', 15, 20)
    seedSession('w2', 15, 20)
    seedSession('w3', 15, 20)

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(false)
  })

  it('4: absolute above floor but percentage below threshold → shouldFire false', async () => {
    seedActive()
    // 60-min sessions running 70 min: 17% over, +10 min absolute
    seedSession('w1', 60, 70)
    seedSession('w2', 60, 70)
    seedSession('w3', 60, 70)

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(false)
  })

  it('5: signal suppressed when pending_planner_notes is non-null', async () => {
    seedActive()
    seedSession('w1', 60, 78)
    seedSession('w2', 60, 75)
    seedSession('w3', 60, 81)
    fixtures.profile = {
      id: USER,
      pending_planner_notes: { schemaVersion: 1, source: 'block_close', capturedAt: '2026-05-01T00:00:00Z' },
    }

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(false)
  })

  it('6: no active mesocycle → shouldFire false', async () => {
    // no seedActive()
    seedSession('w1', 60, 78)
    seedSession('w2', 60, 75)
    seedSession('w3', 60, 81)

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(false)
  })
})
