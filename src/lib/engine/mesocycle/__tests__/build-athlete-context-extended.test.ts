import { describe, expect, it, vi, beforeEach } from 'vitest'

const state: { retrospective: any; pendingNotes: any } = {
    retrospective: null,
    pendingNotes: null,
}

vi.mock('@/lib/supabase/server', () => {
    // Lightweight chainable query builder — handles any sequence of
    // .eq/.order/.limit calls and terminates with .single / .maybeSingle
    // or via direct await (thenable). The behaviour is determined by the
    // table name passed to from().
    function makeBuilder(table: string, columns: string) {
        const profileSelectsPendingNotes =
            table === 'profiles' && columns.includes('pending_planner_notes')

        const dataFor = () => {
            if (table === 'profiles' && profileSelectsPendingNotes) {
                return { pending_planner_notes: state.pendingNotes }
            }
            if (table === 'profiles') {
                return {
                    id: 'user-1',
                    coaching_team: null,
                    goal_archetype: 'hybrid_fitness',
                    pending_planner_notes: state.pendingNotes,
                }
            }
            if (table === 'mesocycles') {
                return { id: 'meso-1', user_id: 'user-1', goal: 'HYBRID_PEAKING', week_count: 6 }
            }
            if (table === 'microcycles') {
                return { id: 'micro-1', is_deload: false, target_rir: 2 }
            }
            if (table === 'block_retrospectives') {
                return state.retrospective
                    ? { snapshot_json: state.retrospective }
                    : null
            }
            return null
        }

        const arrayFor = () => {
            if (table === 'athlete_injuries') return []
            if (table === 'athlete_benchmarks') return []
            if (table === 'recent_training_activity') return []
            return []
        }

        const builder: any = {}
        const passthrough = () => builder
        builder.eq = vi.fn(passthrough)
        builder.order = vi.fn(passthrough)
        builder.limit = vi.fn(passthrough)
        builder.in = vi.fn(passthrough)
        builder.single = vi.fn(async () => ({ data: dataFor(), error: null }))
        builder.maybeSingle = vi.fn(async () => ({ data: dataFor(), error: null }))
        // Make the builder thenable so `await builder` resolves to an array
        // result for terminal queries like .eq().eq() with no .single().
        builder.then = (resolve: any) =>
            resolve({ data: arrayFor(), error: null })
        return builder
    }

    return {
        createClient: vi.fn(async () => ({
            auth: {
                getUser: vi.fn(async () => ({
                    data: { user: { id: 'user-1' } },
                    error: null,
                })),
            },
            from: vi.fn((table: string) => ({
                select: vi.fn((columns: string = '*') => makeBuilder(table, columns)),
            })),
        })),
    }
})

import { buildAthleteContext } from '@/lib/engine/mesocycle/context'

describe('buildAthleteContext — carryover extension', () => {
    beforeEach(() => {
        state.retrospective = null
        state.pendingNotes = null
    })

    it('returns retrospective when present', async () => {
        state.retrospective = {
            schemaVersion: '1.0',
            block: { id: 'b1', name: 'Test' },
            adherence: {
                overall: { completed: 21, prescribed: 51, pct: 41 },
                byCoachDomain: [],
                byWeek: [],
            },
            executionQuality: [],
            recalibrations: [],
            interventions: [],
            missedSessions: [],
            generatedAt: new Date().toISOString(),
        }
        const r = await buildAthleteContext('user-1', 'meso-1', 1)
        expect(r.success).toBe(true)
        expect(r.success && r.data.latestBlockRetrospective?.adherence.overall.pct).toBe(41)
    })

    it('returns pending planner notes when present', async () => {
        state.pendingNotes = {
            schemaVersion: 1,
            source: 'block_close',
            capturedAt: new Date().toISOString(),
            availability: {
                daysPerWeek: 6,
                sessionMinutes: 75,
                warmupMinutes: 20,
                cooldownMinutes: 0,
            },
            freeText: 'test',
        }
        const r = await buildAthleteContext('user-1', 'meso-1', 1)
        expect(r.success).toBe(true)
        expect(r.success && r.data.pendingPlannerNotes?.availability?.daysPerWeek).toBe(6)
    })

    it('returns null carryover when neither exists', async () => {
        const r = await buildAthleteContext('user-1', 'meso-1', 1)
        expect(r.success).toBe(true)
        expect(r.success && r.data.latestBlockRetrospective).toBeNull()
        expect(r.success && r.data.pendingPlannerNotes).toBeNull()
    })
})
