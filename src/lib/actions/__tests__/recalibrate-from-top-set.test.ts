import { describe, it, expect, beforeEach, vi } from 'vitest'

const { recalibrationCalls, setTrainingMaxCalls, tierOverride } = vi.hoisted(() => ({
    recalibrationCalls: [] as any[],
    setTrainingMaxCalls: [] as any[],
    tierOverride: { value: 'logged' as string }
}))

vi.mock('../recalibration.actions', () => ({
    evaluateRecalibration: vi.fn(async (input: any) => {
        recalibrationCalls.push(input)
        return {
            tier: tierOverride.value,
            applied: tierOverride.value !== 'intervention',
            newMax: input.observedMax,
            driftPct: -0.05
        }
    })
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
            }],
            // Athlete logs RIR, never RPE — rpe_actual is null in production.
            ['w-rir', {
                id: 'w-rir', user_id: 'u1', modality: 'LIFTING',
                microcycle_id: 'mc-1', session_inventory_id: null,
                exercise_sets: [
                    { exercise_name: 'Back Squat', set_number: 1, is_amrap: true,
                      target_weight_kg: 85, target_reps: 3,
                      actual_weight_kg: 85, actual_reps: 3,
                      rpe_actual: null, rir_actual: 1 }
                ]
            }],
            ['w-amrap', {
                id: 'w-amrap', user_id: 'u1', modality: 'LIFTING',
                microcycle_id: 'mc-1', session_inventory_id: null,
                exercise_sets: [
                    { exercise_name: 'Deadlift', set_number: 1, is_amrap: false,
                      target_weight_kg: 90, target_reps: 3,
                      actual_weight_kg: 90, actual_reps: 3,
                      rpe_actual: null, rir_actual: 2 },
                    { exercise_name: 'Deadlift', set_number: 2, is_amrap: true,
                      target_weight_kg: 85, target_reps: 3,
                      actual_weight_kg: 85, actual_reps: 8,
                      rpe_actual: null, rir_actual: 0 }
                ]
            }],
            ['w-variants', {
                id: 'w-variants', user_id: 'u1', modality: 'LIFTING',
                microcycle_id: 'mc-1', session_inventory_id: null,
                exercise_sets: [
                    { exercise_name: 'Back Squat (Warm-up)', set_number: 1, is_amrap: false,
                      target_weight_kg: 52.5, target_reps: 5,
                      actual_weight_kg: 52.5, actual_reps: 5,
                      rpe_actual: null, rir_actual: 4 },
                    { exercise_name: 'Back Squat', set_number: 2, is_amrap: true,
                      target_weight_kg: 85, target_reps: 3,
                      actual_weight_kg: 85, actual_reps: 5,
                      rpe_actual: null, rir_actual: 1 },
                    { exercise_name: 'Back Squat (FSL)', set_number: 3, is_amrap: false,
                      target_weight_kg: 65, target_reps: 5,
                      actual_weight_kg: 65, actual_reps: 5,
                      rpe_actual: null, rir_actual: 3 }
                ]
            }],
            ['w-accessory', {
                id: 'w-accessory', user_id: 'u1', modality: 'LIFTING',
                microcycle_id: 'mc-1', session_inventory_id: null,
                exercise_sets: [
                    { exercise_name: 'Romanian Deadlift', set_number: 1, is_amrap: false,
                      target_weight_kg: 67.5, target_reps: 10,
                      actual_weight_kg: 67.5, actual_reps: 10,
                      rpe_actual: null, rir_actual: 2 }
                ]
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
    beforeEach(() => {
        recalibrationCalls.length = 0
        setTrainingMaxCalls.length = 0
        tierOverride.value = 'logged'
        vi.clearAllMocks()
    })

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
            // Resolves with a summary containing only the exercise that succeeded.
            const summary = await recalibrateFromTopSet('w-lift')
            expect(summary.map(e => e.exercise)).toEqual(['Bench'])
            expect(callCount).toBe(2) // both exercises attempted
        } finally {
            ;(reca as any).evaluateRecalibration = orig
        }
    })

    it('persists TM on logged tier; skips persistence on intervention tier', async () => {
        // First pass: logged tier → setTrainingMax should fire for each exercise
        tierOverride.value = 'logged'
        await recalibrateFromTopSet('w-lift')
        expect(setTrainingMaxCalls).toHaveLength(2)
        const exercises = setTrainingMaxCalls.map(c => c.exercise).sort()
        expect(exercises).toEqual(['Bench', 'Squat'])
        for (const call of setTrainingMaxCalls) {
            expect(call.source).toBe('recalibration')
            expect(typeof call.trainingMaxKg).toBe('number')
        }

        // Second pass: intervention tier → setTrainingMax must NOT fire
        setTrainingMaxCalls.length = 0
        tierOverride.value = 'intervention'
        await recalibrateFromTopSet('w-lift')
        expect(setTrainingMaxCalls).toHaveLength(0)
    })
})

// ─── Effort, top-set selection and grouping (2026-07-19) ────────────────────

describe('recalibrateFromTopSet — effort and top-set selection', () => {
    beforeEach(() => {
        recalibrationCalls.length = 0
        setTrainingMaxCalls.length = 0
        tierOverride.value = 'logged'
        vi.clearAllMocks()
    })

    it('derives rpe from rir_actual so logged effort reaches the estimator', async () => {
        // 'w-rir': 85kg x3 @ RIR 1. rpe = 10 - 1 = 9 => effectiveReps = 3 + 1 = 4
        // => 1RM = 85 * (1 + 4/30) = 96.3 => TM = 86.5. Without the RIR bridge
        // rpe is undefined, effectiveReps = 3, and the TM lands lower.
        const summary = await recalibrateFromTopSet('w-rir')
        expect(summary).toHaveLength(1)
        expect(summary[0].observedTrainingMaxKg).toBeGreaterThan(85)
    })

    it('prefers the AMRAP set over a heavier-targeted non-AMRAP set', async () => {
        // 'w-amrap': 90kg x3 (not AMRAP) and 85kg x8 (AMRAP). The 8-rep AMRAP is
        // the real strength signal even though it is the lighter load.
        const summary = await recalibrateFromTopSet('w-amrap')
        expect(summary).toHaveLength(1)
        expect(summary[0].estimated1RMKg).toBeGreaterThan(100)
    })

    it('groups warm-up and FSL variants under the parent lift', async () => {
        const summary = await recalibrateFromTopSet('w-variants')
        expect(summary).toHaveLength(1)
        expect(summary[0].exercise).toBe('Back Squat')
    })

    it('does not emit a summary entry for accessories', async () => {
        const summary = await recalibrateFromTopSet('w-accessory')
        expect(summary).toEqual([])
        expect(recalibrationCalls).toHaveLength(0)
    })

    it('reports applied=false when the training max was not persisted', async () => {
        tierOverride.value = 'intervention'
        const summary = await recalibrateFromTopSet('w-rir')
        expect(summary[0].applied).toBe(false)
    })
})
