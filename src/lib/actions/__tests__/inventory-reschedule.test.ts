import { describe, it, expect, beforeEach, vi } from 'vitest'

const { updatesLog } = vi.hoisted(() => ({
    updatesLog: [] as Array<{ table: string; payload: any; filter: any }>
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
    const state = {
        session_inventory: new Map<string, any>([
            ['si1', { id: 'si1', user_id: 'u1', training_day: 3,
                      scheduled_date: '2026-04-14', status: 'pending' }],
            ['si-missed', { id: 'si-missed', user_id: 'u1', training_day: 4,
                            scheduled_date: '2026-04-10', status: 'missed' }]
        ]),
        workouts: new Map<string, any>([
            ['w1', { id: 'w1', user_id: 'u1', session_inventory_id: 'si1',
                     scheduled_date: '2026-04-14' }]
        ])
    }

    const buildChain = (table: string, store: Map<string, any>) => {
        const chain: any = {
            _filters: {},
            _payload: null,
            select: vi.fn(() => chain),
            update: vi.fn((p: any) => { chain._payload = p; return chain }),
            eq: vi.fn((col: string, v: any) => { chain._filters[col] = v; return chain }),
            maybeSingle: vi.fn(async () => {
                if (table === 'workouts' && chain._filters.session_inventory_id) {
                    const match = Array.from(store.values())
                        .find((r: any) => r.session_inventory_id === chain._filters.session_inventory_id)
                    return { data: match ?? null, error: null }
                }
                return { data: store.get(chain._filters.id) ?? null, error: null }
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
                return { data: store.get(chain._filters.id) ?? null, error: null }
            }),
            then: vi.fn((resolve: any) => {
                if (chain._payload) {
                    updatesLog.push({
                        table, payload: chain._payload, filter: { ...chain._filters }
                    })
                    const row = store.get(chain._filters.id)
                    if (row) {
                        const updated = { ...row, ...chain._payload }
                        store.set(row.id, updated)
                    }
                }
                resolve({ data: null, error: null })
                return Promise.resolve()
            })
        }
        return chain
    }

    const client = {
        from: vi.fn((table: string) => {
            if (table === 'session_inventory') return buildChain('session_inventory', state.session_inventory)
            if (table === 'workouts') return buildChain('workouts', state.workouts)
            throw new Error(`unexpected table ${table}`)
        }),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }
    return { createClient: vi.fn(async () => client) }
})

import { rebindCalendarDate, rescheduleToToday, markMissed } from '../inventory.actions'

describe('inventory reschedule actions', () => {
    beforeEach(() => { updatesLog.length = 0; vi.clearAllMocks() })

    it('rebindCalendarDate updates session_inventory.scheduled_date', async () => {
        const result = await rebindCalendarDate('si1', '2026-04-16')
        expect(result.success).toBe(true)
        const invUpdate = updatesLog.find(
            u => u.table === 'session_inventory' && u.payload.scheduled_date === '2026-04-16'
        )
        expect(invUpdate).toBeDefined()
    })

    it('rebindCalendarDate does NOT touch training_day', async () => {
        await rebindCalendarDate('si1', '2026-04-16')
        const touchesTrainingDay = updatesLog.some(u => 'training_day' in (u.payload ?? {}))
        expect(touchesTrainingDay).toBe(false)
    })

    it('rebindCalendarDate updates linked workouts.scheduled_date', async () => {
        await rebindCalendarDate('si1', '2026-04-16')
        const workoutUpdate = updatesLog.find(
            u => u.table === 'workouts' && u.payload.scheduled_date === '2026-04-16'
        )
        expect(workoutUpdate).toBeDefined()
    })

    it('rescheduleToToday sets scheduled_date to today', async () => {
        const result = await rescheduleToToday('si1')
        expect(result.success).toBe(true)
        const today = new Date().toISOString().slice(0, 10)
        const invUpdate = updatesLog.find(
            u => u.table === 'session_inventory' && u.payload.scheduled_date === today
        )
        expect(invUpdate).toBeDefined()
    })

    it('markMissed sets session_inventory.status to missed', async () => {
        const result = await markMissed('si1')
        expect(result.success).toBe(true)
        const invUpdate = updatesLog.find(
            u => u.table === 'session_inventory' && u.payload.status === 'missed'
        )
        expect(invUpdate).toBeDefined()
    })

    it('returns ActionResult failure when unauthenticated', async () => {
        const mod: any = await import('@/lib/supabase/server')
        const client = await mod.createClient()
        const orig = client.auth.getUser
        client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        try {
            const result = await rebindCalendarDate('si1', '2026-04-16')
            expect(result.success).toBe(false)
        } finally {
            client.auth.getUser = orig
        }
    })
})
