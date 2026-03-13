'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, WorkoutWithSets } from '@/lib/types/training.types'
import type { AthleteBenchmark, Microcycle, Workout } from '@/lib/types/database.types'
import type { SessionInventory } from '@/lib/types/inventory.types'
import { generateStructuredResponse } from '@/lib/ai/client'
import { WeeklySessionPoolSchema, SingleSessionResponseSchema, createValidatedSessionPoolSchema, MesocycleOverviewPlanSchema } from '@/lib/ai/schemas/programming'
import type { WeeklySessionPool, Session, LiftingSession, EnduranceSession, ConditioningSession, MobilitySession, SingleSessionResponse, MesocycleOverviewPlan } from '@/lib/ai/schemas/programming'
import { buildProgrammingSystemPrompt, buildProgrammingUserPrompt, buildSingleSessionSystemPrompt, buildSingleSessionUserPrompt } from '@/lib/ai/prompts/programming'
import type { ProgrammingContext, PreviousWeekSession, SingleSessionContext, ExistingPoolSession, MethodologyContext } from '@/lib/ai/prompts/programming'
import { autoAssignSessionDates, buildTempWorkoutFromSession, findOptimalDayForSession } from '@/lib/scheduling/auto-assign'
import { computeWeeklyLoadSummary } from '@/lib/scheduling/load-scoring'
import {
    calculate531Wave,
    estimateTrainingMax,
    calculateRPVolumeLandmarks,
    calculateWeeklyVolumeTarget,
    calculatePolarizedZoneDistribution,
    calculateDanielsVDOT,
    formatPace,
} from '@/lib/training/methodology-helpers'

// ─── Generate Session Pool for a Single Week ────────────────────────────────

/**
 * Generate a full AI-powered session pool for a specific microcycle (week).
 *
 * This is the core Programming Engine action. It:
 * 1. Loads all athlete context (profile, injuries, benchmarks, recent training)
 * 2. Sends it to Claude via the structured response client
 * 3. Validates the response against the WeeklySessionPool schema
 * 4. Persists workouts + exercise_sets to the database
 * 5. Returns the created workouts
 *
 * Called from:
 * - completeOnboarding (generates week 1)
 * - End-of-week flow (generates next week)
 * - Manual "regenerate" action from dashboard
 */
export async function generateSessionPool(
    microcycleId: string
): Promise<ActionResult<{ workouts: Workout[]; sessionPool: WeeklySessionPool }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // ─── Step 1: Load microcycle context ─────────────────────────────────────
    const { data: microcycle, error: mcError } = await supabase
        .from('microcycles')
        .select('*, mesocycles!inner(id, goal, name, week_count, is_active, ai_context_json)')
        .eq('id', microcycleId)
        .eq('user_id', user.id)
        .single()

    if (mcError || !microcycle) {
        return { success: false, error: mcError?.message ?? 'Microcycle not found' }
    }

    const mesocycleData = microcycle.mesocycles as {
        id: string
        goal: string
        name: string
        week_count: number
        is_active: boolean
        ai_context_json: Record<string, unknown> | null
    }

    // ─── Step 2: Load athlete profile ────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (profileError || !profile) {
        return { success: false, error: 'Could not load athlete profile' }
    }

    // ─── Step 3: Load injuries, benchmarks, recent training in parallel ──────
    const [injuriesResult, benchmarksResult, recentTrainingResult] = await Promise.all([
        supabase
            .from('athlete_injuries')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true),
        supabase
            .from('athlete_benchmarks')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
        supabase
            .from('recent_training_activity')
            .select('*')
            .eq('user_id', user.id),
    ])

    const injuries = injuriesResult.data ?? []
    const benchmarks = benchmarksResult.data ?? []
    const recentTraining = recentTrainingResult.data ?? []

    // Deduplicate benchmarks — keep only latest per benchmark_name
    const latestBenchmarks = deduplicateBenchmarks(benchmarks)

    // ─── Step 4: Determine if this is benchmark discovery week ───────────────
    const isBenchmarkDiscovery =
        profile.benchmark_discovery_status === 'pending' &&
        microcycle.week_number <= 2

    // ─── Step 4b: Load previous week sessions for continuity ────────────────
    let previousWeekSessions: PreviousWeekSession[] | undefined

    if (microcycle.week_number > 1) {
        // Find previous week's microcycle
        const { data: prevMicrocycle } = await supabase
            .from('microcycles')
            .select('id')
            .eq('mesocycle_id', mesocycleData.id)
            .eq('week_number', microcycle.week_number - 1)
            .eq('user_id', user.id)
            .single()

        if (prevMicrocycle) {
            // Load workouts with exercise_sets for the previous week
            const { data: prevWorkouts } = await supabase
                .from('workouts')
                .select('id, name, modality, coach_notes')
                .eq('microcycle_id', prevMicrocycle.id)
                .eq('user_id', user.id)
                .order('scheduled_date', { ascending: true })

            if (prevWorkouts && prevWorkouts.length > 0) {
                const prevWorkoutIds = prevWorkouts.map(w => w.id)
                const { data: prevSets } = await supabase
                    .from('exercise_sets')
                    .select('workout_id, exercise_name, muscle_group, set_number, target_reps, target_weight_kg, actual_reps, actual_weight_kg, rir_actual, rpe_actual')
                    .in('workout_id', prevWorkoutIds)
                    .order('set_number', { ascending: true })

                previousWeekSessions = prevWorkouts.map(w => {
                    const workoutSets = (prevSets ?? []).filter(s => s.workout_id === w.id)

                    // Aggregate sets per exercise (deduplicate into summaries with actuals)
                    const exerciseMap = new Map<string, {
                        exerciseName: string
                        muscleGroup: string
                        sets: number
                        targetReps: number
                        targetWeightKg: number | null
                        actualReps: number | null
                        actualWeightKg: number | null
                        rirActual: number | null
                        rpeActual: number | null
                        _rirCount: number
                    }>()

                    for (const s of workoutSets) {
                        const key = s.exercise_name
                        const existing = exerciseMap.get(key)
                        if (existing) {
                            existing.sets += 1
                            // Keep the highest target weight as representative
                            if (s.target_weight_kg && (!existing.targetWeightKg || s.target_weight_kg > existing.targetWeightKg)) {
                                existing.targetWeightKg = s.target_weight_kg
                            }
                            // Keep the highest actual weight
                            if (s.actual_weight_kg && (!existing.actualWeightKg || s.actual_weight_kg > existing.actualWeightKg)) {
                                existing.actualWeightKg = s.actual_weight_kg
                            }
                            // Keep latest actual reps
                            if (s.actual_reps) existing.actualReps = s.actual_reps
                            // Average RIR across logged sets
                            if (s.rir_actual !== null) {
                                existing._rirCount += 1
                                existing.rirActual = existing.rirActual !== null
                                    ? ((existing.rirActual * (existing._rirCount - 1)) + s.rir_actual) / existing._rirCount
                                    : s.rir_actual
                            }
                            // Keep latest RPE
                            if (s.rpe_actual !== null) existing.rpeActual = s.rpe_actual
                        } else {
                            exerciseMap.set(key, {
                                exerciseName: s.exercise_name,
                                muscleGroup: s.muscle_group ?? 'unknown',
                                sets: 1,
                                targetReps: s.target_reps ?? 0,
                                targetWeightKg: s.target_weight_kg,
                                actualReps: s.actual_reps,
                                actualWeightKg: s.actual_weight_kg,
                                rirActual: s.rir_actual,
                                rpeActual: s.rpe_actual,
                                _rirCount: s.rir_actual !== null ? 1 : 0,
                            })
                        }
                    }

                    return {
                        name: w.name,
                        modality: w.modality,
                        exercises: exerciseMap.size > 0
                            ? Array.from(exerciseMap.values()).map(({ _rirCount, ...rest }) => ({
                                ...rest,
                                rirActual: rest.rirActual !== null ? Math.round(rest.rirActual * 10) / 10 : null,
                            }))
                            : undefined,
                        coachNotes: w.coach_notes,
                    }
                })
            }
        }
    }

    // ─── Step 4c: Load accepted coach adjustments from previous week ────────
    let coachAdjustments: ProgrammingContext['coachAdjustments']

    if (microcycle.week_number > 1) {
        const { data: prevMicrocycleForCoach } = await supabase
            .from('microcycles')
            .select('id')
            .eq('mesocycle_id', mesocycleData.id)
            .eq('week_number', microcycle.week_number - 1)
            .eq('user_id', user.id)
            .maybeSingle()

        if (prevMicrocycleForCoach) {
            const { data: intervention } = await supabase
                .from('ai_coach_interventions')
                .select('volume_adjustments, exercise_swaps, rir_adjustment, rationale')
                .eq('microcycle_id', prevMicrocycleForCoach.id)
                .eq('user_id', user.id)
                .eq('user_accepted', true)
                .order('created_at', { ascending: false })
                .maybeSingle()

            if (intervention) {
                coachAdjustments = {
                    volumeAdjustments: intervention.volume_adjustments as Record<string, number> | null,
                    exerciseSwaps: intervention.exercise_swaps as Array<{ from: string; to: string; reason: string }> | null,
                    rirAdjustment: intervention.rir_adjustment,
                    rationale: intervention.rationale,
                }
            }
        }
    }

    // ─── Step 4d: Load external loads for this week ──────────────────────────
    const { data: externalLoadsRaw } = await supabase
        .from('external_load_logs')
        .select('activity_type, duration_minutes, perceived_intensity, logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', microcycle.start_date)
        .lte('logged_at', microcycle.end_date)
        .order('logged_at', { ascending: true })

    const externalLoads: ProgrammingContext['externalLoads'] = (externalLoadsRaw ?? []).map(el => ({
        activityType: el.activity_type,
        durationMinutes: el.duration_minutes,
        perceivedIntensity: el.perceived_intensity,
        loggedAt: el.logged_at,
    }))

    // ─── Step 4e: Compute previous week load summary ─────────────────────────
    let previousWeekLoadSummary: ProgrammingContext['previousWeekLoadSummary']

    if (microcycle.week_number > 1) {
        const { data: prevMcForLoad } = await supabase
            .from('microcycles')
            .select('id')
            .eq('mesocycle_id', mesocycleData.id)
            .eq('week_number', microcycle.week_number - 1)
            .eq('user_id', user.id)
            .maybeSingle()

        if (prevMcForLoad) {
            const { data: prevWorkoutsForLoad } = await supabase
                .from('workouts')
                .select('*, exercise_sets(*)')
                .eq('microcycle_id', prevMcForLoad.id)
                .eq('user_id', user.id)
                .eq('is_completed', true)

            if (prevWorkoutsForLoad && prevWorkoutsForLoad.length > 0) {
                previousWeekLoadSummary = computeWeeklyLoadSummary(prevWorkoutsForLoad as WorkoutWithSets[])
            }
        }
    }

    // ─── Step 4f: Build methodology-specific context ─────────────────────────
    const methodologyContext = buildMethodologyContext(
        profile, latestBenchmarks, microcycle.week_number, mesocycleData.week_count, microcycle.is_deload
    )

    // ─── Step 4g: Read mesocycle plan (if generated) ─────────────────────────
    let mesocyclePlan: ProgrammingContext['mesocyclePlan']
    const rawPlan = (mesocycleData as any).ai_context_json?.mesocyclePlan
    if (rawPlan) {
        const weekData = rawPlan.volumeProgressionCurve?.find(
            (w: { weekNumber: number }) => w.weekNumber === microcycle.week_number
        )
        mesocyclePlan = {
            blockEmphasis: rawPlan.blockEmphasis ?? '',
            deloadTiming: rawPlan.deloadTiming ?? '',
            keyProgressions: rawPlan.keyProgressions ?? [],
            weekVolumePercent: weekData?.volumePercent,
            weekEmphasis: weekData?.emphasis,
        }
    }

    // ─── Step 5: Build programming context ───────────────────────────────────
    const programmingContext: ProgrammingContext = {
        profile,
        injuries,
        benchmarks: latestBenchmarks,
        recentTraining,
        weekNumber: microcycle.week_number,
        totalWeeks: mesocycleData.week_count,
        isDeload: microcycle.is_deload,
        targetRir: microcycle.target_rir,
        mesocycleGoal: mesocycleData.goal,
        isBenchmarkDiscovery,
        previousWeekSessions,
        coachAdjustments,
        externalLoads: externalLoads.length > 0 ? externalLoads : undefined,
        previousWeekLoadSummary,
        methodologyContext,
        mesocyclePlan,
    }

    // ─── Step 6: Call the AI Programming Engine ──────────────────────────────
    const systemPrompt = buildProgrammingSystemPrompt()
    const userPrompt = buildProgrammingUserPrompt(programmingContext)

    const goalArchetype = profile.goal_archetype ?? mesocycleData.goal ?? 'hybrid_fitness'
    const validatedSchema = createValidatedSessionPoolSchema(goalArchetype)

    const aiResult = await generateStructuredResponse({
        systemPrompt,
        userPrompt,
        schema: validatedSchema,
        maxRetries: 2,
        maxTokens: 8192, // Session pools are large
        temperature: 0.7, // Some variation in programming
    })

    if (!aiResult.success) {
        console.error('[generateSessionPool] AI call failed:', aiResult.error)
        return { success: false, error: `Programming Engine failed: ${aiResult.error}` }
    }

    const sessionPool = aiResult.data

    // ─── Step 7: Delete existing workouts for this microcycle (re-generation) ─
    // This allows regeneration — delete old workouts + sets before inserting new ones
    const { data: existingWorkouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('microcycle_id', microcycleId)
        .eq('user_id', user.id)

    if (existingWorkouts && existingWorkouts.length > 0) {
        const existingIds = existingWorkouts.map(w => w.id)

        // Delete exercise_sets first (FK constraint)
        await supabase
            .from('exercise_sets')
            .delete()
            .in('workout_id', existingIds)

        // Delete workouts
        await supabase
            .from('workouts')
            .delete()
            .eq('microcycle_id', microcycleId)
            .eq('user_id', user.id)
    }

    // ─── Step 8: Persist sessions to database ────────────────────────────────
    // Sessions start UNALLOCATED — user clicks "Allocate" to auto-assign dates.
    // scheduled_date uses microcycle start_date as placeholder.
    const createdWorkouts: Workout[] = []
    const insertErrors: string[] = []

    console.log(`[generateSessionPool] AI returned ${sessionPool.sessions.length} sessions, inserting...`)

    for (let i = 0; i < sessionPool.sessions.length; i++) {
        const session = sessionPool.sessions[i]

        // Map AI modality to DB modality
        const dbModality = mapModality(session.modality)

        // Build coach notes based on session type
        const coachNotes = buildCoachNotes(session, profile.transparency ?? 'minimal')

        // Insert workout — unallocated, using start_date as placeholder
        const { data: workout, error: workoutError } = await supabase
            .from('workouts')
            .insert({
                microcycle_id: microcycleId,
                user_id: user.id,
                modality: dbModality,
                name: session.name,
                scheduled_date: microcycle.start_date,
                is_allocated: false,
                is_completed: false,
                coach_notes: coachNotes,
            })
            .select()
            .single()

        if (workoutError || !workout) {
            const errMsg = `"${session.name}" (${dbModality}): ${workoutError?.message ?? 'no data returned'}`
            console.error(`[generateSessionPool] Insert failed:`, errMsg)
            insertErrors.push(errMsg)
            continue
        }

        createdWorkouts.push(workout)

        // Insert exercise_sets for LIFTING sessions
        if (session.modality === 'LIFTING') {
            await insertLiftingSets(supabase, workout.id, user.id, session)
        }

        // Insert cardio_logs skeleton for CARDIO sessions (targets only, not logged data)
        if (session.modality === 'CARDIO') {
            await insertEnduranceTarget(supabase, workout.id, user.id, session)
        }
    }

    // If zero sessions were persisted, treat as a failure
    if (createdWorkouts.length === 0) {
        const detail = insertErrors.length > 0
            ? `All ${sessionPool.sessions.length} session inserts failed: ${insertErrors.join('; ')}`
            : 'AI returned sessions but none could be persisted.'
        console.error(`[generateSessionPool] CRITICAL: ${detail}`)
        return { success: false, error: detail }
    }

    if (insertErrors.length > 0) {
        console.warn(`[generateSessionPool] ${insertErrors.length}/${sessionPool.sessions.length} inserts failed (${createdWorkouts.length} succeeded)`)
    }

    console.log(`[generateSessionPool] Successfully created ${createdWorkouts.length} workouts`)

    // ─── Step 9: Update benchmark discovery status if applicable ─────────────
    if (isBenchmarkDiscovery && microcycle.week_number === 1) {
        await supabase
            .from('profiles')
            .update({ benchmark_discovery_status: 'in_progress' })
            .eq('id', user.id)
    }
    if (isBenchmarkDiscovery && microcycle.week_number === 2) {
        await supabase
            .from('profiles')
            .update({ benchmark_discovery_status: 'complete' })
            .eq('id', user.id)
    }

    // ─── Step 10: Store the AI context on the mesocycle for debugging ────────
    await supabase
        .from('mesocycles')
        .update({
            ai_context_json: {
                ...(typeof mesocycleData === 'object' ? {} : {}),
                lastGeneratedWeek: microcycle.week_number,
                generatedAt: new Date().toISOString(),
                aiModel: aiResult.metadata?.model,
                aiAttempts: aiResult.metadata?.attempts,
                aiDurationMs: aiResult.metadata?.durationMs,
                volumeDistribution: sessionPool.volumeDistribution,
            },
        })
        .eq('id', mesocycleData.id)
        .eq('user_id', user.id)

    revalidatePath('/dashboard')
    revalidatePath('/workout')

    return {
        success: true,
        data: {
            workouts: createdWorkouts,
            sessionPool,
        },
    }
}

// ─── Generate First Week (Called from Onboarding Completion) ─────────────────

// ─── Generate Mesocycle Plan (High-Level Block Planning) ─────────────────

/**
 * Generate a high-level mesocycle plan — volume progression curve, block emphasis,
 * deload timing, and key progressions. Stored in mesocycles.ai_context_json
 * and read by generateSessionPool to provide macro-level guidance each week.
 */
export async function generateMesocyclePlan(
    mesocycleId: string
): Promise<ActionResult<MesocycleOverviewPlan>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: mesocycle, error: mesoError } = await supabase
        .from('mesocycles')
        .select('*')
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
        .single()

    if (mesoError || !mesocycle) {
        return { success: false, error: 'Mesocycle not found' }
    }

    const [profileResult, benchmarksResult, injuriesResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('athlete_benchmarks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('athlete_injuries').select('*').eq('user_id', user.id).eq('is_active', true),
    ])

    if (profileResult.error || !profileResult.data) {
        return { success: false, error: 'Could not load athlete profile' }
    }

    const profile = profileResult.data
    const benchmarks = deduplicateBenchmarks(benchmarksResult.data ?? [])
    const injuries = injuriesResult.data ?? []

    const systemPrompt = `${buildProgrammingSystemPrompt()}

Your role in this interaction: MESOCYCLE PLANNER. You create a high-level plan for the entire training block — NOT individual sessions. You define the volume progression curve, block emphasis, deload timing, and key progressions.`

    const benchmarkStr = benchmarks.length > 0
        ? benchmarks.map(b => `${b.benchmark_name}: ${b.value} ${b.unit}`).join(', ')
        : 'No benchmarks'

    const injuryStr = injuries.length > 0
        ? injuries.map(i => `${i.body_area} (${i.severity})`).join(', ')
        : 'None'

    const userPrompt = `GENERATE MESOCYCLE PLAN

Block: "${mesocycle.name}" — ${mesocycle.week_count} weeks, Goal: ${mesocycle.goal}
Athlete: Age ${profile.age ?? '?'}, ${profile.sex ?? '?'}, ${profile.bodyweight_kg ?? '?'}kg
Experience: Lifting ${profile.lifting_experience ?? '?'}, Running ${profile.running_experience ?? '?'}, Conditioning ${profile.conditioning_experience ?? '?'}
Goal Archetype: ${profile.goal_archetype ?? mesocycle.goal}
Days/Week: ${profile.available_days}, Duration: ${profile.session_duration_minutes}min
Injuries: ${injuryStr}
Benchmarks: ${benchmarkStr}
Stress: ${profile.stress_level ?? '?'}, Work: ${profile.work_type ?? '?'}

Plan the ${mesocycle.week_count}-week block with:
1. Volume progression for each week (as % of MRV target: start ~60-70%, build to 85-95%, deload drops to 40-50%)
2. Weekly emphasis that shifts based on goal archetype and block periodization
3. Deload timing and rationale
4. 3-5 key progressions to track across the block

Return ONLY the JSON matching the schema.`

    const aiResult = await generateStructuredResponse({
        systemPrompt,
        userPrompt,
        schema: MesocycleOverviewPlanSchema,
        maxRetries: 2,
        maxTokens: 4096,
        temperature: 0.5,
    })

    if (!aiResult.success) {
        console.error('[generateMesocyclePlan] AI call failed:', aiResult.error)
        return { success: false, error: `Mesocycle planning failed: ${aiResult.error}` }
    }

    const plan = aiResult.data

    // Store plan in mesocycle's ai_context_json
    const existingContext = (mesocycle.ai_context_json as Record<string, unknown>) ?? {}
    await supabase
        .from('mesocycles')
        .update({
            ai_context_json: {
                ...existingContext,
                mesocyclePlan: plan,
                planGeneratedAt: new Date().toISOString(),
            },
        })
        .eq('id', mesocycleId)
        .eq('user_id', user.id)

    return { success: true, data: plan }
}

// ─── Generate First Week (Called from Onboarding Completion) ─────────────────

/**
 * Generate the session pool for week 1 of the active mesocycle.
 * Called after onboarding completes and the mesocycle shell exists.
 */
export async function generateFirstWeekPool(): Promise<
    ActionResult<{ workouts: Workout[]; sessionPool: WeeklySessionPool }>
> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Find the active mesocycle's week 1
    const { data: microcycle, error } = await supabase
        .from('microcycles')
        .select('id, mesocycles!inner(is_active)')
        .eq('user_id', user.id)
        .eq('week_number', 1)
        .eq('mesocycles.is_active', true)
        .maybeSingle()

    if (error || !microcycle) {
        return {
            success: false,
            error: 'No active mesocycle with week 1 found. Complete onboarding first.',
        }
    }

    return generateSessionPool(microcycle.id)
}

// ─── Generate Next Week ─────────────────────────────────────────────────────

/**
 * Generate the session pool for the next unprogrammed week in the active mesocycle.
 * Called from the dashboard when the current week ends.
 */
export async function generateNextWeekPool(): Promise<
    ActionResult<{ workouts: Workout[]; sessionPool: WeeklySessionPool }>
> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Find the next microcycle without workouts in the active mesocycle
    const { data: microcycles, error: mcError } = await supabase
        .from('microcycles')
        .select('id, week_number, mesocycles!inner(is_active)')
        .eq('user_id', user.id)
        .eq('mesocycles.is_active', true)
        .order('week_number', { ascending: true })

    if (mcError || !microcycles || microcycles.length === 0) {
        return { success: false, error: 'No active mesocycle found' }
    }

    // Find the first microcycle that has no workouts yet
    for (const mc of microcycles) {
        const { count } = await supabase
            .from('workouts')
            .select('id', { count: 'exact', head: true })
            .eq('microcycle_id', mc.id)
            .eq('user_id', user.id)

        if ((count ?? 0) === 0) {
            return generateSessionPool(mc.id)
        }
    }

    return {
        success: false,
        error: 'All weeks in the current mesocycle already have sessions generated.',
    }
}

// ─── Regenerate Current Week ────────────────────────────────────────────────

/**
 * Regenerate the session pool for the current (or specified) week.
 * Deletes existing workouts and creates new ones.
 * Used when athlete updates their preferences or wants a fresh pool.
 *
 * @param targetMicrocycleId — Optional: regenerate this specific week (used when viewing a non-current week)
 */
export async function regenerateCurrentWeekPool(targetMicrocycleId?: string): Promise<
    ActionResult<{ workouts: Workout[]; sessionPool: WeeklySessionPool }>
> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    if (targetMicrocycleId) {
        return generateSessionPool(targetMicrocycleId)
    }

    const today = new Date().toISOString().split('T')[0]

    // Find the current microcycle (today's date falls within its range)
    let { data: microcycle } = await supabase
        .from('microcycles')
        .select('id')
        .eq('user_id', user.id)
        .lte('start_date', today)
        .gte('end_date', today)
        .maybeSingle()

    // If today is before the first week starts (e.g. onboarded mid-week),
    // fall back to the nearest upcoming microcycle
    if (!microcycle) {
        const { data: upcoming } = await supabase
            .from('microcycles')
            .select('id')
            .eq('user_id', user.id)
            .gte('start_date', today)
            .order('start_date', { ascending: true })
            .limit(1)
            .maybeSingle()
        microcycle = upcoming
    }

    if (!microcycle) {
        return { success: false, error: 'No current training week found' }
    }

    return generateSessionPool(microcycle.id)
}

// ─── Allocate Sessions to Calendar ──────────────────────────────────────────

/**
 * Auto-assign unallocated sessions to calendar days using load-aware scheduling.
 * Called when user clicks "Allocate Sessions" button in the dashboard.
 *
 * @param targetMicrocycleId — Optional: allocate this specific week (used when viewing a non-current week)
 */
export async function allocateSessionDates(targetMicrocycleId?: string): Promise<ActionResult<void>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    let microcycle: { id: string; start_date: string; end_date: string } | null = null

    if (targetMicrocycleId) {
        // Use the explicitly provided microcycle
        const { data: target } = await supabase
            .from('microcycles')
            .select('id, start_date, end_date')
            .eq('id', targetMicrocycleId)
            .eq('user_id', user.id)
            .maybeSingle()
        microcycle = target
    } else {
        // Fall back to date-based lookup
        const today = new Date().toISOString().split('T')[0]

        const { data: currentMeso } = await supabase
            .from('mesocycles')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle()

        if (!currentMeso) {
            return { success: false, error: 'No active mesocycle found' }
        }

        const { data: exactWeek } = await supabase
            .from('microcycles')
            .select('id, start_date, end_date')
            .eq('mesocycle_id', currentMeso.id)
            .eq('user_id', user.id)
            .lte('start_date', today)
            .gte('end_date', today)
            .maybeSingle()

        if (exactWeek) {
            microcycle = exactWeek
        } else {
            const { data: nextWeek } = await supabase
                .from('microcycles')
                .select('id, start_date, end_date')
                .eq('mesocycle_id', currentMeso.id)
                .eq('user_id', user.id)
                .gte('start_date', today)
                .order('start_date', { ascending: true })
                .limit(1)
                .maybeSingle()

            if (nextWeek) {
                microcycle = nextWeek
            } else {
                const { data: lastWeek } = await supabase
                    .from('microcycles')
                    .select('id, start_date, end_date')
                    .eq('mesocycle_id', currentMeso.id)
                    .eq('user_id', user.id)
                    .order('start_date', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                microcycle = lastWeek
            }
        }
    }

    if (!microcycle) {
        return { success: false, error: 'No current training week found' }
    }

    // Load all workouts with exercise_sets for this microcycle
    const { data: workouts } = await supabase
        .from('workouts')
        .select('*, exercise_sets(*)')
        .eq('microcycle_id', microcycle.id)
        .eq('user_id', user.id)

    if (!workouts || workouts.length === 0) {
        return { success: false, error: 'No sessions to allocate' }
    }

    // Filter to unallocated only for assignment, but include all for load context
    const unallocated = workouts.filter(w => !w.is_allocated && !w.is_completed)
    if (unallocated.length === 0) {
        return { success: true, data: undefined }  // Nothing to allocate
    }

    // Load athlete's two-a-day preference for scheduling
    const { data: schedProfile } = await supabase
        .from('profiles')
        .select('two_a_day')
        .eq('id', user.id)
        .single()

    const twoADay = (schedProfile?.two_a_day ?? 'no') as 'yes' | 'sometimes' | 'no'

    // Use load-aware auto-assignment on ALL sessions (already allocated ones
    // will keep their current dates, we only update unallocated ones)
    const allAsWorkoutWithSets = workouts as WorkoutWithSets[]
    const dateAssignments = autoAssignSessionDates(
        allAsWorkoutWithSets,
        microcycle.start_date,
        microcycle.end_date,
        twoADay
    )

    // Update each unallocated workout with its assigned date
    for (const workout of unallocated) {
        const assignedDate = dateAssignments.get(workout.id)
        if (assignedDate) {
            await supabase
                .from('workouts')
                .update({
                    scheduled_date: assignedDate,
                    is_allocated: true,
                })
                .eq('id', workout.id)
                .eq('user_id', user.id)
        }
    }

    revalidatePath('/dashboard')
    return { success: true, data: undefined }
}

// ─── Deallocate All Sessions ────────────────────────────────────────────────

/**
 * Reset all non-completed workouts in the current microcycle back to unallocated.
 * Called when user clicks "Clear Calendar" button.
 *
 * @param targetMicrocycleId — Optional: deallocate this specific week (used when viewing a non-current week)
 */
export async function deallocateAllSessions(targetMicrocycleId?: string): Promise<ActionResult<void>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    let microcycle: { id: string; start_date: string } | null = null

    if (targetMicrocycleId) {
        const { data: target } = await supabase
            .from('microcycles')
            .select('id, start_date')
            .eq('id', targetMicrocycleId)
            .eq('user_id', user.id)
            .maybeSingle()
        microcycle = target
    } else {
        const today = new Date().toISOString().split('T')[0]

        const { data: currentMeso } = await supabase
            .from('mesocycles')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle()

        if (!currentMeso) {
            return { success: false, error: 'No active mesocycle found' }
        }

        const { data: exactWeek } = await supabase
            .from('microcycles')
            .select('id, start_date')
            .eq('mesocycle_id', currentMeso.id)
            .eq('user_id', user.id)
            .lte('start_date', today)
            .gte('end_date', today)
            .maybeSingle()

        if (exactWeek) {
            microcycle = exactWeek
        } else {
            const { data: nextWeek } = await supabase
                .from('microcycles')
                .select('id, start_date')
                .eq('mesocycle_id', currentMeso.id)
                .eq('user_id', user.id)
                .gte('start_date', today)
                .order('start_date', { ascending: true })
                .limit(1)
                .maybeSingle()

            if (nextWeek) {
                microcycle = nextWeek
            } else {
                const { data: lastWeek } = await supabase
                    .from('microcycles')
                    .select('id, start_date')
                    .eq('mesocycle_id', currentMeso.id)
                    .eq('user_id', user.id)
                    .order('start_date', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                microcycle = lastWeek
            }
        }
    }

    if (!microcycle) {
        return { success: false, error: 'No current training week found' }
    }

    // Reset all non-completed workouts to unallocated
    const { error } = await supabase
        .from('workouts')
        .update({
            scheduled_date: microcycle.start_date,
            is_allocated: false,
        })
        .eq('microcycle_id', microcycle.id)
        .eq('user_id', user.id)
        .eq('is_completed', false)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true, data: undefined }
}

// ─── Regenerate / Add Single Session ────────────────────────────────────────

/**
 * Regenerate a single session (replace or add) in the current week's pool.
 *
 * @param workoutId - ID of the workout to replace (null = add mode)
 * @param requestedCategory - Training domain: 'LIFTING' | 'running' | 'rucking' | 'rowing' | 'cycling' | 'swimming' | 'metcon' | 'mobility' | 'benchmark'
 */
export async function regenerateSingleSession(
    workoutId: string | null,
    requestedCategory: string
): Promise<ActionResult<{ workout: Workout; aiResponse: SingleSessionResponse }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // ─── Determine the target microcycle ──────────────────────────────────────
    let microcycleId: string
    let scheduledDate: string

    if (workoutId) {
        // Replace mode — find the workout's microcycle and preserve its date
        const { data: existingWorkout, error: wErr } = await supabase
            .from('workouts')
            .select('id, microcycle_id, scheduled_date, is_completed')
            .eq('id', workoutId)
            .eq('user_id', user.id)
            .single()

        if (wErr || !existingWorkout) {
            return { success: false, error: 'Workout not found' }
        }
        if (existingWorkout.is_completed) {
            return { success: false, error: 'Cannot regenerate a completed workout' }
        }

        microcycleId = existingWorkout.microcycle_id
        scheduledDate = existingWorkout.scheduled_date
    } else {
        // Add mode — find the current microcycle and pick the next available date
        const today = new Date().toISOString().split('T')[0]

        let microcycle: { id: string; start_date: string; end_date: string } | null = null

        const { data: exactWeek } = await supabase
            .from('microcycles')
            .select('id, start_date, end_date')
            .eq('user_id', user.id)
            .lte('start_date', today)
            .gte('end_date', today)
            .maybeSingle()

        if (exactWeek) {
            microcycle = exactWeek
        } else {
            // Fall back to nearest upcoming microcycle (onboarded mid-week)
            const { data: upcoming } = await supabase
                .from('microcycles')
                .select('id, start_date, end_date')
                .eq('user_id', user.id)
                .gte('start_date', today)
                .order('start_date', { ascending: true })
                .limit(1)
                .maybeSingle()
            microcycle = upcoming
        }

        if (!microcycle) {
            return { success: false, error: 'No current training week found' }
        }

        microcycleId = microcycle.id

        // Load existing workouts with exercise sets for load-aware day selection
        const { data: existingWorkoutsForLoad } = await supabase
            .from('workouts')
            .select('*, exercise_sets(*)')
            .eq('microcycle_id', microcycleId)
            .eq('user_id', user.id)
            .order('scheduled_date', { ascending: true })

        // Create a temporary workout for the new session to score
        const tempNewWorkout = {
            id: 'temp-new',
            microcycle_id: microcycleId,
            user_id: user.id,
            modality: requestedCategory === 'LIFTING' ? 'LIFTING'
                : requestedCategory === 'metcon' ? 'METCON'
                : requestedCategory === 'mobility' ? 'CARDIO'
                : 'CARDIO',
            name: `New ${requestedCategory} session`,
            scheduled_date: '',
            is_completed: false,
            completed_at: null,
            actual_duration_minutes: null,
            coach_notes: null,
            created_at: new Date().toISOString(),
            exercise_sets: [],
        } as any

        // Use load-aware scheduling to find the optimal day
        scheduledDate = findOptimalDayForSession(
            tempNewWorkout,
            (existingWorkoutsForLoad ?? []) as any[],
            microcycle.start_date,
            microcycle.end_date
        )
    }

    // ─── Load full context ────────────────────────────────────────────────────
    const { data: microcycle, error: mcError } = await supabase
        .from('microcycles')
        .select('*, mesocycles!inner(id, goal, name, week_count, is_active)')
        .eq('id', microcycleId)
        .eq('user_id', user.id)
        .single()

    if (mcError || !microcycle) {
        return { success: false, error: 'Microcycle not found' }
    }

    const mesocycleData = microcycle.mesocycles as {
        id: string; goal: string; name: string; week_count: number; is_active: boolean
    }

    const [profileResult, injuriesResult, benchmarksResult, recentTrainingResult, existingWorkoutsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('athlete_injuries').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('athlete_benchmarks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('recent_training_activity').select('*').eq('user_id', user.id),
        supabase.from('workouts').select('id, name, modality, coach_notes').eq('microcycle_id', microcycleId).eq('user_id', user.id),
    ])

    if (profileResult.error || !profileResult.data) {
        return { success: false, error: 'Could not load athlete profile' }
    }
    const profile = profileResult.data
    const injuries = injuriesResult.data ?? []
    const benchmarks = deduplicateBenchmarks(benchmarksResult.data ?? [])
    const recentTraining = recentTrainingResult.data ?? []

    // Build existing pool (excluding the session being replaced)
    const existingPool: ExistingPoolSession[] = (existingWorkoutsResult.data ?? [])
        .filter(w => w.id !== workoutId)
        .map(w => ({
            name: w.name,
            modality: w.modality,
        }))

    // Load exercise details for existing pool sessions (for muscle group awareness)
    if (existingPool.length > 0) {
        const poolIds = (existingWorkoutsResult.data ?? [])
            .filter(w => w.id !== workoutId)
            .map(w => w.id)
        const { data: poolSets } = await supabase
            .from('exercise_sets')
            .select('workout_id, exercise_name, muscle_group')
            .in('workout_id', poolIds)

        if (poolSets) {
            for (const ps of existingPool) {
                const workoutRow = (existingWorkoutsResult.data ?? []).find(w => w.name === ps.name)
                if (workoutRow) {
                    const sets = poolSets.filter(s => s.workout_id === workoutRow.id)
                    const uniqueExercises = new Map<string, { exerciseName: string; muscleGroup: string }>()
                    for (const s of sets) {
                        if (!uniqueExercises.has(s.exercise_name)) {
                            uniqueExercises.set(s.exercise_name, {
                                exerciseName: s.exercise_name,
                                muscleGroup: s.muscle_group ?? 'unknown',
                            })
                        }
                    }
                    ps.exercises = Array.from(uniqueExercises.values())
                }
            }
        }
    }

    // Target session info (for replace mode)
    const targetSession = workoutId
        ? (existingWorkoutsResult.data ?? []).find(w => w.id === workoutId)
        : null

    // Load previous week sessions for continuity
    let previousWeekSessions: PreviousWeekSession[] | undefined
    if (microcycle.week_number > 1) {
        const { data: prevMc } = await supabase
            .from('microcycles')
            .select('id')
            .eq('mesocycle_id', mesocycleData.id)
            .eq('week_number', microcycle.week_number - 1)
            .eq('user_id', user.id)
            .single()

        if (prevMc) {
            const { data: prevWorkouts } = await supabase
                .from('workouts')
                .select('id, name, modality, coach_notes')
                .eq('microcycle_id', prevMc.id)
                .eq('user_id', user.id)
                .order('scheduled_date', { ascending: true })

            if (prevWorkouts && prevWorkouts.length > 0) {
                const prevIds = prevWorkouts.map(w => w.id)
                const { data: prevSets } = await supabase
                    .from('exercise_sets')
                    .select('workout_id, exercise_name, muscle_group, set_number, target_reps, target_weight_kg, actual_reps, actual_weight_kg, rir_actual, rpe_actual')
                    .in('workout_id', prevIds)

                previousWeekSessions = prevWorkouts.map(w => {
                    const wSets = (prevSets ?? []).filter(s => s.workout_id === w.id)
                    const exMap = new Map<string, { exerciseName: string; muscleGroup: string; sets: number; targetReps: number; targetWeightKg: number | null; actualReps: number | null; actualWeightKg: number | null; rirActual: number | null; rpeActual: number | null; _rirCount: number }>()
                    for (const s of wSets) {
                        const ex = exMap.get(s.exercise_name)
                        if (ex) {
                            ex.sets += 1
                            if (s.target_weight_kg && (!ex.targetWeightKg || s.target_weight_kg > ex.targetWeightKg)) {
                                ex.targetWeightKg = s.target_weight_kg
                            }
                            if (s.actual_weight_kg && (!ex.actualWeightKg || s.actual_weight_kg > ex.actualWeightKg)) {
                                ex.actualWeightKg = s.actual_weight_kg
                            }
                            if (s.actual_reps) ex.actualReps = s.actual_reps
                            if (s.rir_actual !== null) {
                                ex._rirCount += 1
                                ex.rirActual = ex.rirActual !== null
                                    ? ((ex.rirActual * (ex._rirCount - 1)) + s.rir_actual) / ex._rirCount
                                    : s.rir_actual
                            }
                            if (s.rpe_actual !== null) ex.rpeActual = s.rpe_actual
                        } else {
                            exMap.set(s.exercise_name, {
                                exerciseName: s.exercise_name,
                                muscleGroup: s.muscle_group ?? 'unknown',
                                sets: 1,
                                targetReps: s.target_reps ?? 0,
                                targetWeightKg: s.target_weight_kg,
                                actualReps: s.actual_reps,
                                actualWeightKg: s.actual_weight_kg,
                                rirActual: s.rir_actual,
                                rpeActual: s.rpe_actual,
                                _rirCount: s.rir_actual !== null ? 1 : 0,
                            })
                        }
                    }
                    return {
                        name: w.name,
                        modality: w.modality,
                        exercises: exMap.size > 0
                            ? Array.from(exMap.values()).map(({ _rirCount, ...rest }) => ({
                                ...rest,
                                rirActual: rest.rirActual !== null ? Math.round(rest.rirActual * 10) / 10 : null,
                            }))
                            : undefined,
                        coachNotes: w.coach_notes,
                    }
                })
            }
        }
    }

    // Load benchmark dates for benchmark category
    let benchmarkDates: Array<{ benchmarkName: string; testedAt: string | null }> | undefined
    if (requestedCategory === 'benchmark') {
        benchmarkDates = benchmarks.map(b => ({
            benchmarkName: b.benchmark_name,
            testedAt: b.tested_at,
        }))
    }

    // ─── Build context and call AI ────────────────────────────────────────────
    const isBenchmarkDiscovery =
        profile.benchmark_discovery_status === 'pending' &&
        microcycle.week_number <= 2

    const singleCtx: SingleSessionContext = {
        profile,
        injuries,
        benchmarks,
        recentTraining,
        weekNumber: microcycle.week_number,
        totalWeeks: mesocycleData.week_count,
        isDeload: microcycle.is_deload,
        targetRir: microcycle.target_rir,
        mesocycleGoal: mesocycleData.goal,
        isBenchmarkDiscovery,
        previousWeekSessions,
        mode: workoutId ? 'regenerate' : 'add',
        requestedCategory,
        existingPool,
        targetSession: targetSession ? {
            name: targetSession.name,
            modality: targetSession.modality,
            coachNotes: targetSession.coach_notes,
        } : undefined,
        benchmarkDates,
    }

    const systemPrompt = buildSingleSessionSystemPrompt()
    const userPrompt = buildSingleSessionUserPrompt(singleCtx)

    const aiResult = await generateStructuredResponse({
        systemPrompt,
        userPrompt,
        schema: SingleSessionResponseSchema,
        maxRetries: 2,
        maxTokens: 4096,
        temperature: 0.7,
    })

    if (!aiResult.success) {
        console.error('[regenerateSingleSession] AI call failed:', aiResult.error)
        return { success: false, error: `Session generation failed: ${aiResult.error}` }
    }

    const aiResponse = aiResult.data
    const session = aiResponse.session

    // ─── Delete old workout if replacing ──────────────────────────────────────
    if (workoutId) {
        await supabase.from('exercise_sets').delete().eq('workout_id', workoutId)
        await supabase.from('cardio_logs').delete().eq('workout_id', workoutId)
        await supabase.from('workouts').delete().eq('id', workoutId).eq('user_id', user.id)
    }

    // ─── Persist new session ──────────────────────────────────────────────────
    const dbModality = mapModality(session.modality)
    const coachNotes = buildCoachNotes(session, profile.transparency ?? 'minimal')

    const { data: workout, error: insertErr } = await supabase
        .from('workouts')
        .insert({
            microcycle_id: microcycleId,
            user_id: user.id,
            modality: dbModality,
            name: session.name,
            scheduled_date: scheduledDate,
            is_allocated: false,
            is_completed: false,
            coach_notes: coachNotes,
        })
        .select()
        .single()

    if (insertErr || !workout) {
        console.error('[regenerateSingleSession] Workout insert failed:', insertErr)
        return { success: false, error: `Failed to save session: ${insertErr?.message}` }
    }

    // Insert exercise_sets for LIFTING sessions
    if (session.modality === 'LIFTING') {
        await insertLiftingSets(supabase, workout.id, user.id, session)
    }

    // Insert cardio_logs skeleton for CARDIO sessions
    if (session.modality === 'CARDIO') {
        await insertEnduranceTarget(supabase, workout.id, user.id, session)
    }

    revalidatePath('/dashboard')

    return {
        success: true,
        data: { workout, aiResponse },
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Map AI schema modality to DB workout_modality enum.
 */
function mapModality(aiModality: Session['modality']): 'LIFTING' | 'CARDIO' | 'RUCKING' | 'METCON' | 'MOBILITY' {
    switch (aiModality) {
        case 'LIFTING': return 'LIFTING'
        case 'CARDIO': return 'CARDIO'
        case 'METCON': return 'METCON'
        case 'MOBILITY': return 'MOBILITY'
        default: return 'LIFTING'
    }
}

/**
 * Build coach notes based on session type and transparency preference.
 */
function buildCoachNotes(session: Session, transparency: string): string | null {
    const parts: string[] = []

    // For METCON sessions, the workoutDescription IS the workout — must be persisted
    if (session.modality === 'METCON') {
        const condSession = session as ConditioningSession
        if (condSession.workoutDescription) {
            parts.push(`WORKOUT:\n${condSession.workoutDescription}`)
        }
        const meta: string[] = []
        if (condSession.conditioningType) meta.push(condSession.conditioningType.toUpperCase())
        if (condSession.targetIntensity) meta.push(`Intensity: ${condSession.targetIntensity}`)
        if (condSession.estimatedDurationMinutes) meta.push(`~${condSession.estimatedDurationMinutes} min`)
        if (meta.length > 0) parts.push(meta.join(' · '))
    }

    // For MOBILITY sessions, the description IS the session content
    if (session.modality === 'MOBILITY') {
        const mobSession = session as MobilitySession
        if (mobSession.description) {
            parts.push(`SESSION:\n${mobSession.description}`)
        }
        if (mobSession.focusAreas?.length) {
            parts.push(`Focus: ${mobSession.focusAreas.join(', ')}`)
        }
    }

    // For CARDIO sessions, build structured session prescription
    if (session.modality === 'CARDIO') {
        const endSession = session as EnduranceSession
        const sessionParts: string[] = []

        // Distance or duration
        if (endSession.targetDistanceKm !== null && endSession.targetDistanceKm > 0) {
            sessionParts.push(`${endSession.targetDistanceKm}km`)
        } else if (endSession.estimatedDurationMinutes) {
            sessionParts.push(`${endSession.estimatedDurationMinutes} minutes`)
        }

        // Pace
        if (endSession.targetPaceSecPerKm !== null && endSession.targetPaceSecPerKm > 0) {
            const paceMinutes = Math.floor(endSession.targetPaceSecPerKm / 60)
            const paceSeconds = Math.round(endSession.targetPaceSecPerKm % 60)
            sessionParts.push(`@ ${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}/km pace`)
        }

        // Interval structure
        if (endSession.intervalStructure) {
            sessionParts.push(endSession.intervalStructure)
        }

        if (sessionParts.length > 0) {
            parts.push(`SESSION:\n${sessionParts.join(' ')}`)
        }

        // Add metadata line
        const meta: string[] = []
        if (endSession.intensityZone) {
            meta.push(endSession.intensityZone.replace('_', ' ').toUpperCase())
        }
        if (endSession.enduranceModality) {
            meta.push(endSession.enduranceModality)
        }
        if (endSession.estimatedDurationMinutes) {
            meta.push(`~${endSession.estimatedDurationMinutes} min`)
        }
        if (meta.length > 0) {
            parts.push(meta.join(' · '))
        }
    }

    if (session.coachNotes) {
        parts.push(session.coachNotes)
    }

    if (transparency === 'detailed') {
        if (session.modality === 'LIFTING') {
            const liftSession = session as LiftingSession
            if (liftSession.mobilityPrimer) {
                parts.push(`Mobility primer: ${liftSession.mobilityPrimer}`)
            }
        }
    }

    return parts.length > 0 ? parts.join('\n\n') : null
}

/**
 * Insert exercise_sets for a lifting session.
 */
async function insertLiftingSets(
    supabase: Awaited<ReturnType<typeof createClient>>,
    workoutId: string,
    userId: string,
    session: LiftingSession
): Promise<void> {
    const rows: Array<{
        workout_id: string
        user_id: string
        exercise_name: string
        muscle_group: string
        set_number: number
        target_reps: number
        target_weight_kg: number | null
        target_rir: number
        notes: string | null
    }> = []

    let globalSetNumber = 1
    for (const exercise of session.exercises) {
        for (let s = 0; s < exercise.sets; s++) {
            rows.push({
                workout_id: workoutId,
                user_id: userId,
                exercise_name: exercise.exerciseName,
                muscle_group: exercise.muscleGroup,
                set_number: globalSetNumber,
                target_reps: exercise.targetReps,
                target_weight_kg: exercise.targetWeightKg,
                target_rir: exercise.targetRir,
                notes: exercise.notes ?? (exercise.isBenchmarkTest ? 'BENCHMARK TEST — log carefully' : null),
            })
            globalSetNumber++
        }
    }

    if (rows.length > 0) {
        const { error } = await supabase.from('exercise_sets').insert(rows)
        if (error) {
            console.error(`[insertLiftingSets] Failed for workout ${workoutId}:`, error)
        }
    }
}

/**
 * Insert a cardio_log target entry for an endurance session.
 * This creates a "target" row that the athlete fills in with actuals during logging.
 */
async function insertEnduranceTarget(
    supabase: Awaited<ReturnType<typeof createClient>>,
    workoutId: string,
    userId: string,
    session: EnduranceSession
): Promise<void> {
    // Map intensity zone to cardio_type
    const cardioTypeMap: Record<string, string> = {
        zone_2: 'ZONE_2',
        easy: 'EASY',
        tempo: 'TEMPO',
        threshold: 'TEMPO',
        vo2max: 'VO2_MAX',
        interval: 'VO2_MAX',
    }

    const { error } = await supabase.from('cardio_logs').insert({
        workout_id: workoutId,
        user_id: userId,
        cardio_type: cardioTypeMap[session.intensityZone] ?? 'ZONE_2',
        duration_minutes: session.estimatedDurationMinutes,
        distance_km: session.targetDistanceKm ?? null,
        avg_pace_sec_per_km: session.targetPaceSecPerKm ?? null,
    })

    if (error) {
        console.error(`[insertEnduranceTarget] Failed for workout ${workoutId}:`, error)
    }
}

/**
 * Deduplicate benchmarks — keep only the latest entry per benchmark_name.
 */
function deduplicateBenchmarks(benchmarks: AthleteBenchmark[]): AthleteBenchmark[] {
    const latest = new Map<string, AthleteBenchmark>()
    for (const b of benchmarks) {
        const existing = latest.get(b.benchmark_name)
        if (!existing || new Date(b.created_at) > new Date(existing.created_at)) {
            latest.set(b.benchmark_name, b)
        }
    }
    return Array.from(latest.values())
}

/**
 * Build methodology-specific context with concrete calculated targets.
 * These give Claude exact numbers to follow rather than philosophy strings.
 */
function buildMethodologyContext(
    profile: { strength_methodology?: string | null; hypertrophy_methodology?: string | null; endurance_methodology?: string | null; lifting_experience?: string | null; available_days?: number | null; session_duration_minutes?: number | null },
    benchmarks: AthleteBenchmark[],
    weekNumber: number,
    totalWeeks: number,
    isDeload: boolean
): MethodologyContext | undefined {
    const ctx: MethodologyContext = {}
    const strengthMethod = profile.strength_methodology ?? 'ai_decides'
    const hypertrophyMethod = profile.hypertrophy_methodology ?? 'ai_decides'
    const enduranceMethod = profile.endurance_methodology ?? 'ai_decides'
    const experience = (profile.lifting_experience ?? 'intermediate') as 'beginner' | 'intermediate' | 'advanced'

    // ─── 5/3/1 Protocol ──────────────────────────────────────────────────
    if (strengthMethod === '531') {
        const weekInCycle = ((weekNumber - 1) % 4) + 1
        const liftMap: Array<[string, string[]]> = [
            ['Squat', ['squat', 'back_squat']],
            ['Bench Press', ['bench', 'bench_press']],
            ['Deadlift', ['deadlift']],
            ['OHP', ['ohp', 'overhead_press', 'overhead']],
        ]
        const lines: string[] = []
        for (const [displayName, keywords] of liftMap) {
            const bm = benchmarks.find(b =>
                keywords.some(kw => b.benchmark_name.toLowerCase().includes(kw))
            )
            if (bm) {
                const tm = estimateTrainingMax(bm.value, 1)
                const wave = calculate531Wave(tm, weekInCycle)
                const setsStr = wave.sets.map(s =>
                    `${s.reps}${s.isAmrap ? '+' : ''} @ ${s.weightKg}kg (${Math.round(s.percentTM * 100)}%TM)`
                ).join(', ')
                lines.push(`  ${displayName} (TM: ${tm}kg): ${wave.weekLabel} — ${setsStr}`)
            }
        }
        if (lines.length > 0) {
            ctx.liftingProtocol = `5/3/1 Cycle Week ${weekInCycle}${isDeload && weekInCycle === 4 ? ' (DELOAD)' : ''}:\n${lines.join('\n')}`
        }
    }

    // ─── RP Volume Landmarks ─────────────────────────────────────────────
    if (hypertrophyMethod === 'rp_volume' || hypertrophyMethod === 'ai_decides') {
        const majorGroups = ['Quads', 'Hamstrings', 'Chest', 'Back', 'Shoulders', 'Glutes', 'Biceps', 'Triceps']
        const volumeLines = majorGroups.map(mg => {
            const landmarks = calculateRPVolumeLandmarks(mg, experience)
            const weekTarget = calculateWeeklyVolumeTarget(landmarks, weekNumber, totalWeeks, isDeload)
            return `  ${mg}: ${weekTarget} sets (MEV=${landmarks.mev}, MAV=${landmarks.mav}, MRV=${landmarks.mrv})`
        })
        ctx.volumeTargets = volumeLines.join('\n')
    }

    // ─── Polarized Endurance ─────────────────────────────────────────────
    if (enduranceMethod === 'polarized_80_20' || (enduranceMethod === 'ai_decides' && experience !== 'beginner')) {
        const enduranceSessions = Math.ceil((profile.available_days ?? 4) * 0.3)
        const weeklyEnduranceMinutes = (profile.session_duration_minutes ?? 60) * enduranceSessions
        const split = calculatePolarizedZoneDistribution(weeklyEnduranceMinutes)
        ctx.endurancePlan = `Polarized 80/20: ~${split.easyMinutes} min easy (Zone 2), ~${split.hardMinutes} min hard (Tempo/Threshold/VO2max) across ${enduranceSessions} sessions`
    }

    // ─── Daniels' Paces ──────────────────────────────────────────────────
    if (enduranceMethod === 'daniels_formula') {
        const runBenchmark = benchmarks.find(b =>
            ['5k', '10k', 'mile', '1_mile'].some(kw => b.benchmark_name.toLowerCase().includes(kw))
        )
        if (runBenchmark) {
            const distanceKm = runBenchmark.benchmark_name.toLowerCase().includes('10k') ? 10
                : runBenchmark.benchmark_name.toLowerCase().includes('mile') ? 1.609
                : 5 // default to 5k
            // Benchmark value is assumed to be in the unit stored (check unit field)
            const timeSeconds = runBenchmark.unit === 'seconds' ? runBenchmark.value
                : runBenchmark.unit === 'minutes' ? runBenchmark.value * 60
                : runBenchmark.value * 60 // default assume minutes
            const paces = calculateDanielsVDOT(distanceKm, timeSeconds)
            ctx.trainingPaces = `VDOT: ${paces.vdot}. Easy: ${formatPace(paces.easyPaceSecPerKm)}/km, Tempo: ${formatPace(paces.tempoPaceSecPerKm)}/km, Threshold: ${formatPace(paces.thresholdPaceSecPerKm)}/km, Intervals: ${formatPace(paces.intervalPaceSecPerKm)}/km`
        }
    }

    // Only return if we computed something
    if (ctx.liftingProtocol || ctx.volumeTargets || ctx.endurancePlan || ctx.trainingPaces) {
        return ctx
    }
    return undefined
}
