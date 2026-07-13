/**
 * Session Inventory Generation Actions
 *
 * NEW ARCHITECTURE: Generates unscheduled session inventory instead of calendar-bound workouts.
 * Sessions are created with week_number but NO scheduled_date.
 * Users allocate sessions to calendar dates based on their actual schedule.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import type { ActionResult } from '@/lib/types/training.types'
import type { Workout } from '@/lib/types/database.types'
import { generateSessionPool } from '@/lib/engine/microcycle/generate-pool'
import { suggestAllocation, applyAllocation } from './inventory.actions'

type Supa = SupabaseClient<Database>

/**
 * Convert temporary workouts (produced by generateSessionPool) into
 * session_inventory rows, then delete the temp workouts.
 *
 * Pure helper — no auth check, no allocation. Caller owns those.
 *
 * Returns the number of session_inventory rows successfully inserted plus any
 * per-workout error strings so callers can fail loudly on partial writes.
 */
async function convertWorkoutsToInventory(
    supabase: Supa,
    userId: string,
    mesocycleId: string,
    weekNumber: number,
    workouts: Workout[],
): Promise<{ inserted: number; errors: string[] }> {
    let inserted = 0
    const errors: string[] = []

    for (const workout of workouts) {
        let exercisePrescription = null
        if (workout.modality === 'LIFTING') {
            const { data: sets } = await supabase
                .from('exercise_sets')
                .select('*')
                .eq('workout_id', workout.id)
                .order('set_number', { ascending: true })

            if (sets && sets.length > 0) {
                const exerciseMap = new Map<string, {
                    name: string
                    muscleGroup: string | null
                    sets: Array<{
                        targetReps: number | null
                        targetWeightKg: number | null
                        targetRir: number | null
                        notes: string | null
                    }>
                }>()
                for (const set of sets) {
                    if (!exerciseMap.has(set.exercise_name)) {
                        exerciseMap.set(set.exercise_name, {
                            name: set.exercise_name,
                            muscleGroup: set.muscle_group,
                            sets: [],
                        })
                    }
                    exerciseMap.get(set.exercise_name)!.sets.push({
                        targetReps: set.target_reps,
                        targetWeightKg: set.target_weight_kg,
                        targetRir: set.target_rir,
                        notes: set.notes,
                    })
                }
                exercisePrescription = Array.from(exerciseMap.values())
            }
        }

        const { error: insertError } = await supabase
            .from('session_inventory')
            .insert({
                mesocycle_id: mesocycleId,
                user_id: userId,
                week_number: weekNumber,
                session_priority: 1,
                modality: workout.modality,
                name: workout.name,
                coach_notes: workout.coach_notes,
                estimated_duration_minutes: null,
                load_budget: null,
                scheduled_date: null,
                is_approved: false,
                carry_over_notes: null,
                adjustment_pending: exercisePrescription
                    ? { prescription: exercisePrescription }
                    : null,
            })

        if (insertError) {
            console.error(`[convertWorkoutsToInventory] Failed to insert ${workout.name}:`, insertError)
            errors.push(`${workout.name}: ${insertError.message}`)
        } else {
            inserted++
        }
    }

    // Delete the temporary workouts (we only wanted the session data)
    const workoutIds = workouts.map(w => w.id)
    if (workoutIds.length > 0) {
        await supabase.from('exercise_sets').delete().in('workout_id', workoutIds)
        await supabase.from('cardio_logs').delete().in('workout_id', workoutIds)
        await supabase.from('workouts').delete().in('id', workoutIds).eq('user_id', userId)
    }

    return { inserted, errors }
}

/**
 * Delete any non-completed workouts attached to the given microcycles.
 * Used as a pre-flight on regen and lazy-next-week paths so leftovers from a
 * partially failed prior run don't get rendered in the dashboard or fight with
 * the new generation.
 */
async function cleanOrphanWorkouts(
    supabase: Supa,
    userId: string,
    microcycleIds: string[],
): Promise<void> {
    if (microcycleIds.length === 0) return

    const { data: stale } = await supabase
        .from('workouts')
        .select('id')
        .in('microcycle_id', microcycleIds)
        .eq('user_id', userId)
        .eq('is_completed', false)

    const staleIds = (stale ?? []).map(w => w.id)
    if (staleIds.length === 0) return

    console.log(`[cleanOrphanWorkouts] Removing ${staleIds.length} stale workouts`)
    await supabase.from('exercise_sets').delete().in('workout_id', staleIds)
    await supabase.from('cardio_logs').delete().in('workout_id', staleIds)
    await supabase.from('workouts').delete().in('id', staleIds).eq('user_id', userId)
}

/**
 * Try to auto-allocate the given week so the athlete can start training
 * without an extra manual step. Non-blocking — logs and returns on failure.
 */
async function autoAllocateWeek(mesocycleId: string, weekNumber: number): Promise<void> {
    try {
        const allocationResult = await suggestAllocation(mesocycleId, weekNumber)
        if (!allocationResult.success || !allocationResult.data) {
            console.warn(
                `[autoAllocateWeek] Failed to suggest week ${weekNumber} allocation:`,
                allocationResult.success ? 'no data' : allocationResult.error,
            )
            return
        }
        const applyResult = await applyAllocation(allocationResult.data)
        if (applyResult.success) {
            console.log(`[autoAllocateWeek] Week ${weekNumber}: allocated ${applyResult.data.allocated} sessions`)
        } else {
            console.warn(`[autoAllocateWeek] Failed to apply week ${weekNumber} allocation:`, applyResult.error)
        }
    } catch (err) {
        console.warn(`[autoAllocateWeek] Week ${weekNumber} auto-allocation error (non-blocking):`, err)
    }
}

/**
 * Generate session inventory for a single microcycle (one week).
 *
 * Flow:
 *   1. Resolve microcycle → mesocycle / week_number
 *   2. Pre-clean orphan workouts on this microcycle
 *   3. generateSessionPool — AI fills the workouts table with temps
 *   4. Convert temps → session_inventory, delete temps
 *   5. Auto-allocate the week so the dashboard surfaces training_day=N rows
 *
 * Single entry point used by the wizard (week 1), by `generateNextWeekPool`
 * (lazy weeks 2..N), by `regenerateWeekInventory`, and by anywhere else that
 * needs one week of inventory.
 */
export async function generateWeekInventory(
    microcycleId: string,
    opts: { force?: boolean } = {},
): Promise<ActionResult<{ sessions: number; weekNumber: number; mesocycleId: string }>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    const { data: microcycle, error: mcErr } = await supabase
        .from('microcycles')
        .select('id, week_number, mesocycle_id')
        .eq('id', microcycleId)
        .eq('user_id', user.id)
        .single()
    if (mcErr || !microcycle) {
        return { success: false, error: mcErr?.message ?? 'Microcycle not found' }
    }

    // Idempotency guard: if this week already has inventory, treat generation as
    // a no-op and return the existing count. Without this, a double-dispatch of
    // the wizard/lazy path (retry, double-click, concurrent request) stacks a
    // second AI-generated pool on top of the first — the root cause of a week
    // ending up with ~2x its intended sessions. `regenerateWeekInventory` opts
    // out via `force: true` because it has already deleted the rows it means to
    // replace.
    if (!opts.force) {
        const { count } = await supabase
            .from('session_inventory')
            .select('id', { count: 'exact', head: true })
            .eq('mesocycle_id', microcycle.mesocycle_id)
            .eq('week_number', microcycle.week_number)
            .eq('user_id', user.id)
        if ((count ?? 0) > 0) {
            return {
                success: true,
                data: {
                    sessions: count ?? 0,
                    weekNumber: microcycle.week_number,
                    mesocycleId: microcycle.mesocycle_id,
                },
            }
        }
    }

    await cleanOrphanWorkouts(supabase as Supa, user.id, [microcycle.id])

    const poolResult = await generateSessionPool(microcycle.id)
    if (!poolResult.success) {
        return { success: false, error: `Week ${microcycle.week_number} generation failed: ${poolResult.error}` }
    }

    const { inserted, errors } = await convertWorkoutsToInventory(
        supabase as Supa,
        user.id,
        microcycle.mesocycle_id,
        microcycle.week_number,
        poolResult.data.workouts,
    )

    if (inserted === 0) {
        return {
            success: false,
            error: errors.length > 0
                ? `All inventory inserts failed: ${errors.join('; ')}`
                : `Week ${microcycle.week_number} produced zero inventory rows`,
        }
    }

    await autoAllocateWeek(microcycle.mesocycle_id, microcycle.week_number)

    revalidatePath('/dashboard')

    return {
        success: true,
        data: {
            sessions: inserted,
            weekNumber: microcycle.week_number,
            mesocycleId: microcycle.mesocycle_id,
        },
    }
}

/**
 * Generate session inventory for a contiguous range of weeks (1..weekCount).
 * Currently called by the block-creation wizard with weekCount=1 (lazy
 * generation handles weeks 2..N). Hard-fails on zero-session result so the
 * wizard doesn't trap the athlete on an empty dashboard.
 */
export async function generateMesocycleInventory(
    mesocycleId: string,
    weekCount: number,
): Promise<ActionResult<{ sessions: number; weeks: number }>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    const { data: microcycleRows } = await supabase
        .from('microcycles')
        .select('id, week_number')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .gte('week_number', 1)
        .lte('week_number', weekCount)
        .order('week_number', { ascending: true })

    if (!microcycleRows || microcycleRows.length === 0) {
        return { success: false, error: 'No microcycles found for requested weeks' }
    }

    let totalSessions = 0
    const weekErrors: string[] = []

    for (const mc of microcycleRows) {
        const result = await generateWeekInventory(mc.id)
        if (result.success) {
            totalSessions += result.data.sessions
        } else {
            weekErrors.push(`week ${mc.week_number}: ${result.error}`)
        }
    }

    if (totalSessions === 0) {
        return {
            success: false,
            error: weekErrors.length > 0
                ? `Generation failed for all requested weeks: ${weekErrors.join('; ')}`
                : 'Generation produced zero sessions',
        }
    }

    revalidatePath('/dashboard')
    return {
        success: true,
        data: { sessions: totalSessions, weeks: microcycleRows.length },
    }
}

/**
 * Regenerate inventory for a specific week only.
 * Deletes existing unallocated inventory (where training_day IS NULL) for the
 * week, then runs the standard per-week pipeline.
 */
export async function regenerateWeekInventory(
    mesocycleId: string,
    weekNumber: number,
): Promise<ActionResult<{ sessions: number }>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    console.log(`[regenerateWeekInventory] Regenerating week ${weekNumber}...`)

    const { data: micro, error: mcErr } = await supabase
        .from('microcycles')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .eq('week_number', weekNumber)
        .single()
    if (mcErr || !micro) {
        return { success: false, error: `Microcycle for week ${weekNumber} not found` }
    }

    // Only delete inventory that hasn't been pinned to a training_day yet.
    // Preserves any rows the user already allocated or completed.
    const { error: deleteError } = await supabase
        .from('session_inventory')
        .delete()
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .eq('week_number', weekNumber)
        .is('training_day', null)
    if (deleteError) {
        return { success: false, error: `Failed to delete old inventory: ${deleteError.message}` }
    }

    // force: the delete above already removed the rows we intend to replace, so
    // bypass the idempotency guard (allocated/completed rows may legitimately
    // remain and would otherwise short-circuit regeneration).
    const result = await generateWeekInventory(micro.id, { force: true })
    if (!result.success) return result

    revalidatePath('/dashboard')
    return { success: true, data: { sessions: result.data.sessions } }
}
