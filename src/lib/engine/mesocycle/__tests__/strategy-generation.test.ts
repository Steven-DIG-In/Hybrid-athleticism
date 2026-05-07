import { describe, expect, it, vi, beforeEach } from 'vitest'

const state: {
    user: { id: string } | null
    aiContextJson: any
    contextResult: any
    aiResponse: any
    updatedMesoPatch: any
    updateError: any
} = {
    user: { id: 'user-1' },
    aiContextJson: { archetype: 'hypertrophy', customCounts: null, carryover: { daysPerWeek: 6, sessionMinutes: 75, warmupMinutes: 20, cooldownMinutes: 0, freeText: '' }, mode: 'post-block', strategy: null },
    contextResult: null,
    aiResponse: null,
    updatedMesoPatch: null,
    updateError: null,
}

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(async () => ({ data: { ai_context_json: state.aiContextJson }, error: null })),
                    })),
                })),
            })),
            update: vi.fn((patch: any) => ({
                eq: vi.fn(() => ({
                    eq: vi.fn(async () => {
                        state.updatedMesoPatch = patch
                        return { error: state.updateError }
                    }),
                })),
            })),
        })),
    })),
}))

vi.mock('@/lib/engine/mesocycle/context', () => ({
    buildAthleteContext: vi.fn(async () => ({
        success: state.contextResult ? true : false,
        data: state.contextResult,
        error: state.contextResult ? undefined : 'context unavailable',
    })),
}))

vi.mock('@/lib/ai/client', () => ({
    generateStructuredResponse: vi.fn(async () => ({
        success: state.aiResponse ? true : false,
        data: state.aiResponse,
        error: state.aiResponse ? undefined : 'ai failure',
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { runHeadCoachStrategy } from '@/lib/engine/mesocycle/strategy-generation'

describe('runHeadCoachStrategy', () => {
    beforeEach(() => {
        state.user = { id: 'user-1' }
        state.aiContextJson = { archetype: 'hypertrophy', customCounts: null, carryover: { daysPerWeek: 6, sessionMinutes: 75, warmupMinutes: 20, cooldownMinutes: 0, freeText: '' }, mode: 'post-block', strategy: null }
        state.contextResult = {
            profile: { id: 'user-1', equipment_list: [] },
            coachingTeam: [{ coach: 'strength', priority: 1 }],
            injuries: [], benchmarks: [], recentTraining: [],
            mesocycleId: 'meso-1', mesocycleGoal: 'HYPERTROPHY', weekNumber: 1, totalWeeks: 6,
            isDeload: false, targetRir: 2,
            latestBlockRetrospective: null, pendingPlannerNotes: null,
        }
        state.aiResponse = makeStrategy()
        state.updatedMesoPatch = null
        state.updateError = null
    })

    it('rejects unauthenticated callers', async () => {
        state.user = null
        const r = await runHeadCoachStrategy('meso-1')
        expect(r.success).toBe(false)
    })

    it('persists strategy to mesocycle.ai_context_json.strategy (preserving other fields)', async () => {
        const r = await runHeadCoachStrategy('meso-1')
        expect(r.success).toBe(true)
        expect(state.updatedMesoPatch.ai_context_json.strategy).toBeTruthy()
        expect(state.updatedMesoPatch.ai_context_json.archetype).toBe('hypertrophy')
        expect(state.updatedMesoPatch.ai_context_json.carryover.daysPerWeek).toBe(6)
    })

    it('returns the validated strategy', async () => {
        const r = await runHeadCoachStrategy('meso-1')
        expect(r.success && r.data.strategyRationale).toContain('rationale')
    })

    it('returns error when buildAthleteContext fails', async () => {
        state.contextResult = null
        const r = await runHeadCoachStrategy('meso-1')
        expect(r.success).toBe(false)
    })
})

function makeStrategy() {
    return {
        blockName: 'Hyp Block 2',
        blockEmphasis: 'test emphasis',
        totalWeeks: 6,
        deloadWeek: 6,
        domainAllocations: [{ coach: 'hypertrophy', sessionsPerWeek: 3, loadBudgetPerSession: 6, weeklyFatigueBudget: 100, constraints: [], methodologyDirective: 'test' }],
        weeklyEmphasis: [
            { weekNumber: 1, volumePercent: 80, emphasis: 'accumulation', isDeload: false },
            { weekNumber: 2, volumePercent: 90, emphasis: 'accumulation', isDeload: false },
            { weekNumber: 3, volumePercent: 100, emphasis: 'intensification', isDeload: false },
            { weekNumber: 4, volumePercent: 100, emphasis: 'intensification', isDeload: false },
            { weekNumber: 5, volumePercent: 95, emphasis: 'peak', isDeload: false },
            { weekNumber: 6, volumePercent: 60, emphasis: 'deload', isDeload: true },
        ],
        strategyRationale: 'test rationale',
        keyProgressions: ['progression A', 'progression B'],
        interferenceNotes: 'spacing notes',
    }
}
