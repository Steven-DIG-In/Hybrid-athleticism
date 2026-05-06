'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types/training.types'

export interface OrphanBlock {
    mesocycleId: string
    name: string
    createdAt: string
    hasStrategy: boolean
}

export async function findOrphanBlock(): Promise<ActionResult<OrphanBlock | null>> {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not authenticated' }

    const { data, error } = await supabase
        .from('mesocycles')
        .select('id, name, created_at, ai_context_json')
        .eq('user_id', user.id)
        .eq('is_active', false)
        .eq('is_complete', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!data) return { success: true, data: null }

    const aiCtx = (data.ai_context_json ?? {}) as Record<string, unknown>
    return {
        success: true,
        data: {
            mesocycleId: data.id,
            name: data.name,
            createdAt: data.created_at,
            hasStrategy: aiCtx.strategy != null,
        },
    }
}

export async function discardOrphanBlock(mesocycleId: string): Promise<ActionResult<void>> {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not authenticated' }

    // Delete session_inventory rows first (in case FK cascade isn't set up).
    // session_inventory is keyed by (mesocycle_id, week_number) — verified in Task 10.
    const { error: invErr } = await supabase
        .from('session_inventory')
        .delete()
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
    // Soft-fail on inventory delete (no rows to delete is fine; we don't want to block discard)
    if (invErr) {
        console.warn('[discardOrphanBlock] inventory delete warning:', invErr.message)
    }

    // Delete microcycles
    const { error: micErr } = await supabase
        .from('microcycles')
        .delete()
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
    if (micErr) return { success: false, error: micErr.message }

    // Delete the mesocycle (only if still inactive + incomplete — defensive)
    const { error: mesoErr } = await supabase
        .from('mesocycles')
        .delete()
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
        .eq('is_complete', false)
    if (mesoErr) return { success: false, error: mesoErr.message }

    return { success: true, data: undefined }
}
