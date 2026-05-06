/**
 * Zod schemas for Programming Engine responses.
 *
 * These validate the structured JSON that Claude returns when
 * generating weekly session pools (the core of Section 2).
 *
 * The Programming Engine generates a full week of sessions including:
 * - Lifting sessions with exercises, sets, reps, weight, and target RIR
 * - Endurance sessions with modality, duration, distance, intensity
 * - Conditioning sessions with workout description and structure
 * - Mobility sessions with focus areas and duration
 * - Benchmark discovery sessions woven into the first 1-2 weeks
 */

import { z } from 'zod'

// ─── Lifting Session Schema ─────────────────────────────────────────────────

export const ExerciseSetSchema = z.object({
    exerciseName: z.string().describe('Exercise name (e.g., "Back Squat", "Dumbbell Romanian Deadlift")'),
    muscleGroup: z.string().describe('Primary muscle group (e.g., "Quads", "Hamstrings", "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Glutes", "Core")'),
    sets: z.number().int().min(1).max(10).describe('Number of sets'),
    targetReps: z.number().int().min(1).max(50).describe('Target reps per set'),
    targetWeightKg: z.number().min(0).nullable().describe('Target weight in kg, or null if bodyweight'),
    targetRir: z.number().min(0).max(5).describe('Target reps in reserve'),
    notes: z.string().nullable().optional().describe('Coach notes for this exercise (e.g., "3-0-1-0 tempo", "pause at bottom")'),
    isBenchmarkTest: z.boolean().optional().describe('True if this exercise is a benchmark discovery test'),
})

export const LiftingSessionSchema = z.object({
    name: z.string().describe('Session name (e.g., "Upper Body Strength A", "Lower Body Hypertrophy")'),
    modality: z.literal('LIFTING'),
    estimatedDurationMinutes: z.number().int().min(20).max(120),
    coachNotes: z.string().nullable().describe('Session-level coach notes / rationale'),
    exercises: z.array(ExerciseSetSchema).min(3).max(12),
    mobilityPrimer: z.string().nullable().optional().describe('Pre-session mobility work if applicable (e.g., "5 min hip flexor + ankle mobility")'),
})

// ─── Endurance Session Schema ───────────────────────────────────────────────

export const EnduranceSessionSchema = z.object({
    name: z.string().describe('Session name (e.g., "Long Run", "Tempo Row", "Easy Swim")'),
    modality: z.literal('CARDIO'),
    enduranceModality: z.enum([
        'running', 'rucking', 'rowing', 'swimming', 'cycling',
    ]).describe('Specific endurance modality'),
    estimatedDurationMinutes: z.number().int().min(10).max(240),
    intensityZone: z.enum([
        'zone_2', 'tempo', 'threshold', 'vo2max', 'easy', 'interval',
    ]).describe('Target intensity zone'),
    targetDistanceKm: z.number().min(0).nullable().describe('Target distance in km, or null if time-based'),
    targetPaceSecPerKm: z.number().nullable().optional().describe('Target pace in sec/km if applicable'),
    intervalStructure: z.string().nullable().optional().describe('Interval structure if applicable (e.g., "8x400m @ 5K pace, 90s rest")'),
    coachNotes: z.string().nullable().describe('Session-level rationale'),
    isBenchmarkTest: z.boolean().optional().describe('True if this is a benchmark discovery session (e.g., time trial)'),
    ruckWeightLbs: z.number().nullable().optional().describe('Ruck pack weight in lbs, only for rucking'),
})

// ─── Conditioning Session Schema ────────────────────────────────────────────

export const ConditioningSessionSchema = z.object({
    name: z.string().describe('Session name (e.g., "Metcon — Chipper", "Assault Bike Intervals")'),
    modality: z.literal('METCON'),
    estimatedDurationMinutes: z.number().int().min(10).max(90),
    conditioningType: z.enum([
        'metcon', 'amrap', 'emom', 'for_time', 'intervals', 'circuit', 'chipper',
    ]).describe('Type of conditioning workout'),
    workoutDescription: z.string().describe('Full workout description in standard notation (e.g., "21-15-9 of: Thrusters (95/65), Pull-ups")'),
    targetIntensity: z.enum(['moderate', 'high', 'max_effort']),
    equipmentNeeded: z.array(z.string()).describe('List of equipment required'),
    coachNotes: z.string().nullable().describe('Session-level rationale'),
    isBenchmarkTest: z.boolean().optional(),
})

// ─── Mobility / Recovery Session Schema ─────────────────────────────────────

export const MobilitySessionSchema = z.object({
    name: z.string().describe('Session name (e.g., "Active Recovery + Full Body Mobility")'),
    modality: z.literal('MOBILITY'),
    estimatedDurationMinutes: z.number().int().min(10).max(60),
    focusAreas: z.array(z.string()).describe('Body areas to focus on (e.g., ["hips", "thoracic spine", "ankles"])'),
    description: z.string().describe('Guided mobility flow description'),
    coachNotes: z.string().nullable(),
})

// ─── Session Union ──────────────────────────────────────────────────────────

export const SessionSchema = z.discriminatedUnion('modality', [
    LiftingSessionSchema,
    EnduranceSessionSchema,
    ConditioningSessionSchema,
    MobilitySessionSchema,
])

// ─── Full Week Session Pool ─────────────────────────────────────────────────

export const WeeklySessionPoolSchema = z.object({
    weekNumber: z.number().int().min(1),
    isDeloadWeek: z.boolean(),

    sessions: z.array(SessionSchema).min(3).max(10).describe('The unordered pool of sessions for this week'),

    weekRationale: z.string()
        .min(20)
        .max(2000)
        .describe('1-4 sentence explanation of the week\'s programming focus, volume distribution, and any noteworthy mediator decisions'),

    volumeDistribution: z.object({
        strengthPercent: z.number().min(0).max(100),
        endurancePercent: z.number().min(0).max(100),
        conditioningPercent: z.number().min(0).max(100),
        mobilityPercent: z.number().min(0).max(100),
    }).describe('Approximate time distribution across domains'),

    fatigueNotes: z.string().nullable().describe('Any cross-domain interference notes or fatigue considerations'),

    benchmarkDiscoveryNotes: z.string().nullable().optional().describe('What benchmarks are being tested this week and why'),
})

// ─── Full Mesocycle Plan ────────────────────────────────────────────────────

export const MesocyclePlanSchema = z.object({
    mesocycleName: z.string().describe('Name for the training block (e.g., "Hybrid Fitness — Block 1")'),
    mesocycleGoal: z.enum(['HYPERTROPHY', 'STRENGTH', 'ENDURANCE', 'HYBRID_PEAKING']),
    weekCount: z.number().int().min(4).max(8),
    deloadWeek: z.number().int().describe('Which week number is the deload (usually the last)'),

    weeklyPlan: z.string()
        .max(3000)
        .describe('High-level plan overview: block emphasis, phase focus, volume progression strategy'),

    weeks: z.array(WeeklySessionPoolSchema).min(1).describe('Session pools for each programmed week'),
})

// ─── Archetype-Validated Session Pool Schema ──────────────────────────────

const ARCHETYPE_DISTRIBUTION: Record<string, {
    lifting: [number, number]
    endurance: [number, number]
    conditioning: [number, number]
    mobility: [number, number]
}> = {
    hybrid_fitness:     { lifting: [1, 3], endurance: [1, 3], conditioning: [0, 2], mobility: [1, 2] },
    strength_focus:     { lifting: [2, 4], endurance: [0, 2], conditioning: [0, 1], mobility: [1, 2] },
    endurance_focus:    { lifting: [1, 2], endurance: [2, 4], conditioning: [0, 1], mobility: [1, 2] },
    conditioning_focus: { lifting: [1, 2], endurance: [0, 2], conditioning: [1, 3], mobility: [1, 2] },
    longevity:          { lifting: [1, 3], endurance: [1, 2], conditioning: [0, 2], mobility: [1, 2] },
    // Mesocycle goal names (fallback mapping)
    HYBRID_PEAKING:     { lifting: [1, 3], endurance: [1, 3], conditioning: [0, 2], mobility: [1, 2] },
    STRENGTH:           { lifting: [2, 4], endurance: [0, 2], conditioning: [0, 1], mobility: [1, 2] },
    ENDURANCE:          { lifting: [1, 2], endurance: [2, 4], conditioning: [0, 1], mobility: [1, 2] },
    HYPERTROPHY:        { lifting: [2, 4], endurance: [0, 2], conditioning: [0, 2], mobility: [1, 2] },
}

/**
 * Creates a session pool schema with archetype-based distribution validation.
 * Falls back to the base schema if the archetype is unknown.
 */
export function createValidatedSessionPoolSchema(goalArchetype: string) {
    return WeeklySessionPoolSchema
        .superRefine((data, ctx) => {
            const ranges = ARCHETYPE_DISTRIBUTION[goalArchetype]
            if (!ranges) return // Unknown archetype, skip validation

            const lifting = data.sessions.filter(s => s.modality === 'LIFTING').length
            const endurance = data.sessions.filter(s => s.modality === 'CARDIO').length
            const conditioning = data.sessions.filter(s => s.modality === 'METCON').length
            const mobility = data.sessions.filter(s => s.modality === 'MOBILITY').length

            const valid =
                lifting >= ranges.lifting[0] && lifting <= ranges.lifting[1] &&
                endurance >= ranges.endurance[0] && endurance <= ranges.endurance[1] &&
                conditioning >= ranges.conditioning[0] && conditioning <= ranges.conditioning[1] &&
                mobility >= ranges.mobility[0] && mobility <= ranges.mobility[1]

            if (!valid) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Session distribution violates ${goalArchetype} archetype. Got: ${lifting} lifting (want ${ranges.lifting}), ${endurance} endurance (want ${ranges.endurance}), ${conditioning} conditioning (want ${ranges.conditioning}), ${mobility} mobility (want ${ranges.mobility}). Fix the session mix.`,
                    path: ['sessions'],
                })
            }

            // Volume distribution sum check
            const { strengthPercent, endurancePercent, conditioningPercent, mobilityPercent } = data.volumeDistribution
            const total = strengthPercent + endurancePercent + conditioningPercent + mobilityPercent
            if (total < 85 || total > 115) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'volumeDistribution percentages must sum to approximately 100 (allowed 85-115).',
                    path: ['volumeDistribution'],
                })
            }
        })
}

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type ExerciseSetPrescription = z.infer<typeof ExerciseSetSchema>
export type LiftingSession = z.infer<typeof LiftingSessionSchema>
export type EnduranceSession = z.infer<typeof EnduranceSessionSchema>
export type ConditioningSession = z.infer<typeof ConditioningSessionSchema>
export type MobilitySession = z.infer<typeof MobilitySessionSchema>
export type Session = z.infer<typeof SessionSchema>
export type WeeklySessionPool = z.infer<typeof WeeklySessionPoolSchema>
export type MesocyclePlan = z.infer<typeof MesocyclePlanSchema>

// ─── Single Session Response Schema ────────────────────────────────────────

export const SingleSessionResponseSchema = z.object({
    session: SessionSchema,
    rationale: z.string().min(10).max(1000).describe('Why this session was chosen — how it fits the athlete\'s current pool, goals, and training phase'),
    fatigueNotes: z.string().nullable().describe('Any interference or fatigue considerations with existing sessions in the pool'),
})

export type SingleSessionResponse = z.infer<typeof SingleSessionResponseSchema>

// ─── Schema as prompt-embeddable text ───────────────────────────────────────

export const SESSION_POOL_SCHEMA_TEXT = `{
  "weekNumber": integer,
  "isDeloadWeek": boolean,
  "sessions": [
    // LIFTING session:
    {
      "name": "string",
      "modality": "LIFTING",
      "estimatedDurationMinutes": integer (20-120),
      "coachNotes": "string | null",
      "exercises": [
        {
          "exerciseName": "string",
          "muscleGroup": "string (Quads/Hamstrings/Glutes/Chest/Back/Shoulders/Biceps/Triceps/Core)",
          "sets": integer (1-10),
          "targetReps": integer (1-50),
          "targetWeightKg": number | null,
          "targetRir": number (0-5),
          "notes": "string | null",
          "isBenchmarkTest": boolean (optional)
        }
      ],
      "mobilityPrimer": "string | null"
    },
    // CARDIO (endurance) session:
    {
      "name": "string",
      "modality": "CARDIO",
      "enduranceModality": "running" | "rucking" | "rowing" | "swimming" | "cycling",
      "estimatedDurationMinutes": integer (10-240),
      "intensityZone": "zone_2" | "tempo" | "threshold" | "vo2max" | "easy" | "interval",
      "targetDistanceKm": number | null,
      "targetPaceSecPerKm": number | null,
      "intervalStructure": "string | null",
      "coachNotes": "string | null",
      "isBenchmarkTest": boolean (optional),
      "ruckWeightLbs": number | null (only for rucking)
    },
    // METCON (conditioning) session:
    {
      "name": "string",
      "modality": "METCON",
      "estimatedDurationMinutes": integer (10-90),
      "conditioningType": "metcon" | "amrap" | "emom" | "for_time" | "intervals" | "circuit" | "chipper",
      "workoutDescription": "string (full workout in standard notation)",
      "targetIntensity": "moderate" | "high" | "max_effort",
      "equipmentNeeded": ["string"],
      "coachNotes": "string | null",
      "isBenchmarkTest": boolean (optional)
    },
    // MOBILITY session:
    {
      "name": "string",
      "modality": "MOBILITY",
      "estimatedDurationMinutes": integer (10-60),
      "focusAreas": ["string"],
      "description": "string",
      "coachNotes": "string | null"
    }
  ],
  "weekRationale": "string (20-2000 chars)",
  "volumeDistribution": {
    "strengthPercent": number (0-100),
    "endurancePercent": number (0-100),
    "conditioningPercent": number (0-100),
    "mobilityPercent": number (0-100)
  },
  "fatigueNotes": "string | null",
  "benchmarkDiscoveryNotes": "string | null"
}`

export const SINGLE_SESSION_SCHEMA_TEXT = `{
  "session": {
    // ONE of: LIFTING / CARDIO / METCON / MOBILITY session object (same schema as above)
  },
  "rationale": "string (10-1000 chars) — why this session fits the athlete's current pool",
  "fatigueNotes": "string | null — interference or fatigue considerations"
}`
