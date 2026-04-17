import { describe, it, expect, beforeEach, vi } from 'vitest'

// The actual server-client path may be @/lib/supabase/server — verify by reading
// how an existing action file imports it (e.g., src/lib/actions/workout.actions.ts).
vi.mock('@/lib/supabase/server', () => {
    const state = { rows: new Map<string, any>() }
    const keyOf = (u: string, m: string, w: number) => `${u}|${m}|${w}`
    const client = {
        from: vi.fn((table: string) => {
            if (table !== 'block_pointer') throw new Error(`unexpected table ${table}`)
            const chain: any = {
                _filters: {},
                select: vi.fn(() => chain),
                eq: vi.fn((col: string, v: any) => { chain._filters[col] = v; return chain }),
                maybeSingle: vi.fn(async () => {
                    const f = chain._filters
                    const k = keyOf(f.user_id, f.mesocycle_id, f.week_number)
                    return { data: state.rows.get(k) ?? null, error: null }
                }),
                single: vi.fn(async () => {
                    const f = chain._filters
                    const k = keyOf(f.user_id, f.mesocycle_id, f.week_number)
                    return { data: state.rows.get(k) ?? null, error: null }
                }),
                upsert: vi.fn((row: any) => {
                    const k = keyOf(row.user_id, row.mesocycle_id, row.week_number)
                    const existing = state.rows.get(k)
                    state.rows.set(k, { ...row, ...existing, ...row, id: existing?.id ?? 'p1' })
                    chain._last = state.rows.get(k)
                    chain._justUpserted = true
                    return chain
                }),
                update: vi.fn((patch: any) => {
                    chain._pendingPatch = patch
                    return chain
                })
            }
            // After .update().eq().eq().eq().select().single() runs, apply the patch.
            const applyPatchAndReturn = async () => {
                const f = chain._filters
                const k = keyOf(f.user_id, f.mesocycle_id, f.week_number)
                const existing = state.rows.get(k)
                if (existing && chain._pendingPatch) {
                    state.rows.set(k, { ...existing, ...chain._pendingPatch })
                }
                return { data: state.rows.get(k) ?? null, error: null }
            }
            chain.single = vi.fn(async () => {
                if (chain._pendingPatch) return applyPatchAndReturn()
                if (chain._justUpserted && chain._last) {
                    return { data: chain._last, error: null }
                }
                const f = chain._filters
                const k = keyOf(f.user_id, f.mesocycle_id, f.week_number)
                return { data: state.rows.get(k) ?? null, error: null }
            })
            return chain
        }),
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
        }
    }
    return { createClient: vi.fn(async () => client), __state: state }
})

// Import AFTER vi.mock so the mock is in place.
import { initBlockPointer, getBlockPointer, advanceBlockPointer }
    from '../block-pointer.actions'

describe('block-pointer actions', () => {
    beforeEach(async () => {
        const mod: any = await import('@/lib/supabase/server')
        mod.__state.rows.clear()
        vi.clearAllMocks()
    })

    it('initBlockPointer creates a row with next_training_day = 1', async () => {
        const result = await initBlockPointer('meso-1', 1)
        expect(result).toMatchObject({
            user_id: 'u1',
            mesocycle_id: 'meso-1',
            week_number: 1,
            next_training_day: 1
        })
    })

    it('getBlockPointer returns existing row when present', async () => {
        await initBlockPointer('meso-1', 1)
        const pointer = await getBlockPointer('meso-1', 1)
        expect(pointer.next_training_day).toBe(1)
    })

    it('getBlockPointer auto-initializes when absent', async () => {
        const pointer = await getBlockPointer('meso-1', 2)
        expect(pointer.next_training_day).toBe(1)
        expect(pointer.week_number).toBe(2)
    })

    it('advanceBlockPointer increments next_training_day by 1', async () => {
        await initBlockPointer('meso-1', 1)
        const after = await advanceBlockPointer('meso-1', 1)
        expect(after.next_training_day).toBe(2)
    })

    it('advanceBlockPointer is capped at sessionsInWeek + 1', async () => {
        await initBlockPointer('meso-1', 1)
        for (let i = 0; i < 10; i++) {
            await advanceBlockPointer('meso-1', 1, { sessionsInWeek: 6 })
        }
        const final = await getBlockPointer('meso-1', 1)
        expect(final.next_training_day).toBeLessThanOrEqual(7)
    })

    it('throws when unauthenticated', async () => {
        const mod: any = await import('@/lib/supabase/server')
        const client = await mod.createClient()
        const originalGetUser = client.auth.getUser
        client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        try {
            await expect(initBlockPointer('meso-1', 1)).rejects.toThrow('unauthenticated')
        } finally {
            // Restore so other tests sharing the mock client aren't affected.
            client.auth.getUser = originalGetUser
        }
    })

    it.todo('coalesces concurrent advances within the same week')
})
