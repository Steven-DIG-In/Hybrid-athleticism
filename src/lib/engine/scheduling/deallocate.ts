'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types/training.types'

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

    let microcycle: { id: string; start_date: string; mesocycle_id: string; week_number: number } | null = null

    if (targetMicrocycleId) {
        const { data: target } = await supabase
            .from('microcycles')
            .select('id, start_date, mesocycle_id, week_number')
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
            .select('id, start_date, mesocycle_id, week_number')
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
                .select('id, start_date, mesocycle_id, week_number')
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
                    .select('id, start_date, mesocycle_id, week_number')
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

    // Inventory-aware path: clear training_day/session_slot/scheduled_date on
    // session_inventory rows for this week, and delete the linked non-completed
    // workouts so a fresh `applyAllocation` can rebuild them. Completed
    // sessions (and their workouts) are preserved.
    const { data: invRows } = await supabase
        .from('session_inventory')
        .select('id')
        .eq('mesocycle_id', microcycle.mesocycle_id)
        .eq('week_number', microcycle.week_number)
        .eq('user_id', user.id)
        .not('training_day', 'is', null)

    if (invRows && invRows.length > 0) {
        const invIds = invRows.map(r => r.id)

        const { data: linkedWorkouts } = await supabase
            .from('workouts')
            .select('id, session_inventory_id')
            .in('session_inventory_id', invIds)
            .eq('microcycle_id', microcycle.id)
            .eq('user_id', user.id)
            .eq('is_completed', false)

        if (linkedWorkouts && linkedWorkouts.length > 0) {
            const woIds = linkedWorkouts.map(w => w.id)
            const clearedInvIds = linkedWorkouts
                .map(w => w.session_inventory_id)
                .filter((id): id is string => Boolean(id))

            await supabase.from('exercise_sets').delete().in('workout_id', woIds)
            await supabase.from('workouts').delete().in('id', woIds)

            if (clearedInvIds.length > 0) {
                await supabase
                    .from('session_inventory')
                    .update({ training_day: null, session_slot: null, scheduled_date: null })
                    .in('id', clearedInvIds)
                    .eq('user_id', user.id)
            }
        }
    }

    // Legacy path: reset any non-inventory-backed workouts (older flow that
    // wrote workouts directly without going through session_inventory).
    const { error } = await supabase
        .from('workouts')
        .update({
            scheduled_date: microcycle.start_date,
            is_allocated: false,
        })
        .eq('microcycle_id', microcycle.id)
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .is('session_inventory_id', null)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true, data: undefined }
}
