import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
    state: {
        insertedRows: [] as any[],
        deletedIds: [] as string[],
        medicalEvents: [
            {
                id: 'me1',
                event_type: 'lab_test',
                event_date: '2026-04-01',
                title: 'Blood Panel',
                structured_data: { cholesterol: 180 },
            },
            {
                id: 'me2',
                event_type: 'injury',
                event_date: '2026-03-15',
                title: 'Knee strain',
                structured_data: null,
            },
        ] as any[],
        lastEqArgs: null as [string, any] | null,
    }
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
    const client = {
        from: vi.fn((table: string) => {
            if (table === 'medical_events') {
                return {
                    // Insert chain
                    insert: vi.fn((row: any) => {
                        state.insertedRows.push(row)
                        return {
                            select: vi.fn(() => ({
                                single: vi.fn(async () => ({
                                    data: { id: `me${state.insertedRows.length}` },
                                    error: null,
                                }))
                            }))
                        }
                    }),
                    // Update chain
                    update: vi.fn((patch: any) => ({
                        eq: vi.fn((col: string, val: any) => {
                            state.lastEqArgs = [col, val]
                            return Promise.resolve({ data: null, error: null })
                        }),
                    })),
                    // Delete chain
                    delete: vi.fn(() => ({
                        eq: vi.fn((col: string, val: any) => {
                            state.lastEqArgs = [col, val]
                            state.deletedIds.push(val)
                            return Promise.resolve({ data: null, error: null })
                        }),
                    })),
                    // Select chain for listMedicalEvents
                    select: vi.fn(() => {
                        const queryChain: any = {
                            order: vi.fn(() =>
                                Promise.resolve({ data: state.medicalEvents, error: null })
                            ),
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
    addMedicalEvent,
    listMedicalEvents,
    deleteMedicalEvent,
} from '../medicals.actions'

describe('medicals actions', () => {
    beforeEach(() => {
        state.insertedRows.length = 0
        state.deletedIds.length = 0
        state.lastEqArgs = null
        vi.clearAllMocks()
    })

    describe('addMedicalEvent', () => {
        it('inserts with user_id and structured_data, returns ok:true with id', async () => {
            const input = {
                event_type: 'lab_test' as const,
                event_date: '2026-04-10',
                title: 'Comprehensive Metabolic Panel',
                structured_data: { glucose: 95, creatinine: 1.0 },
            }
            const result = await addMedicalEvent(input)
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
                const result = await addMedicalEvent({
                    event_type: 'other',
                    event_date: '2026-04-10',
                    title: 'Some event',
                })
                expect(result.ok).toBe(false)
                expect('error' in result && result.error).toBe('unauthenticated')
            } finally {
                c.auth.getUser = orig
            }
        })
    })

    describe('listMedicalEvents', () => {
        it('returns rows from medical_events ordered by event_date desc', async () => {
            const results = await listMedicalEvents()
            expect(results).toHaveLength(2)
            expect(results![0].id).toBe('me1')
            expect(results![1].id).toBe('me2')
        })
    })

    describe('deleteMedicalEvent', () => {
        it('calls .delete().eq("id", id) with the correct id', async () => {
            const result = await deleteMedicalEvent('me1')
            expect(result.ok).toBe(true)
            expect(state.lastEqArgs).toEqual(['id', 'me1'])
            expect(state.deletedIds).toContain('me1')
        })
    })
})
