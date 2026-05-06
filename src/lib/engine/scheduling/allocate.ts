'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { autoAssignSessionDates } from '@/lib/scheduling/auto-assign'
import type { ActionResult, WorkoutWithSets } from '@/lib/types/training.types'

// ─── Allocate Sessions to Calendar ──────────────────────────────────────────

/**
 * Auto-assign unallocated sessions to calendar days using load-aware scheduling.
 * Called when user clicks "Allocate Sessions" button in the dashboard.
 *
 * @param targetMicrocycleId — Optional: allocate this specific week (used when viewing a non-current week)
 */
export async function allocateSessionDates(targetMicrocycleId?: string): Promise<ActionResult<void>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    let microcycle: { id: string; start_date: string; end_date: string } | null = null

    if (targetMicrocycleId) {
        // Use the explicitly provided microcycle
        const { data: target } = await supabase
            .from('microcycles')
            .select('id, start_date, end_date')
            .eq('id', targetMicrocycleId)
            .eq('user_id', user.id)
            .maybeSingle()
        microcycle = target
    } else {
        // Fall back to date-based lookup
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
            .select('id, start_date, end_date')
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
                .select('id, start_date, end_date')
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
                    .select('id, start_date, end_date')
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

    // Load all workouts with exercise_sets for this microcycle
    const { data: workouts } = await supabase
        .from('workouts')
        .select('*, exercise_sets(*)')
        .eq('microcycle_id', microcycle.id)
        .eq('user_id', user.id)

    if (!workouts || workouts.length === 0) {
        return { success: false, error: 'No sessions to allocate' }
    }

    // Filter to unallocated only for assignment, but include all for load context
    const unallocated = workouts.filter(w => !w.is_allocated && !w.is_completed)
    if (unallocated.length === 0) {
        return { success: true, data: undefined }  // Nothing to allocate
    }

    // Load athlete's two-a-day preference for scheduling
    const { data: schedProfile } = await supabase
        .from('profiles')
        .select('two_a_day')
        .eq('id', user.id)
        .single()

    const twoADay = (schedProfile?.two_a_day ?? 'no') as 'yes' | 'sometimes' | 'no'

    // Use load-aware auto-assignment on ALL sessions (already allocated ones
    // will keep their current dates, we only update unallocated ones)
    const allAsWorkoutWithSets = workouts as WorkoutWithSets[]
    const dateAssignments = autoAssignSessionDates(
        allAsWorkoutWithSets,
        microcycle.start_date,
        microcycle.end_date,
        twoADay
    )

    // Update each unallocated workout with its assigned date
    for (const workout of unallocated) {
        const assignedDate = dateAssignments.get(workout.id)
        if (assignedDate) {
            await supabase
                .from('workouts')
                .update({
                    scheduled_date: assignedDate,
                    is_allocated: true,
                })
                .eq('id', workout.id)
                .eq('user_id', user.id)
        }
    }

    revalidatePath('/dashboard')
    return { success: true, data: undefined }
}
