'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateStructuredResponse } from '@/lib/ai/client'
import { SingleSessionResponseSchema } from '@/lib/ai/schemas/programming'
import type { SingleSessionResponse } from '@/lib/ai/schemas/programming'
import {
    buildSingleSessionSystemPrompt,
    buildSingleSessionUserPrompt,
} from '@/lib/ai/prompts/programming'
import type {
    PreviousWeekSession,
    SingleSessionContext,
    ExistingPoolSession,
} from '@/lib/ai/prompts/programming'
import { findOptimalDayForSession } from '@/lib/scheduling/auto-assign'
import { deduplicateBenchmarks } from '@/lib/engine/mesocycle/context'
import {
    insertLiftingSets,
    insertEnduranceTarget,
    buildCoachNotes,
    mapModality,
} from '@/lib/engine/microcycle/persistence'
import type { ActionResult } from '@/lib/types/training.types'
import type { Workout } from '@/lib/types/database.types'

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
            .select('id, start_date, end_date, mesocycles!inner(is_active)')
            .eq('user_id', user.id)
            .eq('mesocycles.is_active', true)
            .lte('start_date', today)
            .gte('end_date', today)
            .maybeSingle()

        if (exactWeek) {
            microcycle = exactWeek
        } else {
            // Fall back to nearest upcoming microcycle (onboarded mid-week)
            const { data: upcoming } = await supabase
                .from('microcycles')
                .select('id, start_date, end_date, mesocycles!inner(is_active)')
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
