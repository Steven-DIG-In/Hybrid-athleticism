import { describe, it, expect, vi, beforeEach } from 'vitest'

const { calls, failure } = vi.hoisted(() => ({
    calls: [] as Array<{ table: string; patch: unknown; ids: unknown; userId: unknown }>,
    failure: { value: null as string | null },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
    const buildChain = (table: string) => {
        const state: { patch?: unknown; ids?: unknown; userId?: unknown } = {}
        const chain: Record<string, unknown> = {
            update: (patch: unknown) => { state.patch = patch; return chain },
            in: (_col: string, ids: unknown) => { state.ids = ids; return chain },
            eq: (col: string, v: unknown) => {
                if (col === 'user_id') state.userId = v
                return chain
            },
            then: (resolve: (r: unknown) => unknown) => {
                calls.push({ table, patch: state.patch, ids: state.ids, userId: state.userId })
                return resolve(
                    failure.value
                        ? { error: { message: failure.value } }
                        : { error: null },
                )
            },
        }
        return chain
    }
    return {
        createClient: async () => ({
            auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
            from: (table: string) => buildChain(table),
        }),
    }
})

import { markSessionsMissed } from '../inventory.actions'

beforeEach(() => {
    calls.length = 0
    failure.value = null
})

describe('markSessionsMissed', () => {
    it('marks a single session missed', async () => {
        const res = await markSessionsMissed(['s1'])
        expect(res).toEqual({ success: true, data: { marked: 1 } })
        expect(calls[0].table).toBe('session_inventory')
        expect(calls[0].patch).toEqual({ status: 'missed' })
        expect(calls[0].ids).toEqual(['s1'])
    })

    it('marks many sessions in a single statement', async () => {
        const res = await markSessionsMissed(['s1', 's2', 's3'])
        expect(res).toEqual({ success: true, data: { marked: 3 } })
        expect(calls).toHaveLength(1)
        expect(calls[0].ids).toEqual(['s1', 's2', 's3'])
    })

    it('scopes the write to the authenticated user', async () => {
        await markSessionsMissed(['s1'])
        expect(calls[0].userId).toBe('u1')
    })

    it('is a no-op on an empty list and never touches the database', async () => {
        const res = await markSessionsMissed([])
        expect(res).toEqual({ success: true, data: { marked: 0 } })
        expect(calls).toHaveLength(0)
    })

    it('surfaces a database error instead of reporting a false success', async () => {
        failure.value = 'permission denied'
        const res = await markSessionsMissed(['s1'])
        expect(res).toEqual({ success: false, error: 'permission denied' })
    })
})
