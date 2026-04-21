import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
    state: {
        insertedRows: [] as any[],
        lastOrderArgs: null as [string, any] | null,
        bodyCompRows: [
            {
                id: 'bc1',
                measured_on: '2026-04-15',
                method: 'scale',
                weight_kg: 82.4,
                body_fat_pct: 14.2,
                lean_mass_kg: null,
                measurements: null,
                notes: null,
            },
            {
                id: 'bc2',
                measured_on: '2026-03-01',
                method: 'dexa',
                weight_kg: 83.0,
                body_fat_pct: 13.8,
                lean_mass_kg: 71.4,
                measurements: null,
                notes: 'Annual scan',
            },
        ] as any[],
    }
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
    const client = {
        from: vi.fn((table: string) => {
            if (table === 'body_composition_measurements') {
                return {
                    // Insert chain
                    insert: vi.fn((row: any) => {
                        state.insertedRows.push(row)
                        return {
                            select: vi.fn(() => ({
                                single: vi.fn(async () => ({
                                    data: { id: `bc${state.insertedRows.length}` },
                                    error: null,
                                }))
                            }))
                        }
                    }),
                    // Select chain for listBodyComp
                    select: vi.fn(() => {
                        const queryChain: any = {
                            order: vi.fn((col: string, opts: any) => {
                                state.lastOrderArgs = [col, opts]
                                return Promise.resolve({ data: state.bodyCompRows, error: null })
                            }),
                        }
                        return queryChain
                    }),
                }
            }
            return {}
        }),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }
    return { createClient: vi.fn(async () => client) }
})

import {
    addBodyCompMeasurement,
    listBodyComp,
} from '../body-comp.actions'

describe('body-comp actions', () => {
    beforeEach(() => {
        state.insertedRows.length = 0
        state.lastOrderArgs = null
        vi.clearAllMocks()
    })

    describe('addBodyCompMeasurement', () => {
        it('inserts row with user_id and returns ok:true with id', async () => {
            const input = {
                measured_on: '2026-04-20',
                method: 'scale' as const,
                weight_kg: 82.4,
                body_fat_pct: 14.2,
            }
            const result = await addBodyCompMeasurement(input)
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
                const result = await addBodyCompMeasurement({
                    measured_on: '2026-04-20',
                    method: 'scale',
                })
                expect(result.ok).toBe(false)
                expect('error' in result && result.error).toBe('unauthenticated')
            } finally {
                c.auth.getUser = orig
            }
        })
    })

    describe('listBodyComp', () => {
        it('returns rows from body_composition_measurements ordered by measured_on desc', async () => {
            const results = await listBodyComp()
            expect(results).toHaveLength(2)
            expect(results![0].id).toBe('bc1')
            expect(results![1].id).toBe('bc2')
        })

        it('calls .order("measured_on", { ascending: false })', async () => {
            await listBodyComp()
            expect(state.lastOrderArgs).toEqual(['measured_on', { ascending: false }])
        })
    })
})
