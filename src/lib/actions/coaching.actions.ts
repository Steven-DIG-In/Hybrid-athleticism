'use server'

/**
 * Multi-Agent Coaching Actions
 *
 * Server actions for the coaching staff architecture.
 *
 * Pipeline A (mesocycle generation) was relocated to
 * `@/lib/engine/mesocycle/generate.ts` in Task 11 of the engine refactor,
 * along with its private context-builder helpers
 * (`@/lib/engine/mesocycle/context.ts`).
 *
 * What remains here:
 *   - Pipeline B: runWeeklyRecoveryCheck() — weekly check-in + adjustment
 *   - Local-only helpers used by Pipeline B: computeMuscleGroupVolumes,
 *     loadNextWeekSessions
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types/training.types'
import type { WeeklyAdjustmentResult } from '@/lib/engine/types'
import { runWeeklyAdjustment } from '@/lib/ai/orchestrator'
import { buildAthleteContext } from '@/lib/engine/mesocycle/context'

// ─── Pipeline B: Weekly Recovery Check ──────────────────────────────────────

/**
 * Run the weekly recovery check-in for a specific microcycle.
 *
 * Recovery Coach reviews last week's data → GREEN/YELLOW/RED.
 * If YELLOW/RED: Head Coach issues directive → Strength Coach modifies.
 */
export async function runWeeklyRecoveryCheck(
    microcycleId: string
): Promise<ActionResult<WeeklyAdjustmentResult>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Load microcycle
    const { data: microcycle, error: mcError } = await supabase
        .from('microcycles')
        .select('*, mesocycles!inner(id, goal, week_count)')
        .eq('id', microcycleId)
        .eq('user_id', user.id)
        .single()

    if (mcError || !microcycle) {
        return { success: false, error: 'Microcycle not found' }
    }

    const mesocycleData = microcycle.mesocycles as {
        id: string
        goal: string
        week_count: number
    }

    // Build athlete context with previous week data
    const ctxResult = await buildAthleteContext(
        user.id,
        mesocycleData.id,
        microcycle.week_number,
        { includePreviousWeek: true }
    )
    if (!ctxResult.success) {
        return { success: false, error: ctxResult.error }
    }
    const ctx = ctxResult.data

    // Build muscle group volumes from exercise sets
    const muscleGroupVolumes = await computeMuscleGroupVolumes(user.id, microcycleId)

    // Build next week's sessions for adjustment context
    const nextWeekSessions = await loadNextWeekSessions(
        user.id,
        mesocycleData.id,
        microcycle.week_number + 1
    )

    // Run Pipeline B
    const result = await runWeeklyAdjustment(ctx, muscleGroupVolumes, nextWeekSessions)

    if (!result.success) {
        return { success: false, error: result.error }
    }

    // Persist recovery assessment to microcycle
    await supabase
        .from('microcycles')
        .update({
            recovery_status: result.data.recovery.status,
            recovery_assessment: result.data.recovery as unknown as Record<string, unknown>,
            adjustment_directive: result.data.directive
                ? (result.data.directive as unknown as Record<string, unknown>)
                : null,
        })
        .eq('id', microcycleId)
        .eq('user_id', user.id)

    revalidatePath('/dashboard')
    return result
}

// ─── Helper: Compute Muscle Group Volumes ───────────────────────────────────

async function computeMuscleGroupVolumes(
    userId: string,
    microcycleId: string
): Promise<Array<{
    muscleGroup: string
    setsThisWeek: number
    targetSets: number
    totalTonnageKg: number
    avgRIR: number | null
}> | undefined> {
    const supabase = await createClient()

    const { data: workouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('microcycle_id', microcycleId)
        .eq('user_id', userId)

    if (!workouts || workouts.length === 0) return undefined

    const workoutIds = workouts.map(w => w.id)
    const { data: sets } = await supabase
        .from('exercise_sets')
        .select('muscle_group, target_reps, target_weight_kg, actual_reps, actual_weight_kg, rir_actual')
        .in('workout_id', workoutIds)

    if (!sets || sets.length === 0) return undefined

    const grouped = new Map<string, {
        sets: number
        tonnage: number
        rirSum: number
        rirCount: number
    }>()

    for (const s of sets) {
        const mg = s.muscle_group ?? 'unknown'
        const existing = grouped.get(mg) ?? { sets: 0, tonnage: 0, rirSum: 0, rirCount: 0 }
        existing.sets += 1
        const weight = s.actual_weight_kg ?? s.target_weight_kg ?? 0
        const reps = s.actual_reps ?? s.target_reps ?? 0
        existing.tonnage += weight * reps
        if (s.rir_actual !== null) {
            existing.rirSum += s.rir_actual
            existing.rirCount += 1
        }
        grouped.set(mg, existing)
    }

    return Array.from(grouped.entries()).map(([muscleGroup, data]) => ({
        muscleGroup,
        setsThisWeek: data.sets,
        targetSets: 0, // Would come from strategy — simplified for Phase 1
        totalTonnageKg: data.tonnage,
        avgRIR: data.rirCount > 0 ? data.rirSum / data.rirCount : null,
    }))
}

// ─── Helper: Load Next Week Sessions ────────────────────────────────────────

async function loadNextWeekSessions(
    userId: string,
    mesocycleId: string,
    nextWeekNumber: number
): Promise<Array<{ coach: string; sessionName: string; exercises?: string[] }> | undefined> {
    const supabase = await createClient()

    const { data: nextMicrocycle } = await supabase
        .from('microcycles')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', nextWeekNumber)
        .eq('user_id', userId)
        .maybeSingle()

    if (!nextMicrocycle) return undefined

    const { data: workouts } = await supabase
        .from('workouts')
        .select('id, name, modality')
        .eq('microcycle_id', nextMicrocycle.id)
        .eq('user_id', userId)

    if (!workouts || workouts.length === 0) return undefined

    const result: Array<{ coach: string; sessionName: string; exercises?: string[] }> = []

    for (const w of workouts) {
        // Map modality to coach type
        const coach = w.modality === 'lifting' ? 'strength'
            : w.modality === 'cardio' ? 'endurance'
            : w.modality === 'conditioning' ? 'conditioning'
            : w.modality === 'mobility' ? 'mobility'
            : 'strength'

        // Load exercise names
        const { data: sets } = await supabase
            .from('exercise_sets')
            .select('exercise_name')
            .eq('workout_id', w.id)

        const uniqueExercises = sets
            ? [...new Set(sets.map(s => s.exercise_name))]
            : undefined

        result.push({
            coach,
            sessionName: w.name,
            exercises: uniqueExercises,
        })
    }

    return result
}
