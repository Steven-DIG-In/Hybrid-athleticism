import { describe, it, expect, vi, beforeEach } from 'vitest'

const { updatesLog } = vi.hoisted(() => ({
    updatesLog: [] as Array<{ table: string; payload: any; filter: any }>
}))

vi.mock('@/lib/supabase/server', () => {
    const state = {
        workouts: new Map<string, any>(),
        session_inventory: new Map<string, any>()
    }
    // seed
    state.workouts.set('w1', {
        id: 'w1', user_id: 'u1',
        scheduled_date: '2026-04-14',   // yesterday-ish vs "today"
        session_inventory_id: 'si1'
    })
    state.session_inventory.set('si1', {
        id: 'si1', user_id: 'u1', status: 'pending'
    })

    const buildChain = (table: string, store: Map<string, any>) => {
        const chain: any = {
            _filters: {},
            _payload: null,
            select: vi.fn(() => chain),
            update: vi.fn((p: any) => { chain._payload = p; return chain }),
            eq: vi.fn((col: string, v: any) => { chain._filters[col] = v; return chain }),
            maybeSingle: vi.fn(async () => {
                const row = store.get(chain._filters.id)
                return { data: row ?? null, error: null }
            }),
            single: vi.fn(async () => {
                if (chain._payload) {
                    updatesLog.push({
                        table, payload: chain._payload, filter: { ...chain._filters }
                    })
                    const row = store.get(chain._filters.id)
                    if (row) {
                        const updated = { ...row, ...chain._payload }
                        store.set(row.id, updated)
                        return { data: updated, error: null }
                    }
                }
                const row = store.get(chain._filters.id)
                return { data: row ?? null, error: null }
            })
        }
        return chain
    }

    const client = {
        from: vi.fn((table: string) => {
            if (table === 'workouts') return buildChain('workouts', state.workouts)
            if (table === 'session_inventory') return buildChain('session_inventory', state.session_inventory)
            throw new Error(`unexpected table ${table}`)
        }),
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
        }
    }
    return {
        createClient: vi.fn(async () => client),
        __state: state,
        __updatesLog: updatesLog
    }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { startWorkout } from '../workout.actions'

describe('startWorkout', () => {
    beforeEach(() => { updatesLog.length = 0; vi.clearAllMocks() })

    it('rebinds workouts.scheduled_date to today', async () => {
        const result = await startWorkout('w1')
        expect(result.success).toBe(true)
        const today = new Date().toISOString().slice(0, 10)
        const workoutUpdate = updatesLog.find(u => u.table === 'workouts')
        expect(workoutUpdate?.payload.scheduled_date).toBe(today)
    })

    it('sets session_inventory.status to active', async () => {
        const result = await startWorkout('w1')
        expect(result.success).toBe(true)
        const inventoryUpdate = updatesLog.find(u => u.table === 'session_inventory')
        expect(inventoryUpdate?.payload.status).toBe('active')
    })

    it('returns ActionResult failure when unauthenticated', async () => {
        const mod: any = await import('@/lib/supabase/server')
        const client = await mod.createClient()
        const orig = client.auth.getUser
        client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        try {
            const result = await startWorkout('w1')
            expect(result.success).toBe(false)
            expect(result.error).toBe('Not authenticated')
        } finally {
            client.auth.getUser = orig
        }
    })

    it('is resilient when the workout has no linked session_inventory', async () => {
        const mod: any = await import('@/lib/supabase/server')
        mod.__state.workouts.set('w2', {
            id: 'w2', user_id: 'u1',
            scheduled_date: '2026-04-14',
            session_inventory_id: null
        })
        const result = await startWorkout('w2')
        expect(result.success).toBe(true)
        // Should still have rebound the workout's scheduled_date.
        const workoutUpdate = updatesLog.find(
            u => u.table === 'workouts' && u.filter.id === 'w2'
        )
        expect(workoutUpdate?.payload.scheduled_date).toBe(
            new Date().toISOString().slice(0, 10)
        )
    })
})
