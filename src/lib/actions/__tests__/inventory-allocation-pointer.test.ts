import { describe, it, expect, beforeEach, vi } from 'vitest'

const { initCalls } = vi.hoisted(() => ({ initCalls: [] as Array<{ mesocycleId: string; weekNumber: number }> }))

vi.mock('../block-pointer.actions', () => ({
    initBlockPointer: vi.fn(async (mesocycleId: string, weekNumber: number) => {
        initCalls.push({ mesocycleId, weekNumber })
        return {
            id: 'p1',
            user_id: 'u1',
            mesocycle_id: mesocycleId,
            week_number: weekNumber,
            next_training_day: 1,
            created_at: '2026-04-17T00:00:00Z',
            updated_at: '2026-04-17T00:00:00Z'
        }
    })
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// A deliberately permissive supabase mock: returns sane defaults for all
// reads/writes so applyAllocation's happy path produces allocated > 0.
vi.mock('@/lib/supabase/server', () => {
    const microcycle = { id: 'micro-1', start_date: '2026-04-20' }
    const checkInWindowExisting: any = null // force insert branch, avoids update path

    const buildChain = (table: string): any => {
        const chain: any = {
            _filters: {},
            _payload: null,
            select: vi.fn(() => chain),
            eq: vi.fn((col: string, v: any) => { chain._filters[col] = v; return chain }),
            insert: vi.fn((payload: any) => { chain._payload = { ...payload, __insert: true }; return chain }),
            update: vi.fn((payload: any) => { chain._payload = { ...payload, __update: true }; return chain }),
            maybeSingle: vi.fn(async () => {
                if (table === 'microcycles') return { data: microcycle, error: null }
                if (table === 'check_in_windows') return { data: checkInWindowExisting, error: null }
                return { data: null, error: null }
            }),
            single: vi.fn(async () => {
                if (table === 'microcycles') return { data: microcycle, error: null }
                if (table === 'workouts') return { data: { id: 'w1' }, error: null }
                return { data: null, error: null }
            }),
            then: vi.fn((resolve: any) => {
                resolve({ data: null, error: null })
                return Promise.resolve()
            })
        }
        return chain
    }

    const client = {
        from: vi.fn((table: string) => buildChain(table)),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }
    return { createClient: vi.fn(async () => client) }
})

// Import AFTER the mocks are registered.
import { applyAllocation } from '../inventory.actions'
import type { DayAllocation, SessionInventory } from '@/lib/types/inventory.types'

function makeSession(overrides: Partial<SessionInventory> = {}): SessionInventory {
    return {
        id: 'si1',
        mesocycle_id: 'meso-1',
        user_id: 'u1',
        week_number: 2,
        session_priority: 1,
        modality: 'LIFTING',
        name: 'Squat Day',
        coach_notes: null,
        estimated_duration_minutes: 60,
        load_budget: null,
        scheduled_date: null,
        training_day: null,
        session_slot: null,
        completed_at: null,
        is_approved: true,
        carry_over_notes: null,
        adjustment_pending: null,
        created_at: '2026-04-17T00:00:00Z',
        updated_at: '2026-04-17T00:00:00Z',
        ...overrides
    }
}

describe('applyAllocation initializes block_pointer', () => {
    beforeEach(() => {
        initCalls.length = 0
        vi.clearAllMocks()
    })

    it('calls initBlockPointer(mesocycleId, weekNumber) once when at least one session was allocated', async () => {
        const allocation: DayAllocation = {
            days: [
                {
                    dayNumber: 1,
                    sessions: [
                        { session: makeSession({ id: 'si1' }), slot: 1, reasoning: 'primary' }
                    ]
                }
            ],
            warnings: [],
            totalTrainingDays: 1
        }

        const result = await applyAllocation(allocation)

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.allocated).toBeGreaterThan(0)
        }
        expect(initCalls).toEqual([{ mesocycleId: 'meso-1', weekNumber: 2 }])
    })

    it('does NOT call initBlockPointer when zero sessions were allocated', async () => {
        const allocation: DayAllocation = {
            days: [], // no training days => zero iterations => allocated stays 0
            warnings: [],
            totalTrainingDays: 0
        }

        const result = await applyAllocation(allocation)

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.allocated).toBe(0)
        }
        expect(initCalls).toEqual([])
    })
})
