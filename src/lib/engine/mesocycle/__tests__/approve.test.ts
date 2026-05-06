import { describe, expect, it, vi, beforeEach } from 'vitest'

const state: any = {
    user: { id: 'user-1' },
    mesoUpdated: null as any,
    week1MicroId: 'micro-1',
    pointerInserted: null as any,
    notesCleared: false,
    micErr: null as any,
}

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
        from: vi.fn((table: string) => {
            if (table === 'mesocycles') {
                return {
                    update: vi.fn((patch: any) => ({
                        eq: vi.fn(() => ({ eq: vi.fn(async () => { state.mesoUpdated = patch; return { error: null } }) })),
                    })),
                }
            }
            if (table === 'microcycles') {
                return {
                    select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: state.week1MicroId ? { id: state.week1MicroId } : null, error: state.micErr })) })) })) })) })),
                }
            }
            if (table === 'block_pointer') {
                return {
                    upsert: vi.fn(async (row: any) => { state.pointerInserted = row; return { error: null } }),
                }
            }
            return {}
        }),
    })),
}))

vi.mock('@/lib/actions/pending-notes.actions', () => ({
    clearPendingPlannerNotes: vi.fn(async () => { state.notesCleared = true; return { success: true } }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { approveBlockPlan } from '@/lib/engine/mesocycle/approve'

describe('approveBlockPlan', () => {
    beforeEach(() => {
        state.user = { id: 'user-1' }
        state.mesoUpdated = null
        state.week1MicroId = 'micro-1'
        state.pointerInserted = null
        state.notesCleared = false
        state.micErr = null
    })

    it('rejects unauthenticated callers', async () => {
        state.user = null
        const r = await approveBlockPlan('meso-1')
        expect(r.success).toBe(false)
    })

    it('flips mesocycle.is_active to true', async () => {
        await approveBlockPlan('meso-1')
        expect(state.mesoUpdated.is_active).toBe(true)
    })

    it('sets block_pointer to (week 1, day 1)', async () => {
        await approveBlockPlan('meso-1')
        expect(state.pointerInserted.user_id).toBe('user-1')
        expect(state.pointerInserted.mesocycle_id).toBe('meso-1')
        expect(state.pointerInserted.week_number).toBe(1)
        expect(state.pointerInserted.next_training_day).toBe(1)
    })

    it('clears pending_planner_notes', async () => {
        await approveBlockPlan('meso-1')
        expect(state.notesCleared).toBe(true)
    })

    it('returns error when week 1 microcycle is missing', async () => {
        state.week1MicroId = null
        const r = await approveBlockPlan('meso-1')
        expect(r.success).toBe(false)
    })
})
