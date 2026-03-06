/**
 * Programming Engine Prompt Builders
 *
 * Constructs system + user prompts for generating weekly session pools.
 * This is the core of Build Section 2 — the Hybrid Mediator in action.
 *
 * The prompt incorporates:
 * - Full athlete profile (onboarding data)
 * - Active injuries and movement restrictions
 * - Known benchmarks (self-reported or tested)
 * - Recent training activity (pre-onboarding snapshot)
 * - Equipment constraints
 * - Methodology preferences
 * - Current mesocycle context (week number, goal, deload status)
 * - Benchmark discovery status (what to test in weeks 1-2)
 */

import {
    HYBRID_MEDIATOR_IDENTITY,
    TRAINING_PHILOSOPHY,
    JSON_RESPONSE_RULES,
    ESTIMATION_DIRECTIVE,
    EQUIPMENT_CONSTRAINT,
    BODY_COMP_RULES,
} from './system'
import { SESSION_POOL_SCHEMA_TEXT, SINGLE_SESSION_SCHEMA_TEXT } from '../schemas/programming'
import type { Profile, AthleteInjury, AthleteBenchmark, RecentTrainingActivity } from '@/lib/types/database.types'

// ─── Types for the programming payload ───────────────────────────────────────

export interface PreviousWeekSession {
    name: string
    modality: string
    exercises?: Array<{
        exerciseName: string
        muscleGroup: string
        sets: number
        targetReps: number
        targetWeightKg: number | null
        actualReps: number | null
        actualWeightKg: number | null
        rirActual: number | null
        rpeActual: number | null
    }>
    coachNotes: string | null
}

export interface CoachAdjustments {
    volumeAdjustments: Record<string, number> | null
    exerciseSwaps: Array<{ from: string; to: string; reason: string }> | null
    rirAdjustment: number | null
    rationale: string
}

export interface ExternalLoad {
    activityType: string
    durationMinutes: number | null
    perceivedIntensity: string
    loggedAt: string
}

export interface WeeklyLoadSummaryContext {
    totalSpinalLoad: number
    totalCnsLoad: number
    totalLowerBodySets: number
    totalUpperBodySets: number
    avgDailyLoad: number
    peakDayLoad: number
    sessionCount: number
}

export interface MethodologyContext {
    liftingProtocol?: string
    volumeTargets?: string
    endurancePlan?: string
    trainingPaces?: string
}

export interface MesocyclePlanContext {
    blockEmphasis: string
    deloadTiming: string
    keyProgressions: string[]
    weekVolumePercent?: number
    weekEmphasis?: string
}

export interface ProgrammingContext {
    profile: Profile
    injuries: AthleteInjury[]
    benchmarks: AthleteBenchmark[]
    recentTraining: RecentTrainingActivity[]
    weekNumber: number
    totalWeeks: number
    isDeload: boolean
    targetRir: number | null
    mesocycleGoal: string
    isBenchmarkDiscovery: boolean
    previousWeekSessions?: PreviousWeekSession[]
    coachAdjustments?: CoachAdjustments
    externalLoads?: ExternalLoad[]
    previousWeekLoadSummary?: WeeklyLoadSummaryContext
    methodologyContext?: MethodologyContext
    mesocyclePlan?: MesocyclePlanContext
}

// ─── System Prompt ───────────────────────────────────────────────────────────

export function buildProgrammingSystemPrompt(): string {
    return `${HYBRID_MEDIATOR_IDENTITY}

Your role in this interaction: PROGRAMMING ENGINE. You generate a complete weekly session pool for a hybrid athlete based on their profile, goals, equipment, injuries, and current training phase.

${TRAINING_PHILOSOPHY}

${EQUIPMENT_CONSTRAINT}

${ESTIMATION_DIRECTIVE}

${BODY_COMP_RULES}

SESSION POOL DESIGN RULES:

1. POOL SIZE: Generate sessions based on the athlete's available days. Pool size = available_days. Each session is self-contained.

2. DOMAIN DISTRIBUTION:
   Based on goal archetype:
   - "hybrid_fitness": Balanced across all domains — 2 lifting, 1-2 endurance, 1 conditioning, 0-1 mobility
   - "strength_focus": Lifting emphasis — 3 lifting, 1 endurance (maintenance), 0-1 conditioning, 0-1 mobility
   - "endurance_focus": Endurance emphasis — 1-2 lifting (maintenance), 2-3 endurance, 0-1 conditioning, 0-1 mobility
   - "conditioning_focus": Conditioning emphasis — 1-2 lifting, 1 endurance, 2 conditioning, 0-1 mobility
   - "longevity": Moderate across all — 2 lifting, 1 endurance, 1 conditioning, 1 mobility

3. SESSION DURATION: Respect the athlete's session_duration_minutes. If they said 60 minutes, don't generate 90-minute lifting sessions.

4. LIFTING SPLIT SELECTION:
   Based on available lifting days:
   - 2 days: Upper/Lower split
   - 3 days: Push/Pull/Legs or Upper/Lower/Full Body
   - 4+ days: Push/Pull/Legs/Upper (or PPL + specialty)
   Exercises must be achievable with the athlete's equipment.

5. VOLUME MANAGEMENT:
   - Beginner: Start at MEV (low volume, learn movements)
   - Intermediate: Start at moderate volume, progress toward MAV
   - Advanced: Start at MAV, approach MRV carefully
   - Deload weeks: Drop to ~60% of normal volume, reduce intensity

6. EXERCISE SELECTION:
   - ONLY prescribe exercises possible with the athlete's equipment_list
   - If they have "barbell_rack": back squat, bench press, overhead press, deadlift, rows
   - If they have "dumbbells": DB press, DB rows, lunges, goblet squats, etc.
   - If they have "pull_up_bar": pull-ups, chin-ups, hanging leg raises
   - NEVER prescribe cable exercises without "cable_machine" or "machines"
   - Respect movements_to_avoid from injuries

7. WEIGHT ESTIMATION:
   If benchmarks exist: Use them. Back squat working weight at week's target intensity.
   If benchmarks are missing: Estimate conservatively from bodyweight, experience level, sex, and age.
   Weight estimation heuristics for intermediate male (adjust down for beginner/female/older):
   - Back Squat: ~0.8x bodyweight for working sets
   - Bench Press: ~0.6x bodyweight
   - Deadlift: ~1.0x bodyweight
   - OHP: ~0.35x bodyweight
   For females: multiply above by ~0.65
   For beginners: multiply by ~0.6
   For advanced: multiply by ~1.3
   These are STARTING estimates — the system auto-calibrates from logged performance.

8. ENDURANCE PROGRAMMING:
   - Only program endurance modalities the athlete has selected/has equipment for
   - Check equipment_usage_intents: if rower is "endurance", program steady-state rows; if "conditioning", only use for metcons
   - Respect endurance_modality_preferences order for session allocation
   - Beginner endurance: Conversational pace, base building
   - Intermediate: 80/20 polarized (80% easy, 20% hard)
   - Advanced: More structured intervals, tempo work

9. CONDITIONING PROGRAMMING:
   - Respect conditioning_style_preferences (metcon, intervals, circuits, etc.)
   - Only use equipment the athlete has
   - Don't program max-effort conditioning the day before heavy lifting

10. MOBILITY PROGRAMMING:
    - Generate standalone mobility sessions for recovery days
    - Add mobilityPrimer to lifting sessions when relevant (desk job athlete squatting gets hip/ankle mobility)
    - Focus areas driven by: injuries, lifestyle (desk job → hips/thoracic), recent training load

11. BENCHMARK DISCOVERY:
    When isBenchmarkDiscovery is true (weeks 1-2):
    - Weave benchmark tests INTO regular sessions (don't create separate "test days")
    - For lifting: program a ramp-up to estimated 3RM or 5RM (safer than true 1RM)
    - For endurance: include a time trial or steady-state test at conversational pace
    - Mark benchmark exercises with isBenchmarkTest: true
    - Only test benchmarks the athlete DOESN'T already have data for
    - If they reported benchmarks during onboarding, use those and skip that test

12. DELOAD WEEK RULES:
    - Reduce volume by ~40% (fewer sets per exercise, not fewer exercises)
    - Reduce intensity (higher RIR target, lighter weights)
    - Keep movement patterns the same (practice, not stimulus)
    - Endurance: Easy pace only, reduced duration
    - Conditioning: Light/moderate only, no max-effort pieces
    - Add extra mobility work

13. CROSS-DOMAIN INTERFERENCE:
    - Don't place heavy squat sessions and long runs in the same pool position without warning
    - Flag in fatigueNotes when two sessions will compete for the same recovery system
    - If athlete has high stress_level or physical_labor work_type, reduce total volume by 10-15%

RESPONSE SCHEMA:
${SESSION_POOL_SCHEMA_TEXT}

${JSON_RESPONSE_RULES}`
}

// ─── User Prompt ─────────────────────────────────────────────────────────────

export function buildProgrammingUserPrompt(ctx: ProgrammingContext): string {
    const { profile, injuries, benchmarks, recentTraining, weekNumber, totalWeeks, isDeload, targetRir, mesocycleGoal, isBenchmarkDiscovery, previousWeekSessions } = ctx

    // Build athlete profile section
    const experienceSummary = [
        `Lifting: ${profile.lifting_experience ?? 'unknown'}`,
        `Running: ${profile.running_experience ?? 'unknown'}`,
        `Conditioning: ${profile.conditioning_experience ?? 'unknown'}`,
        profile.rucking_experience ? `Rucking: ${profile.rucking_experience}` : null,
        profile.rowing_experience ? `Rowing: ${profile.rowing_experience}` : null,
        profile.swimming_experience ? `Swimming: ${profile.swimming_experience}` : null,
        profile.cycling_experience ? `Cycling: ${profile.cycling_experience}` : null,
    ].filter(Boolean).join(', ')

    // Build equipment section
    const equipmentStr = profile.equipment_list?.length > 0
        ? profile.equipment_list.join(', ')
        : 'Unknown / minimal'

    const equipmentIntents = profile.equipment_usage_intents
        ? Object.entries(profile.equipment_usage_intents)
            .map(([eq, intent]) => `${eq}: ${intent}`)
            .join(', ')
        : 'None specified'

    // Build injury section
    const injuryStr = injuries.length > 0
        ? injuries
            .filter(i => i.is_active)
            .map(i => `${i.body_area} (${i.severity}): ${i.description || 'No description'}. Avoid: ${i.movements_to_avoid?.join(', ') || 'none specified'}`)
            .join('\n  ')
        : 'None reported'

    // Build movements to avoid
    const movementsToAvoid = profile.movements_to_avoid?.length > 0
        ? profile.movements_to_avoid.join(', ')
        : 'None'

    // Build benchmark section
    const benchmarkStr = benchmarks.length > 0
        ? benchmarks
            .map(b => `${b.benchmark_name}: ${b.value} ${b.unit} (${b.source})`)
            .join(', ')
        : 'No benchmarks reported — use estimation'

    // Build recent training section
    const recentTrainingStr = recentTraining.length > 0
        ? recentTraining
            .map(rt => `${rt.modality}: ${rt.frequency_per_week}x/week${rt.approximate_volume ? `, ~${rt.approximate_volume}` : ''}`)
            .join(', ')
        : 'No recent training data — starting from scratch'

    // Build methodology section
    const methodologyStr = [
        `Strength: ${profile.strength_methodology ?? 'ai_decides'}`,
        `Hypertrophy: ${profile.hypertrophy_methodology ?? 'ai_decides'}`,
        `Endurance: ${profile.endurance_methodology ?? 'ai_decides'}`,
    ].join(', ')

    // Endurance preferences
    const endurancePrefs = profile.endurance_modality_preferences?.length > 0
        ? profile.endurance_modality_preferences.join(' > ')
        : 'No ranking'

    const conditioningPrefs = profile.conditioning_style_preferences?.length > 0
        ? profile.conditioning_style_preferences.join(', ')
        : 'No preference'

    return `GENERATE WEEKLY SESSION POOL

── ATHLETE PROFILE ──
Age: ${profile.age ?? 'Unknown'} | Sex: ${profile.sex ?? 'Unknown'} | Weight: ${profile.bodyweight_kg ?? 'Unknown'} kg | Height: ${profile.height_cm ?? 'Unknown'} cm
Experience: ${experienceSummary}
Goal Archetype: ${profile.goal_archetype ?? mesocycleGoal}
Body Comp Goal: ${profile.body_comp_goal ?? 'No preference'}

── SCHEDULE & AVAILABILITY ──
Available Days: ${profile.available_days}/week
Session Duration: ${profile.session_duration_minutes} minutes
Two-a-days: ${profile.two_a_day ?? 'no'}
Time Preference: ${profile.time_of_day ?? 'no preference'}

── EQUIPMENT ──
Environment: ${profile.primary_training_environment ?? 'Unknown'}
Equipment: ${equipmentStr}
Equipment Usage Intents: ${equipmentIntents}

── ENDURANCE & CONDITIONING PREFERENCES ──
Endurance Modality Ranking: ${endurancePrefs}
Conditioning Style: ${conditioningPrefs}

── METHODOLOGY ──
${methodologyStr}
Transparency: ${profile.transparency ?? 'minimal'}

── LIFESTYLE ──
Work Type: ${profile.work_type ?? 'Unknown'}
Stress Level: ${profile.stress_level ?? 'Unknown'}
Travel Frequency: ${profile.travel_frequency ?? 'Unknown'}

── INJURIES & LIMITATIONS ──
  ${injuryStr}
Movements to Avoid: ${movementsToAvoid}

── KNOWN BENCHMARKS ──
${benchmarkStr}

── RECENT TRAINING HISTORY ──
${recentTrainingStr}

── CURRENT TRAINING PHASE ──
Mesocycle Goal: ${mesocycleGoal}
Week: ${weekNumber} of ${totalWeeks}
Target RIR: ${targetRir ?? 'Not set'}
Deload Week: ${isDeload ? 'YES — reduce volume & intensity' : 'No'}
Benchmark Status: ${
        isBenchmarkDiscovery
            ? 'DISCOVERY ACTIVE — weave benchmark tests into this week\'s sessions for untested lifts/endurance. Ramp to 3-5RM for strength, include time trials for endurance.'
            : 'No — use existing data or estimates'
    }

${previousWeekSessions && previousWeekSessions.length > 0 ? `
── PREVIOUS WEEK'S SESSIONS (with actual performance) ──
${previousWeekSessions.map((s, i) => {
        const exerciseLines = s.exercises
            ? s.exercises.map(e => {
                const target = `${e.sets}×${e.targetReps}${e.targetWeightKg ? ` @ ${e.targetWeightKg}kg` : ''}`
                const hasActuals = e.actualReps !== null || e.actualWeightKg !== null
                const actual = hasActuals
                    ? ` → Actual: ${e.sets}×${e.actualReps ?? '?'}${e.actualWeightKg ? ` @ ${e.actualWeightKg}kg` : ''}${e.rirActual !== null ? `, RIR ${e.rirActual.toFixed(1)}` : ''}${e.rpeActual !== null ? `, RPE ${e.rpeActual}` : ''}`
                    : ' → (not logged)'
                return `    - ${e.exerciseName} (${e.muscleGroup}): Target: ${target}${actual}`
            }).join('\n')
            : '    (no exercise detail)'
        return `${i + 1}. ${s.name} [${s.modality}]\n${exerciseLines}${s.coachNotes ? `\n    Notes: ${s.coachNotes}` : ''}`
    }).join('\n')}

PROGRESSIVE OVERLOAD INSTRUCTION: Compare Target vs Actual for each exercise.
- If the athlete hit all target reps at the target weight with RIR >= 1: increase weight by 2.5kg (upper body) or 5kg (lower body).
- If RIR was 0 or they missed reps: hold the weight or reduce slightly. The athlete is at their current limit.
- If the athlete exceeded the target weight (Actual > Target): they self-regulated up. Use their actual weight as the new baseline.
- If not logged ("not logged"): hold the prescription from last week.
- Apply these rules exercise by exercise. Do not reinvent the program — build upon last week's session structure.
` : ''}${ctx.coachAdjustments ? `
── COACH ADJUSTMENTS FOR THIS WEEK ──
Rationale: ${ctx.coachAdjustments.rationale}
${ctx.coachAdjustments.volumeAdjustments ? `Volume Deltas: ${Object.entries(ctx.coachAdjustments.volumeAdjustments).map(([mg, delta]) => `${mg}: ${delta > 0 ? '+' : ''}${delta} sets`).join(', ')}` : ''}
${ctx.coachAdjustments.exerciseSwaps?.length ? `Exercise Swaps: ${ctx.coachAdjustments.exerciseSwaps.map(s => `${s.from} → ${s.to} (${s.reason})`).join(', ')}` : ''}
${ctx.coachAdjustments.rirAdjustment !== null ? `RIR Adjustment: ${ctx.coachAdjustments.rirAdjustment > 0 ? '+' : ''}${ctx.coachAdjustments.rirAdjustment}` : ''}

COACH INSTRUCTION: Apply these adjustments to this week's programming. These are based on actual logged performance from last week.
` : ''}${ctx.externalLoads && ctx.externalLoads.length > 0 ? `
── EXTERNAL LOADS THIS WEEK ──
${ctx.externalLoads.map(el => `- ${el.activityType}: ${el.durationMinutes ?? '?'} min, intensity: ${el.perceivedIntensity} (${el.loggedAt})`).join('\n')}

EXTERNAL LOAD INSTRUCTION: Factor these activities into your volume/intensity decisions. High-intensity combat sports or long hikes should reduce same-day or next-day training load. Reduce lower body volume after heavy hiking/sport, reduce CNS load after combat sports.
` : ''}${ctx.previousWeekLoadSummary ? `
── PREVIOUS WEEK LOAD SUMMARY ──
Sessions: ${ctx.previousWeekLoadSummary.sessionCount} | Avg Daily Load: ${ctx.previousWeekLoadSummary.avgDailyLoad}/10 | Peak Day Load: ${ctx.previousWeekLoadSummary.peakDayLoad}/10
Spinal Load Index: ${ctx.previousWeekLoadSummary.totalSpinalLoad} | Total CNS Load: ${ctx.previousWeekLoadSummary.totalCnsLoad}
Lower Body Sets: ${ctx.previousWeekLoadSummary.totalLowerBodySets} | Upper Body Sets: ${ctx.previousWeekLoadSummary.totalUpperBodySets}

LOAD INSTRUCTION: If spinal load or CNS load was high last week, moderate this week's loading in those systems. If peak day load was >= 8, ensure better session distribution this week.
` : ''}${ctx.methodologyContext ? `
── METHODOLOGY-SPECIFIC TARGETS (use these exact numbers) ──
${ctx.methodologyContext.liftingProtocol ? `LIFTING PROTOCOL:\n${ctx.methodologyContext.liftingProtocol}\n` : ''}${ctx.methodologyContext.volumeTargets ? `VOLUME TARGETS (sets per muscle group this week):\n${ctx.methodologyContext.volumeTargets}\n` : ''}${ctx.methodologyContext.endurancePlan ? `ENDURANCE PLAN:\n${ctx.methodologyContext.endurancePlan}\n` : ''}${ctx.methodologyContext.trainingPaces ? `TRAINING PACES:\n${ctx.methodologyContext.trainingPaces}\n` : ''}
METHODOLOGY INSTRUCTION: Follow these calculated targets precisely. They come from validated formulas (5/3/1, RP landmarks, Daniels). Do not override them with your own estimates. You have creative freedom in exercise selection, session structure, and accessories — but the main lifts, volumes, and paces must match these targets.
` : ''}${ctx.mesocyclePlan ? `
── MESOCYCLE PLAN CONTEXT ──
Block Emphasis: ${ctx.mesocyclePlan.blockEmphasis}
This Week: Volume at ${ctx.mesocyclePlan.weekVolumePercent ?? '?'}% of MRV, emphasis on "${ctx.mesocyclePlan.weekEmphasis ?? 'general'}"
Deload Strategy: ${ctx.mesocyclePlan.deloadTiming}
Key Progressions: ${ctx.mesocyclePlan.keyProgressions.join('; ')}
` : ''}Generate a complete session pool for this week. Return ONLY the JSON matching the schema.`
}

// ─── Single Session Context & Prompts ─────────────────────────────────────

export interface ExistingPoolSession {
    name: string
    modality: string
    exercises?: Array<{ exerciseName: string; muscleGroup: string }>
}

export interface SingleSessionContext extends ProgrammingContext {
    mode: 'regenerate' | 'add'
    requestedCategory: string
    existingPool: ExistingPoolSession[]
    targetSession?: { name: string; modality: string; coachNotes: string | null }
    benchmarkDates?: Array<{ benchmarkName: string; testedAt: string | null }>
}

export function buildSingleSessionSystemPrompt(): string {
    return `${HYBRID_MEDIATOR_IDENTITY}

Your role in this interaction: SINGLE SESSION GENERATOR. You generate exactly ONE training session for a specific category, designed to fit within an existing weekly session pool.

${TRAINING_PHILOSOPHY}

${EQUIPMENT_CONSTRAINT}

${ESTIMATION_DIRECTIVE}

SINGLE SESSION RULES:

1. Generate EXACTLY ONE session matching the requested category.
2. Check the existing pool for conflicts — don't duplicate sessions or muscle groups already heavily loaded.
3. The session must be achievable with the athlete's equipment.
4. Respect session_duration_minutes from the athlete profile.
5. If replacing a session, the new session should serve a different training stimulus than the old one.
6. For BENCHMARK category: generate a session with isBenchmarkTest: true exercises. Ramp the athlete to a 3-5RM for strength benchmarks, or include time trials for endurance benchmarks. Prioritise testing benchmarks that are stale (oldest tested_at dates) or never tested.

CATEGORY MAPPING:
- "LIFTING": Generate a lifting session (modality: "LIFTING")
- "running": Generate a running session (modality: "CARDIO", enduranceModality: "running")
- "rucking": Generate a rucking session (modality: "CARDIO", enduranceModality: "rucking")
- "rowing": Generate a rowing session (modality: "CARDIO", enduranceModality: "rowing")
- "cycling": Generate a cycling session (modality: "CARDIO", enduranceModality: "cycling")
- "swimming": Generate a swimming session (modality: "CARDIO", enduranceModality: "swimming")
- "metcon": Generate a conditioning session (modality: "METCON")
- "mobility": Generate a mobility session (modality: "MOBILITY")
- "benchmark": Generate a benchmark test session — choose appropriate modality based on what needs testing

RESPONSE SCHEMA:
${SINGLE_SESSION_SCHEMA_TEXT}

${JSON_RESPONSE_RULES}`
}

export function buildSingleSessionUserPrompt(ctx: SingleSessionContext): string {
    const { profile, injuries, benchmarks, existingPool, requestedCategory, mode, targetSession, weekNumber, totalWeeks, isDeload, targetRir, mesocycleGoal, previousWeekSessions, benchmarkDates } = ctx

    const equipmentStr = profile.equipment_list?.length > 0
        ? profile.equipment_list.join(', ')
        : 'Unknown / minimal'

    const injuryStr = injuries.length > 0
        ? injuries.filter(i => i.is_active).map(i => `${i.body_area} (${i.severity})`).join(', ')
        : 'None'

    const benchmarkStr = benchmarks.length > 0
        ? benchmarks.map(b => `${b.benchmark_name}: ${b.value} ${b.unit}`).join(', ')
        : 'No benchmarks — use estimation'

    const existingPoolStr = existingPool.length > 0
        ? existingPool.map((s, i) => {
            const exercises = s.exercises
                ? s.exercises.map(e => `${e.exerciseName} (${e.muscleGroup})`).join(', ')
                : 'no detail'
            return `  ${i + 1}. ${s.name} [${s.modality}] — ${exercises}`
        }).join('\n')
        : '  (empty pool)'

    const prevWeekStr = previousWeekSessions && previousWeekSessions.length > 0
        ? previousWeekSessions.map((s, i) => {
            const exercises = s.exercises
                ? s.exercises.map(e => `${e.exerciseName}: ${e.sets}×${e.targetReps}${e.targetWeightKg ? ` @ ${e.targetWeightKg}kg` : ''}`).join(', ')
                : 'no detail'
            return `  ${i + 1}. ${s.name} [${s.modality}] — ${exercises}`
        }).join('\n')
        : null

    const benchmarkDatesStr = benchmarkDates && benchmarkDates.length > 0
        ? benchmarkDates.map(b => `  ${b.benchmarkName}: ${b.testedAt ?? 'never tested'}`).join('\n')
        : null

    return `GENERATE SINGLE SESSION

── MODE ──
${mode === 'regenerate' ? `REPLACE session: "${targetSession?.name ?? 'unknown'}" [${targetSession?.modality ?? '?'}]` : 'ADD new session to pool'}
Requested Category: ${requestedCategory.toUpperCase()}

── ATHLETE SNAPSHOT ──
Age: ${profile.age ?? '?'} | Sex: ${profile.sex ?? '?'} | Weight: ${profile.bodyweight_kg ?? '?'} kg
Experience: Lifting ${profile.lifting_experience ?? '?'}, Running ${profile.running_experience ?? '?'}, Conditioning ${profile.conditioning_experience ?? '?'}
Equipment: ${equipmentStr}
Session Duration: ${profile.session_duration_minutes} minutes
Injuries: ${injuryStr}
Movements to Avoid: ${profile.movements_to_avoid?.length ? profile.movements_to_avoid.join(', ') : 'None'}

── KNOWN BENCHMARKS ──
${benchmarkStr}
${benchmarkDatesStr ? `\n── BENCHMARK TEST DATES ──\n${benchmarkDatesStr}` : ''}

── CURRENT TRAINING PHASE ──
Week: ${weekNumber} of ${totalWeeks} | Goal: ${mesocycleGoal}
Target RIR: ${targetRir ?? 'Not set'}
Deload: ${isDeload ? 'YES' : 'No'}

── EXISTING POOL (this week) ──
${existingPoolStr}

${prevWeekStr ? `── PREVIOUS WEEK'S SESSIONS ──\n${prevWeekStr}\n\nCONTINUITY: Progress from previous week where applicable.` : ''}

Generate exactly ONE session for the requested category. Return ONLY the JSON matching the schema.`
}
