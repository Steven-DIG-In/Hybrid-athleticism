import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
    state: { training_maxes: {} as Record<string, any> }
}))

vi.mock('@/lib/supabase/server', () => {
    const client = {
        from: vi.fn(() => {
            const chain: any = {
                _filters: {},
                _payload: null as any,
                _isUpdate: false,
                select: vi.fn(() => chain),
                update: vi.fn((p: any) => { chain._payload = p; chain._isUpdate = true; return chain }),
                eq: vi.fn((col: string, v: any) => { chain._filters[col] = v; return chain }),
                maybeSingle: vi.fn(async () => ({
                    data: { training_maxes: state.training_maxes }, error: null
                }))
            }
            // Support: `await supabase.from('profiles').update({...}).eq('id', user.id)`
            // We make chain thenable so it resolves after .eq()
            chain.then = (resolve: any) => {
                if (chain._isUpdate && chain._payload) {
                    state.training_maxes = chain._payload.training_maxes
                }
                resolve({ data: null, error: null })
                return Promise.resolve({ data: null, error: null })
            }
            return chain
        }),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }
    return { createClient: vi.fn(async () => client) }
})

import { getTrainingMax, setTrainingMax } from '../training-maxes.actions'

describe('training-maxes persistence', () => {
    beforeEach(() => { state.training_maxes = {}; vi.clearAllMocks() })

    it('getTrainingMax returns null when exercise not in map', async () => {
        expect(await getTrainingMax('Squat')).toBeNull()
    })

    it('setTrainingMax writes new entry and getTrainingMax reads it back', async () => {
        await setTrainingMax({ exercise: 'Squat', trainingMaxKg: 132.7, source: 'recalibration' })
        const entry = await getTrainingMax('Squat')
        expect(entry?.trainingMaxKg).toBe(132.7)
        expect(entry?.source).toBe('recalibration')
        expect(entry?.updatedAt).toBeDefined()
    })

    it('setTrainingMax preserves other exercises in the map', async () => {
        await setTrainingMax({ exercise: 'Squat', trainingMaxKg: 140, source: 'onboarding' })
        await setTrainingMax({ exercise: 'Bench', trainingMaxKg: 100, source: 'onboarding' })
        expect((await getTrainingMax('Squat'))?.trainingMaxKg).toBe(140)
        expect((await getTrainingMax('Bench'))?.trainingMaxKg).toBe(100)
    })

    it('setTrainingMax overwrites entry for same exercise', async () => {
        await setTrainingMax({ exercise: 'Squat', trainingMaxKg: 140, source: 'onboarding' })
        await setTrainingMax({ exercise: 'Squat', trainingMaxKg: 132, source: 'recalibration' })
        const entry = await getTrainingMax('Squat')
        expect(entry?.trainingMaxKg).toBe(132)
        expect(entry?.source).toBe('recalibration')
    })
})
