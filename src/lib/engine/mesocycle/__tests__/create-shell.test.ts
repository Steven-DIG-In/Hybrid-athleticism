import { describe, expect, it, vi, beforeEach } from 'vitest'

const state: any = {
    insertedMesos: [] as any[],
    insertedMicros: [] as any[],
    authUser: { id: 'user-1' } as { id: string } | null,
}

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: state.authUser }, error: null })) },
        from: vi.fn((table: string) => {
            if (table === 'mesocycles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(async () => ({ count: state.mesoCount ?? 0, error: null })),
                    })),
                    insert: vi.fn((row: any) => ({
                        select: vi.fn(() => ({
                            single: vi.fn(async () => {
                                state.insertedMesos.push(row)
                                return { data: { ...row, id: 'meso-new' }, error: null }
                            }),
                        })),
                    })),
                }
            }
            if (table === 'microcycles') {
                return {
                    insert: vi.fn(async (rows: any[]) => {
                        state.insertedMicros.push(...rows)
                        return { error: null }
                    }),
                }
            }
            return {}
        }),
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createBlockShell } from '@/lib/engine/mesocycle/create-shell'

describe('createBlockShell', () => {
    beforeEach(() => {
        state.mesoCount = 0
        state.insertedMesos = []
        state.insertedMicros = []
        state.authUser = { id: 'user-1' }
    })

    it('inserts mesocycle with name based on archetype + block number', async () => {
        const r = await createBlockShell({
            mode: 'post-block',
            archetype: 'hypertrophy',
            durationWeeks: 6,
            customCounts: undefined,
            carryover: { daysPerWeek: 6, sessionMinutes: 75, warmupMinutes: 20, cooldownMinutes: 0, freeText: '' },
        }, /* blockNumberOverride for test */ 2)
        expect(r.success).toBe(true)
        expect(state.insertedMesos[0].name).toBe('HYPERTROPHY Block 2')
        expect(state.insertedMesos[0].is_active).toBe(false)
        expect(state.insertedMesos[0].is_complete).toBe(false)
        expect(state.insertedMesos[0].week_count).toBe(6)
    })

    it('scaffolds 6 microcycles when durationWeeks is 6', async () => {
        await createBlockShell({
            mode: 'post-block',
            archetype: 'strength',
            durationWeeks: 6,
            carryover: { daysPerWeek: 5, sessionMinutes: 60, warmupMinutes: 10, cooldownMinutes: 0, freeText: '' },
        }, 1)
        expect(state.insertedMicros).toHaveLength(6)
        expect(state.insertedMicros[5].is_deload).toBe(true)
    })

    it('persists carryover + archetype + customCounts in ai_context_json', async () => {
        await createBlockShell({
            mode: 'post-block',
            archetype: 'custom',
            durationWeeks: 4,
            customCounts: { hypertrophy: 2, strength: 3, conditioning: 1, endurance: 0, mobility: 1, recovery: 0 },
            carryover: { daysPerWeek: 4, sessionMinutes: 90, warmupMinutes: 15, cooldownMinutes: 5, freeText: 'note' },
        }, 3)
        expect(state.insertedMesos[0].ai_context_json.archetype).toBe('custom')
        expect(state.insertedMesos[0].ai_context_json.customCounts.strength).toBe(3)
        expect(state.insertedMesos[0].ai_context_json.carryover.daysPerWeek).toBe(4)
    })

    it('rejects unauthenticated callers', async () => {
        state.authUser = null
        const r = await createBlockShell({
            mode: 'post-block',
            archetype: 'hypertrophy',
            durationWeeks: 6,
            carryover: { daysPerWeek: 6, sessionMinutes: 75, warmupMinutes: 20, cooldownMinutes: 0, freeText: '' },
        }, 1)
        expect(r.success).toBe(false)
    })
})
