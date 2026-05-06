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

    let microcycle: { id: string; start_date: string } | null = null

    if (targetMicrocycleId) {
        const { data: target } = await supabase
            .from('microcycles')
            .select('id, start_date')
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
            .select('id, start_date')
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
                .select('id, start_date')
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
                    .select('id, start_date')
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

    // Reset all non-completed workouts to unallocated
    const { error } = await supabase
        .from('workouts')
        .update({
            scheduled_date: microcycle.start_date,
            is_allocated: false,
        })
        .eq('microcycle_id', microcycle.id)
        .eq('user_id', user.id)
        .eq('is_completed', false)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true, data: undefined }
}
