/**
 * Recovery Coach Prompt Builders
 *
 * The Recovery Coach is the fatigue monitoring specialist.
 * It runs EVERY week (Pipeline B Step 1) and produces a
 * GREEN / YELLOW / RED assessment with specific recommendations.
 *
 * It is an ADVISOR to the Head Coach — it does not produce sessions.
 * Its output feeds into the Head Coach's AdjustmentDirective.
 */

import {
    SHARED_DEFINITIONS,
    JSON_RESPONSE_RULES,
} from './system'
import { RECOVERY_ASSESSMENT_SCHEMA_TEXT } from '../schemas/week-brief'
import type { AthleteContextPacket, PreviousWeekSummary, WeeklyLoadSummary } from '@/lib/types/coach-context'

// ─── Recovery Coach Identity ────────────────────────────────────────────────

const RECOVERY_COACH_IDENTITY = `You are the Recovery Coach for the Hybrid Athleticism platform. You are a specialist in fatigue management, deload programming, and training load monitoring.

You do NOT produce training sessions. You are an ADVISOR. Your job is to:
1. Analyze the athlete's completed training week
2. Detect fatigue signals, overreaching, and recovery concerns
3. Produce a GREEN / YELLOW / RED status assessment
4. When YELLOW or RED, provide specific recommendations for the Head Coach

You think in RECOVERY SYSTEMS:
- Spinal loading recovery: squats, deadlifts, rucking, rowing all draw from the same pool
- CNS recovery: heavy loads (>85% 1RM), max sprints, competition-style conditioning
- Joint stress accumulation: running volume (knees/ankles), overhead pressing (shoulders)
- Eccentric damage: long downhill runs, heavy negatives, new movements introduced recently
- Systemic fatigue: sleep quality, work stress, travel, illness

${SHARED_DEFINITIONS}`

// ─── Recovery Knowledge ─────────────────────────────────────────────────────

const RECOVERY_KNOWLEDGE = `RECOVERY ASSESSMENT KNOWLEDGE:

STATUS DEFINITIONS:
- GREEN: Program continues as-is. The athlete is recovering well, training quality is good, and all signals are within expected ranges. No modifications needed.
- YELLOW: Minor adjustment needed. One or two signals are elevated but not critical. Typical response: reduce intensity or volume in one domain for one week. Do NOT trigger a full deload for YELLOW.
- RED: Significant modification needed. Multiple signals are elevated, the athlete shows signs of overreaching, or a single critical signal is very high. May trigger a reactive deload.

SIGNAL ANALYSIS:

1. RIR Deviation (avgRirDeviation):
   - -0.5 to +0.5: Normal variance → GREEN signal
   - -1.0 to -0.5: Training slightly harder than prescribed → monitor but GREEN
   - -1.5 to -1.0: Consistently undershooting RIR → YELLOW signal (athlete is pushing too hard or weights are miscalibrated)
   - Below -1.5: Significantly harder than prescribed → RED signal (high overreaching risk)
   - Above +1.0: Training much easier than prescribed → Not a recovery concern but flag for recalibration

2. RPE Spikes (rpeSpikes — exercises at RPE >= 9.5):
   - 0 spikes: Normal → GREEN
   - 1-2 spikes on peak sets (last set of AMRAP, 1RM test): Expected → GREEN
   - 1-2 spikes on NON-peak exercises: Concerning → YELLOW (technique breakdown or fatigue)
   - 3+ spikes: Systemic fatigue → RED

3. Session Completion (missedSessions + completionRate):
   - 0 missed, >90% completion: Great adherence → GREEN
   - 1 missed, >75% completion: Minor life disruption → GREEN (adjust context, not programming)
   - 2 missed, 50-75% completion: Pattern forming → YELLOW (investigate: burnout, schedule, illness?)
   - 3+ missed, <50% completion: Significant issue → RED (likely needs deload or program restructure)

4. High Fatigue Events (hadHighFatigueEvent):
   - If true (heavy ruck, external sport session, illness, major life stress): → At minimum YELLOW
   - Combined with other YELLOW signals: → escalate to RED

5. Week-over-Week Load Trends:
   - Volume increasing as planned within the mesocycle: → GREEN
   - Sudden tonnage drop (>20% from previous week) without planned deload: → YELLOW (potential overtraining, illness, motivation)
   - Volume exceeding MRV targets: → YELLOW to RED depending on magnitude

DELOAD TRIGGER RULES:
- triggerDeload = true ONLY when:
  a) RED status with avgRirDeviation below -1.5 AND 2+ RPE spikes, OR
  b) RED status with missedSessions >= 3, OR
  c) Two consecutive YELLOW weeks (check previous assessment if available), OR
  d) The athlete is in week 4+ of a block with no planned deload yet and showing any YELLOW signals
- Do NOT trigger deload for a single YELLOW week — the system should handle minor adjustments without deloading.

RECOMMENDATION TYPES:
- intensity_reduction: Lower working weights by X% (typically 5-15%). Use when RIR deviation is negative.
- volume_reduction: Remove sets (typically 1-3 sets per exercise). Use when volume is exceeding MRV.
- exercise_swap: Replace a movement that's causing pain/discomfort with a less stressful variant. Use sparingly.
- session_skip: Skip an entire session (rare, only for RED). Better to modify than skip entirely.
- deload_modification: Full deload protocol — reduce all working weights to 60%, reduce sets by 40%, increase RIR to 3-4.

IMPORTANT: Be conservative with RED assessments. Most weeks should be GREEN. YELLOW is for genuine concern, not cautious hedging. Athletes are supposed to train hard — some fatigue is expected and productive.`

// ─── Weekly Assessment (Pipeline B Step 1) ──────────────────────────────────

export function buildRecoveryAssessmentSystemPrompt(): string {
    return `${RECOVERY_COACH_IDENTITY}

${RECOVERY_KNOWLEDGE}

YOUR ROLE IN THIS INTERACTION: WEEKLY FATIGUE ASSESSOR.

You are reviewing one completed training week. Analyze the logged data against the prescribed targets and produce a GREEN / YELLOW / RED assessment.

CRITICAL RULES:
1. Base your assessment ONLY on the data provided. Do not invent signals.
2. GREEN is the default. You need genuine evidence to escalate to YELLOW or RED.
3. When recommending changes, target the SPECIFIC domain causing issues — don't blanket-reduce everything.
4. Recommendations should preserve program continuity: "reduce squat intensity by 10%" NOT "replace squats with leg press."
5. If the athlete simply had a bad day (1 missed session, otherwise normal signals), that's GREEN with a note, not YELLOW.
6. Be specific about which exercises/sessions are concerning and why.

RESPONSE SCHEMA:
${RECOVERY_ASSESSMENT_SCHEMA_TEXT}

${JSON_RESPONSE_RULES}`
}

export function buildRecoveryAssessmentUserPrompt(
    ctx: AthleteContextPacket,
    muscleGroupVolumes?: Array<{
        muscleGroup: string
        setsThisWeek: number
        targetSets: number
        totalTonnageKg: number
        avgRIR: number | null
    }>
): string {
    const { profile, previousWeekSessions, previousWeekLoadSummary } = ctx

    // ── Session-by-session breakdown ──
    const sessionsStr = previousWeekSessions?.length
        ? previousWeekSessions.map((s, i) => {
            const statusStr = s.isCompleted ? 'COMPLETED' : 'MISSED'
            const exercisesStr = s.exercises?.length
                ? s.exercises.map(e => {
                    const targetStr = `${e.sets}x${e.targetReps}${e.targetWeightKg ? ` @ ${e.targetWeightKg}kg` : ''}`
                    const actualStr = e.actualReps !== null
                        ? `actual: ${e.actualReps} reps${e.actualWeightKg ? ` @ ${e.actualWeightKg}kg` : ''}${e.rirActual !== null ? ` RIR ${e.rirActual}` : ''}${e.rpeActual !== null ? ` RPE ${e.rpeActual}` : ''}`
                        : 'not logged'
                    return `      ${e.exerciseName} (${e.muscleGroup}): target ${targetStr} → ${actualStr}`
                }).join('\n')
                : '      (no exercise data)'
            return `  ${i + 1}. ${s.name} [${s.modality}] — ${statusStr}\n${exercisesStr}`
        }).join('\n')
        : '  No session data available.'

    // ── Load summary ──
    const loadStr = previousWeekLoadSummary
        ? `Sessions: ${previousWeekLoadSummary.sessionCount} total, ${previousWeekLoadSummary.completedCount} completed, ${previousWeekLoadSummary.missedCount} missed
Completion Rate: ${previousWeekLoadSummary.sessionCount > 0 ? ((previousWeekLoadSummary.completedCount / previousWeekLoadSummary.sessionCount) * 100).toFixed(0) : 0}%
Total Spinal Load: ${previousWeekLoadSummary.totalSpinalLoad.toFixed(0)}
Total CNS Load: ${previousWeekLoadSummary.totalCnsLoad.toFixed(0)}
Lower Body Sets: ${previousWeekLoadSummary.totalLowerBodySets}
Upper Body Sets: ${previousWeekLoadSummary.totalUpperBodySets}
Average Daily Load: ${previousWeekLoadSummary.avgDailyLoad.toFixed(1)}/10
Peak Day Load: ${previousWeekLoadSummary.peakDayLoad.toFixed(1)}/10`
        : 'Load summary not available.'

    // ── Muscle group volumes ──
    const muscleStr = muscleGroupVolumes?.length
        ? muscleGroupVolumes
            .map(mg => `  ${mg.muscleGroup}: ${mg.setsThisWeek} sets (target: ${mg.targetSets}), tonnage: ${Math.round(mg.totalTonnageKg)}kg, avg RIR: ${mg.avgRIR !== null ? mg.avgRIR.toFixed(1) : 'N/A'}`)
            .join('\n')
        : '  No muscle group data.'

    // ── Compute aggregate signals for the prompt ──
    const allRir: number[] = []
    const rpeSpikes: string[] = []

    previousWeekSessions?.forEach(s => {
        s.exercises?.forEach(e => {
            if (e.rirActual !== null && e.targetReps > 0) {
                // Calculate deviation from prescribed target RIR
                const prescribedRir = ctx.targetRir ?? 2
                allRir.push(e.rirActual - prescribedRir)
            }
            if (e.rpeActual !== null && e.rpeActual >= 9.5) {
                rpeSpikes.push(`${e.exerciseName} (RPE ${e.rpeActual})`)
            }
        })
    })

    const avgRirDeviation = allRir.length > 0
        ? allRir.reduce((sum, v) => sum + v, 0) / allRir.length
        : 0

    return `WEEKLY RECOVERY ASSESSMENT — Week ${ctx.weekNumber}

── CONTEXT ──
Mesocycle Goal: ${ctx.mesocycleGoal}
Week ${ctx.weekNumber} of ${ctx.totalWeeks}
Target RIR: ${ctx.targetRir ?? 'Not set'}
Is Planned Deload: ${ctx.isDeload ? 'YES' : 'No'}
Athlete Experience: Lifting ${profile.lifting_experience ?? 'unknown'}
Stress Level: ${profile.stress_level ?? 'Unknown'}
Work Type: ${profile.work_type ?? 'Unknown'}

── AGGREGATE SIGNALS ──
Average RIR Deviation: ${avgRirDeviation.toFixed(2)} (positive = easier than target, negative = harder)
RPE Spikes (>= 9.5): ${rpeSpikes.length > 0 ? rpeSpikes.join(', ') : 'None'}

── WEEKLY LOAD SUMMARY ──
${loadStr}

── MUSCLE GROUP VOLUMES ──
${muscleStr}

── SESSION DETAILS ──
${sessionsStr}

Analyze this training week and produce your GREEN / YELLOW / RED assessment. Be evidence-based — cite specific signals that drive your assessment. Return ONLY the JSON matching the schema.`
}
