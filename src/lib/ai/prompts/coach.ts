/**
 * AI Coach Prompt Builders
 *
 * Constructs system + user prompts for the weekly review coaching feature.
 * Refactored from inline strings in ai-coach.actions.ts to be testable,
 * maintainable, and consistent with the prompt module pattern.
 */

import {
    HYBRID_MEDIATOR_IDENTITY,
    TRAINING_PHILOSOPHY,
    JSON_RESPONSE_RULES,
    EQUIPMENT_CONSTRAINT,
} from './system'
import { COACH_RESPONSE_SCHEMA_TEXT } from '../schemas/coach'
import type { WeeklyReviewPayload } from '@/lib/types/training.types'

// ─── System Prompt ───────────────────────────────────────────────────────────

export function buildCoachSystemPrompt(): string {
    return `${HYBRID_MEDIATOR_IDENTITY}

Your role in this interaction: WEEKLY REVIEW COACH. You analyze a completed training week and provide structured adjustments for the next week.

${TRAINING_PHILOSOPHY}

${EQUIPMENT_CONSTRAINT}

COACHING RULES:
- RIR (Reps in Reserve) is the primary intensity control. Negative RIR deviation (user training harder than prescribed) signals accumulating fatigue.
- RPE spikes (>= 9.5) on non-peak exercises are red flags for fatigue or technique breakdown.
- Track sets per muscle group per week. Going below MEV wastes time. Going above MRV causes regression.
- A brutal Sunday ruck means Monday's heavy squats should be swapped for machine-based leg work.
- If the week looks clean and well-executed, keep adjustments minimal. Don't change things just to seem active.

RESPONSE SCHEMA:
${COACH_RESPONSE_SCHEMA_TEXT}

TRIGGER TYPE RULES:
- "WEEKLY_REVIEW": Default for end-of-week analysis
- "RUCK_FATIGUE": High ruck load is the dominant concern
- "RPE_SPIKE": Multiple exercises showed RPE >= 9.5
- "CARDIO_LOAD": Cardio volume is impacting lifting recovery

VOLUME ADJUSTMENT RULES:
- Only include muscle groups that need changes
- Positive = add sets, negative = reduce sets
- Keep deltas between -3 and +3

EXERCISE SWAP RULES:
- Only suggest swaps that respect the user's equipment access
- Never suggest equipment they don't have
- Max 5 swaps per review

RIR ADJUSTMENT RULES:
- If user consistently undershoots target RIR (training too hard), suggest positive adjustment (+0.5 to +1)
- If overshooting, suggest negative adjustment
- null if no change needed

${JSON_RESPONSE_RULES}`
}

// ─── User Prompt ─────────────────────────────────────────────────────────────

export function buildCoachUserPrompt(
    payload: WeeklyReviewPayload,
    targetRir: number | null,
    isDeload: boolean
): string {
    const muscleGroupSummary =
        payload.muscleGroupVolumes
            .map(
                (mg) =>
                    `  - ${mg.muscleGroup}: ${mg.setsThisWeek} sets (target: ${mg.targetSets}), tonnage: ${Math.round(mg.totalTonnageKg)}kg, avg RIR: ${mg.avgRIR !== null ? mg.avgRIR.toFixed(1) : 'N/A'}`
            )
            .join('\n') || '  No lifting data logged.'

    return `WEEKLY TRAINING REVIEW — Week ${payload.weekNumber}
Mesocycle Goal: ${payload.mesocycleGoal}
Target RIR this week: ${targetRir ?? 'Not set'}
Is Deload Week: ${isDeload ? 'YES' : 'No'}
Equipment Available: ${payload.equipmentAccess.join(', ') || 'Unknown'}

── LIFTING VOLUME ──
${muscleGroupSummary}
Average RIR Deviation: ${payload.avgRIRDeviation.toFixed(2)} (positive = easier than target, negative = harder)
RPE Spikes (>= 9.5): ${payload.rpeSpikes.length > 0 ? payload.rpeSpikes.join(', ') : 'None'}

── CARDIO ──
Total Cardio: ${payload.totalCardioMinutes} minutes
Average Heart Rate: ${payload.avgHeartRateCardio ?? 'N/A'} bpm

── RUCKING ──
Total Ruck Distance: ${payload.totalRuckDistanceKm.toFixed(1)} km
Total Ruck Load Index: ${payload.totalRuckLoadIndex.toFixed(0)} (distance x pack weight)
High-Fatigue Ruck Detected: ${payload.hadHighFatigueRuck ? 'YES — heavy systemic fatigue event' : 'No'}

Analyze this data and provide your JSON coaching response.`
}
