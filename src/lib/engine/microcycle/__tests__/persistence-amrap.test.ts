import { describe, it, expect } from 'vitest'
import { insertLiftingSets } from '../persistence'

function fakeSupabase(captured: { rows?: Array<Record<string, unknown>> }) {
    return {
        from: () => ({
            insert: async (rows: Array<Record<string, unknown>>) => {
                captured.rows = rows
                return { error: null }
            },
        }),
    } as never
}

const session = (exercises: unknown[]) => ({
    name: 'Lower',
    modality: 'LIFTING',
    estimatedDurationMinutes: 60,
    coachNotes: null,
    exercises,
}) as never

describe('insertLiftingSets — AMRAP', () => {
    it('persists isAmrap onto every set row of the exercise', async () => {
        const captured: { rows?: Array<Record<string, unknown>> } = {}
        await insertLiftingSets(fakeSupabase(captured), 'w1', 'u1', session([
            { exerciseName: 'Deadlift', muscleGroup: 'Back', sets: 1, targetReps: 3, targetWeightKg: 85, targetRir: 1, notes: null, isAmrap: true },
            { exerciseName: 'Deadlift (FSL)', muscleGroup: 'Back', sets: 2, targetReps: 5, targetWeightKg: 65, targetRir: 3, notes: null },
        ]))

        expect(captured.rows).toHaveLength(3)
        expect(captured.rows![0].is_amrap).toBe(true)
        expect(captured.rows![1].is_amrap).toBe(false)
        expect(captured.rows![2].is_amrap).toBe(false)
    })

    it('defaults to false when the coach omits the flag', async () => {
        const captured: { rows?: Array<Record<string, unknown>> } = {}
        await insertLiftingSets(fakeSupabase(captured), 'w1', 'u1', session([
            { exerciseName: 'Back Squat', muscleGroup: 'Quads', sets: 3, targetReps: 5, targetWeightKg: 70, targetRir: 2, notes: null },
        ]))
        expect(captured.rows!.every(r => r.is_amrap === false)).toBe(true)
    })

    it('preserves the existing ramp shape: one row per set, targets untouched', async () => {
        const captured: { rows?: Array<Record<string, unknown>> } = {}
        await insertLiftingSets(fakeSupabase(captured), 'w1', 'u1', session([
            { exerciseName: 'Deadlift', muscleGroup: 'Back', sets: 1, targetReps: 3, targetWeightKg: 65, targetRir: 3, notes: null },
            { exerciseName: 'Deadlift', muscleGroup: 'Back', sets: 1, targetReps: 3, targetWeightKg: 75, targetRir: 2, notes: null },
            { exerciseName: 'Deadlift', muscleGroup: 'Back', sets: 1, targetReps: 3, targetWeightKg: 85, targetRir: 1, notes: null, isAmrap: true },
        ]))
        expect(captured.rows!.map(r => r.target_weight_kg)).toEqual([65, 75, 85])
        expect(captured.rows!.map(r => r.is_amrap)).toEqual([false, false, true])
        expect(captured.rows!.map(r => r.set_number)).toEqual([1, 2, 3])
    })
})
