'use server'

/**
 * Agent activity logging — INTERNAL to server actions.
 *
 * `logDecision` writes a row to `agent_activity` describing an agent's
 * prescription-affecting or user-facing decision. Called by other server
 * actions (recalibration, intervention-firing) — never directly from
 * components. Throws on auth/DB errors rather than returning ActionResult.
 *
 * Phase 2 writes only two decision types: 'recalibration' and
 * 'intervention_fired'. Phase 3 will extend the CHECK constraint and this
 * union to include more types.
 */

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database.types'

type AgentActivity = Database['public']['Tables']['agent_activity']['Row']

export type AgentCoach =
    | 'strength'
    | 'hypertrophy'
    | 'endurance'
    | 'conditioning'
    | 'mobility'
    | 'recovery'
    | 'head'

export type AgentDecisionType = 'recalibration' | 'intervention_fired'

export interface LogDecisionInput {
    coach: AgentCoach
    decisionType: AgentDecisionType
    targetEntity: Record<string, unknown>
    reasoningStructured: Record<string, unknown>
    reasoningText: string
    mesocycleId?: string | null
    weekNumber?: number | null
}

export async function logDecision(input: LogDecisionInput): Promise<AgentActivity> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const { data, error } = await supabase
        .from('agent_activity')
        .insert({
            user_id: user.id,
            coach: input.coach,
            decision_type: input.decisionType,
            target_entity: input.targetEntity,
            reasoning_structured: input.reasoningStructured,
            reasoning_text: input.reasoningText,
            mesocycle_id: input.mesocycleId ?? null,
            week_number: input.weekNumber ?? null
        })
        .select()
        .single()
    if (error) throw error
    return data
}
