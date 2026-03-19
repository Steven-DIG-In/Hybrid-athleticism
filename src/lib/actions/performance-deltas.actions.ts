'use server'

import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

type DeltaClassification = 'over_performing' | 'on_track' | 'under_performing'

/**
 * Classify a single numeric delta using the ±5% threshold rule.
 * Returns null when there is no prescribed value to compare against.
 */
function classifyDelta(
    prescribed: number | null,
    actual: number | null
): DeltaClassification | null {
    if (prescribed == null || prescribed === 0 || actual == null) return null

    const ratio = actual / prescribed
    if (ratio > 1.05) return 'over_performing'
    if (ratio < 0.95) return 'under_performing'
    return 'on_track'
}

/**
 * Combine two classifications using "worst-case wins" logic.
 * Priority: under_performing > over_performing > on_track > null
 */
function mergeClassifications(
    a: DeltaClassification | null,
    b: DeltaClassification | null
): DeltaClassification | null {
    if (a === 'under_performing' || b === 'under_performing') return 'under_performing'
    if (a === 'over_performing' || b === 'over_performing') return 'over_performing'
    if (a === 'on_track' || b === 'on_track') return 'on_track'
    return null
}

// ─── Main Action ──────────────────────────────────────────────────────────────

/**
 * Compute and persist performance deltas for a completed session.
 *
 * Flow:
 * 1. Resolve the workout → session_inventory link to confirm ownership
 * 2. Load all exercise_sets for the workout that have actual values logged
 * 3. Group by exercise_name and aggregate prescribed/actual averages per set
 * 4. Classify each exercise as over_performing | on_track | under_performing
 * 5. Delete any pre-existing deltas for this inventory session (idempotent)
 * 6. Insert fresh performance_deltas rows
 *
 * This function is designed to be called non-blocking — callers should
 * fire-and-forget after marking the workout complete.
 */
export async function generatePerformanceDeltas(
    sessionInventoryId: string,
    userId: string
): Promise<{ success: boolean; error?: string; deltasCreated?: number }> {
    const supabase = await createClient()

    // ── 1. Verify ownership and fetch the session_inventory record ────────────
    const { data: inventorySession, error: inventoryError } = await supabase
        .from('session_inventory')
        .select('id')
        .eq('id', sessionInventoryId)
        .eq('user_id', userId)
        .single()

    if (inventoryError || !inventorySession) {
        const msg = inventoryError?.message ?? 'session_inventory record not found'
        console.error('[generatePerformanceDeltas] inventory lookup failed:', msg)
        return { success: false, error: msg }
    }

    // ── 2. Find the linked workout ────────────────────────────────────────────
    const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .select('id')
        .eq('session_inventory_id', sessionInventoryId)
        .eq('user_id', userId)
        .eq('is_completed', true)
        .maybeSingle()

    if (workoutError) {
        console.error('[generatePerformanceDeltas] workout lookup failed:', workoutError.message)
        return { success: false, error: workoutError.message }
    }

    if (!workout) {
        // No completed workout linked to this inventory session yet — nothing to do
        return { success: true, deltasCreated: 0 }
    }

    // ── 3. Load exercise_sets with both target and actual values ──────────────
    const { data: sets, error: setsError } = await supabase
        .from('exercise_sets')
        .select(
            'exercise_name, target_weight_kg, actual_weight_kg, target_reps, actual_reps, rpe_actual'
        )
        .eq('workout_id', workout.id)
        .eq('user_id', userId)
        .not('actual_reps', 'is', null)   // Only sets the athlete actually logged

    if (setsError) {
        console.error('[generatePerformanceDeltas] exercise_sets fetch failed:', setsError.message)
        return { success: false, error: setsError.message }
    }

    if (!sets || sets.length === 0) {
        return { success: true, deltasCreated: 0 }
    }

    // ── 4. Aggregate per exercise ─────────────────────────────────────────────
    // For each exercise we take the average of prescribed/actual across all sets.
    // This smooths out individual set variance and gives a session-level picture.

    type ExerciseAccumulator = {
        prescribedWeightSum: number
        prescribedWeightCount: number
        actualWeightSum: number
        actualWeightCount: number
        prescribedRepsSum: number
        prescribedRepsCount: number
        actualRepsSum: number
        actualRepsCount: number
        actualRpeSum: number
        actualRpeCount: number
    }

    const exerciseMap = new Map<string, ExerciseAccumulator>()

    for (const set of sets) {
        const name = set.exercise_name
        const acc = exerciseMap.get(name) ?? {
            prescribedWeightSum: 0,
            prescribedWeightCount: 0,
            actualWeightSum: 0,
            actualWeightCount: 0,
            prescribedRepsSum: 0,
            prescribedRepsCount: 0,
            actualRepsSum: 0,
            actualRepsCount: 0,
            actualRpeSum: 0,
            actualRpeCount: 0,
        }

        if (set.target_weight_kg != null) {
            acc.prescribedWeightSum += Number(set.target_weight_kg)
            acc.prescribedWeightCount++
        }
        if (set.actual_weight_kg != null) {
            acc.actualWeightSum += Number(set.actual_weight_kg)
            acc.actualWeightCount++
        }
        if (set.target_reps != null) {
            acc.prescribedRepsSum += Number(set.target_reps)
            acc.prescribedRepsCount++
        }
        if (set.actual_reps != null) {
            acc.actualRepsSum += Number(set.actual_reps)
            acc.actualRepsCount++
        }
        if (set.rpe_actual != null) {
            acc.actualRpeSum += Number(set.rpe_actual)
            acc.actualRpeCount++
        }

        exerciseMap.set(name, acc)
    }

    // ── 5. Build delta rows ───────────────────────────────────────────────────

    type DeltaInsert = {
        user_id: string
        session_inventory_id: string
        exercise_name: string
        prescribed_weight: number | null
        actual_weight: number | null
        prescribed_reps: number | null
        actual_reps: number | null
        prescribed_rpe: number | null
        actual_rpe: number | null
        delta_classification: DeltaClassification
    }

    const deltaRows: DeltaInsert[] = []

    for (const [exerciseName, acc] of exerciseMap.entries()) {
        const prescribedWeight =
            acc.prescribedWeightCount > 0
                ? acc.prescribedWeightSum / acc.prescribedWeightCount
                : null
        const actualWeight =
            acc.actualWeightCount > 0
                ? acc.actualWeightSum / acc.actualWeightCount
                : null
        const prescribedReps =
            acc.prescribedRepsCount > 0
                ? Math.round(acc.prescribedRepsSum / acc.prescribedRepsCount)
                : null
        const actualReps =
            acc.actualRepsCount > 0
                ? Math.round(acc.actualRepsSum / acc.actualRepsCount)
                : null
        const actualRpe =
            acc.actualRpeCount > 0
                ? acc.actualRpeSum / acc.actualRpeCount
                : null

        // Classify weight and reps independently, then take worst-case
        const weightClass = classifyDelta(prescribedWeight, actualWeight)
        const repsClass = classifyDelta(prescribedReps, actualReps)
        const merged = mergeClassifications(weightClass, repsClass)

        // Skip exercises where we have no basis for comparison
        if (merged === null) continue

        deltaRows.push({
            user_id: userId,
            session_inventory_id: sessionInventoryId,
            exercise_name: exerciseName,
            prescribed_weight: prescribedWeight,
            actual_weight: actualWeight,
            prescribed_reps: prescribedReps,
            actual_reps: actualReps,
            prescribed_rpe: null,  // exercise_sets has no prescribed RPE column; use null
            actual_rpe: actualRpe,
            delta_classification: merged,
        })
    }

    if (deltaRows.length === 0) {
        // All exercises lacked target values (e.g., free-form session) — nothing to write
        return { success: true, deltasCreated: 0 }
    }

    // ── 6. Delete stale deltas (idempotent re-run safety) ────────────────────
    const { error: deleteError } = await supabase
        .from('performance_deltas')
        .delete()
        .eq('session_inventory_id', sessionInventoryId)
        .eq('user_id', userId)

    if (deleteError) {
        console.error('[generatePerformanceDeltas] stale delta cleanup failed:', deleteError.message)
        return { success: false, error: deleteError.message }
    }

    // ── 7. Insert fresh delta rows ────────────────────────────────────────────
    const { error: insertError } = await supabase
        .from('performance_deltas')
        .insert(deltaRows)

    if (insertError) {
        console.error('[generatePerformanceDeltas] insert failed:', insertError.message)
        return { success: false, error: insertError.message }
    }

    return { success: true, deltasCreated: deltaRows.length }
}
