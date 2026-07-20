import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Guards the prescription/execution boundary from the code side.
 *
 * Migration 026 revokes UPDATE on the prescription columns for `authenticated`,
 * so a regression here fails at runtime in production. This test fails it in CI
 * instead.
 *
 * The rule: the execution surface writes actuals. It never writes targets, and
 * it never writes `notes` — generation-owned commentary (tempo cues, "AMRAP
 * set", benchmark markers). `updateExerciseSet` used to write
 * `notes: input.notes ?? null`, and because the logger never passes notes,
 * completing a set NULLED the coach's note on it.
 */

const { updates } = vi.hoisted(() => ({ updates: [] as Record<string, unknown>[] }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
    const chain = (): Record<string, unknown> => {
        const c: Record<string, unknown> = {
            select: () => c,
            update: (patch: Record<string, unknown>) => { updates.push(patch); return c },
            eq: () => c,
            not: () => c,
            order: () => c,
            limit: () => c,
            maybeSingle: async () => ({ data: null, error: null }),
            single: async () => ({ data: { id: 's1', workout_id: 'w1' }, error: null }),
        }
        return c
    }
    return {
        createClient: async () => ({
            auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
            from: () => chain(),
        }),
    }
})

import { updateExerciseSet } from '../logging.actions'

const PRESCRIPTION_COLUMNS = [
    'target_reps',
    'target_weight_kg',
    'target_rir',
    'is_amrap',
    'notes',
]

beforeEach(() => { updates.length = 0 })

describe('prescription/execution ownership', () => {
    it('updateExerciseSet never writes a prescription column', async () => {
        await updateExerciseSet('s1', {
            actualReps: 5,
            actualWeightKg: 80,
            rirActual: 2,
        })

        expect(updates.length).toBeGreaterThan(0)
        for (const patch of updates) {
            for (const col of PRESCRIPTION_COLUMNS) {
                expect(
                    Object.prototype.hasOwnProperty.call(patch, col),
                    `updateExerciseSet must not write "${col}" — migration 026 revokes it`,
                ).toBe(false)
            }
        }
    })

    it('updateExerciseSet does write the execution columns', async () => {
        await updateExerciseSet('s1', {
            actualReps: 5,
            actualWeightKg: 80,
            rirActual: 2,
        })

        const patch = updates.find(u => 'actual_reps' in u)
        expect(patch).toBeDefined()
        expect(patch).toMatchObject({
            actual_reps: 5,
            actual_weight_kg: 80,
            rir_actual: 2,
        })
    })
})
