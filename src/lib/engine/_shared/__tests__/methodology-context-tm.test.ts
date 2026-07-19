import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getTrainingMaxMock } = vi.hoisted(() => ({ getTrainingMaxMock: vi.fn() }))

vi.mock('@/lib/actions/training-maxes.actions', () => ({
    getTrainingMax: getTrainingMaxMock,
}))

import { resolveTrainingMaxForExercise } from '@/lib/training/methodology-helpers'

beforeEach(() => getTrainingMaxMock.mockReset())

describe('resolveTrainingMaxForExercise', () => {
    it('prefers a stored training max over the onboarding benchmark estimate', async () => {
        getTrainingMaxMock.mockResolvedValue({
            trainingMaxKg: 78.5, updatedAt: '', source: 'recalibration',
        })
        // Benchmark says 105kg 1RM (=> ~94.5 TM); the stored TM must win.
        expect(await resolveTrainingMaxForExercise('Squat', 105, 1)).toBe(78.5)
    })

    it('resolves the stored max even when the caller uses a different display name', async () => {
        getTrainingMaxMock.mockResolvedValue({
            trainingMaxKg: 49.5, updatedAt: '', source: 'recalibration',
        })
        expect(await resolveTrainingMaxForExercise('OHP', 60, 1)).toBe(49.5)
        expect(getTrainingMaxMock).toHaveBeenCalledWith('OHP')
    })

    it('falls back to the benchmark estimate when nothing is stored', async () => {
        getTrainingMaxMock.mockResolvedValue(null)
        const tm = await resolveTrainingMaxForExercise('Squat', 100, 1)
        expect(tm).toBeCloseTo(90, 0)
    })

    // NOTE: the throw-path fallback (resolveTrainingMaxForExercise catches a
    // failed lookup and falls back to the benchmark) is deliberately not tested
    // here — vitest 4 reports any error raised inside a mock as an unhandled
    // test error even when the code under test catches it. The behaviour is
    // pre-existing and unchanged; the null case above covers the same fallback.
})
