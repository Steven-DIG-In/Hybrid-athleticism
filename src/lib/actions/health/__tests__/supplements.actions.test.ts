import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
    state: {
        insertedRows: [] as any[],
        updatedRows: [] as Array<{ id: string; patch: any }>,
        lastQueryHadIsFilter: false,
        supplements: [
            { id: 's1', name: 'Creatine', end_date: null },
            { id: 's2', name: 'Fish Oil', end_date: '2025-01-01' },
        ] as any[],
    }
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
    const client = {
        from: vi.fn((table: string) => {
            if (table === 'supplements') {
                // Insert chain
                const insertChain = {
                    insert: vi.fn((row: any) => {
                        state.insertedRows.push(row)
                        return {
                            select: vi.fn(() => ({
                                single: vi.fn(async () => ({
                                    data: { id: `sup${state.insertedRows.length}` },
                                    error: null,
                                }))
                            }))
                        }
                    }),
                    // Update chain — thenable so `await supabase.from(...).update(...).eq(...)` works
                    update: vi.fn((patch: any) => {
                        const updateChain: any = {
                            _patch: patch,
                            eq: vi.fn((col: string, val: any) => {
                                state.updatedRows.push({ id: val, patch })
                                // Return thenable so `const { error } = await ...` works
                                const p = Promise.resolve({ data: null, error: null })
                                return p
                            }),
                        }
                        return updateChain
                    }),
                    // Select chain for listSupplements
                    select: vi.fn(() => {
                        state.lastQueryHadIsFilter = false
                        const queryChain: any = {
                            order: vi.fn(() => queryChain),
                            is: vi.fn((col: string, val: any) => {
                                state.lastQueryHadIsFilter = true
                                return queryChain
                            }),
                            // Make queryChain thenable so `const { data, error } = await q` works
                            then: (resolve: any, reject: any) => {
                                const active = state.supplements.filter(s =>
                                    !state.lastQueryHadIsFilter || s.end_date === null
                                )
                                return Promise.resolve({ data: active, error: null }).then(resolve, reject)
                            },
                        }
                        return queryChain
                    }),
                }
                return insertChain
            }
            return {}
        }),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }
    return { createClient: vi.fn(async () => client) }
})

import {
    addSupplement,
    updateSupplement,
    endSupplement,
    listSupplements,
} from '../supplements.actions'

describe('supplements actions', () => {
    beforeEach(() => {
        state.insertedRows.length = 0
        state.updatedRows.length = 0
        state.lastQueryHadIsFilter = false
        vi.clearAllMocks()
    })

    describe('addSupplement', () => {
        it('inserts row with user_id and returns ok:true with an id', async () => {
            const input = {
                name: 'Creatine',
                dose: 5,
                dose_unit: 'g',
                timing: ['morning'],
                start_date: '2026-01-01',
            }
            const result = await addSupplement(input)
            expect(result.ok).toBe(true)
            expect('id' in result && result.id).toBeTruthy()
            expect(state.insertedRows[0]).toMatchObject({
                ...input,
                user_id: 'u1',
            })
        })

        it('returns unauthenticated error when no user', async () => {
            const mod: any = await import('@/lib/supabase/server')
            const c = await mod.createClient()
            const orig = c.auth.getUser
            c.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
            try {
                const result = await addSupplement({
                    name: 'Zinc',
                    dose: null,
                    dose_unit: null,
                    timing: [],
                    start_date: '2026-01-01',
                })
                expect(result.ok).toBe(false)
                expect('error' in result && result.error).toBe('unauthenticated')
            } finally {
                c.auth.getUser = orig
            }
        })
    })

    describe('listSupplements', () => {
        it('applies .is("end_date", null) filter when include_ended is false', async () => {
            await listSupplements({ include_ended: false })
            expect(state.lastQueryHadIsFilter).toBe(true)
        })

        it('does NOT apply .is filter when include_ended is true', async () => {
            await listSupplements({ include_ended: true })
            expect(state.lastQueryHadIsFilter).toBe(false)
        })

        it('returns only active supplements when include_ended is false', async () => {
            const results = await listSupplements({ include_ended: false })
            expect(results).toHaveLength(1)
            expect(results![0].id).toBe('s1')
        })

        it('returns all supplements when include_ended is true', async () => {
            const results = await listSupplements({ include_ended: true })
            expect(results).toHaveLength(2)
        })
    })

    describe('endSupplement', () => {
        it('delegates to updateSupplement with end_date patch', async () => {
            const result = await endSupplement('s1', '2026-04-01')
            expect(result.ok).toBe(true)
            expect(state.updatedRows[0]).toMatchObject({
                id: 's1',
                patch: { end_date: '2026-04-01' },
            })
        })
    })

    describe('updateSupplement', () => {
        it('updates a supplement by id and returns ok:true', async () => {
            const result = await updateSupplement('s2', { dose: 10 })
            expect(result.ok).toBe(true)
            expect(state.updatedRows[0]).toMatchObject({
                id: 's2',
                patch: { dose: 10 },
            })
        })
    })
})
