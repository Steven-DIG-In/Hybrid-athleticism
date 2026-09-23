import { describe, it, expect } from 'vitest'
import { rangesFromCoachCounts } from '../programming'

describe('rangesFromCoachCounts', () => {
    it('folds strength + hypertrophy into lifting, ±1', () => {
        const r = rangesFromCoachCounts({ strength: 2, hypertrophy: 2, endurance: 2, conditioning: 1, mobility: 1 })
        expect(r.lifting).toEqual([3, 5])
        expect(r.endurance).toEqual([1, 3])
        expect(r.conditioning).toEqual([0, 2])
        expect(r.mobility).toEqual([0, 2])
    })

    it('allows 4 lifting sessions — the static hybrid_fitness table capped it at 3', () => {
        const r = rangesFromCoachCounts({ strength: 2, hypertrophy: 2 })
        expect(4).toBeGreaterThanOrEqual(r.lifting[0])
        expect(4).toBeLessThanOrEqual(r.lifting[1])
    })

    it('counts recovery as mobility and never goes below zero', () => {
        const r = rangesFromCoachCounts({ recovery: 1 })
        expect(r.mobility).toEqual([0, 2])
        expect(r.conditioning).toEqual([0, 1])
    })
})
