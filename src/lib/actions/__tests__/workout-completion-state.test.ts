import { describe, it, expect, beforeEach, vi } from 'vitest'

const { updatesLog, advanceCalls } = vi.hoisted(() => ({
    updatesLog: [] as Array<{ table: string; payload: any; filter: any }>,
    advanceCalls: [] as Array<{ mesocycleId: string; weekNumber: number }>
}))

vi.mock('../block-pointer.actions', () => ({
    advanceBlockPointer: vi.fn(async (mesocycleId: string, weekNumber: number) => {
        advanceCalls.push({ mesocycleId, weekNumber })
        return { id: 'p1', user_id: 'u1', mesocycle_id: mesocycleId,
                 week_number: weekNumber, next_training_day: 2,
                 updated_at: new Date().toISOString() }
    })
}))

vi.mock('../performance-deltas.actions', () => ({
    generatePerformanceDeltas: vi.fn(async () => ({ success: true }))
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
    const state = {
        workouts: new Map<string, any>([
            ['w1', {
                id: 'w1', user_id: 'u1',
                session_inventory_id: 'si1',
                is_completed: false
            }],
            ['w-no-inv', {
                id: 'w-no-inv', user_id: 'u1',
                session_inventory_id: null,
                is_completed: false
            }]
        ]),
        session_inventory: new Map<string, any>([
            ['si1', {
                id: 'si1', user_id: 'u1',
                mesocycle_id: 'meso-1', week_number: 2,
                status: 'active'
            }]
        ])
    }

    const buildChain = (table: string, store: Map<string, any>) => {
        const flush = () => {
            if (chain._payload && !chain._flushed) {
                chain._flushed = true
                updatesLog.push({
                    table, payload: chain._payload, filter: { ...chain._filters }
                })
                const row = store.get(chain._filters.id)
                if (row) {
                    const updated = { ...row, ...chain._payload }
                    store.set(row.id, updated)
                    return updated
                }
            }
            return store.get(chain._filters.id) ?? null
        }
        const chain: any = {
            _filters: {},
            _payload: null,
            _flushed: false,
            select: vi.fn(() => chain),
            update: vi.fn((p: any) => { chain._payload = p; return chain }),
            insert: vi.fn((row: any) => {
                updatesLog.push({ table, payload: row, filter: {} })
                return { select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) }
            }),
            eq: vi.fn((col: string, v: any) => { chain._filters[col] = v; return chain }),
            maybeSingle: vi.fn(async () => ({
                data: store.get(chain._filters.id) ?? null, error: null
            })),
            single: vi.fn(async () => {
                const data = flush()
                return { data, error: null }
            }),
            // Awaiting the chain directly (no .single()/.maybeSingle()) resolves like a supabase update.
            then: (resolve: any, reject: any) => {
                try {
                    const data = flush()
                    return Promise.resolve({ data, error: null }).then(resolve, reject)
                } catch (err) {
                    return Promise.reject(err).then(resolve, reject)
                }
            }
        }
        return chain
    }

    const client = {
        from: vi.fn((table: string) => {
            if (table === 'workouts') return buildChain('workouts', state.workouts)
            if (table === 'session_inventory') return buildChain('session_inventory', state.session_inventory)
            if (table === 'conditioning_logs') return buildChain('conditioning_logs', new Map())
            throw new Error(`unexpected table ${table}`)
        }),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) }
    }
    return { createClient: vi.fn(async () => client), __state: state }
})

import { completeWorkout } from '../workout.actions'

describe('completeWorkout state transitions', () => {
    beforeEach(() => {
        updatesLog.length = 0
        advanceCalls.length = 0
        vi.clearAllMocks()
    })

    it('sets workouts.completed_date to today', async () => {
        await completeWorkout('w1', 45)
        const today = new Date().toISOString().slice(0, 10)
        const match = updatesLog.find(
            u => u.table === 'workouts' && u.payload.completed_date === today
        )
        expect(match).toBeDefined()
    })

    it('transitions session_inventory.status to completed', async () => {
        await completeWorkout('w1', 45)
        const match = updatesLog.find(
            u => u.table === 'session_inventory' && u.payload.status === 'completed'
        )
        expect(match).toBeDefined()
    })

    it('advances block_pointer for the linked mesocycle/week', async () => {
        await completeWorkout('w1', 45)
        expect(advanceCalls).toEqual([{ mesocycleId: 'meso-1', weekNumber: 2 }])
    })

    it('skips inventory transition and pointer advance when no session_inventory_id', async () => {
        await completeWorkout('w-no-inv', 30)
        expect(advanceCalls).toHaveLength(0)
        const invUpdate = updatesLog.find(
            u => u.table === 'session_inventory' && u.payload?.status === 'completed'
        )
        expect(invUpdate).toBeUndefined()
    })

    it('returns success even if block_pointer advance throws', async () => {
        const mod: any = await import('../block-pointer.actions')
        const orig = mod.advanceBlockPointer
        mod.advanceBlockPointer = vi.fn(async () => { throw new Error('db down') })
        try {
            const result = await completeWorkout('w1', 45)
            expect(result.success).toBe(true)
        } finally {
            mod.advanceBlockPointer = orig
        }
    })
})
