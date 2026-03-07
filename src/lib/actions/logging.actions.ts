'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types/training.types'
import type { ExerciseSet, CardioLog, RuckingLog, ConditioningLog } from '@/lib/types/database.types'
import { revalidatePath } from 'next/cache'
import { calculateRPVolumeLandmarks, calculateWeeklyVolumeTarget } from '@/lib/training/methodology-helpers'

// ─── Lifting Set Logging ──────────────────────────────────────────────────────

export interface LogExerciseSetInput {
    workoutId: string
    exerciseName: string
    muscleGroup?: string
    setNumber: number
    targetReps?: number
    targetWeightKg?: number
    targetRir?: number
    actualReps: number
    actualWeightKg: number
    rirActual?: number
    rpeActual?: number
    notes?: string
    isPR?: boolean
}

/**
 * Log an individual exercise set during a lifting or MetCon workout.
 * Flags personal records and calculates tonnage on the client.
 */
export async function logExerciseSet(
    input: LogExerciseSetInput
): Promise<ActionResult<ExerciseSet>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Determine if this is a PR (heaviest single set for this exercise)
    let isPR = input.isPR ?? false
    if (!isPR) {
        const { data: prCheck } = await supabase
            .from('exercise_sets')
            .select('actual_weight_kg, actual_reps')
            .eq('user_id', user.id)
            .eq('exercise_name', input.exerciseName)
            .not('actual_weight_kg', 'is', null)
            .order('actual_weight_kg', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (prCheck) {
            isPR = input.actualWeightKg > (prCheck.actual_weight_kg ?? 0)
        } else {
            isPR = true  // First logged set is always a PR
        }
    }

    const { data: exerciseSet, error } = await supabase
        .from('exercise_sets')
        .insert({
            workout_id: input.workoutId,
            user_id: user.id,
            exercise_name: input.exerciseName,
            muscle_group: input.muscleGroup ?? null,
            set_number: input.setNumber,
            target_reps: input.targetReps ?? null,
            target_weight_kg: input.targetWeightKg ?? null,
            target_rir: input.targetRir ?? null,
            actual_reps: input.actualReps,
            actual_weight_kg: input.actualWeightKg,
            rir_actual: input.rirActual ?? null,
            rpe_actual: input.rpeActual ?? null,
            notes: input.notes ?? null,
            is_pr: isPR,
            logged_at: new Date().toISOString(),
        })
        .select()
        .single()

    if (error) {
        console.error('[logExerciseSet]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/workout')
    return { success: true, data: exerciseSet }
}

// ─── Update Pre-Scaffolded Set ───────────────────────────────────────────────

export interface UpdateExerciseSetInput {
    actualReps: number
    actualWeightKg: number
    rirActual?: number
    rpeActual?: number
    notes?: string
}

/**
 * Update a pre-scaffolded exercise_set with actual performance data.
 * Used during the active workout flow — sets are created with target values
 * when the mesocycle is built, and the user fills in actuals during execution.
 * Automatically detects personal records (heaviest weight for the exercise).
 */
export async function updateExerciseSet(
    setId: string,
    input: UpdateExerciseSetInput
): Promise<ActionResult<ExerciseSet>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Fetch the existing set to get exercise_name for PR detection
    const { data: existingSet, error: fetchError } = await supabase
        .from('exercise_sets')
        .select('exercise_name')
        .eq('id', setId)
        .eq('user_id', user.id)
        .single()

    if (fetchError || !existingSet) {
        return { success: false, error: fetchError?.message ?? 'Set not found' }
    }

    // PR detection: check if this is the heaviest weight logged for this exercise
    const { data: prCheck } = await supabase
        .from('exercise_sets')
        .select('actual_weight_kg')
        .eq('user_id', user.id)
        .eq('exercise_name', existingSet.exercise_name)
        .not('actual_weight_kg', 'is', null)
        .order('actual_weight_kg', { ascending: false })
        .limit(1)
        .maybeSingle()

    const isPR = prCheck
        ? input.actualWeightKg > (prCheck.actual_weight_kg ?? 0)
        : true // First logged set is always a PR

    const { data: updatedSet, error } = await supabase
        .from('exercise_sets')
        .update({
            actual_reps: input.actualReps,
            actual_weight_kg: input.actualWeightKg,
            rir_actual: input.rirActual ?? null,
            rpe_actual: input.rpeActual ?? null,
            notes: input.notes ?? null,
            is_pr: isPR,
            logged_at: new Date().toISOString(),
        })
        .eq('id', setId)
        .eq('user_id', user.id)
        .select()
        .single()

    if (error) {
        console.error('[updateExerciseSet]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/workout')
    return { success: true, data: updatedSet }
}

// ─── Update Exercise Set Targets ─────────────────────────────────────────────

/**
 * Update the target values on a pre-scaffolded exercise set.
 * Used when the athlete adjusts AI estimates before starting a workout.
 */
export async function updateExerciseSetTargets(
    setId: string,
    targets: { targetWeightKg?: number; targetReps?: number; targetRir?: number }
): Promise<ActionResult<ExerciseSet>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const updatePayload: Record<string, unknown> = {}
    if (targets.targetWeightKg !== undefined) updatePayload.target_weight_kg = targets.targetWeightKg
    if (targets.targetReps !== undefined) updatePayload.target_reps = targets.targetReps
    if (targets.targetRir !== undefined) updatePayload.target_rir = targets.targetRir

    const { data: updatedSet, error } = await supabase
        .from('exercise_sets')
        .update(updatePayload)
        .eq('id', setId)
        .eq('user_id', user.id)
        .select()
        .single()

    if (error) {
        console.error('[updateExerciseSetTargets]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/workout')
    return { success: true, data: updatedSet }
}

// ─── Cardio Session Logging ───────────────────────────────────────────────────

export interface LogCardioSessionInput {
    workoutId: string
    cardioType?: 'ZONE_2' | 'VO2_MAX' | 'TEMPO' | 'EASY'
    durationMinutes: number
    distanceKm?: number
    avgPaceSecPerKm?: number
    avgHeartRateBpm?: number
    maxHeartRateBpm?: number
    caloriesBurned?: number
    perceivedEffortRpe?: number
    deviceSource?: string
    rawDataJson?: Record<string, unknown>
}

/**
 * Log a completed cardio session (Zone 2, VO2 Max interval, tempo run, easy run).
 */
export async function logCardioSession(
    input: LogCardioSessionInput
): Promise<ActionResult<CardioLog>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: cardioLog, error } = await supabase
        .from('cardio_logs')
        .insert({
            workout_id: input.workoutId,
            user_id: user.id,
            cardio_type: input.cardioType ?? 'ZONE_2',
            duration_minutes: input.durationMinutes,
            distance_km: input.distanceKm ?? null,
            avg_pace_sec_per_km: input.avgPaceSecPerKm ?? null,
            avg_heart_rate_bpm: input.avgHeartRateBpm ?? null,
            max_heart_rate_bpm: input.maxHeartRateBpm ?? null,
            calories_burned: input.caloriesBurned ?? null,
            perceived_effort_rpe: input.perceivedEffortRpe ?? null,
            device_source: input.deviceSource ?? null,
            raw_data_json: input.rawDataJson ?? null,
            logged_at: new Date().toISOString(),
        })
        .select()
        .single()

    if (error) {
        console.error('[logCardioSession]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/workout')
    return { success: true, data: cardioLog }
}

// ─── Rucking Session Logging ──────────────────────────────────────────────────

export interface LogRuckingSessionInput {
    workoutId: string
    distanceKm: number
    packWeightLbs: number
    durationMinutes: number
    elevationGainM?: number
    avgPaceSecPerKm?: number
    terrain?: string
    avgHeartRateBpm?: number
    perceivedEffortRpe?: number
    notes?: string
}

/**
 * Log a completed rucking session.
 * The AI coach will check total_load_index (computed: distance_km * pack_weight_lbs)
 * and may set fatigue_flag on high-load rucks to suppress next-day lifting volume.
 */
export async function logRuckingSession(
    input: LogRuckingSessionInput
): Promise<ActionResult<RuckingLog>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Heuristic: flag high-load rucks for the AI coach attention
    // A load index > 300 (e.g., 6km × 60lbs) is a significant systemic fatigue event
    const loadIndex = input.distanceKm * input.packWeightLbs
    const fatigueFlag = loadIndex > 300

    const { data: ruckingLog, error } = await supabase
        .from('rucking_logs')
        .insert({
            workout_id: input.workoutId,
            user_id: user.id,
            distance_km: input.distanceKm,
            pack_weight_lbs: input.packWeightLbs,
            duration_minutes: input.durationMinutes,
            elevation_gain_m: input.elevationGainM ?? null,
            avg_pace_sec_per_km: input.avgPaceSecPerKm ?? null,
            terrain: input.terrain ?? null,
            avg_heart_rate_bpm: input.avgHeartRateBpm ?? null,
            perceived_effort_rpe: input.perceivedEffortRpe ?? null,
            notes: input.notes ?? null,
            fatigue_flag: fatigueFlag,
            logged_at: new Date().toISOString(),
        })
        .select()
        .single()

    if (error) {
        console.error('[logRuckingSession]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/workout')
    return { success: true, data: ruckingLog }
}

// ─── Conditioning Session Logging ─────────────────────────────────────────────

export interface LogConditioningSessionInput {
    workoutId: string
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

/**
 * Log a completed conditioning/metcon session.
 * Captures format-specific results (time, rounds, completion), Rx/Scaled status,
 * RPE, modifications, and athlete notes for the Recovery Coach weekly review.
 */
export async function logConditioningSession(
    input: LogConditioningSessionInput
): Promise<ActionResult<ConditioningLog>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: conditioningLog, error } = await supabase
        .from('conditioning_logs')
        .insert({
            workout_id: input.workoutId,
            user_id: user.id,
            workout_format: input.workoutFormat,
            is_rx: input.isRx,
            result_time_seconds: input.resultTimeSeconds ?? null,
            result_rounds: input.resultRounds ?? null,
            result_partial_reps: input.resultPartialReps ?? null,
            result_completed: input.resultCompleted ?? null,
            perceived_effort_rpe: input.perceivedEffortRpe ?? null,
            modifications: input.modifications ?? null,
            athlete_notes: input.athleteNotes ?? null,
            logged_at: new Date().toISOString(),
        })
        .select()
        .single()

    if (error) {
        console.error('[logConditioningSession]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/workout')
    return { success: true, data: conditioningLog }
}

// ─── Weekly Volume Summary (for AI Coach input) ───────────────────────────────

/**
 * Aggregate all logged data for a microcycle into the structured payload
 * required by the weekly Anthropic AI Coach review.
 */
export async function buildWeeklyPayload(microcycleId: string) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get all workouts in the microcycle
    const { data: workouts, error: workoutError } = await supabase
        .from('workouts')
        .select('id, modality')
        .eq('microcycle_id', microcycleId)
        .eq('user_id', user.id)

    if (workoutError || !workouts) {
        return { success: false, error: workoutError?.message ?? 'No workouts found' }
    }

    const workoutIds = workouts.map((w) => w.id)

    // Lifting summary
    const { data: sets } = await supabase
        .from('exercise_sets')
        .select('exercise_name, muscle_group, actual_reps, actual_weight_kg, rir_actual, rpe_actual')
        .in('workout_id', workoutIds)
        .not('actual_reps', 'is', null)

    // Cardio summary
    const { data: cardioLogs } = await supabase
        .from('cardio_logs')
        .select('duration_minutes, avg_heart_rate_bpm')
        .in('workout_id', workoutIds)

    // Rucking summary
    const { data: ruckingLogs } = await supabase
        .from('rucking_logs')
        .select('distance_km, total_load_index, fatigue_flag')
        .in('workout_id', workoutIds)

    // Conditioning summary
    const { data: conditioningLogs } = await supabase
        .from('conditioning_logs')
        .select('workout_format, is_rx, perceived_effort_rpe, result_time_seconds, result_rounds, result_completed, modifications')
        .in('workout_id', workoutIds)

    // Aggregate muscle group volumes
    const muscleGroupMap = new Map<string, {
        sets: number; tonnage: number; rirValues: number[]
    }>()

    for (const set of sets ?? []) {
        const mg = set.muscle_group ?? 'Unknown'
        const entry = muscleGroupMap.get(mg) ?? { sets: 0, tonnage: 0, rirValues: [] }
        entry.sets += 1
        entry.tonnage += (set.actual_reps ?? 0) * (set.actual_weight_kg ?? 0)
        if (set.rir_actual !== null) entry.rirValues.push(set.rir_actual)
        muscleGroupMap.set(mg, entry)
    }

    // Load athlete experience level and microcycle context for RP volume targets
    const { data: profileForVolume } = await supabase
        .from('profiles')
        .select('lifting_experience')
        .eq('id', user.id)
        .single()

    const { data: microcycleContext } = await supabase
        .from('microcycles')
        .select('week_number, is_deload, mesocycles!inner(week_count)')
        .eq('id', microcycleId)
        .eq('user_id', user.id)
        .single()

    const experience = (profileForVolume?.lifting_experience ?? 'intermediate') as 'beginner' | 'intermediate' | 'advanced'
    const weekNum = microcycleContext?.week_number ?? 1
    const totalWeeksForVolume = (microcycleContext?.mesocycles as unknown as { week_count: number } | null)?.week_count ?? 6
    const isDeloadForVolume = microcycleContext?.is_deload ?? false

    const muscleGroupVolumes = Array.from(muscleGroupMap.entries()).map(([mg, v]) => {
        const landmarks = calculateRPVolumeLandmarks(mg, experience)
        const target = calculateWeeklyVolumeTarget(landmarks, weekNum, totalWeeksForVolume, isDeloadForVolume)
        return {
            muscleGroup: mg,
            setsThisWeek: v.sets,
            targetSets: target,
            totalTonnageKg: v.tonnage,
            avgRIR: v.rirValues.length > 0
                ? v.rirValues.reduce((a, b) => a + b, 0) / v.rirValues.length
                : null,
        }
    })

    return {
        success: true,
        data: {
            muscleGroupVolumes,
            totalCardioMinutes: cardioLogs?.reduce((sum, c) => sum + c.duration_minutes, 0) ?? 0,
            totalRuckDistanceKm: ruckingLogs?.reduce((sum, r) => sum + r.distance_km, 0) ?? 0,
            totalRuckLoadIndex: ruckingLogs?.reduce((sum, r) => sum + (r.total_load_index ?? 0), 0) ?? 0,
            hadHighFatigueRuck: ruckingLogs?.some((r) => r.fatigue_flag) ?? false,
            conditioningSessionCount: conditioningLogs?.length ?? 0,
            conditioningAvgRpe: conditioningLogs && conditioningLogs.length > 0
                ? conditioningLogs
                    .filter(c => c.perceived_effort_rpe != null)
                    .reduce((sum, c) => sum + (c.perceived_effort_rpe ?? 0), 0) /
                    Math.max(conditioningLogs.filter(c => c.perceived_effort_rpe != null).length, 1)
                : null,
            conditioningRxRate: conditioningLogs && conditioningLogs.length > 0
                ? conditioningLogs.filter(c => c.is_rx).length / conditioningLogs.length
                : null,
            hadHighRpeConditioning: conditioningLogs?.some(c => (c.perceived_effort_rpe ?? 0) >= 9) ?? false,
        },
    }
}
