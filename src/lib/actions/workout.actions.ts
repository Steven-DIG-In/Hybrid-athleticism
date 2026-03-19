'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, TodayViewData, DashboardData, WorkoutWithSets } from '@/lib/types/training.types'
import type { Workout } from '@/lib/types/database.types'
import { generatePerformanceDeltas } from '@/lib/actions/performance-deltas.actions'

/**
 * Get today's scheduled workout with all its sets/exercises.
 * Returns null if no workout is scheduled for today.
 */
export async function getTodaysWorkout(): Promise<ActionResult<TodayViewData>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD

    // Fetch today's workout with its sets
    const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .select(`
      *,
      exercise_sets (
        *
      )
    `)
        .eq('user_id', user.id)
        .eq('scheduled_date', today)
        .order('set_number', { referencedTable: 'exercise_sets', ascending: true })
        .maybeSingle()

    if (workoutError) {
        return { success: false, error: workoutError.message }
    }

    // Fetch the current microcycle (week) for context display
    const { data: currentWeek } = await supabase
        .from('microcycles')
        .select('*')
        .eq('user_id', user.id)
        .lte('start_date', today)
        .gte('end_date', today)
        .maybeSingle()

    // Fetch the active mesocycle
    const { data: currentMesocycle } = await supabase
        .from('mesocycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

    // Check for any unreviewed AI coach interventions
    const { count: interventionCount } = await supabase
        .from('ai_coach_interventions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('presented_to_user', false)

    return {
        success: true,
        data: {
            workout: workout as WorkoutWithSets | null,
            currentWeek: currentWeek ?? null,
            currentMesocycle: currentMesocycle ?? null,
            hasUnreviewedIntervention: (interventionCount ?? 0) > 0,
        },
    }
}

/**
 * Get a specific workout with all its sets, ordered by set_number.
 */
export async function getWorkoutById(workoutId: string): Promise<ActionResult<WorkoutWithSets>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: workout, error } = await supabase
        .from('workouts')
        .select(`
      *,
      exercise_sets (
        *
      )
    `)
        .eq('id', workoutId)
        .eq('user_id', user.id)
        .order('set_number', { referencedTable: 'exercise_sets', ascending: true })
        .single()

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, data: workout as WorkoutWithSets }
}

/**
 * Mark a workout as complete and record the actual duration.
 */
export interface ConditioningResultInput {
    workoutFormat: string
    isRx: boolean
    resultTimeSeconds?: number
    resultRounds?: number
    resultPartialReps?: number
    resultCompleted?: boolean
    perceivedEffortRpe?: number
    modifications?: string
    athleteNotes?: string
}

export async function completeWorkout(
    workoutId: string,
    actualDurationMinutes: number,
    conditioningResult?: ConditioningResultInput
): Promise<ActionResult<Workout>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: workout, error } = await supabase
        .from('workouts')
        .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
            actual_duration_minutes: actualDurationMinutes,
        })
        .eq('id', workoutId)
        .eq('user_id', user.id)
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message }
    }

    // Persist conditioning result if provided
    if (conditioningResult) {
        const { error: condError } = await supabase
            .from('conditioning_logs')
            .insert({
                workout_id: workoutId,
                user_id: user.id,
                workout_format: conditioningResult.workoutFormat,
                is_rx: conditioningResult.isRx,
                result_time_seconds: conditioningResult.resultTimeSeconds ?? null,
                result_rounds: conditioningResult.resultRounds ?? null,
                result_partial_reps: conditioningResult.resultPartialReps ?? null,
                result_completed: conditioningResult.resultCompleted ?? null,
                perceived_effort_rpe: conditioningResult.perceivedEffortRpe ?? null,
                modifications: conditioningResult.modifications ?? null,
                athlete_notes: conditioningResult.athleteNotes ?? null,
                logged_at: new Date().toISOString(),
            })

        if (condError) {
            console.error('[completeWorkout] conditioning log error:', condError)
            // Don't fail the whole completion — workout is already marked done
        }
    }

    // Generate performance deltas non-blocking — only applies to sessions
    // that were created from inventory (i.e., have a session_inventory_id).
    // Failure here must never surface to the athlete completing a workout.
    if (workout.session_inventory_id) {
        generatePerformanceDeltas(workout.session_inventory_id, user.id).catch((err) => {
            console.error('[completeWorkout] performance delta generation failed:', err)
        })
    }

    revalidatePath('/dashboard')
    revalidatePath('/workout')
    return { success: true, data: workout }
}

/**
 * Swap an exercise within a workout (respects the user's equipment constraints on the UI side).
 * Updates all sets in the workout for the old exercise name.
 */
export async function swapExercise(
    workoutId: string,
    fromExerciseName: string,
    toExerciseName: string,
    muscleGroup?: string
): Promise<ActionResult<{ updatedCount: number }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const updatePayload: Record<string, unknown> = { exercise_name: toExerciseName }
    if (muscleGroup) updatePayload.muscle_group = muscleGroup

    const { data, error } = await supabase
        .from('exercise_sets')
        .update(updatePayload)
        .eq('workout_id', workoutId)
        .eq('user_id', user.id)
        .eq('exercise_name', fromExerciseName)
        .select('id')

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/workout')
    return { success: true, data: { updatedCount: data.length } }
}

/**
 * Get workout history for a specific exercise (for the "historical data" panel during logging).
 */
export async function getExerciseHistory(
    exerciseName: string,
    limit = 5
): Promise<ActionResult<Workout[]>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get the last N workouts that contained this exercise
    const { data, error } = await supabase
        .from('exercise_sets')
        .select(`
      actual_reps,
      actual_weight_kg,
      rir_actual,
      rpe_actual,
      is_pr,
      logged_at,
      workouts!inner (
        scheduled_date
      )
    `)
        .eq('user_id', user.id)
        .eq('exercise_name', exerciseName)
        .not('actual_reps', 'is', null)
        .order('logged_at', { ascending: false })
        .limit(limit * 5)  // Fetch extra to account for multiple sets per session

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, data: data as unknown as Workout[] }
}

// ─── Dashboard Session Pool Data ────────────────────────────────────────────

/**
 * Fetch the full weekly session pool for the dashboard.
 * Returns all workouts for the current microcycle (week) with their sets,
 * plus mesocycle context and completion status.
 */
export async function getDashboardData(weekNumber?: number): Promise<ActionResult<DashboardData>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const today = new Date().toISOString().split('T')[0]

    // Fetch profile for name, goal context, equipment, and preferences
    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, goal_archetype, equipment_list, endurance_modality_preferences, conditioning_style_preferences')
        .eq('id', user.id)
        .maybeSingle()

    // Fetch the active mesocycle
    const { data: currentMesocycle } = await supabase
        .from('mesocycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

    // Fetch the target microcycle (week)
    // If weekNumber is provided, show that specific week. Otherwise, find the nearest.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentWeek: any = null

    if (currentMesocycle) {
        if (weekNumber) {
            const { data: requestedWeek } = await supabase
                .from('microcycles')
                .select('*')
                .eq('mesocycle_id', currentMesocycle.id)
                .eq('user_id', user.id)
                .eq('week_number', weekNumber)
                .maybeSingle()

            currentWeek = requestedWeek
        }

        if (!currentWeek) {
            // Default: find the week containing today or the nearest upcoming one
            const { data: exactWeek } = await supabase
                .from('microcycles')
                .select('*')
                .eq('mesocycle_id', currentMesocycle.id)
                .eq('user_id', user.id)
                .lte('start_date', today)
                .gte('end_date', today)
                .maybeSingle()

            if (exactWeek) {
                currentWeek = exactWeek
            } else {
                const { data: nextWeek } = await supabase
                    .from('microcycles')
                    .select('*')
                    .eq('mesocycle_id', currentMesocycle.id)
                    .eq('user_id', user.id)
                    .gte('start_date', today)
                    .order('start_date', { ascending: true })
                    .limit(1)
                    .maybeSingle()

                if (nextWeek) {
                    currentWeek = nextWeek
                } else {
                    const { data: lastWeek } = await supabase
                        .from('microcycles')
                        .select('*')
                        .eq('mesocycle_id', currentMesocycle.id)
                        .eq('user_id', user.id)
                        .order('start_date', { ascending: false })
                        .limit(1)
                        .maybeSingle()

                    currentWeek = lastWeek
                }
            }
        }
    }

    // Fetch all workouts for this microcycle with their exercise sets
    let sessionPool: WorkoutWithSets[] = []
    if (currentWeek) {
        const { data: workouts } = await supabase
            .from('workouts')
            .select(`
                *,
                exercise_sets (*)
            `)
            .eq('microcycle_id', (currentWeek as { id: string }).id)
            .eq('user_id', user.id)
            .order('scheduled_date', { ascending: true })

        sessionPool = (workouts ?? []) as WorkoutWithSets[]
        console.log('[getDashboardData] Fetched session pool:', sessionPool.length, 'workouts')
    }

    // Fetch ALL workouts across the entire mesocycle for the calendar view
    let allWorkouts: WorkoutWithSets[] = []
    let mesocycleStartDate: string | null = null
    let mesocycleEndDate: string | null = null
    if (currentMesocycle) {
        // Get all microcycles for date range
        const { data: allMicrocycles } = await supabase
            .from('microcycles')
            .select('id, start_date, end_date')
            .eq('mesocycle_id', currentMesocycle.id)
            .eq('user_id', user.id)
            .order('week_number', { ascending: true })

        if (allMicrocycles && allMicrocycles.length > 0) {
            mesocycleStartDate = allMicrocycles[0].start_date
            mesocycleEndDate = allMicrocycles[allMicrocycles.length - 1].end_date

            const microcycleIds = allMicrocycles.map(m => m.id)
            const { data: allWk } = await supabase
                .from('workouts')
                .select(`
                    *,
                    exercise_sets (*)
                `)
                .in('microcycle_id', microcycleIds)
                .eq('user_id', user.id)
                .order('scheduled_date', { ascending: true })

            allWorkouts = (allWk ?? []) as WorkoutWithSets[]
        }
    }

    const completedCount = sessionPool.filter(w => w.is_completed).length
    const totalCount = sessionPool.length

    // Check for unreviewed AI interventions
    const { count: interventionCount } = await supabase
        .from('ai_coach_interventions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('presented_to_user', false)

    // Check if the previous week was a deload (for post-deload benchmark suggestion)
    let previousWeekIsDeload = false
    if (currentWeek && currentMesocycle) {
        const prevWeekNumber = (currentWeek as { week_number: number }).week_number - 1
        if (prevWeekNumber >= 1) {
            const { data: prevMicrocycle } = await supabase
                .from('microcycles')
                .select('is_deload')
                .eq('mesocycle_id', currentMesocycle.id)
                .eq('week_number', prevWeekNumber)
                .eq('user_id', user.id)
                .maybeSingle()

            previousWeekIsDeload = prevMicrocycle?.is_deload ?? false
        }
    }

    return {
        success: true,
        data: {
            currentMesocycle: currentMesocycle ?? null,
            currentWeek: currentWeek as DashboardData['currentWeek'],
            sessionPool,
            allWorkouts,
            completedCount,
            totalCount,
            totalWeeks: currentMesocycle?.week_count ?? 0,
            hasUnreviewedIntervention: (interventionCount ?? 0) > 0,
            weekHasWorkouts: totalCount > 0,
            hasUnallocatedSessions: sessionPool.some(w => !w.is_allocated),
            athleteName: profile?.display_name ?? null,
            goalArchetype: profile?.goal_archetype ?? null,
            equipmentList: profile?.equipment_list ?? [],
            endurancePreferences: profile?.endurance_modality_preferences ?? [],
            conditioningPreferences: profile?.conditioning_style_preferences ?? [],
            previousWeekIsDeload,
            mesocycleStartDate,
            mesocycleEndDate,
        },
    }
}

// ─── Update Workout Date ──────────────────────────────────────────────────────

/**
 * Update the scheduled date of a workout.
 * Used when athletes drag sessions to different days on the calendar.
 */
export async function updateWorkoutDate(
    workoutId: string,
    newDate: string
): Promise<ActionResult<Workout>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: workout, error } = await supabase
        .from('workouts')
        .update({ scheduled_date: newDate, is_allocated: true })
        .eq('id', workoutId)
        .eq('user_id', user.id)
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true, data: workout }
}
