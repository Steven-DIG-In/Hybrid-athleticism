/**
 * Zod schemas for the Multi-Agent Coaching Architecture.
 *
 * These validate structured JSON from the Head Coach and Recovery Coach:
 * - MesocycleStrategySchema: Head Coach's strategic plan (Pipeline A Step 1)
 * - RecoveryAssessmentSchema: Recovery Coach's weekly GREEN/YELLOW/RED (Pipeline B Step 1)
 * - AdjustmentDirectiveSchema: Head Coach's modification orders (Pipeline B Step 3)
 */

import { z } from 'zod'

// ─── Domain Allocation (per-coach mandate within a mesocycle) ───────────────

export const DomainAllocationSchema = z.object({
    coach: z.enum(['strength', 'hypertrophy', 'endurance', 'conditioning', 'mobility']),
    sessionsPerWeek: z.number().int().min(0).max(6),
    loadBudgetPerSession: z.number().min(1).max(10),
    weeklyFatigueBudget: z.number().min(0).max(100)
        .describe('Percentage of total recovery budget allocated to this domain'),
    constraints: z.array(z.string())
        .describe('Domain-specific constraints (e.g., "no heavy spinal loading day before endurance")'),
    methodologyDirective: z.string()
        .describe('Specific methodology instructions (e.g., "5/3/1 waves, leader template")'),
})

// ─── Mesocycle Strategy (Head Coach Pipeline A Step 1) ──────────────────────

export const MesocycleStrategySchema = z.object({
    blockName: z.string().describe('Name for this training block (e.g., "Hybrid Fitness — Block 1")'),
    blockEmphasis: z.string().describe('2-3 sentence overview of block emphasis and goals'),
    totalWeeks: z.number().int().min(4).max(8),
    deloadWeek: z.number().int().describe('Which week number is the planned deload'),

    domainAllocations: z.array(DomainAllocationSchema).min(1).max(6)
        .describe('Per-domain allocation for the mesocycle'),

    weeklyEmphasis: z.array(z.object({
        weekNumber: z.number().int(),
        volumePercent: z.number().min(40).max(110)
            .describe('Volume as % of MRV target for this week'),
        emphasis: z.string()
            .describe('Training emphasis this week (e.g., "strength accumulation", "endurance build")'),
        isDeload: z.boolean(),
    })).min(4).max(8),

    strategyRationale: z.string().min(20).max(2000)
        .describe('Why this strategy was chosen given the athlete\'s goals, experience, and coaching team'),
    keyProgressions: z.array(z.string()).min(2).max(6)
        .describe('Key progressions planned across the block'),
    interferenceNotes: z.string()
        .describe('How cross-domain interference will be managed (session spacing, load management)'),
})

export type MesocycleStrategyValidated = z.infer<typeof MesocycleStrategySchema>

// ─── Recovery Assessment (Recovery Coach Pipeline B Step 1) ─────────────────

export const RecoveryAssessmentSchema = z.object({
    status: z.enum(['GREEN', 'YELLOW', 'RED'])
        .describe('GREEN = continue as programmed, YELLOW = minor adjustment needed, RED = significant modification or deload'),

    rationale: z.string().min(10).max(1000)
        .describe('1-3 sentence human-readable explanation of the assessment'),

    recommendations: z.array(z.object({
        targetDomain: z.enum(['strength', 'hypertrophy', 'endurance', 'conditioning', 'mobility']),
        type: z.enum([
            'intensity_reduction',
            'volume_reduction',
            'exercise_swap',
            'session_skip',
            'deload_modification',
        ]),
        description: z.string().describe('What should change (e.g., "Reduce squat intensity by 10%")'),
        magnitude: z.number().nullable().optional()
            .describe('Percentage change if applicable (e.g., -10 for "reduce by 10%")'),
    })).optional()
        .describe('Only present for YELLOW/RED status'),

    signals: z.object({
        avgRirDeviation: z.number()
            .describe('Positive = easier than target, negative = harder'),
        rpeSpikes: z.array(z.string())
            .describe('Exercises with RPE >= 9.5'),
        missedSessions: z.number().int().min(0),
        completionRate: z.number().min(0).max(1),
        hadHighFatigueEvent: z.boolean(),
    }),

    triggerDeload: z.boolean()
        .describe('True if a reactive deload should override the planned schedule'),
})

export type RecoveryAssessmentValidated = z.infer<typeof RecoveryAssessmentSchema>

// ─── Adjustment Directive (Head Coach Pipeline B Step 3) ────────────────────

export const AdjustmentDirectiveSchema = z.object({
    weekNumber: z.number().int(),
    rationale: z.string().min(10).max(1000),

    coachDirectives: z.array(z.object({
        coach: z.enum(['strength', 'hypertrophy', 'endurance', 'conditioning', 'mobility']),
        action: z.enum(['modify', 'skip', 'replace', 'no_change']),
        instructions: z.string()
            .describe('Natural language modification order for the domain coach'),
        intensityAdjustment: z.number().nullable().optional()
            .describe('Percentage change to intensity (e.g., -10)'),
        volumeAdjustment: z.number().nullable().optional()
            .describe('Set count change (e.g., -2)'),
        exerciseSwaps: z.array(z.object({
            from: z.string(),
            to: z.string(),
            reason: z.string(),
        })).optional(),
    })),
})

export type AdjustmentDirectiveValidated = z.infer<typeof AdjustmentDirectiveSchema>

// ─── Strength Program (Strength Coach multi-week output) ────────────────────

export const StrengthExerciseSchema = z.object({
    exerciseName: z.string(),
    muscleGroup: z.string(),
    category: z.enum(['primary_compound', 'secondary_compound', 'accessory', 'warm_up']),
    sets: z.number().int().min(1).max(10),
    targetReps: z.number().int().min(1).max(50),
    targetWeightKg: z.number().min(0).nullable(),
    targetRir: z.number().min(0).max(5),
    notes: z.string().nullable(),
    isBenchmarkTest: z.boolean().optional(),
    methodologySource: z.string().nullable().optional()
        .describe('Formula source for this prescription (e.g., "5/3/1 week 1: 3x5+ @ 85% TM")'),
})

export const StrengthSessionSchema = z.object({
    name: z.string(),
    splitType: z.string().describe('e.g., "Upper A", "Lower B", "Push", "Pull", "Full Body"'),
    estimatedDurationMinutes: z.number().int().min(20).max(120),
    loadBudget: z.number().min(1).max(10),
    exercises: z.array(StrengthExerciseSchema).min(3).max(12),
    mobilityPrimerRequest: z.string().nullable().optional()
        .describe('What mobility prep is needed (e.g., "hip/ankle mobility for squats")'),
    coachNotes: z.string().nullable(),
})

export const StrengthProgramSchema = z.object({
    methodologyUsed: z.string()
        .describe('Primary methodology (e.g., "5/3/1 Wendler — Leader template")'),
    splitDesign: z.string()
        .describe('Split structure (e.g., "Upper/Lower 2x per week")'),
    programRationale: z.string().min(20).max(2000)
        .describe('Why this methodology and split were chosen for this athlete'),

    weeks: z.array(z.object({
        weekNumber: z.number().int(),
        isDeload: z.boolean(),
        weekNotes: z.string().nullable()
            .describe('Coaching notes for this specific week'),
        sessions: z.array(StrengthSessionSchema).min(1).max(6),
    })).min(4).max(8),
})

export type StrengthProgramValidated = z.infer<typeof StrengthProgramSchema>

// ─── Endurance Program (Endurance Coach multi-week output) ──────────────────

export const EnduranceSessionSchema = z.object({
    name: z.string(),
    enduranceModality: z.enum(['running', 'rucking', 'rowing', 'swimming', 'cycling']),
    estimatedDurationMinutes: z.number().int().min(10).max(240),
    loadBudget: z.number().min(1).max(10),
    intensityZone: z.enum(['zone_2', 'tempo', 'threshold', 'vo2max', 'easy', 'interval']),
    targetDistanceKm: z.number().min(0).nullable(),
    targetPaceSecPerKm: z.number().nullable().optional()
        .describe('Target pace in sec/km, only for running/rucking'),
    intervalStructure: z.string().nullable().optional()
        .describe('Interval structure (e.g., "8x400m @ 5K pace, 90s rest")'),
    ruckWeightLbs: z.number().nullable().optional()
        .describe('Ruck pack weight in lbs, only for rucking'),
    coachNotes: z.string().nullable(),
    methodologySource: z.string().nullable().optional()
        .describe('Formula source (e.g., "Daniels VDOT 45: Easy pace @ 5:30/km")'),
})

export const EnduranceProgramSchema = z.object({
    methodologyUsed: z.string()
        .describe('Primary methodology (e.g., "80/20 Polarized + Daniels paces")'),
    modalitySummary: z.string()
        .describe('Which modalities and how they are distributed (e.g., "3x running, 1x rowing per week")'),
    programRationale: z.string().min(20).max(2000)
        .describe('Why this approach was chosen for this athlete'),

    weeks: z.array(z.object({
        weekNumber: z.number().int(),
        isDeload: z.boolean(),
        totalDistanceKm: z.number().min(0).nullable()
            .describe('Total planned distance for the week across all modalities'),
        totalDurationMinutes: z.number().int().min(0)
            .describe('Total planned duration for the week'),
        weekNotes: z.string().nullable()
            .describe('Coaching notes for this specific week'),
        sessions: z.array(EnduranceSessionSchema).min(1).max(6),
    })).min(4).max(8),
})

export type EnduranceProgramValidated = z.infer<typeof EnduranceProgramSchema>

// ─── Hypertrophy Program (Hypertrophy Coach multi-week output) ──────────────

export const HypertrophyExerciseSchema = z.object({
    exerciseName: z.string(),
    muscleGroup: z.string(),
    category: z.enum(['compound', 'isolation', 'machine', 'warm_up']),
    sets: z.number().int().min(1).max(10),
    targetReps: z.number().int().min(1).max(50),
    targetWeightKg: z.number().min(0).nullable(),
    targetRir: z.number().min(0).max(5),
    tempo: z.string().nullable().optional()
        .describe('Tempo notation (e.g., "3-0-1-0" = 3s eccentric, 0 pause, 1s concentric, 0 top)'),
    restSeconds: z.number().nullable().optional()
        .describe('Rest between sets in seconds'),
    notes: z.string().nullable(),
    methodologySource: z.string().nullable().optional()
        .describe('Volume source (e.g., "RP: Chest MAV week 3 = 16 sets")'),
})

export const HypertrophySessionSchema = z.object({
    name: z.string(),
    muscleGroupFocus: z.array(z.string())
        .describe('Primary muscle groups targeted (e.g., ["Chest", "Triceps"])'),
    estimatedDurationMinutes: z.number().int().min(20).max(120),
    loadBudget: z.number().min(1).max(10),
    exercises: z.array(HypertrophyExerciseSchema).min(3).max(12),
    mobilityPrimerRequest: z.string().nullable().optional(),
    coachNotes: z.string().nullable(),
})

export const HypertrophyProgramSchema = z.object({
    methodologyUsed: z.string()
        .describe('Primary methodology (e.g., "RP Volume Landmarks — MEV to MAV progression")'),
    splitDesign: z.string()
        .describe('Split structure (e.g., "Push/Pull/Legs", "Upper/Lower", "Chest-Back/Shoulders-Arms/Legs")'),
    programRationale: z.string().min(20).max(2000),

    weeks: z.array(z.object({
        weekNumber: z.number().int(),
        isDeload: z.boolean(),
        weekNotes: z.string().nullable(),
        sessions: z.array(HypertrophySessionSchema).min(1).max(6),
    })).min(4).max(8),
})

export type HypertrophyProgramValidated = z.infer<typeof HypertrophyProgramSchema>

// ─── Conditioning Program (Conditioning Coach multi-week output) ────────────

export const ConditioningSessionSchema = z.object({
    name: z.string(),
    conditioningType: z.enum(['metcon', 'amrap', 'emom', 'for_time', 'intervals', 'circuit', 'chipper']),
    estimatedDurationMinutes: z.number().int().min(10).max(90),
    loadBudget: z.number().min(1).max(10),
    targetIntensity: z.enum(['moderate', 'high', 'max_effort']),
    workoutDescription: z.string()
        .describe('Full workout in standard notation (e.g., "21-15-9: Thrusters @ 43kg, Pull-ups")'),
    equipmentNeeded: z.array(z.string()),
    energySystemTarget: z.enum(['glycolytic', 'oxidative', 'phosphagen', 'mixed']),
    coachNotes: z.string().nullable(),
})

export const ConditioningProgramSchema = z.object({
    methodologyUsed: z.string()
        .describe('Programming approach (e.g., "Balanced energy system development")'),
    programRationale: z.string().min(20).max(2000),

    weeks: z.array(z.object({
        weekNumber: z.number().int(),
        isDeload: z.boolean(),
        weekNotes: z.string().nullable(),
        sessions: z.array(ConditioningSessionSchema).min(1).max(4),
    })).min(4).max(8),
})

export type ConditioningProgramValidated = z.infer<typeof ConditioningProgramSchema>

// ─── Mobility Program (Mobility Coach multi-week output) ────────────────────

export const MobilityExerciseSchema = z.object({
    exerciseName: z.string(),
    bodyArea: z.string(),
    durationSeconds: z.number().nullable().optional(),
    sets: z.number().int().nullable().optional(),
    reps: z.number().int().nullable().optional(),
    notes: z.string().nullable(),
})

export const MobilityPrimerSchema = z.object({
    targetSessionName: z.string()
        .describe('Which session this primes (e.g., "Lower Body Strength A")'),
    focusAreas: z.array(z.string()),
    durationMinutes: z.number().int().min(3).max(15),
    exercises: z.array(MobilityExerciseSchema).min(2).max(6),
})

export const MobilitySessionSchema = z.object({
    name: z.string(),
    estimatedDurationMinutes: z.number().int().min(10).max(60),
    focusAreas: z.array(z.string()),
    exercises: z.array(MobilityExerciseSchema).min(3).max(12),
    coachNotes: z.string().nullable(),
})

export const MobilityProgramSchema = z.object({
    methodologyUsed: z.string()
        .describe('Approach (e.g., "FRC-inspired + session-specific primers")'),
    programRationale: z.string().min(20).max(2000),

    weeks: z.array(z.object({
        weekNumber: z.number().int(),
        isDeload: z.boolean(),
        weekNotes: z.string().nullable(),
        standaloneSessions: z.array(MobilitySessionSchema).min(1).max(3),
        sessionPrimers: z.array(MobilityPrimerSchema).optional()
            .describe('Mobility primers for lifting/conditioning sessions'),
    })).min(4).max(8),
})

export type MobilityProgramValidated = z.infer<typeof MobilityProgramSchema>

// ─── Schema text for embedding in prompts ───────────────────────────────────

export const MESOCYCLE_STRATEGY_SCHEMA_TEXT = `{
  "blockName": "string",
  "blockEmphasis": "string (2-3 sentences)",
  "totalWeeks": integer (4-8),
  "deloadWeek": integer,
  "domainAllocations": [
    {
      "coach": "strength" | "hypertrophy" | "endurance" | "conditioning" | "mobility",
      "sessionsPerWeek": integer (0-6),
      "loadBudgetPerSession": number (1-10),
      "weeklyFatigueBudget": number (0-100, % of total recovery),
      "constraints": ["string"],
      "methodologyDirective": "string"
    }
  ],
  "weeklyEmphasis": [
    { "weekNumber": integer, "volumePercent": number (40-110), "emphasis": "string", "isDeload": boolean }
  ],
  "strategyRationale": "string (20-2000 chars)",
  "keyProgressions": ["string"],
  "interferenceNotes": "string"
}`

export const RECOVERY_ASSESSMENT_SCHEMA_TEXT = `{
  "status": "GREEN" | "YELLOW" | "RED",
  "rationale": "string (10-1000 chars)",
  "recommendations": [
    {
      "targetDomain": "strength" | "hypertrophy" | "endurance" | "conditioning" | "mobility",
      "type": "intensity_reduction" | "volume_reduction" | "exercise_swap" | "session_skip" | "deload_modification",
      "description": "string",
      "magnitude": number | null
    }
  ],
  "signals": {
    "avgRirDeviation": number,
    "rpeSpikes": ["string"],
    "missedSessions": integer,
    "completionRate": number (0-1),
    "hadHighFatigueEvent": boolean
  },
  "triggerDeload": boolean
}`

export const ADJUSTMENT_DIRECTIVE_SCHEMA_TEXT = `{
  "weekNumber": integer,
  "rationale": "string",
  "coachDirectives": [
    {
      "coach": "strength" | "hypertrophy" | "endurance" | "conditioning" | "mobility",
      "action": "modify" | "skip" | "replace" | "no_change",
      "instructions": "string (natural language modification order)",
      "intensityAdjustment": number | null,
      "volumeAdjustment": number | null,
      "exerciseSwaps": [{ "from": "string", "to": "string", "reason": "string" }]
    }
  ]
}`

export const STRENGTH_PROGRAM_SCHEMA_TEXT = `{
  "methodologyUsed": "string (e.g., '5/3/1 Wendler — Leader template')",
  "splitDesign": "string (e.g., 'Upper/Lower 2x per week')",
  "programRationale": "string (20-2000 chars)",
  "weeks": [
    {
      "weekNumber": integer,
      "isDeload": boolean,
      "weekNotes": "string | null",
      "sessions": [
        {
          "name": "string",
          "splitType": "string (e.g., 'Upper A', 'Lower B')",
          "estimatedDurationMinutes": integer (20-120),
          "loadBudget": number (1-10),
          "exercises": [
            {
              "exerciseName": "string",
              "muscleGroup": "string (use standard names: Quads, Hamstrings, Glutes, Chest, Back, Shoulders, Biceps, Triceps, Core, Calves, Forearms)",
              "category": "primary_compound" | "secondary_compound" | "accessory" | "warm_up",
              "sets": integer (1-10),
              "targetReps": integer (1-50),
              "targetWeightKg": number | null,
              "targetRir": number (0-5),
              "notes": "string | null",
              "isBenchmarkTest": boolean (optional),
              "methodologySource": "string | null (e.g., '5/3/1 week 1: 3x5+ @ 85% TM')"
            }
          ],
          "mobilityPrimerRequest": "string | null",
          "coachNotes": "string | null"
        }
      ]
    }
  ]
}`

export const HYPERTROPHY_PROGRAM_SCHEMA_TEXT = `{
  "methodologyUsed": "string (e.g., 'RP Volume Landmarks — MEV to MAV progression')",
  "splitDesign": "string (e.g., 'Push/Pull/Legs', 'Upper/Lower', 'Chest-Back/Shoulders-Arms/Legs')",
  "programRationale": "string (20-2000 chars)",
  "weeks": [
    {
      "weekNumber": integer,
      "isDeload": boolean,
      "weekNotes": "string | null",
      "sessions": [
        {
          "name": "string",
          "muscleGroupFocus": ["string (e.g., 'Chest', 'Triceps')"],
          "estimatedDurationMinutes": integer (20-120),
          "loadBudget": number (1-10),
          "exercises": [
            {
              "exerciseName": "string",
              "muscleGroup": "string (use standard names: Quads, Hamstrings, Glutes, Chest, Back, Shoulders, Biceps, Triceps, Core, Calves, Forearms)",
              "category": "compound" | "isolation" | "machine" | "warm_up",
              "sets": integer (1-10),
              "targetReps": integer (1-50),
              "targetWeightKg": number | null,
              "targetRir": number (0-5),
              "tempo": "string | null (e.g., '3-0-1-0' = 3s eccentric, 0 pause, 1s concentric, 0 top)",
              "restSeconds": number | null (e.g., 90),
              "notes": "string | null",
              "methodologySource": "string | null (e.g., 'RP: Chest MAV week 3 = 16 sets')"
            }
          ],
          "mobilityPrimerRequest": "string | null",
          "coachNotes": "string | null"
        }
      ]
    }
  ]
}`

export const CONDITIONING_PROGRAM_SCHEMA_TEXT = `{
  "methodologyUsed": "string (e.g., 'Balanced energy system development')",
  "programRationale": "string (20-2000 chars)",
  "weeks": [
    {
      "weekNumber": integer,
      "isDeload": boolean,
      "weekNotes": "string | null",
      "sessions": [
        {
          "name": "string (e.g., 'MetCon Monday', 'EMOM Power')",
          "conditioningType": "metcon" | "amrap" | "emom" | "for_time" | "intervals" | "circuit" | "chipper",
          "estimatedDurationMinutes": integer (10-90),
          "loadBudget": number (1-10),
          "targetIntensity": "moderate" | "high" | "max_effort",
          "workoutDescription": "string (full workout in standard notation, e.g., '21-15-9: Thrusters @ 43kg, Pull-ups')",
          "equipmentNeeded": ["string"],
          "energySystemTarget": "glycolytic" | "oxidative" | "phosphagen" | "mixed",
          "coachNotes": "string | null"
        }
      ]
    }
  ]
}`

export const MOBILITY_PROGRAM_SCHEMA_TEXT = `{
  "methodologyUsed": "string (e.g., 'FRC-inspired + session-specific primers')",
  "programRationale": "string (20-2000 chars)",
  "weeks": [
    {
      "weekNumber": integer,
      "isDeload": boolean,
      "weekNotes": "string | null",
      "standaloneSessions": [
        {
          "name": "string",
          "estimatedDurationMinutes": integer (10-60),
          "focusAreas": ["string (e.g., 'Hips', 'Thoracic Spine', 'Shoulders')"],
          "exercises": [
            {
              "exerciseName": "string",
              "bodyArea": "string",
              "durationSeconds": number | null,
              "sets": integer | null,
              "reps": integer | null,
              "notes": "string | null"
            }
          ],
          "coachNotes": "string | null"
        }
      ],
      "sessionPrimers": [
        {
          "targetSessionName": "string (which lifting/conditioning session this primes)",
          "focusAreas": ["string"],
          "durationMinutes": integer (3-15),
          "exercises": [
            {
              "exerciseName": "string",
              "bodyArea": "string",
              "durationSeconds": number | null,
              "sets": integer | null,
              "reps": integer | null,
              "notes": "string | null"
            }
          ]
        }
      ]
    }
  ]
}`

export const ENDURANCE_PROGRAM_SCHEMA_TEXT = `{
  "methodologyUsed": "string (e.g., '80/20 Polarized + Daniels paces')",
  "modalitySummary": "string (e.g., '3x running, 1x rowing per week')",
  "programRationale": "string (20-2000 chars)",
  "weeks": [
    {
      "weekNumber": integer,
      "isDeload": boolean,
      "totalDistanceKm": number | null,
      "totalDurationMinutes": integer,
      "weekNotes": "string | null",
      "sessions": [
        {
          "name": "string (e.g., 'Long Run', 'Tempo Row', 'Easy Recovery Run')",
          "enduranceModality": "running" | "rucking" | "rowing" | "swimming" | "cycling",
          "estimatedDurationMinutes": integer (10-240),
          "loadBudget": number (1-10),
          "intensityZone": "zone_2" | "tempo" | "threshold" | "vo2max" | "easy" | "interval",
          "targetDistanceKm": number | null,
          "targetPaceSecPerKm": number | null (optional, running/rucking only),
          "intervalStructure": "string | null (optional, e.g., '8x400m @ 5K pace, 90s rest')",
          "ruckWeightLbs": number | null (optional, rucking only),
          "coachNotes": "string | null",
          "methodologySource": "string | null (e.g., 'Daniels VDOT 45: Easy @ 5:30/km')"
        }
      ]
    }
  ]
}`
