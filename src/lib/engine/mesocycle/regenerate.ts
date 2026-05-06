'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { runHeadCoachStrategy } from '@/lib/engine/mesocycle/strategy-generation'
import { generateSessionPool } from '@/lib/engine/microcycle/generate-pool'
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

    // Find week 1 microcycle
    const { data: week1Micro } = await supabase
        .from('microcycles')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', 1)
        .eq('user_id', user.id)
        .single()

    // Delete week 1 inventory if present
    if (week1Micro) {
        await supabase
            .from('session_inventory')
            .delete()
            .eq('microcycle_id', week1Micro.id)
    }

    // Re-run strategy
    const stratResult = await runHeadCoachStrategy(mesocycleId)
    if (!stratResult.success) return { success: false, error: stratResult.error }

    // Re-run week 1 generation
    if (week1Micro) {
        const poolResult = await generateSessionPool(week1Micro.id)
        if (!poolResult.success) return { success: false, error: `Week 1 regen failed: ${poolResult.error}` }
    }

    revalidatePath('/data/blocks/new')
    return { success: true, data: { strategy: stratResult.data } }
}
