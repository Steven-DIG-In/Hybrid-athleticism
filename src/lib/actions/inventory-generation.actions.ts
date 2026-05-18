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
import type { ActionResult } from '@/lib/types/training.types'
import type { SessionInventory } from '@/lib/types/inventory.types'
import { generateSessionPool } from '@/lib/engine/microcycle/generate-pool'
import { suggestAllocation, applyAllocation } from './inventory.actions'

/**
 * Generate unscheduled session inventory for an entire mesocycle.
 *
 * HOW IT WORKS:
 * 1. For each week (1 to weekCount):
 *    - Call existing generateSessionPool to leverage AI programming
 *    - Extract session data from AI response
 *    - Delete the temporary workouts (we only want inventory)
 *    - Insert into session_inventory with week_number, scheduled_date=NULL
 * 2. Return all created inventory sessions
 *
 * USER FLOW AFTER:
 * - User reviews Week 1 inventory
 * - Clicks "Allocate Week 1"
 * - AI suggests optimal dates based on constraints
 * - Sessions get scheduled_date set
 * - Training begins
 *
 * @param mesocycleId - The mesocycle to generate inventory for
 * @param weekCount - Number of weeks to generate (4, 6, 8, or 12)
 */
export async function generateMesocycleInventory(
    mesocycleId: string,
    weekCount: number
): Promise<ActionResult<{ sessions: number; weeks: number }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    let totalSessions = 0
    const weekErrors: string[] = []

    // Pre-resolve all microcycles so we can fan out the AI calls in parallel.
    // Sequential generation hit Vercel's function timeout on 6+ week blocks.
    const { data: microcycleRows } = await supabase
        .from('microcycles')
        .select('id, week_number')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .gte('week_number', 1)
        .lte('week_number', weekCount)
        .order('week_number', { ascending: true })

    const microcycleByWeek = new Map<number, string>()
    for (const mc of microcycleRows ?? []) {
        microcycleByWeek.set(mc.week_number, mc.id)
    }

    // Pre-clean any orphan workouts on the target microcycles. A prior partial
    // run (e.g. killed by Vercel's 300s timeout mid-loop) can leave non-completed
    // workouts behind that were never converted to session_inventory. They show
    // up in the dashboard's week view because they share a microcycle and a
    // placeholder scheduled_date. Clean them here so generation is idempotent.
    const targetMicrocycleIds = Array.from(microcycleByWeek.values())
    if (targetMicrocycleIds.length > 0) {
        const { data: stale } = await supabase
            .from('workouts')
            .select('id')
            .in('microcycle_id', targetMicrocycleIds)
            .eq('user_id', user.id)
            .eq('is_completed', false)
        const staleIds = (stale ?? []).map(w => w.id)
        if (staleIds.length > 0) {
            console.log(`[generateMesocycleInventory] Pre-clean: removing ${staleIds.length} stale workouts`)
            await supabase.from('exercise_sets').delete().in('workout_id', staleIds)
            await supabase.from('cardio_logs').delete().in('workout_id', staleIds)
            await supabase.from('workouts').delete().in('id', staleIds).eq('user_id', user.id)
        }
    }

    // Run all weeks' AI generations in parallel. Each generateSessionPool
    // operates on its own microcycle (no cross-week DB contention) and reads
    // shared profile/benchmark context which is safe to read concurrently.
    console.log(`[generateMesocycleInventory] Generating ${weekCount} weeks in parallel...`)
    const poolResults = await Promise.all(
        Array.from({ length: weekCount }, (_, i) => {
            const weekNum = i + 1
            const mcId = microcycleByWeek.get(weekNum)
            if (!mcId) {
                console.warn(`[generateMesocycleInventory] No microcycle found for week ${weekNum}, skipping...`)
                return Promise.resolve(null as null | Awaited<ReturnType<typeof generateSessionPool>>)
            }
            return generateSessionPool(mcId)
        })
    )

    // Process the results sequentially so DB writes don't race each other on
    // the workouts/session_inventory tables.
    for (let i = 0; i < weekCount; i++) {
        const weekNum = i + 1
        const poolResult = poolResults[i]

        if (!poolResult) {
            weekErrors.push(`week ${weekNum}: missing microcycle`)
            continue
        }
        if (!poolResult.success) {
            console.error(`[generateMesocycleInventory] Failed week ${weekNum}:`, poolResult.error)
            weekErrors.push(`week ${weekNum}: ${poolResult.error}`)
            continue
        }

        // Extract session data from workouts
        const workouts = poolResult.data.workouts

        // Convert workouts → session_inventory
        for (const workout of workouts) {
            // Load exercise_sets if LIFTING
            let exercisePrescription = null
            if (workout.modality === 'LIFTING') {
                const { data: sets } = await supabase
                    .from('exercise_sets')
                    .select('*')
                    .eq('workout_id', workout.id)
                    .order('set_number', { ascending: true })

                if (sets && sets.length > 0) {
                    // Group by exercise
                    const exerciseMap = new Map<string, any>()
                    for (const set of sets) {
                        if (!exerciseMap.has(set.exercise_name)) {
                            exerciseMap.set(set.exercise_name, {
                                name: set.exercise_name,
                                muscleGroup: set.muscle_group,
                                sets: []
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

            // Insert into session_inventory
            const { error: insertError } = await supabase
                .from('session_inventory')
                .insert({
                    mesocycle_id: mesocycleId,
                    user_id: user.id,
                    week_number: weekNum,
                    session_priority: 1, // All core sessions
                    modality: workout.modality,
                    name: workout.name,
                    coach_notes: workout.coach_notes,
                    estimated_duration_minutes: null, // Extract from AI if available
                    load_budget: null, // Extract from AI if available
                    scheduled_date: null, // UNSCHEDULED
                    is_approved: false,
                    carry_over_notes: null,
                    adjustment_pending: exercisePrescription ? {
                        prescription: exercisePrescription
                    } : null,
                })

            if (insertError) {
                console.error(`[generateMesocycleInventory] Failed to insert ${workout.name}:`, insertError)
            } else {
                totalSessions++
            }
        }

        // Delete the temporary workouts (we only wanted the session data)
        const workoutIds = workouts.map(w => w.id)
        if (workoutIds.length > 0) {
            await supabase.from('exercise_sets').delete().in('workout_id', workoutIds)
            await supabase.from('workouts').delete().in('id', workoutIds)
        }

        console.log(`[generateMesocycleInventory] Week ${weekNum}: Created ${workouts.length} inventory sessions`)
    }

    // Hard-fail when generation produced zero sessions. Previously the function
    // returned success:true with sessions:0, which let the wizard advance to an
    // empty preview, approve the block, and trap the athlete in a polling loop
    // on a permanently empty dashboard.
    if (totalSessions === 0) {
        return {
            success: false,
            error: weekErrors.length > 0
                ? `Generation failed for all requested weeks: ${weekErrors.join('; ')}`
                : 'Generation produced zero sessions',
        }
    }

    // Auto-allocate Week 1 so the athlete can start training immediately
    try {
        const allocationResult = await suggestAllocation(mesocycleId, 1)
        if (allocationResult.success && allocationResult.data) {
            const applyResult = await applyAllocation(allocationResult.data)
            if (applyResult.success) {
                console.log(`[generateMesocycleInventory] Auto-allocated Week 1: ${applyResult.data.allocated} sessions`)
            } else {
                console.warn('[generateMesocycleInventory] Failed to apply Week 1 allocation:', applyResult.error)
            }
        } else {
            console.warn('[generateMesocycleInventory] Failed to suggest Week 1 allocation:', allocationResult.success ? 'no data' : allocationResult.error)
        }
    } catch (err) {
        console.warn('[generateMesocycleInventory] Week 1 auto-allocation error (non-blocking):', err)
    }

    revalidatePath('/dashboard')

    console.log(`[generateMesocycleInventory] Complete: ${totalSessions} sessions across ${weekCount} weeks`)

    return {
        success: true,
        data: {
            sessions: totalSessions,
            weeks: weekCount
        }
    }
}

/**
 * Regenerate inventory for a specific week only.
 * Deletes existing unscheduled inventory for that week, generates new sessions.
 *
 * @param mesocycleId - The mesocycle
 * @param weekNumber - Which week to regenerate (1, 2, 3...)
 */
export async function regenerateWeekInventory(
    mesocycleId: string,
    weekNumber: number
): Promise<ActionResult<{ sessions: number }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    console.log(`[regenerateWeekInventory] Regenerating week ${weekNumber}...`)

    // Delete existing unscheduled inventory for this week
    // IMPORTANT: Only delete unscheduled sessions to preserve allocated/completed ones
    const { error: deleteError } = await supabase
        .from('session_inventory')
        .delete()
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .eq('week_number', weekNumber)
        .is('scheduled_date', null)

    if (deleteError) {
        return { success: false, error: `Failed to delete old inventory: ${deleteError.message}` }
    }

    // Generate new inventory for this week
    const result = await generateMesocycleInventory(mesocycleId, weekNumber)

    if (!result.success) {
        return result
    }

    revalidatePath('/dashboard')

    return {
        success: true,
        data: { sessions: result.data.sessions }
    }
}
