/**
 * Zod schemas for AI Coach responses.
 *
 * These provide runtime validation for the structured JSON
 * that Claude returns for weekly reviews and coaching interventions.
 */

import { z } from 'zod'

// ─── Coach Response Schema ───────────────────────────────────────────────────

export const ExerciseSwapSchema = z.object({
    from: z.string().describe('Exercise being replaced'),
    to: z.string().describe('Replacement exercise'),
    reason: z.string().describe('Brief reason for the swap'),
})

export const CoachResponseSchema = z.object({
    triggerType: z.enum([
        'WEEKLY_REVIEW',
        'RUCK_FATIGUE',
        'RPE_SPIKE',
        'CARDIO_LOAD',
    ]).describe('Primary trigger for this intervention'),

    rationale: z.string()
        .min(10)
        .max(1000)
        .describe('1-3 sentence human-readable explanation'),

    volumeAdjustments: z.record(z.string(), z.number().int().min(-3).max(3))
        .describe('Muscle group delta sets: { "Quads": -2, "Back": 1 }'),

    exerciseSwaps: z.array(ExerciseSwapSchema)
        .max(5)
        .describe('Exercise swap recommendations'),

    rirAdjustment: z.number().min(-2).max(2).nullable()
        .describe('Global RIR adjustment or null if no change'),
})

export type CoachResponseValidated = z.infer<typeof CoachResponseSchema>

// ─── Schema as prompt-embeddable string ──────────────────────────────────────
// Used in system prompts to tell Claude the exact schema it must conform to.

export const COACH_RESPONSE_SCHEMA_TEXT = `{
  "triggerType": "WEEKLY_REVIEW" | "RUCK_FATIGUE" | "RPE_SPIKE" | "CARDIO_LOAD",
  "rationale": "string (10-1000 chars, 1-3 sentence human-readable explanation)",
  "volumeAdjustments": { "MuscleGroup": integer (-3 to +3) },
  "exerciseSwaps": [{ "from": "string", "to": "string", "reason": "string" }],
  "rirAdjustment": number (-2 to +2) | null
}`
