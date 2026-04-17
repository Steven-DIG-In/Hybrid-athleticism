import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Training loop integration test.
 *
 * Scenario: athlete completes a LIFTING session where the top set was
 * under-performed by ~8% (5-10% tier → 'logged').
 * Expected outcome:
 *   - workouts.completed_date set to today (via completeWorkout flow)
 *   - session_inventory.status → 'completed'
 *   - block_pointer advanced past day 1
 *   - agent_activity row written with decision_type='recalibration', tier='logged'
 *   - profiles.training_maxes[exerciseName] upserted via setTrainingMax
 *
 * This test stubs the Supabase layer with a shared in-memory state and
 * exercises the real action implementations to lock in the integration.
 */

const { state, logs } = vi.hoisted(() => ({
    state: {
        workouts: new Map<string, any>(),
        session_inventory: new Map<string, any>(),
        block_pointer: new Map<string, any>(),
        agent_activity: [] as any[],
        profiles: new Map<string, any>(),
        exercise_sets: new Map<string, any>(),
        conditioning_logs: [] as any[]
    },
    logs: {
        agentActivityInserts: [] as any[],
        profileUpdates: [] as any[],
        pointerUpdates: [] as any[]
    }
}))

function seed() {
    state.workouts.clear()
    state.session_inventory.clear()
    state.block_pointer.clear()
    state.agent_activity.length = 0
    state.profiles.clear()
    state.exercise_sets.clear()
    state.conditioning_logs.length = 0
    logs.agentActivityInserts.length = 0
    logs.profileUpdates.length = 0
    logs.pointerUpdates.length = 0

    state.workouts.set('w1', {
        id: 'w1', user_id: 'u1', modality: 'LIFTING',
        microcycle_id: 'mc-1', session_inventory_id: 'si1',
        scheduled_date: '2026-04-14', is_completed: false,
        exercise_sets: [
            {
                id: 's1', exercise_name: 'Back Squat', set_number: 1,
                target_weight_kg: 140, target_reps: 5,
                actual_weight_kg: 125, actual_reps: 5, rpe_actual: 9
            }
        ]
    })
    state.session_inventory.set('si1', {
        id: 'si1', user_id: 'u1', mesocycle_id: 'meso-1',
        week_number: 1, status: 'active', training_day: 1,
        scheduled_date: '2026-04-14'
    })
    state.profiles.set('u1', { id: 'u1', training_maxes: {} })
    // Seed the block_pointer at day 1 so advance can observe a +1 transition.
    state.block_pointer.set('u1|meso-1|1', {
        id: 'p1', user_id: 'u1', mesocycle_id: 'meso-1',
        week_number: 1, next_training_day: 1
    })
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('../performance-deltas.actions', () => ({
    generatePerformanceDeltas: vi.fn(async () => ({ success: true }))
}))

vi.mock('../ai-coach.actions', () => ({
    saveCoachIntervention: vi.fn(async () => ({ success: true, data: { id: 'iv1' } }))
}))

vi.mock('@/lib/supabase/server', () => {
    function table(name: string): any {
        const chain: any = {
            _filters: {},
            _payload: null,
            _isInsert: false,
            _isUpsert: false,

            select: vi.fn(() => chain),
            eq: vi.fn((col: string, v: any) => { chain._filters[col] = v; return chain }),
            update: vi.fn((p: any) => { chain._payload = p; return chain }),
            insert: vi.fn((row: any) => {
                chain._payload = row
                chain._isInsert = true
                if (name === 'agent_activity') {
                    logs.agentActivityInserts.push(row)
                    state.agent_activity.push({ ...row, id: `a${state.agent_activity.length + 1}` })
                } else if (name === 'conditioning_logs') {
                    state.conditioning_logs.push(row)
                }
                return chain
            }),
            upsert: vi.fn((row: any) => {
                chain._payload = row
                chain._isUpsert = true
                if (name === 'block_pointer') {
                    const key = `${row.user_id}|${row.mesocycle_id}|${row.week_number}`
                    const existing = state.block_pointer.get(key)
                    const merged = { ...existing, ...row, id: existing?.id ?? 'p1' }
                    state.block_pointer.set(key, merged)
                    chain._payload = merged
                }
                return chain
            }),
            single: vi.fn(async () => {
                if (chain._isInsert || chain._isUpsert) {
                    const row = chain._payload
                    return { data: { ...row, id: row?.id ?? 'x1' }, error: null }
                }
                if (name === 'block_pointer') {
                    const key = `${chain._filters.user_id}|${chain._filters.mesocycle_id}|${chain._filters.week_number}`
                    const row = state.block_pointer.get(key)
                    if (chain._payload && row) {
                        const updated = { ...row, ...chain._payload }
                        state.block_pointer.set(key, updated)
                        logs.pointerUpdates.push(updated)
                        return { data: updated, error: null }
                    }
                    return { data: row ?? null, error: null }
                }
                if (name === 'workouts') {
                    const row = state.workouts.get(chain._filters.id)
                    if (chain._payload && row) {
                        const updated = { ...row, ...chain._payload }
                        state.workouts.set(row.id, updated)
                        return { data: updated, error: null }
                    }
                    return { data: row ?? null, error: null }
                }
                if (name === 'session_inventory') {
                    const row = state.session_inventory.get(chain._filters.id)
                    if (chain._payload && row) {
                        const updated = { ...row, ...chain._payload }
                        state.session_inventory.set(row.id, updated)
                        return { data: updated, error: null }
                    }
                    return { data: row ?? null, error: null }
                }
                if (name === 'profiles') {
                    const row = state.profiles.get(chain._filters.id)
                    return { data: row ?? null, error: null }
                }
                return { data: null, error: null }
            }),
            maybeSingle: vi.fn(async () => {
                if (name === 'workouts') {
                    const row = state.workouts.get(chain._filters.id)
                    return { data: row ?? null, error: null }
                }
                if (name === 'session_inventory') {
                    const row = state.session_inventory.get(chain._filters.id)
                    return { data: row ?? null, error: null }
                }
                if (name === 'block_pointer') {
                    const key = `${chain._filters.user_id}|${chain._filters.mesocycle_id}|${chain._filters.week_number}`
                    return { data: state.block_pointer.get(key) ?? null, error: null }
                }
                if (name === 'profiles') {
                    const row = state.profiles.get(chain._filters.id)
                    return { data: row ?? null, error: null }
                }
                return { data: null, error: null }
            }),
            then: (resolve: any, reject: any) => {
                try {
                    // Awaited directly — apply pending update (no .select().single()).
                    if (chain._payload && !chain._isInsert && !chain._isUpsert) {
                        if (name === 'workouts') {
                            const row = state.workouts.get(chain._filters.id)
                            if (row) state.workouts.set(row.id, { ...row, ...chain._payload })
                        }
                        if (name === 'session_inventory') {
                            const row = state.session_inventory.get(chain._filters.id)
                            if (row) state.session_inventory.set(row.id, { ...row, ...chain._payload })
                        }
                        if (name === 'profiles') {
                            const row = state.profiles.get(chain._filters.id)
                            if (row) {
                                state.profiles.set(row.id, { ...row, ...chain._payload })
                                logs.profileUpdates.push(chain._payload)
                            }
                        }
                        if (name === 'block_pointer') {
                            const key = `${chain._filters.user_id}|${chain._filters.mesocycle_id}|${chain._filters.week_number}`
                            const row = state.block_pointer.get(key)
                            if (row) {
                                const updated = { ...row, ...chain._payload }
                                state.block_pointer.set(key, updated)
                                logs.pointerUpdates.push(updated)
                            }
                        }
                    }
                    return Promise.resolve({ data: null, error: null }).then(resolve, reject)
                } catch (err) {
                    return Promise.reject(err).then(resolve, reject)
                }
            }
        }
        return chain
    }

    return {
        createClient: vi.fn(async () => ({
            from: vi.fn((t: string) => table(t)),
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'u1' } }, error: null
                })
            }
        }))
    }
})

import { completeWorkout } from '../workout.actions'

describe('Training loop integration', () => {
    beforeEach(() => {
        seed()
        vi.clearAllMocks()
    })

    it(
        'end-to-end under-performance scenario: completion → recalibration logged → training_max persisted → pointer advances',
        async () => {
            const result = await completeWorkout('w1', 45)
            expect(result.success).toBe(true)

            // Allow fire-and-forget recalibrateFromTopSet to complete.
            await new Promise(r => setTimeout(r, 100))

            // 1. Workout state — completed_date set to today
            const workout = state.workouts.get('w1')
            expect(workout.is_completed).toBe(true)
            expect(workout.completed_date).toBe(new Date().toISOString().slice(0, 10))

            // 2. Session inventory transitioned to 'completed'
            const inv = state.session_inventory.get('si1')
            expect(inv.status).toBe('completed')

            // 3. Block pointer advanced past day 1
            const pointer = state.block_pointer.get('u1|meso-1|1')
            expect(pointer).toBeDefined()
            expect(pointer.next_training_day).toBeGreaterThan(1)

            // 4. Agent activity recalibration row written at 'logged' tier
            const recalibRow = logs.agentActivityInserts.find(
                r => r.decision_type === 'recalibration'
            )
            expect(recalibRow).toBeDefined()
            expect(recalibRow.coach).toBe('strength')
            expect(recalibRow.reasoning_structured.previousMax).toBeGreaterThan(0)
            expect(recalibRow.reasoning_structured.newMax).toBeLessThan(
                recalibRow.reasoning_structured.previousMax
            )
            expect(recalibRow.reasoning_structured.tier).toBe('logged')

            // 5. Training max persisted to profile
            const profile = state.profiles.get('u1')
            expect(profile.training_maxes['Back Squat']).toBeDefined()
            expect(profile.training_maxes['Back Squat'].source).toBe('recalibration')
        },
        10000
    )
})
