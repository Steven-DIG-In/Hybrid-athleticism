import { describe, expect, it, vi, beforeEach } from 'vitest'

const state: any = {
    user: { id: 'user-1' },
    aiContextJson: { strategy: { foo: 'bar' }, archetype: 'hypertrophy', customCounts: null, carryover: {}, mode: 'post-block' },
    week1MicroId: 'micro-1',
    strategyClearedFor: null,
    week1InventoryDeleted: false,
    runHeadCoachResult: { success: true, data: { strategyRationale: 'rerun' } },
    poolResult: { success: true, data: { workouts: [], sessionPool: {} } },
}

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
        from: vi.fn((table: string) => {
            if (table === 'mesocycles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { ai_context_json: state.aiContextJson }, error: null })) })) })),
                    })),
                    update: vi.fn((patch: any) => ({
                        eq: vi.fn(() => ({ eq: vi.fn(async () => {
                            state.strategyClearedFor = patch.ai_context_json
                            return { error: null }
                        }) })),
                    })),
                }
            }
            if (table === 'microcycles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: state.week1MicroId ? { id: state.week1MicroId } : null, error: null })) })) })) })),
                    })),
                }
            }
            if (table === 'session_inventory') {
                return {
                    delete: vi.fn(() => ({ eq: vi.fn(async () => {
                        state.week1InventoryDeleted = true
                        return { error: null }
                    }) })),
                }
            }
            return {}
        }),
    })),
}))

vi.mock('@/lib/engine/mesocycle/strategy-generation', () => ({
    runHeadCoachStrategy: vi.fn(async () => state.runHeadCoachResult),
}))

vi.mock('@/lib/engine/microcycle/generate-pool', () => ({
    generateSessionPool: vi.fn(async () => state.poolResult),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { regenerateBlockPlan } from '@/lib/engine/mesocycle/regenerate'

describe('regenerateBlockPlan', () => {
    beforeEach(() => {
        state.user = { id: 'user-1' }
        state.aiContextJson = { strategy: { foo: 'bar' }, archetype: 'hypertrophy', customCounts: null, carryover: {}, mode: 'post-block' }
        state.week1MicroId = 'micro-1'
        state.strategyClearedFor = null
        state.week1InventoryDeleted = false
        state.runHeadCoachResult = { success: true, data: { strategyRationale: 'rerun' } }
        state.poolResult = { success: true, data: { workouts: [], sessionPool: {} } }
    })

    it('rejects unauthenticated callers', async () => {
        state.user = null as any
        const r = await regenerateBlockPlan('meso-1')
        expect(r.success).toBe(false)
    })

    it('clears strategy from ai_context_json (preserves other fields)', async () => {
        await regenerateBlockPlan('meso-1')
        expect(state.strategyClearedFor.strategy).toBeNull()
        expect(state.strategyClearedFor.archetype).toBe('hypertrophy')
        expect(state.strategyClearedFor.mode).toBe('post-block')
    })

    it('deletes week 1 session_inventory before re-running', async () => {
        await regenerateBlockPlan('meso-1')
        expect(state.week1InventoryDeleted).toBe(true)
    })

    it('returns error when runHeadCoachStrategy fails', async () => {
        state.runHeadCoachResult = { success: false, error: 'AI down' }
        const r = await regenerateBlockPlan('meso-1')
        expect(r.success).toBe(false)
    })

    it('returns error when generateSessionPool fails after strategy succeeds', async () => {
        state.poolResult = { success: false, error: 'pool down' }
        const r = await regenerateBlockPlan('meso-1')
        expect(r.success).toBe(false)
    })
})
