import { describe, it, expect } from 'vitest'
import { buildMesocycleStrategyUserPrompt } from '../head-coach'
import type { AthleteContextPacket } from '@/lib/types/coach-context'

function makeCtx(aiContextJson: Record<string, unknown>): AthleteContextPacket {
    return {
        profile: {
            equipment_list: [], goal_archetype: 'hybrid_fitness', available_days: 7, session_duration_minutes: 75,
            training_maxes: { back_squat: { trainingMaxKg: 87 }, 'Barbell Row': { trainingMaxKg: 80 } },
        },
        totalWeeks: 4,
        coachingTeam: [{ coach: 'strength', priority: 1 }],
        injuries: [{
            body_area: 'other', severity: 'moderate', is_active: true, movements_to_avoid: [],
            description: 'Pneumonia late Aug; rebuild conditioning gradually',
        }],
        benchmarks: [],
        recentTraining: [{ modality: 'swimming', frequency_per_week: 3, approximate_volume: '1.5km open water' }],
        pendingPlannerNotes: null,
        aiContextJson,
    } as unknown as AthleteContextPacket
}

const carryover = { daysPerWeek: 6, sessionMinutes: 70, warmupMinutes: 10, cooldownMinutes: 0, freeText: 'TRT started 23 Sep' }

describe('head-coach strategy user prompt', () => {
    it('passes the wizard availability and notes through in post-block mode', () => {
        const prompt = buildMesocycleStrategyUserPrompt(makeCtx({ mode: 'post-block', archetype: 'hybrid', carryover }))
        expect(prompt).toContain('Days/week: 6')
        expect(prompt).toContain('Free text: TRT started 23 Sep')
    })

    it('shows the injury description, not just body area and severity', () => {
        const prompt = buildMesocycleStrategyUserPrompt(makeCtx({ mode: 'post-block', archetype: 'hybrid', carryover }))
        expect(prompt).toContain('Pneumonia late Aug')
    })

    it('shows recent training', () => {
        const prompt = buildMesocycleStrategyUserPrompt(makeCtx({ mode: 'post-block', archetype: 'hybrid', carryover }))
        expect(prompt).toContain('swimming: 3x/week, ~1.5km open water')
    })

    it('states the block length so the strategy covers exactly those weeks', () => {
        const prompt = buildMesocycleStrategyUserPrompt(makeCtx({ mode: 'post-block', archetype: 'hybrid', carryover }))
        expect(prompt).toContain('Length: 4 weeks')
        expect(prompt).toContain('week 4 is the deload')
    })

    it('shows the stored main-lift training maxes, not accessory entries', () => {
        const prompt = buildMesocycleStrategyUserPrompt(makeCtx({ mode: 'post-block', archetype: 'hybrid', carryover }))
        expect(prompt).toContain('back squat: 87 kg')
        expect(prompt).not.toContain('Barbell Row')
    })
})

// 2026-10-26: Block 7 was planned as a "Post-Pneumonia Rebuild" a month after the
// athlete came back, because the injury and recent-training rows written on
// return day read as present-tense facts and the last block's actuals said
// nothing about performance.
describe('head-coach strategy prompt — stale context vs last block', () => {
    const NOW = new Date('2026-10-26T09:00:00Z')

    function staleCtx(retro: unknown) {
        const ctx = makeCtx({ mode: 'post-block', archetype: 'hybrid', carryover }) as unknown as Record<string, unknown>
        ctx.injuries = [{
            body_area: 'other', severity: 'moderate', is_active: true, movements_to_avoid: [],
            description: 'Pneumonia, now returning after ~7 weeks off',
            created_at: '2026-09-23T15:09:41Z',
        }]
        ctx.recentTraining = [{
            modality: 'lifting', frequency_per_week: 2, approximate_volume: 'first back after 7 wks off',
            captured_at: '2026-09-23T15:09:41Z',
        }]
        ctx.latestBlockRetrospective = retro
        return ctx as unknown as AthleteContextPacket
    }

    const retro = {
        block: { name: 'HYPERTROPHY Block 6', startDate: '2026-09-23', endDate: '2026-10-20', closedAt: '2026-10-24T05:50:34Z', weekCount: 4 },
        adherence: {
            overall: { prescribed: 24, completed: 12, missed: 12, pct: 50 },
            byCoachDomain: { strength: { prescribed: 9, completed: 9, missed: 0, pct: 100 } },
            byWeek: [],
        },
        executionQuality: {
            byCoachDomain: {
                strength: { sessionsWithDeltas: 9, meanDeltaPct: 6, classificationCounts: { over: 15, on: 6, under: 7 } },
                endurance: { sessionsWithDeltas: 0, meanDeltaPct: 0, classificationCounts: { over: 0, on: 0, under: 0 } },
            },
        },
        recalibrations: [
            { exerciseName: 'Back Squat', fromKg: 74.5, toKg: 79, source: 'recalibration', triggeredBy: 'drift_5_to_10', occurredAt: '2026-10-06T16:23:32Z' },
            { exerciseName: 'Bench Press', fromKg: 70, toKg: 72, source: 'recalibration', triggeredBy: 'drift_lt_5', occurredAt: '2026-10-12T09:14:49Z' },
            { exerciseName: 'Bench Press', fromKg: 70, toKg: 72, source: 'recalibration', triggeredBy: 'drift_lt_5', occurredAt: '2026-10-12T09:14:49Z' },
        ],
        interventions: [],
        missedSessions: [],
    }

    it('dates the injury and says how long ago it was recorded', () => {
        const prompt = buildMesocycleStrategyUserPrompt(staleCtx(null), NOW)
        expect(prompt).toContain('recorded 2026-09-23, 33 days ago')
    })

    it('dates recent training and flags it as possibly out of date', () => {
        const prompt = buildMesocycleStrategyUserPrompt(staleCtx(null), NOW)
        expect(prompt).toContain('lifting: 2x/week, ~first back after 7 wks off')
        expect(prompt).toContain('recorded 2026-09-23, 33 days ago — may be out of date')
    })

    it('does not flag recent training captured within the last two weeks', () => {
        const ctx = staleCtx(null) as unknown as { recentTraining: Array<{ captured_at: string }> }
        ctx.recentTraining[0].captured_at = '2026-10-20T09:00:00Z'
        const prompt = buildMesocycleStrategyUserPrompt(ctx as unknown as AthleteContextPacket, NOW)
        expect(prompt).toContain('recorded 2026-10-20, 6 days ago')
        expect(prompt).not.toContain('may be out of date')
    })

    it('gives the last block its dates, execution quality and per-lift recalibrations', () => {
        const prompt = buildMesocycleStrategyUserPrompt(staleCtx(retro), NOW)
        expect(prompt).toContain('Dates: 2026-09-23 → 2026-10-20 (4 weeks)')
        expect(prompt).toContain('strength: 9 sessions, mean +6% vs prescription (over 15 / on 6 / under 7 sets)')
        expect(prompt).not.toContain('endurance: 0 sessions')
        // the duplicated Bench Press row renders once
        expect(prompt).toContain('Training-max recalibrations: Back Squat 74.5→79 kg (2026-10-06), Bench Press 70→72 kg (2026-10-12)\n')
    })

    it('tells the head coach that the completed block outranks older context', () => {
        const prompt = buildMesocycleStrategyUserPrompt(staleCtx(retro), NOW)
        expect(prompt).toMatch(/completed this block[\s\S]*more recent than any injury or recent-training entry recorded before/)
    })
})
