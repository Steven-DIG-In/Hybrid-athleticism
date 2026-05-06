'use server'

/**
 * Microcycle (weekly session pool) generation actions
 * (Task 12 — engine refactor).
 *
 * Relocated from `src/lib/actions/programming.actions.ts`. These three
 * server actions own week-level Programming Engine output:
 *   - generateSessionPool(microcycleId)
 *   - generateNextWeekPool()
 *   - regenerateCurrentWeekPool(targetMicrocycleId?)
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, WorkoutWithSets } from '@/lib/types/training.types'
import type { Workout } from '@/lib/types/database.types'
import { generateStructuredResponse } from '@/lib/ai/client'
import { createValidatedSessionPoolSchema } from '@/lib/ai/schemas/programming'
import type { WeeklySessionPool } from '@/lib/ai/schemas/programming'
import type { ProgrammingContext, PreviousWeekSession } from '@/lib/ai/prompts/programming'
import {
    buildProgrammingSystemPrompt,
    buildProgrammingUserPrompt,
} from '@/lib/ai/prompts/programming'
import { computeWeeklyLoadSummary } from '@/lib/scheduling/load-scoring'
import { buildMethodologyContext } from '@/lib/engine/_shared/methodology-context'
import { deduplicateBenchmarks } from '@/lib/engine/mesocycle/context'
import { extractWeekBrief } from '@/lib/engine/mesocycle/strategy'
import { MesocycleStrategySchema, type MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'
import {
    insertLiftingSets,
    insertEnduranceTarget,
    buildCoachNotes,
    mapModality,
} from '@/lib/engine/microcycle/persistence'

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
    const methodologyContext = await buildMethodologyContext(
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

    // ─── Step 5b: Read head-coach strategy from mesocycle.ai_context_json ────
    // (set by D's wizard). Backward-compatible: if no strategy (Block 1),
    // weekBriefs is [] and the prompt falls back to today's behavior.
    let strategy: MesocycleStrategyValidated | null = null
    const aiCtx = (mesocycleData.ai_context_json ?? {}) as Record<string, unknown>
    const rawStrategy = aiCtx.strategy
    if (rawStrategy) {
        const parsed = MesocycleStrategySchema.safeParse(rawStrategy)
        if (parsed.success) strategy = parsed.data
    }

    // If strategy is present, derive per-coach weekBriefs for this week from
    // its domainAllocations (coachingTeam isn't loaded in this function).
    const weekBriefs = strategy
        ? strategy.domainAllocations
            .map(d => ({
                coach: d.coach,
                brief: extractWeekBrief(strategy!, d.coach, microcycle.week_number),
            }))
            .filter(x => x.brief !== null)
        : []

    // ─── Step 6: Call the AI Programming Engine ──────────────────────────────
    const systemPrompt = buildProgrammingSystemPrompt()
    const baseUserPrompt = buildProgrammingUserPrompt(programmingContext)

    const weekBriefSection = weekBriefs.length > 0
        ? `\n\n── HEAD COACH'S BRIEF FOR THIS WEEK ──\n${weekBriefs
            .map(({ coach, brief }) => {
                if (!brief) return ''
                return `### ${coach}
Sessions this week: ${brief.sessionsToGenerate}
Load budget per session: ${brief.loadBudget}/10
Week emphasis: ${brief.weekEmphasis}
Volume: ${brief.volumePercent}% of MRV
${brief.isDeload ? '(deload week)' : ''}
Methodology directive: ${brief.methodologyDirective}
Constraints: ${brief.constraints.join('; ') || '(none)'}`
            })
            .filter(Boolean)
            .join('\n\n')}\n\nGenerate sessions that respect each coach's brief.`
        : ''
    const userPrompt = baseUserPrompt + weekBriefSection

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

    // Find the current microcycle (today's date falls within its range).
    // Restricted to the user's active mesocycle so historical mesocycles
    // can't accidentally be matched. Behavior-preserving for single user
    // because Steven only has one active mesocycle at a time.
    let { data: microcycle } = await supabase
        .from('microcycles')
        .select('id, mesocycles!inner(is_active)')
        .eq('user_id', user.id)
        .eq('mesocycles.is_active', true)
        .lte('start_date', today)
        .gte('end_date', today)
        .maybeSingle()

    // If today is before the first week starts (e.g. onboarded mid-week),
    // fall back to the nearest upcoming microcycle in the active mesocycle.
    if (!microcycle) {
        const { data: upcoming } = await supabase
            .from('microcycles')
            .select('id, mesocycles!inner(is_active)')
            .eq('user_id', user.id)
            .eq('mesocycles.is_active', true)
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

