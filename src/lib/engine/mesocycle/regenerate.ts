'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { runHeadCoachStrategy } from '@/lib/engine/mesocycle/strategy-generation'
import { generateMesocycleInventory } from '@/lib/actions/inventory-generation.actions'
import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'
import type { ActionResult } from '@/lib/types/training.types'

export async function regenerateBlockPlan(
    mesocycleId: string,
): Promise<ActionResult<{ strategy: MesocycleStrategyValidated }>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    // Read existing ai_context_json so we preserve archetype/customCounts/carryover
    const { data: mesoRow, error: mesoErr } = await supabase
        .from('mesocycles')
        .select('ai_context_json')
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
        .single()

    if (mesoErr || !mesoRow) return { success: false, error: mesoErr?.message ?? 'Mesocycle not found' }

    const aiCtx = (mesoRow.ai_context_json ?? {}) as Record<string, unknown>

    // Clear strategy (keep archetype/customCounts/carryover/mode)
    const { error: clearErr } = await supabase
        .from('mesocycles')
        .update({ ai_context_json: { ...aiCtx, strategy: null } })
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
    if (clearErr) return { success: false, error: `Strategy clear failed: ${clearErr.message}` }

    // Find week 1 microcycle (still needed for any per-week microcycle metadata operations)
    const { data: week1Micro } = await supabase
        .from('microcycles')
        .select('id, week_number')
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', 1)
        .eq('user_id', user.id)
        .single()

    // Delete week 1 inventory (correct schema: keyed by mesocycle_id + week_number, not microcycle_id)
    if (week1Micro) {
        await supabase
            .from('session_inventory')
            .delete()
            .eq('mesocycle_id', mesocycleId)
            .eq('week_number', 1)
            .eq('user_id', user.id)
    }

    // Re-run strategy
    const stratResult = await runHeadCoachStrategy(mesocycleId)
    if (!stratResult.success) return { success: false, error: stratResult.error }

    // Re-run week 1 generation (writes to session_inventory)
    const inventoryResult = await generateMesocycleInventory(mesocycleId, 1)
    if (!inventoryResult.success) {
        return { success: false, error: `Week 1 regen failed: ${inventoryResult.error}` }
    }

    revalidatePath('/data/blocks/new')
    return { success: true, data: { strategy: stratResult.data } }
}
