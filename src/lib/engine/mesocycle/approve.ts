'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { clearPendingPlannerNotes } from '@/lib/actions/pending-notes.actions'
import type { ActionResult } from '@/lib/types/training.types'

/**
 * Approve a drafted block plan and start it.
 *
 * Final step of the block-creation wizard. Flips the mesocycle to active,
 * positions the block_pointer at (week 1, day 1) so the dashboard surfaces the
 * first training day, and consumes any pending planner notes carryover that
 * fed the planning conversation.
 */
export async function approveBlockPlan(
    mesocycleId: string,
): Promise<ActionResult<void>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    // Flip mesocycle.is_active = true (scoped to caller).
    const { error: mesoErr } = await supabase
        .from('mesocycles')
        .update({ is_active: true })
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
    if (mesoErr) return { success: false, error: mesoErr.message }

    // Confirm a week 1 microcycle exists — the pointer is meaningless without it.
    const { data: week1Micro, error: microErr } = await supabase
        .from('microcycles')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', 1)
        .eq('user_id', user.id)
        .single()
    if (microErr || !week1Micro) {
        return { success: false, error: 'Week 1 microcycle missing' }
    }

    // Position block_pointer at (week 1, day 1). Upsert so a stale pointer from
    // a prior abandoned approval is overwritten cleanly.
    const { error: pointerErr } = await supabase
        .from('block_pointer')
        .upsert(
            {
                user_id: user.id,
                mesocycle_id: mesocycleId,
                week_number: 1,
                next_training_day: 1,
            },
            { onConflict: 'user_id,mesocycle_id,week_number' },
        )
    if (pointerErr) {
        return { success: false, error: `Block pointer failed: ${pointerErr.message}` }
    }

    // Carryover consumed — clear planner notes so the next block doesn't re-eat them.
    await clearPendingPlannerNotes()

    revalidatePath('/dashboard')
    return { success: true, data: undefined }
}
