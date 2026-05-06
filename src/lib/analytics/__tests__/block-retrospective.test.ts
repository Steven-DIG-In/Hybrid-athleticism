import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Fixture state — mutated per test ──────────────────────────────────
const { fixtures } = vi.hoisted(() => ({
  fixtures: {
    mesocycle: null as any,
    microcycles: [] as any[],
    workouts: [] as any[],
    sessionInventory: [] as any[],
    performanceDeltas: [] as any[],
    agentActivity: [] as any[],
    interventions: [] as any[],
  },
}))

vi.mock('@/lib/supabase/server', () => {
  const handler = (table: string) => {
    if (table === 'mesocycles') {
      return makeQuery(() => fixtures.mesocycle ? [fixtures.mesocycle] : [])
    }
    if (table === 'microcycles') {
      return makeQuery(() => fixtures.microcycles)
    }
    if (table === 'workouts') {
      return makeQuery(() => fixtures.workouts)
    }
    if (table === 'session_inventory') {
      return makeQuery(() => fixtures.sessionInventory)
    }
    if (table === 'performance_deltas') {
      return makeQuery(() => fixtures.performanceDeltas)
    }
    if (table === 'agent_activity') {
      return makeQuery(() => fixtures.agentActivity)
    }
    if (table === 'ai_coach_interventions') {
      return makeQuery(() => fixtures.interventions)
    }
    return makeQuery(() => [])
  }
  const client = {
    from: vi.fn(handler),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  }
  return { createClient: vi.fn(async () => client) }
})

/** Builds a thenable query chain that resolves to {data, error}. Supports
 *  chained .select().eq().eq()...  filters by ignoring filter values
 *  (fixtures already represent the post-filter result set). */
function makeQuery(getRows: () => any[]) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: getRows()[0] ?? null, error: null })),
    single: vi.fn(async () => ({ data: getRows()[0] ?? null, error: null })),
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: getRows(), error: null }).then(resolve, reject),
  }
  return chain
}

import { buildBlockRetrospectiveSnapshot } from '../block-retrospective'

const MESO_ID = 'meso-1'
const USER = 'u1'

function resetFixtures() {
  fixtures.mesocycle = null
  fixtures.microcycles = []
  fixtures.workouts = []
  fixtures.sessionInventory = []
  fixtures.performanceDeltas = []
  fixtures.agentActivity = []
  fixtures.interventions = []
}

function seedMesocycle(overrides: Partial<any> = {}) {
  fixtures.mesocycle = {
    id: MESO_ID, user_id: USER, name: 'Test Block',
    goal: 'HYBRID_PEAKING', week_count: 6,
    start_date: '2026-03-23', is_active: true, is_complete: false,
    ...overrides,
  }
  fixtures.microcycles = Array.from({ length: 6 }, (_, i) => ({
    id: `mc-${i + 1}`, mesocycle_id: MESO_ID, user_id: USER,
    week_number: i + 1,
    start_date: `2026-03-${23 + i * 7}`,
    end_date: `2026-03-${29 + i * 7}`,
  }))
}

/** Inserts an inventory row + matching workout (status pending or completed). */
function seedSession(opts: {
  weekNumber: number; trainingDay: number; modality: string;
  status: 'pending' | 'completed' | 'missed';
  withDeltas?: { weight: number; actualWeight: number }[];
}) {
  const id = `inv-${opts.weekNumber}-${opts.trainingDay}-${opts.modality}`
  const mc = fixtures.microcycles.find(m => m.week_number === opts.weekNumber)!
  fixtures.sessionInventory.push({
    id, mesocycle_id: MESO_ID, user_id: USER,
    week_number: opts.weekNumber, training_day: opts.trainingDay,
    session_slot: 1, modality: opts.modality, name: `${opts.modality} session`,
    status: opts.status,
  })
  if (opts.status === 'completed') {
    fixtures.workouts.push({
      id: `w-${id}`, microcycle_id: mc.id, user_id: USER,
      session_inventory_id: id,
      completed_at: '2026-03-25T10:00:00Z',
      training_day: opts.trainingDay, session_slot: 1,
    })
    for (const d of opts.withDeltas ?? []) {
      fixtures.performanceDeltas.push({
        id: `d-${id}-${fixtures.performanceDeltas.length}`,
        user_id: USER, session_inventory_id: id,
        exercise_name: 'Bench Press',
        prescribed_weight: d.weight, actual_weight: d.actualWeight,
        prescribed_reps: null, actual_reps: null,
        prescribed_rpe: null, actual_rpe: null,
        delta_classification:
          d.actualWeight > d.weight ? 'over' :
          d.actualWeight < d.weight ? 'under' : 'on',
        created_at: '2026-03-25T10:30:00Z',
      })
    }
  }
}

describe('buildBlockRetrospectiveSnapshot', () => {
  beforeEach(() => {
    resetFixtures()
    vi.clearAllMocks()
  })

  it('1: happy path — mixed adherence with recalibrations and interventions', async () => {
    seedMesocycle()
    // 4 strength done, 2 strength pending → 4/6 = 67%
    for (let i = 1; i <= 4; i++) {
      seedSession({
        weekNumber: 1, trainingDay: i, modality: 'lifting',
        status: 'completed',
        withDeltas: [{ weight: 100, actualWeight: 100 }],
      })
    }
    seedSession({ weekNumber: 1, trainingDay: 5, modality: 'lifting', status: 'pending' })
    seedSession({ weekNumber: 1, trainingDay: 6, modality: 'lifting', status: 'pending' })

    fixtures.agentActivity = [
      {
        id: 'a1', user_id: USER, coach: 'strength',
        decision_type: 'recalibration',
        target_entity: { exercise_name: 'Bench Press' },
        reasoning_structured: {
          from_kg: 75, to_kg: 72,
          source: 'recalibration', triggered_by: 'drift_5_to_10',
        },
        created_at: '2026-04-24T05:25:37Z',
      },
      {
        id: 'a2', user_id: USER, coach: 'strength',
        decision_type: 'recalibration',
        target_entity: { exercise_name: 'Overhead Press' },
        reasoning_structured: {
          from_kg: 52, to_kg: 49.5,
          source: 'intervention_response', triggered_by: 'drift_gt_10',
        },
        created_at: '2026-04-24T05:26:05Z',
      },
    ]
    fixtures.interventions = [
      {
        id: 'i1', user_id: USER, microcycle_id: 'mc-2',
        coach_domain: 'strength', trigger_type: 'rolling_under_pattern',
        rationale: 'Three sessions under-performing.',
        presented_to_user: true, user_response: 'keep',
        created_at: '2026-04-10T12:00:00Z',
      },
    ]

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)

    expect(snap.schemaVersion).toBe(1)
    expect(snap.block.id).toBe(MESO_ID)
    expect(snap.adherence.overall).toEqual({
      prescribed: 6, completed: 4, missed: 2, pct: 67,
    })
    expect(snap.adherence.byCoachDomain.strength).toEqual({
      prescribed: 6, completed: 4, missed: 2, pct: 67,
    })
    expect(snap.adherence.byWeek[0]).toMatchObject({
      weekNumber: 1, prescribed: 6, completed: 4, missed: 2, pct: 67,
    })
    expect(snap.recalibrations).toHaveLength(2)
    expect(snap.recalibrations[0]).toMatchObject({
      exerciseName: 'Bench Press', fromKg: 75, toKg: 72,
      source: 'recalibration', triggeredBy: 'drift_5_to_10',
    })
    expect(snap.interventions).toHaveLength(1)
    expect(snap.interventions[0].userResponse).toBe('keep')
  })

  it('2: 100% adherence, no recalibrations, no interventions', async () => {
    seedMesocycle()
    for (let i = 1; i <= 3; i++) {
      seedSession({ weekNumber: 1, trainingDay: i, modality: 'lifting', status: 'completed' })
    }

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)

    expect(snap.adherence.overall).toEqual({
      prescribed: 3, completed: 3, missed: 0, pct: 100,
    })
    expect(snap.recalibrations).toEqual([])
    expect(snap.interventions).toEqual([])
    expect(snap.missedSessions).toEqual([])
  })

  it('3: 0% adherence — block abandoned, all pending', async () => {
    seedMesocycle()
    for (let i = 1; i <= 4; i++) {
      seedSession({ weekNumber: 1, trainingDay: i, modality: 'cardio', status: 'pending' })
    }

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)

    expect(snap.adherence.overall).toEqual({
      prescribed: 4, completed: 0, missed: 4, pct: 0,
    })
    expect(snap.adherence.byCoachDomain.endurance.pct).toBe(0)
    expect(snap.executionQuality.byCoachDomain.endurance.sessionsWithDeltas).toBe(0)
    expect(snap.executionQuality.byCoachDomain.endurance.meanDeltaPct).toBe(0)
    expect(snap.missedSessions).toHaveLength(4)
    expect(snap.missedSessions[0].coachDomain).toBe('endurance')
  })

  it('4: completed sessions but no performance_deltas (legacy pre-Phase 1)', async () => {
    seedMesocycle()
    seedSession({ weekNumber: 1, trainingDay: 1, modality: 'lifting', status: 'completed' })
    seedSession({ weekNumber: 1, trainingDay: 2, modality: 'lifting', status: 'completed' })
    // no withDeltas → no performance_deltas rows seeded

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)

    expect(snap.adherence.overall.completed).toBe(2)
    expect(snap.executionQuality.byCoachDomain.strength.sessionsWithDeltas).toBe(0)
    expect(snap.executionQuality.byCoachDomain.strength.meanDeltaPct).toBe(0)
    expect(snap.executionQuality.byCoachDomain.strength.classificationCounts)
      .toEqual({ over: 0, on: 0, under: 0 })
  })

  it('5: agent_activity rows of other decision_types are filtered out', async () => {
    seedMesocycle()
    seedSession({ weekNumber: 1, trainingDay: 1, modality: 'lifting', status: 'completed' })
    fixtures.agentActivity = [
      {
        id: 'a1', user_id: USER, coach: 'strength',
        decision_type: 'intervention_fired',
        target_entity: {}, reasoning_structured: {},
        created_at: '2026-03-25T10:00:00Z',
      },
      {
        id: 'a2', user_id: USER, coach: 'head',
        decision_type: 'block_close',
        target_entity: {}, reasoning_structured: {},
        created_at: '2026-03-25T10:00:00Z',
      },
    ]

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)
    expect(snap.recalibrations).toEqual([])
  })

  it('6: division by zero is guarded (mesocycle with no sessions in inventory)', async () => {
    seedMesocycle()
    // no seedSession calls

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)
    expect(snap.adherence.overall).toEqual({
      prescribed: 0, completed: 0, missed: 0, pct: 0,
    })
    for (const d of Object.keys(snap.adherence.byCoachDomain) as Array<keyof typeof snap.adherence.byCoachDomain>) {
      expect(snap.adherence.byCoachDomain[d].pct).toBe(0)
    }
  })
})
