'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { clearPendingPlannerNotes } from '@/lib/actions/pending-notes.actions'
import type { ActionResult } from '@/lib/types/training.types'
import {
    methodologyEnumFromStrategy,
    type StrategyShape,
} from './methodology-mapping'

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

    // Refuse to activate a mesocycle with no week-1 inventory. A 0-row block is
    // unusable — the dashboard polls inventory forever and the athlete cannot
    // start training. This is a defense-in-depth check: generateMesocycleInventory
    // is supposed to reject the upstream wizard call before approve is reached.
    const { count: week1Count, error: countErr } = await supabase
        .from('session_inventory')
        .select('id', { count: 'exact', head: true })
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .eq('week_number', 1)
    if (countErr) return { success: false, error: `Inventory check failed: ${countErr.message}` }
    if ((week1Count ?? 0) === 0) {
        return {
            success: false,
            error: 'Week 1 has no sessions — regenerate the plan before approving.',
        }
    }

    // Flip mesocycle.is_active = true (scoped to caller). Read ai_context_json
    // back so we can inspect the head-coach strategy below.
    const { data: meso, error: mesoErr } = await supabase
        .from('mesocycles')
        .update({ is_active: true })
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
        .select('ai_context_json')
        .single()
    if (mesoErr) return { success: false, error: mesoErr.message }

    // Persist the strategy's methodology choice onto the profile so subsequent
    // generation paths (including regenerations) feed the correct lifting
    // protocol into the AI prompt. Only writes when the directive maps cleanly;
    // unknown directives leave the profile field untouched.
    const strategy = (meso?.ai_context_json as Record<string, unknown> | null)?.strategy as
        StrategyShape | undefined
    const strengthEnum = methodologyEnumFromStrategy(strategy)
    if (strengthEnum) {
        const { error: profileErr } = await supabase
            .from('profiles')
            .update({ strength_methodology: strengthEnum })
            .eq('id', user.id)
        if (profileErr) {
            console.warn('[approveBlockPlan] strength_methodology persist failed:', profileErr.message)
        }
    }

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
