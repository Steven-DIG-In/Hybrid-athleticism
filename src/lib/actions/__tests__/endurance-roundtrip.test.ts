import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DayAllocation, SessionInventory } from '@/lib/types/inventory.types'

// Round-trip test for the CARDIO endurance prescription:
//   generate (writes workouts.endurance_prescription, covered by Task 3) →
//   convertWorkoutsToInventory copies it onto session_inventory.adjustment_pending.endurancePrescription →
//   applyAllocation copies it back onto the new workout's endurance_prescription column.
//
// Each `it` block uses vi.doMock + vi.resetModules + a dynamic import so the
// two halves of the round trip (convert vs allocate) can mock
// '../inventory.actions' and '../block-pointer.actions' independently without
// one test's module mocks leaking into the other.

const FAKE_PRESCRIPTION = {
    modality: 'run',
    totalDistanceKm: 8,
    segments: [{ kind: 'steady', distanceKm: 8, targetPaceSecPerKm: 300 }],
}

describe('endurance prescription round-trip', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
    })

    it('convertWorkoutsToInventory copies endurance_prescription into adjustment_pending for a CARDIO temp workout', async () => {
        vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))

        // The expensive AI call — return one CARDIO temp workout carrying
        // endurance_prescription (as Task 3 writes it during generation).
        vi.doMock('@/lib/engine/microcycle/generate-pool', () => ({
            generateSessionPool: vi.fn(async () => ({
                success: true,
                data: {
                    workouts: [
                        {
                            id: 'temp-w1',
                            modality: 'CARDIO',
                            name: 'Easy Run',
                            coach_notes: null,
                            endurance_prescription: FAKE_PRESCRIPTION,
                        },
                    ],
                    sessionPool: { sessions: [] },
                },
            })),
        }))

        // Auto-allocation is irrelevant to this half of the round trip — make
        // it fail fast (non-blocking, generateWeekInventory tolerates it) so
        // we only observe the session_inventory insert convert produces.
        vi.doMock('../inventory.actions', () => ({
            suggestAllocation: vi.fn(async () => ({ success: false, error: 'not under test' })),
            applyAllocation: vi.fn(async () => ({ success: false, error: 'not under test' })),
        }))

        const sessionInventoryInserts: Record<string, unknown>[] = []

        vi.doMock('@/lib/supabase/server', () => {
            const buildChain = (table: string): any => {
                const chain: any = {
                    select: vi.fn(() => chain),
                    eq: vi.fn(() => chain),
                    in: vi.fn(() => chain),
                    order: vi.fn(() => chain),
                    limit: vi.fn(() => chain),
                    insert: vi.fn((payload: any) => {
                        if (table === 'session_inventory') sessionInventoryInserts.push(payload)
                        return chain
                    }),
                    delete: vi.fn(() => chain),
                    single: vi.fn(async () => {
                        if (table === 'microcycles') {
                            return { data: { id: 'micro-1', week_number: 2, mesocycle_id: 'meso-1' }, error: null }
                        }
                        return { data: null, error: null }
                    }),
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    then: (resolve: any) => {
                        // Idempotency-guard count read + generic list reads.
                        if (table === 'session_inventory') return resolve({ data: null, count: 0, error: null })
                        if (table === 'workouts') return resolve({ data: [], error: null })
                        if (table === 'microcycles') {
                            // Grid read by rebaseMicrocyclesFromWeek; week 2 starts
                            // today so the rebase is a no-op here.
                            const today = new Date().toISOString().split('T')[0]
                            const plus = (d: number) =>
                                new Date(Date.parse(today) + d * 86_400_000).toISOString().split('T')[0]
                            return resolve({
                                data: [{ id: 'micro-1', week_number: 2, start_date: today, end_date: plus(6) }],
                                error: null,
                            })
                        }
                        return resolve({ data: null, error: null })
                    },
                }
                return chain
            }

            const client = {
                from: vi.fn((table: string) => buildChain(table)),
                auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
            }
            return { createClient: vi.fn(async () => client) }
        })

        const { generateWeekInventory } = await import('../inventory-generation.actions')

        const result = await generateWeekInventory('micro-1', { force: true })

        expect(result.success).toBe(true)
        expect(sessionInventoryInserts).toHaveLength(1)
        expect(sessionInventoryInserts[0].adjustment_pending).toEqual({
            endurancePrescription: FAKE_PRESCRIPTION,
        })
    })

    it("applyAllocation's workout insert payload includes endurance_prescription from session.adjustment_pending", async () => {
        // Undo the previous test's mock of '../inventory.actions' — that test
        // needed applyAllocation stubbed out; this test needs the real one.
        // vi.resetModules() clears the module cache but not doMock registrations.
        vi.doUnmock('../inventory.actions')

        vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))

        vi.doMock('../block-pointer.actions', () => ({
            initBlockPointer: vi.fn(async (mesocycleId: string, weekNumber: number) => ({
                id: 'p1',
                user_id: 'u1',
                mesocycle_id: mesocycleId,
                week_number: weekNumber,
                next_training_day: 1,
                created_at: '2026-04-17T00:00:00Z',
                updated_at: '2026-04-17T00:00:00Z',
            })),
        }))

        const workoutInserts: Record<string, unknown>[] = []

        vi.doMock('@/lib/supabase/server', () => {
            const microcycle = { id: 'micro-1', start_date: '2026-04-20' }

            const buildChain = (table: string): any => {
                const chain: any = {
                    select: vi.fn(() => chain),
                    eq: vi.fn(() => chain),
                    insert: vi.fn((payload: any) => {
                        if (table === 'workouts') workoutInserts.push(payload)
                        return chain
                    }),
                    update: vi.fn(() => chain),
                    maybeSingle: vi.fn(async () => {
                        if (table === 'microcycles') return { data: microcycle, error: null }
                        if (table === 'check_in_windows') return { data: null, error: null }
                        return { data: null, error: null }
                    }),
                    single: vi.fn(async () => {
                        if (table === 'microcycles') return { data: microcycle, error: null }
                        if (table === 'workouts') return { data: { id: 'w1' }, error: null }
                        return { data: null, error: null }
                    }),
                    then: vi.fn((resolve: any) => {
                        resolve({ data: null, error: null })
                        return Promise.resolve()
                    }),
                }
                return chain
            }

            const client = {
                from: vi.fn((table: string) => buildChain(table)),
                auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
            }
            return { createClient: vi.fn(async () => client) }
        })

        const { applyAllocation } = await import('../inventory.actions')

        function makeSession(overrides: Partial<SessionInventory> = {}): SessionInventory {
            return {
                id: 'si1',
                mesocycle_id: 'meso-1',
                user_id: 'u1',
                week_number: 2,
                session_priority: 1,
                modality: 'CARDIO',
                name: 'Easy Run',
                coach_notes: null,
                estimated_duration_minutes: 45,
                load_budget: null,
                scheduled_date: null,
                training_day: null,
                session_slot: null,
                completed_at: null,
                is_approved: true,
                carry_over_notes: null,
                adjustment_pending: { endurancePrescription: FAKE_PRESCRIPTION } as unknown as SessionInventory['adjustment_pending'],
                created_at: '2026-04-17T00:00:00Z',
                updated_at: '2026-04-17T00:00:00Z',
                ...overrides,
            }
        }

        const allocation: DayAllocation = {
            days: [
                {
                    dayNumber: 1,
                    sessions: [{ session: makeSession(), slot: 1, reasoning: 'primary' }],
                },
            ],
            warnings: [],
            totalTrainingDays: 1,
        }

        const result = await applyAllocation(allocation)

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.allocated).toBeGreaterThan(0)
        }
        expect(workoutInserts).toHaveLength(1)
        expect(workoutInserts[0].endurance_prescription).toEqual(FAKE_PRESCRIPTION)
    })
})
