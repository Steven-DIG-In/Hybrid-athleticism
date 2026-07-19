import { describe, it, expect } from 'vitest'
import { suggestNextSetWeight } from '../WorkoutLogger'

describe('suggestNextSetWeight', () => {
    it('returns null when the next set has a prescribed weight — the coach wins', () => {
        expect(suggestNextSetWeight({
            nextTargetWeightKg: 75, previousActualWeightKg: 65, actualRir: 3, targetRir: 3,
        })).toBeNull()
    })

    it('never overrides a ramp even when the athlete missed the target badly', () => {
        expect(suggestNextSetWeight({
            nextTargetWeightKg: 85, previousActualWeightKg: 75, actualRir: 0, targetRir: 2,
        })).toBeNull()
    })

    it('never overrides a ramp even when the athlete sailed through', () => {
        expect(suggestNextSetWeight({
            nextTargetWeightKg: 85, previousActualWeightKg: 75, actualRir: 5, targetRir: 1,
        })).toBeNull()
    })

    it('reproduces the 5/3/1 regression it exists to prevent', () => {
        // Week 2 ramp 65 -> 75 -> 85. Logging set 1 at 65 on target must leave
        // set 2 showing its prescribed 75, not the 65 that was previously
        // written into the field.
        expect(suggestNextSetWeight({
            nextTargetWeightKg: 75, previousActualWeightKg: 65, actualRir: 3, targetRir: 3,
        })).toBeNull()
        expect(suggestNextSetWeight({
            nextTargetWeightKg: 85, previousActualWeightKg: 75, actualRir: 2, targetRir: 2,
        })).toBeNull()
    })

    it('fills an unprescribed set from the previous actual, nudged by RIR', () => {
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 60, actualRir: 4, targetRir: 2,
        })).toBe(65)
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 60, actualRir: 3, targetRir: 2,
        })).toBe(62.5)
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 60, actualRir: 2, targetRir: 2,
        })).toBe(60)
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 60, actualRir: 1, targetRir: 2,
        })).toBe(57.5)
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 60, actualRir: 0, targetRir: 2,
        })).toBe(55)
    })

    it('never suggests a negative weight', () => {
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 2, actualRir: 0, targetRir: 2,
        })).toBe(0)
    })
})
