import { describe, it, expect } from 'vitest'
import { buildMesocycleStrategyUserPrompt } from '../head-coach'
import type { AthleteContextPacket } from '@/lib/types/coach-context'

function makeCtx(aiContextJson: Record<string, unknown>): AthleteContextPacket {
    return {
        profile: { equipment_list: [], goal_archetype: 'hybrid_fitness', available_days: 7, session_duration_minutes: 75 },
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
})
