import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockState, mockFrom } = vi.hoisted(() => {
    const mockState = { profile: { training_maxes: {} as Record<string, unknown> } }
    const mockFrom = vi.fn()
    return { mockState, mockFrom }
})

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
        from: mockFrom,
    }),
}))
vi.mock('@/lib/athlete/capabilities.actions', () => ({
    recordCapability: vi.fn(async () => undefined),
}))

import { getTrainingMax, setTrainingMax } from '../training-maxes.actions'
import { recordCapability } from '@/lib/athlete/capabilities.actions'

beforeEach(() => {
    mockState.profile = { training_maxes: {} }
    vi.mocked(recordCapability).mockClear()
    mockFrom.mockImplementation(() => ({
        select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockState.profile, error: null }) }),
        }),
        update: (patch: { training_maxes: Record<string, unknown> }) => {
            mockState.profile.training_maxes = patch.training_maxes
            return { eq: async () => ({ error: null }) }
        },
    }))
})

describe('training-max key normalization', () => {
    it('stores under the canonical key regardless of the display name used', async () => {
        await setTrainingMax({ exercise: 'Back Squat', trainingMaxKg: 78.5, source: 'recalibration' })
        expect(Object.keys(mockState.profile.training_maxes)).toEqual(['back_squat'])
    })

    it('closes the loop: written as "Back Squat", read as "Squat"', async () => {
        await setTrainingMax({ exercise: 'Back Squat', trainingMaxKg: 78.5, source: 'recalibration' })
        const found = await getTrainingMax('Squat')
        expect(found?.trainingMaxKg).toBe(78.5)
    })

    it('closes the loop for OHP too', async () => {
        await setTrainingMax({ exercise: 'Overhead Press', trainingMaxKg: 49.5, source: 'recalibration' })
        expect((await getTrainingMax('OHP'))?.trainingMaxKg).toBe(49.5)
    })

    it('collapses warm-up and supplemental variants onto the parent lift', async () => {
        await setTrainingMax({ exercise: 'Back Squat (Warm-up)', trainingMaxKg: 31.5, source: 'recalibration' })
        expect(Object.keys(mockState.profile.training_maxes)).toEqual(['back_squat'])
    })

    it('refuses to write a training max for an accessory', async () => {
        const res = await setTrainingMax({ exercise: 'Romanian Deadlift', trainingMaxKg: 87, source: 'recalibration' })
        expect(res).toBeNull()
        expect(mockState.profile.training_maxes).toEqual({})
    })

    it('returns null when reading an accessory', async () => {
        expect(await getTrainingMax('Bulgarian Split Squat')).toBeNull()
    })

    it('writes through to the capability store using a registry-resolvable label', async () => {
        await setTrainingMax({ exercise: 'Back Squat (FSL)', trainingMaxKg: 80, source: 'recalibration' })
        expect(recordCapability).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'back squat', value: 80 })
        )
    })

    it('preserves other lifts when writing one', async () => {
        await setTrainingMax({ exercise: 'Deadlift', trainingMaxKg: 94.5, source: 'recalibration' })
        await setTrainingMax({ exercise: 'Bench Press', trainingMaxKg: 59.5, source: 'recalibration' })
        expect(mockState.profile.training_maxes).toMatchObject({
            deadlift: expect.objectContaining({ trainingMaxKg: 94.5 }),
            bench_press: expect.objectContaining({ trainingMaxKg: 59.5 }),
        })
    })
})
