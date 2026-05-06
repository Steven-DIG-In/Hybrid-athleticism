'use server'

/**
 * Mesocycle generation — single canonical action (Task 11 — engine refactor).
 *
 * Merged from two pre-refactor functions:
 *   - coaching.actions.generateMesocycleWithCoaches (outer shell:
 *     auth check, Supabase loads, persistence, audit logging)
 *   - orchestrator.generateMesocycleProgram (inner pipeline:
 *     head-coach strategy + per-domain-coach programs)
 *
 * Pipeline:
 *   Step 1: Head Coach → MesocycleStrategy (AI)
 *   Step 2: Domain Coaches → per-domain programs in parallel
 *           (config-driven loop via coachRegistry.programming)
 *   Step 3: Cross-domain observability check
 *   Step 4: Persist strategy + programs to mesocycles row
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { coachRegistry } from '@/lib/coaches'
import { generateStructuredResponse } from '@/lib/ai/client'
import { MesocycleStrategySchema } from '@/lib/ai/schemas/week-brief'
import {
    buildMesocycleStrategySystemPrompt,
    buildMesocycleStrategyUserPrompt,
} from '@/lib/ai/prompts/head-coach'
import {
    executeAssignedSkills,
    buildPreComputedAddendum,
} from '@/lib/engine/_shared/skill-execution'
import { buildDomainUserPromptArgs } from '@/lib/engine/_shared/domain-prompt-args'
import { extractWeekBrief } from '@/lib/engine/mesocycle/strategy'
import type { CoachDomain } from '@/lib/skills/types'
import type { ActionResult } from '@/lib/types/training.types'
import type { AthleteContextPacket } from '@/lib/types/coach-context'
import type { MethodologyContext } from '@/lib/ai/prompts/programming'
import type { EnduranceMethodologyContext } from '@/lib/ai/prompts/endurance-coach'
import type { MesocycleGenerationResult } from '@/lib/engine/types'

// Outer-shell helpers — relocated to engine/mesocycle/context.ts (Task 11).
import {
    buildAthleteContext,
    buildStrengthMethodologyContext,
    buildEnduranceMethodologyContext,
    buildVolumeTargetsString,
} from '@/lib/engine/mesocycle/context'

/**
 * Generate a full mesocycle program using the multi-agent coaching architecture.
 *
 * All 5 domain coaches run in parallel: Strength, Endurance, Hypertrophy,
 * Conditioning, Mobility. Stores strategy and programs on the mesocycle for
 * downstream use.
 */
export async function generateMesocycleProgram(
    mesocycleId: string
): Promise<ActionResult<MesocycleGenerationResult>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Build athlete context
    const ctxResult = await buildAthleteContext(user.id, mesocycleId, 1)
    if (!ctxResult.success) {
        return { success: false, error: ctxResult.error }
    }
    const ctx: AthleteContextPacket = ctxResult.data

    // Build methodology context for the Strength Coach
    const methodologyContext: MethodologyContext | undefined = await buildStrengthMethodologyContext(
        ctx.profile,
        ctx.benchmarks,
        1,
        ctx.totalWeeks,
        ctx.isDeload
    )

    // Build methodology context for the Endurance Coach
    const enduranceMethodologyContext: EnduranceMethodologyContext | undefined = buildEnduranceMethodologyContext(
        ctx.profile,
        ctx.benchmarks
    )

    // Build volume targets for the Hypertrophy Coach
    const volumeTargets: string | undefined = buildVolumeTargetsString(
        ctx.profile,
        1,
        ctx.totalWeeks,
        ctx.isDeload
    )

    // ─── Inlined Pipeline A: Mesocycle Generation ──────────────────────────
    // (Previously in orchestrator.generateMesocycleProgram)
    console.log('[engine/mesocycle] Pipeline A: Starting mesocycle generation')

    // ── Step 1: Head Coach — Mesocycle Strategy ────────────────────────────
    console.log('[engine/mesocycle] Step 1: Head Coach → MesocycleStrategy')

    const strategyResult = await generateStructuredResponse({
        systemPrompt: buildMesocycleStrategySystemPrompt(),
        userPrompt: buildMesocycleStrategyUserPrompt(ctx),
        schema: MesocycleStrategySchema,
        maxRetries: 2,
        maxTokens: 4096,
        temperature: 0.6,
    })

    if (!strategyResult.success) {
        console.error('[engine/mesocycle] Head Coach strategy failed:', strategyResult.error)
        return { success: false, error: `Head Coach strategy failed: ${strategyResult.error}` }
    }

    const strategy = strategyResult.data
    console.log(`[engine/mesocycle] Strategy: "${strategy.blockName}" — ${strategy.totalWeeks} weeks, deload week ${strategy.deloadWeek}`)

    // ── Step 2: Domain Coaches — Parallel program generation (config-driven) ─

    const pipelineResult: MesocycleGenerationResult = { strategy }
    const domainPromises: Array<Promise<void>> = []

    // Track shared skills already executed this cycle
    const executedSharedSkills = new Map<string, unknown>()

    // Build list of coaches to run:
    // 1. All coaches in the athlete's coaching team
    // 2. Always-active coaches (mobility, recovery) that are not already in the team
    const coachDomains = new Set<string>()
    for (const entry of ctx.coachingTeam) {
        coachDomains.add(entry.coach)
    }
    // Add always-active domain coaches (mobility is always active and generates programs)
    for (const coach of coachRegistry.getAlwaysActiveCoaches()) {
        if (coach.id !== 'recovery' && coachRegistry.getCoach(coach.id)?.programming) {
            coachDomains.add(coach.id)
        }
    }

    for (const domain of coachDomains) {
        const meta = coachRegistry.getCoach(domain as CoachDomain)?.programming
        if (!meta) continue

        const config = coachRegistry.getCoach(domain as CoachDomain)
        const brief = extractWeekBrief(strategy, domain, 1)

        if (!brief) {
            console.warn(`[engine/mesocycle] No ${domain} allocation in strategy — skipping ${meta.logLabel} Coach`)
            continue
        }

        console.log(`[engine/mesocycle] Step 2: ${meta.logLabel} Coach → multi-week program`)

        // Run assigned skills to pre-compute deterministic values
        const preComputed = config
            ? await executeAssignedSkills(config, ctx, strategy, executedSharedSkills)
            : new Map<string, unknown>()

        // Build prompt args specific to this domain
        const userPromptArgs = buildDomainUserPromptArgs(
            domain, ctx, brief, strategy,
            methodologyContext, enduranceMethodologyContext, volumeTargets
        )

        // Build user prompt and append pre-computed data
        const baseUserPrompt = meta.buildUserPrompt(...userPromptArgs)
        const preComputedAddendum = buildPreComputedAddendum(preComputed)
        const userPrompt = preComputedAddendum
            ? baseUserPrompt + preComputedAddendum
            : baseUserPrompt

        domainPromises.push(
            generateStructuredResponse({
                systemPrompt: meta.buildSystemPrompt(),
                userPrompt,
                schema: meta.schema,
                maxRetries: 2,
                maxTokens: meta.maxTokens,
                temperature: meta.temperature,
            }).then(r => {
                if (r.success) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ;(pipelineResult as unknown as Record<string, unknown>)[meta.resultKey] = r.data
                    console.log(`[engine/mesocycle] ${meta.logLabel} program: ${meta.logSummary(r.data)}`)
                } else {
                    console.error(`[engine/mesocycle] ${meta.logLabel} Coach program failed:`, r.error)
                }
            })
        )
    }

    // Run all domain coaches in parallel
    if (domainPromises.length > 0) {
        await Promise.all(domainPromises)
    }

    // Check if at least one domain coach produced a program
    const hasAnyProgram = pipelineResult.strengthProgram
        || pipelineResult.enduranceProgram
        || pipelineResult.hypertrophyProgram
        || pipelineResult.conditioningProgram
        || pipelineResult.mobilityProgram
    if (!hasAnyProgram) {
        return {
            success: false,
            error: 'No domain coaches produced a program. Check coaching team configuration.',
        }
    }

    // ── Step 3: Cross-Domain Check ──────────────────────────────────────────
    const programCount = [
        pipelineResult.strengthProgram && 'Strength',
        pipelineResult.enduranceProgram && 'Endurance',
        pipelineResult.hypertrophyProgram && 'Hypertrophy',
        pipelineResult.conditioningProgram && 'Conditioning',
        pipelineResult.mobilityProgram && 'Mobility',
    ].filter(Boolean)
    console.log(`[engine/mesocycle] Step 3: Cross-domain check — ${programCount.length} programs: ${programCount.join(', ')}`)

    if (pipelineResult.strengthProgram && pipelineResult.hypertrophyProgram) {
        console.log('[engine/mesocycle] Strength + Hypertrophy coexistence — verify no exercise duplication')
    }
    if (pipelineResult.strengthProgram && pipelineResult.enduranceProgram) {
        const s = pipelineResult.strengthProgram.weeks[0]?.sessions.length ?? 0
        const e = pipelineResult.enduranceProgram.weeks[0]?.sessions.length ?? 0
        console.log(`[engine/mesocycle] Week 1: ${s} strength + ${e} endurance sessions`)
    }

    console.log('[engine/mesocycle] Pipeline A complete')

    // ─── End inlined pipeline ──────────────────────────────────────────────

    // Persist strategy + all domain programs to mesocycle
    await supabase
        .from('mesocycles')
        .update({
            mesocycle_strategy: pipelineResult.strategy as unknown as Record<string, unknown>,
            strength_program: pipelineResult.strengthProgram
                ? (pipelineResult.strengthProgram as unknown as Record<string, unknown>)
                : null,
            endurance_program: pipelineResult.enduranceProgram
                ? (pipelineResult.enduranceProgram as unknown as Record<string, unknown>)
                : null,
            hypertrophy_program: pipelineResult.hypertrophyProgram
                ? (pipelineResult.hypertrophyProgram as unknown as Record<string, unknown>)
                : null,
            conditioning_program: pipelineResult.conditioningProgram
                ? (pipelineResult.conditioningProgram as unknown as Record<string, unknown>)
                : null,
            mobility_program: pipelineResult.mobilityProgram
                ? (pipelineResult.mobilityProgram as unknown as Record<string, unknown>)
                : null,
            ai_context_json: {
                orchestratorVersion: 'full',
                generatedAt: new Date().toISOString(),
                coachingTeam: ctx.coachingTeam,
            },
        })
        .eq('id', mesocycleId)
        .eq('user_id', user.id)

    revalidatePath('/dashboard')
    return { success: true, data: pipelineResult }
}
