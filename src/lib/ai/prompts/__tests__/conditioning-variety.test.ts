import { describe, it, expect } from 'vitest'
import {
    buildProgrammingSystemPrompt,
    buildProgrammingUserPrompt,
    type ProgrammingContext,
} from '../programming'
import { buildMesocycleStrategySystemPrompt } from '../head-coach'
import { extractConditioningFormat, buildCoachNotes } from '@/lib/engine/microcycle/persistence'
import { CONDITIONING_TYPES, type ConditioningSession } from '@/lib/ai/schemas/programming'
import type { Profile } from '@/lib/types/database.types'

const baseProfile = {
    age: 46,
    sex: 'male',
    bodyweight_kg: 90,
    height_cm: 183,
    lifting_experience: 'intermediate',
    running_experience: 'intermediate',
    conditioning_experience: 'intermediate',
    equipment_list: ['barbell_rack', 'kettlebells', 'assault_bike', 'rower'],
    equipment_usage_intents: null,
    available_days: 6,
    session_duration_minutes: 75,
    movements_to_avoid: [],
    endurance_modality_preferences: [],
    conditioning_style_preferences: [],
    goal_archetype: 'hybrid_fitness',
    transparency: 'minimal',
} as unknown as Profile

function makeCtx(overrides: Partial<ProgrammingContext> = {}): ProgrammingContext {
    return {
        profile: baseProfile,
        injuries: [],
        benchmarks: [],
        recentTraining: [],
        weekNumber: 2,
        totalWeeks: 6,
        isDeload: false,
        targetRir: 2,
        mesocycleGoal: 'hybrid_fitness',
        isBenchmarkDiscovery: false,
        ...overrides,
    }
}

describe('conditioning variety — programming system prompt', () => {
    it('instructs week-to-week format rotation for conditioning', () => {
        const prompt = buildProgrammingSystemPrompt()
        expect(prompt).toContain('WEEK-TO-WEEK VARIETY')
        expect(prompt).toMatch(/same workout format .*two weeks in a row/i)
        expect(prompt).toMatch(/benchmark/i)
    })
})

describe('conditioning variety — programming user prompt', () => {
    it('scopes the progressive-overload continuity instruction to LIFTING sessions', () => {
        const ctx = makeCtx({
            previousWeekSessions: [
                {
                    name: 'Lower Body Strength',
                    modality: 'LIFTING',
                    exercises: [{
                        exerciseName: 'Back Squat',
                        muscleGroup: 'quads',
                        sets: 3,
                        targetReps: 5,
                        targetWeightKg: 80,
                        actualReps: 5,
                        actualWeightKg: 80,
                        rirActual: 2,
                        rpeActual: null,
                    }],
                    coachNotes: null,
                },
            ],
        })
        const prompt = buildProgrammingUserPrompt(ctx)
        expect(prompt).toContain('PROGRESSIVE OVERLOAD INSTRUCTION (LIFTING sessions only)')
        expect(prompt).toContain('CONDITIONING VARIETY INSTRUCTION')
        // The old unscoped wording must be gone
        expect(prompt).not.toMatch(/^PROGRESSIVE OVERLOAD INSTRUCTION: Compare/m)
    })

    it('tells the model NOT to repeat last week conditioning workout with more volume', () => {
        const ctx = makeCtx({
            previousWeekSessions: [
                {
                    name: 'Mixed-Modal Conditioning',
                    modality: 'METCON',
                    exercises: undefined,
                    coachNotes: 'WORKOUT:\n20 min EMOM ...\n\nEMOM · Intensity: moderate · ~30 min',
                },
            ],
        })
        const prompt = buildProgrammingUserPrompt(ctx)
        expect(prompt).toMatch(/do not repeat last week'?s conditioning/i)
        expect(prompt).toMatch(/rotate/i)
    })

    it('renders recent conditioning formats section with rotation instruction when provided', () => {
        const ctx = makeCtx({
            recentConditioning: [
                { name: 'Mixed-Modal Conditioning — EMOM', format: 'EMOM', createdAt: '2026-07-19' },
                { name: 'Mixed-Modal Conditioning', format: 'EMOM', createdAt: '2026-06-29' },
                { name: 'Assault Bike + Kettlebell EMOM', format: 'EMOM', createdAt: '2026-06-25' },
            ],
        })
        const prompt = buildProgrammingUserPrompt(ctx)
        expect(prompt).toContain('RECENT CONDITIONING SESSIONS')
        expect(prompt).toContain('Mixed-Modal Conditioning — EMOM')
        expect(prompt).toContain('FORMAT ROTATION INSTRUCTION')
        expect(prompt).toMatch(/different .*format/i)
    })

    it('omits the recent conditioning section when no data provided', () => {
        const prompt = buildProgrammingUserPrompt(makeCtx())
        expect(prompt).not.toContain('RECENT CONDITIONING SESSIONS')
        expect(prompt).not.toContain('FORMAT ROTATION INSTRUCTION')
    })
})

describe('extractConditioningFormat', () => {
    it('extracts the format token from the coach-notes meta line', () => {
        expect(extractConditioningFormat('WORKOUT:\n24 min EMOM ...\n\nEMOM · Intensity: moderate · ~30 min')).toBe('EMOM')
        expect(extractConditioningFormat('WORKOUT:\nFor Time (20 min cap) ...\n\nFOR_TIME · Intensity: high · ~30 min')).toBe('FOR_TIME')
        expect(extractConditioningFormat('WORKOUT:\n3 Rounds for Quality\n\nCIRCUIT · Intensity: moderate')).toBe('CIRCUIT')
    })

    it('falls back to scanning the workout text when no meta line exists', () => {
        expect(extractConditioningFormat('WORKOUT:\n12 min AMRAP of burpees')).toBe('AMRAP')
    })

    it('returns null for null or format-free notes', () => {
        expect(extractConditioningFormat(null)).toBeNull()
        expect(extractConditioningFormat('just some notes')).toBeNull()
    })

    it('round-trips every conditioningType written by buildCoachNotes', () => {
        for (const format of CONDITIONING_TYPES) {
            const session: ConditioningSession = {
                name: 'Test Session',
                modality: 'METCON',
                estimatedDurationMinutes: 20,
                conditioningType: format,
                workoutDescription: '3 rounds of quality movement',
                targetIntensity: 'moderate',
                equipmentNeeded: [],
                coachNotes: null,
            }
            const notes = buildCoachNotes(session, 'minimal')
            expect(extractConditioningFormat(notes)).toBe(format.toUpperCase())
        }
    })
})

describe('head-coach strategy prompt — conditioning directive rules', () => {
    it('forbids pinning workout formats or literal example workouts in directives', () => {
        const prompt = buildMesocycleStrategySystemPrompt()
        expect(prompt).toContain('METHODOLOGY DIRECTIVE RULES')
        expect(prompt).toMatch(/do not prescribe specific workout formats/i)
        expect(prompt).toMatch(/example workouts/i)
    })
})
