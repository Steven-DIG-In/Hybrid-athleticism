'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateStructuredResponse } from '@/lib/ai/client'
import { MesocycleStrategySchema, type MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'
import {
    buildMesocycleStrategySystemPrompt,
    buildMesocycleStrategyUserPrompt,
} from '@/lib/ai/prompts/head-coach'
import { buildAthleteContext } from '@/lib/engine/mesocycle/context'
import type { ActionResult } from '@/lib/types/training.types'

/**
 * Run the Head Coach to produce a MesocycleStrategy at block start.
 *
 * Reads the wizard's archetype/customCounts/carryover/mode from
 * mesocycle.ai_context_json (written by createBlockShell), builds the athlete
 * context (now retrospective + pending_planner_notes aware), splices the
 * ai_context_json onto the context for the prompt, calls the AI, and persists
 * the resulting strategy back to mesocycle.ai_context_json.strategy
 * (preserving the other fields).
 */
export async function runHeadCoachStrategy(
    mesocycleId: string,
): Promise<ActionResult<MesocycleStrategyValidated>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    // Read wizard input from ai_context_json (written by createBlockShell)
    const { data: mesoRow } = await supabase
        .from('mesocycles')
        .select('ai_context_json')
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
        .single()

    const aiCtx = (mesoRow?.ai_context_json ?? {}) as Record<string, unknown>

    // Build athlete context (now retrospective + pending-notes aware)
    const ctxResult = await buildAthleteContext(user.id, mesocycleId, 1)
    if (!ctxResult.success) return { success: false, error: ctxResult.error }

    // Splice aiContextJson onto context so the prompt sees archetype/customCounts/carryover/mode
    const ctxWithAi = { ...ctxResult.data, aiContextJson: aiCtx } as typeof ctxResult.data & {
        aiContextJson: Record<string, unknown>
    }

    const systemPrompt = buildMesocycleStrategySystemPrompt()
    const userPrompt = buildMesocycleStrategyUserPrompt(ctxWithAi)

    const aiResult = await generateStructuredResponse({
        systemPrompt,
        userPrompt,
        schema: MesocycleStrategySchema,
        maxTokens: 8192,
        temperature: 0.6,
    })

    if (!aiResult.success) {
        return { success: false, error: `Head coach failed: ${aiResult.error}` }
    }

    const strategy = aiResult.data

    // Persist strategy onto ai_context_json (preserve archetype/customCounts/carryover/mode)
    const { error: updateErr } = await supabase
        .from('mesocycles')
        .update({
            ai_context_json: {
                ...aiCtx,
                strategy,
            },
        })
        .eq('id', mesocycleId)
        .eq('user_id', user.id)

    if (updateErr) {
        return { success: false, error: `Strategy persist failed: ${updateErr.message}` }
    }

    revalidatePath('/data/blocks/new')
    return { success: true, data: strategy }
}
