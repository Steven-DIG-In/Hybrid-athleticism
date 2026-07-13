import { describe, it, expect, beforeEach, vi } from 'vitest'

const { fixtures } = vi.hoisted(() => ({
  fixtures: {
    workouts: [] as any[],
    cardioLogs: [] as any[],
  },
}))

vi.mock('@/lib/supabase/server', () => {
  const handler = (table: string) => {
    if (table === 'workouts') return makeQuery(() => fixtures.workouts)
    if (table === 'cardio_logs') return makeQuery(() => fixtures.cardioLogs)
    return makeQuery(() => [])
  }
  const client = { from: vi.fn(handler) }
  return { createClient: vi.fn(async () => client) }
})

function makeQuery(getRows: () => any[]) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: getRows(), error: null }).then(resolve, reject),
  }
  return chain
}

import { getRecentEnduranceDeltaSeries } from '../endurance-series'

const USER = 'u1'

const RUNNING_PRESCRIPTION = {
  modality: 'running',
  intensityZone: 'tempo',
  targetDistanceKm: 8,
  targetDurationMin: 45,
  targetPaceSecPerKm: 340,
  ruckWeightKg: null,
  intervalStructure: null,
  source: 'formula',
  paceSource: 'VDOT 38 → tempo 5:40/km',
  notes: null,
}

const RUCKING_PRESCRIPTION = {
  modality: 'rucking',
  intensityZone: 'easy',
  targetDistanceKm: 6,
  targetDurationMin: 60,
  targetPaceSecPerKm: null,
  ruckWeightKg: 20,
  intervalStructure: null,
  source: 'ai',
  notes: null,
}

function resetFixtures() {
  fixtures.workouts = []
  fixtures.cardioLogs = []
}

function seedRunningSession(id: string, completedAt: string, avgPaceSecPerKm: number) {
  fixtures.workouts.push({ id, completed_at: completedAt, endurance_prescription: RUNNING_PRESCRIPTION })
  fixtures.cardioLogs.push({
    workout_id: id,
    distance_km: 8,
    duration_minutes: 46,
    avg_pace_sec_per_km: avgPaceSecPerKm,
    avg_heart_rate_bpm: 152,
    perceived_effort_rpe: 6,
  })
}

function seedRuckingSession(id: string, completedAt: string, durationMinutes: number) {
  fixtures.workouts.push({ id, completed_at: completedAt, endurance_prescription: RUCKING_PRESCRIPTION })
  fixtures.cardioLogs.push({
    workout_id: id,
    distance_km: 6,
    duration_minutes: durationMinutes,
    avg_pace_sec_per_km: null,
    avg_heart_rate_bpm: 130,
    perceived_effort_rpe: 4,
  })
}

describe('getRecentEnduranceDeltaSeries', () => {
  beforeEach(() => {
    resetFixtures()
    vi.clearAllMocks()
  })

  it('1: empty array when there are no completed cardio workouts', async () => {
    const points = await getRecentEnduranceDeltaSeries(USER)
    expect(points).toEqual([])
  })

  it('2: N completed cardio sessions produce N points, oldest-first', async () => {
    // workouts arrive newest-first from the query (order by completed_at desc)
    seedRunningSession('w3', '2026-07-03T10:00:00Z', 340)
    seedRuckingSession('w2', '2026-07-02T10:00:00Z', 60)
    seedRunningSession('w1', '2026-07-01T10:00:00Z', 340)

    const points = await getRecentEnduranceDeltaSeries(USER, { limit: 20 })
    expect(points).toHaveLength(3)
    // reversed to oldest-first for the chart
    expect(points.map(p => p.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
  })

  it('3: running session primary metric is pace delta %', async () => {
    // prescribed pace 340s/km, actual 357.0s/km → +5%
    seedRunningSession('w1', '2026-07-01T10:00:00Z', 357)

    const points = await getRecentEnduranceDeltaSeries(USER)
    expect(points).toHaveLength(1)
    expect(points[0]).toEqual({ date: '2026-07-01', delta_pct: 5 })
  })

  it('4: non-running (rucking) session primary metric is duration delta %', async () => {
    // prescribed 60 min, actual 66 min → +10%
    seedRuckingSession('w1', '2026-07-01T10:00:00Z', 66)

    const points = await getRecentEnduranceDeltaSeries(USER)
    expect(points).toHaveLength(1)
    expect(points[0]).toEqual({ date: '2026-07-01', delta_pct: 10 })
  })

  it('5: completed cardio workout with no matching cardio_logs row is excluded (unlogged, not on-target)', async () => {
    fixtures.workouts.push({ id: 'w1', completed_at: '2026-07-01T10:00:00Z', endurance_prescription: RUNNING_PRESCRIPTION })
    // no matching fixtures.cardioLogs entry

    const points = await getRecentEnduranceDeltaSeries(USER)
    expect(points).toEqual([])
  })
})
