import { describe, it, expect } from 'vitest'
import { ARCHETYPE_GOALS, ARCHETYPE_LABELS } from '../archetypes'
import { Constants } from '@/lib/types/database.types'

describe('ARCHETYPE_GOALS', () => {
    it('maps every archetype to a value the mesocycle_goal enum accepts', () => {
        const allowed: readonly string[] = Constants.public.Enums.mesocycle_goal
        for (const archetype of Object.keys(ARCHETYPE_LABELS)) {
            expect(allowed).toContain(ARCHETYPE_GOALS[archetype as keyof typeof ARCHETYPE_GOALS])
        }
    })

    it('maps hybrid to HYBRID_PEAKING, not the rejected HYBRID', () => {
        expect(ARCHETYPE_GOALS.hybrid).toBe('HYBRID_PEAKING')
    })
})
