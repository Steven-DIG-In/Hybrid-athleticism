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

    // Generate sessions for each week
    for (let weekNum = 1; weekNum <= weekCount; weekNum++) {
        console.log(`[generateMesocycleInventory] Generating inventory for week ${weekNum}/${weekCount}...`)

        // Find microcycle for this week
        const { data: microcycle } = await supabase
            .from('microcycles')
            .select('id')
            .eq('mesocycle_id', mesocycleId)
            .eq('week_number', weekNum)
            .eq('user_id', user.id)
            .maybeSingle()

        if (!microcycle) {
            console.warn(`[generateMesocycleInventory] No microcycle found for week ${weekNum}, skipping...`)
            continue
        }

        // Call existing AI programming to generate sessions
        const poolResult = await generateSessionPool(microcycle.id)

        if (!poolResult.success) {
            console.error(`[generateMesocycleInventory] Failed week ${weekNum}:`, poolResult.error)
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
