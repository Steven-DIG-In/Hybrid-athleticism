import { describe, it, expect, beforeEach, vi } from 'vitest'

const { interventionStore, setTrainingMaxCalls } = vi.hoisted(() => ({
    interventionStore: {
        current: null as any
    },
    setTrainingMaxCalls: [] as any[]
}))

vi.mock('../training-maxes.actions', () => ({
    setTrainingMax: vi.fn(async (input: any) => {
        setTrainingMaxCalls.push(input)
        return {
            trainingMaxKg: input.trainingMaxKg,
            updatedAt: new Date().toISOString(),
            source: input.source
        }
    })
}))

// Minimal next/cache shim — revalidatePath is a no-op in tests.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
    const buildChain = () => {
        const chain: any = {
            _filters: {},
            select: vi.fn(() => chain),
            update: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(async () => ({
                data: interventionStore.current, error: null
            }))
        }
        return chain
    }
    const client = {
        from: vi.fn(() => buildChain()),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) }
    }
    return { createClient: vi.fn(async () => client) }
})

// Avoid loading real AI deps — not used in these tests but imported at module level.
vi.mock('@/lib/ai/client', () => ({ generateStructuredResponse: vi.fn() }))
vi.mock('@/lib/ai/schemas/coach', () => ({ CoachResponseSchema: {} }))
vi.mock('@/lib/ai/prompts/coach', () => ({
    buildCoachSystemPrompt: vi.fn(() => ''),
    buildCoachUserPrompt: vi.fn(() => '')
}))
vi.mock('../logging.actions', () => ({
    buildWeeklyPayload: vi.fn()
}))

import { respondToIntervention } from '../ai-coach.actions'

describe('respondToIntervention — training-max persistence hook', () => {
    beforeEach(() => {
        setTrainingMaxCalls.length = 0
        interventionStore.current = null
        vi.clearAllMocks()
    })

    it('accepts recalibration_prompt → persists TM from input_payload', async () => {
        interventionStore.current = {
            id: 'i1',
            trigger_type: 'recalibration_prompt',
            input_payload: {
                exercise: 'Squat',
                observedMax: 132,
                coach: 'strength',
                previousMax: 150,
                driftPct: -0.12
            },
            user_accepted: true,
            presented_to_user: true
        }
        const res = await respondToIntervention('i1', true)
        expect(res.success).toBe(true)
        expect(setTrainingMaxCalls).toHaveLength(1)
        expect(setTrainingMaxCalls[0]).toEqual({
            exercise: 'Squat',
            trainingMaxKg: 132,
            source: 'intervention_response'
        })
    })

    it('rejects recalibration_prompt → does NOT persist TM', async () => {
        interventionStore.current = {
            id: 'i1',
            trigger_type: 'recalibration_prompt',
            input_payload: { exercise: 'Squat', observedMax: 132 },
            user_accepted: false,
            presented_to_user: true
        }
        const res = await respondToIntervention('i1', false)
        expect(res.success).toBe(true)
        expect(setTrainingMaxCalls).toHaveLength(0)
    })

    it('accepts non-recalibration trigger → does NOT persist TM', async () => {
        interventionStore.current = {
            id: 'i1',
            trigger_type: 'weekly_review',
            input_payload: { exercise: 'Squat', observedMax: 132 },
            user_accepted: true,
            presented_to_user: true
        }
        const res = await respondToIntervention('i1', true)
        expect(res.success).toBe(true)
        expect(setTrainingMaxCalls).toHaveLength(0)
    })

    it('accepts recalibration_prompt with incomplete payload → does NOT persist TM', async () => {
        interventionStore.current = {
            id: 'i1',
            trigger_type: 'recalibration_prompt',
            input_payload: { observedMax: 132 }, // missing exercise
            user_accepted: true,
            presented_to_user: true
        }
        const res = await respondToIntervention('i1', true)
        expect(res.success).toBe(true)
        expect(setTrainingMaxCalls).toHaveLength(0)
    })
})
