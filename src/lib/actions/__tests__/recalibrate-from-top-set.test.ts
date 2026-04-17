import { describe, it, expect, beforeEach, vi } from 'vitest'

const { recalibrationCalls } = vi.hoisted(() => ({
    recalibrationCalls: [] as any[]
}))

vi.mock('../recalibration.actions', () => ({
    evaluateRecalibration: vi.fn(async (input: any) => {
        recalibrationCalls.push(input)
        return { tier: 'logged', applied: true, newMax: input.observedMax, driftPct: -0.05 }
    })
}))

vi.mock('@/lib/supabase/server', () => {
    const state = {
        workouts: new Map<string, any>([
            ['w-lift', {
                id: 'w-lift', user_id: 'u1', modality: 'LIFTING',
                microcycle_id: 'mc-1', session_inventory_id: 'si1',
                exercise_sets: [
                    { exercise_name: 'Squat', set_number: 1,
                      target_weight_kg: 100, target_reps: 5,
                      actual_weight_kg: 100, actual_reps: 5, rpe_actual: 8 },
                    { exercise_name: 'Squat', set_number: 2,
                      target_weight_kg: 110, target_reps: 3,
                      actual_weight_kg: 105, actual_reps: 3, rpe_actual: 9 },
                    { exercise_name: 'Bench', set_number: 1,
                      target_weight_kg: 80, target_reps: 5,
                      actual_weight_kg: 80, actual_reps: 5, rpe_actual: 8 }
                ]
            }],
            ['w-cardio', {
                id: 'w-cardio', user_id: 'u1', modality: 'CARDIO',
                exercise_sets: []
            }],
            ['w-empty', {
                id: 'w-empty', user_id: 'u1', modality: 'LIFTING',
                microcycle_id: 'mc-1', session_inventory_id: null,
                exercise_sets: []
            }]
        ]),
        session_inventory: new Map<string, any>([
            ['si1', { id: 'si1', user_id: 'u1', mesocycle_id: 'meso-1', week_number: 2 }]
        ])
    }

    const buildChain = (table: string, store: Map<string, any>) => {
        const chain: any = {
            _filters: {},
            select: vi.fn(() => chain),
            eq: vi.fn((col: string, v: any) => { chain._filters[col] = v; return chain }),
            maybeSingle: vi.fn(async () => ({
                data: store.get(chain._filters.id) ?? null, error: null
            }))
        }
        return chain
    }

    const client = {
        from: vi.fn((table: string) => {
            if (table === 'workouts') return buildChain('workouts', state.workouts)
            if (table === 'session_inventory') return buildChain('session_inventory', state.session_inventory)
            throw new Error(`unexpected table ${table}`)
        }),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }
    return { createClient: vi.fn(async () => client) }
})

import { recalibrateFromTopSet } from '../recalibrate-from-top-set.actions'

describe('recalibrateFromTopSet', () => {
    beforeEach(() => { recalibrationCalls.length = 0; vi.clearAllMocks() })

    it('fires one evaluateRecalibration per distinct exercise in a LIFTING workout', async () => {
        await recalibrateFromTopSet('w-lift')
        const exercises = recalibrationCalls.map(c => c.evidence.exercise).sort()
        expect(exercises).toEqual(['Bench', 'Squat'])
    })

    it('picks the heaviest target set as the top set (per exercise)', async () => {
        await recalibrateFromTopSet('w-lift')
        const squatCall = recalibrationCalls.find(c => c.evidence.exercise === 'Squat')
        expect(squatCall.evidence.topSet.targetWeightKg).toBe(110)
    })

    it('passes mesocycleId, weekNumber, microcycleId through', async () => {
        await recalibrateFromTopSet('w-lift')
        const call = recalibrationCalls[0]
        expect(call.mesocycleId).toBe('meso-1')
        expect(call.weekNumber).toBe(2)
        expect(call.microcycleId).toBe('mc-1')
    })

    it('no-ops on non-LIFTING workouts', async () => {
        await recalibrateFromTopSet('w-cardio')
        expect(recalibrationCalls).toHaveLength(0)
    })

    it('no-ops on LIFTING workouts with no exercise_sets', async () => {
        await recalibrateFromTopSet('w-empty')
        expect(recalibrationCalls).toHaveLength(0)
    })

    it('logs and continues when evaluateRecalibration throws for one exercise', async () => {
        const reca = await import('../recalibration.actions')
        const orig = reca.evaluateRecalibration
        let callCount = 0
        ;(reca as any).evaluateRecalibration = vi.fn(async (input: any) => {
            callCount++
            if (input.evidence.exercise === 'Squat') throw new Error('gate failed')
            return { tier: 'visible', applied: true, newMax: input.observedMax, driftPct: 0 }
        })
        try {
            await expect(recalibrateFromTopSet('w-lift')).resolves.toBeUndefined()
            expect(callCount).toBe(2) // both exercises attempted
        } finally {
            ;(reca as any).evaluateRecalibration = orig
        }
    })
})
