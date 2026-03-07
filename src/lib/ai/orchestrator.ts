/**
 * Multi-Agent Coaching Orchestrator
 *
 * Central coordinator for the coaching staff architecture.
 * Two pipelines:
 *
 * Pipeline A — Mesocycle Generation (runs once per mesocycle):
 *   Step 1: Head Coach → MesocycleStrategy
 *   Step 2: Domain Coaches → multi-week programs (parallel)
 *   Step 3: (Future) Head Coach assembly + validation
 *
 * Pipeline B — Weekly Adjustment (runs every week):
 *   Step 1: Recovery Coach → GREEN / YELLOW / RED assessment
 *   Step 2: Decision Gate (TypeScript, no AI)
 *   Step 3: Head Coach → AdjustmentDirective (if YELLOW/RED)
 *   Step 4: Domain Coach → targeted modification (if YELLOW/RED)
 *
 * All 5 domain coaches: Strength, Endurance, Hypertrophy, Conditioning, Mobility.
 */

import { generateStructuredResponse } from './client'
import type { ActionResult } from '@/lib/types/training.types'
import type {
    AthleteContextPacket,
    CoachingTeamEntry,
    WeekBrief,
} from '@/lib/types/coach-context'
import type { MethodologyContext } from './prompts/programming'
import type { EnduranceMethodologyContext } from './prompts/endurance-coach'

// Schemas
import {
    MesocycleStrategySchema,
    RecoveryAssessmentSchema,
    AdjustmentDirectiveSchema,
    StrengthProgramSchema,
    EnduranceProgramSchema,
    HypertrophyProgramSchema,
    ConditioningProgramSchema,
    MobilityProgramSchema,
} from './schemas/week-brief'
import type {
    MesocycleStrategyValidated,
    RecoveryAssessmentValidated,
    AdjustmentDirectiveValidated,
    StrengthProgramValidated,
    EnduranceProgramValidated,
    HypertrophyProgramValidated,
    ConditioningProgramValidated,
    MobilityProgramValidated,
} from './schemas/week-brief'

// Prompts
import {
    buildMesocycleStrategySystemPrompt,
    buildMesocycleStrategyUserPrompt,
    buildAdjustmentDirectiveSystemPrompt,
    buildAdjustmentDirectiveUserPrompt,
} from './prompts/head-coach'
import {
    buildStrengthProgramSystemPrompt,
    buildStrengthProgramUserPrompt,
    buildStrengthModificationSystemPrompt,
    buildStrengthModificationUserPrompt,
} from './prompts/strength-coach'
import {
    buildEnduranceProgramSystemPrompt,
    buildEnduranceProgramUserPrompt,
    buildEnduranceModificationSystemPrompt,
    buildEnduranceModificationUserPrompt,
} from './prompts/endurance-coach'
import {
    buildHypertrophyProgramSystemPrompt,
    buildHypertrophyProgramUserPrompt,
    buildHypertrophyModificationSystemPrompt,
    buildHypertrophyModificationUserPrompt,
} from './prompts/hypertrophy-coach'
import {
    buildConditioningProgramSystemPrompt,
    buildConditioningProgramUserPrompt,
    buildConditioningModificationSystemPrompt,
    buildConditioningModificationUserPrompt,
} from './prompts/conditioning-coach'
import {
    buildMobilityProgramSystemPrompt,
    buildMobilityProgramUserPrompt,
    buildMobilityModificationSystemPrompt,
    buildMobilityModificationUserPrompt,
} from './prompts/mobility-coach'
import {
    buildRecoveryAssessmentSystemPrompt,
    buildRecoveryAssessmentUserPrompt,
} from './prompts/recovery-coach'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MesocycleGenerationResult {
    strategy: MesocycleStrategyValidated
    strengthProgram?: StrengthProgramValidated
    enduranceProgram?: EnduranceProgramValidated
    hypertrophyProgram?: HypertrophyProgramValidated
    conditioningProgram?: ConditioningProgramValidated
    mobilityProgram?: MobilityProgramValidated
}

export interface WeeklyAdjustmentResult {
    recovery: RecoveryAssessmentValidated
    directive?: AdjustmentDirectiveValidated
    modifiedStrengthSessions?: StrengthProgramValidated
    modifiedEnduranceSessions?: EnduranceProgramValidated
    modifiedHypertrophySessions?: HypertrophyProgramValidated
    modifiedConditioningSessions?: ConditioningProgramValidated
    modifiedMobilitySessions?: MobilityProgramValidated
    // If GREEN, directive and modified sessions are undefined — serve pre-programmed sessions
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the WeekBrief for a specific domain coach from the MesocycleStrategy.
 * This slices the strategy into a per-coach mandate for a specific week.
 */
export function extractWeekBrief(
    strategy: MesocycleStrategyValidated,
    coachType: string,
    weekNumber: number
): WeekBrief | null {
    const allocation = strategy.domainAllocations.find(d => d.coach === coachType)
    if (!allocation) return null

    const weekEmphasis = strategy.weeklyEmphasis.find(w => w.weekNumber === weekNumber)
    if (!weekEmphasis) return null

    const otherDomains = strategy.domainAllocations
        .filter(d => d.coach !== coachType)
        .map(d => ({
            domain: d.coach,
            sessionCount: d.sessionsPerWeek,
            loadBudget: d.loadBudgetPerSession,
        }))

    return {
        weekNumber,
        isDeload: weekEmphasis.isDeload,
        weekEmphasis: weekEmphasis.emphasis,
        volumePercent: weekEmphasis.volumePercent,
        sessionsToGenerate: allocation.sessionsPerWeek,
        loadBudget: allocation.loadBudgetPerSession,
        constraints: allocation.constraints,
        methodologyDirective: allocation.methodologyDirective,
        otherDomainsThisWeek: otherDomains,
    }
}

/**
 * Check if a coaching team includes a specific coach type.
 */
function hasCoach(team: CoachingTeamEntry[], type: string): boolean {
    return team.some(t => t.coach === type)
}

// ─── Pipeline A: Mesocycle Generation ───────────────────────────────────────

/**
 * Pipeline A — Full mesocycle program generation.
 *
 * Called at:
 * - New mesocycle creation
 * - Athlete changes coaching team
 * - Manual re-generation
 *
 * All 5 domain coaches run in parallel: Strength, Endurance, Hypertrophy,
 * Conditioning, Mobility.
 */
export async function generateMesocycleProgram(
    ctx: AthleteContextPacket,
    methodologyContext?: MethodologyContext,
    enduranceMethodologyContext?: EnduranceMethodologyContext,
    volumeTargets?: string
): Promise<ActionResult<MesocycleGenerationResult>> {
    console.log('[orchestrator] Pipeline A: Starting mesocycle generation')

    // ── Step 1: Head Coach — Mesocycle Strategy ────────────────────────────
    console.log('[orchestrator] Step 1: Head Coach → MesocycleStrategy')

    const strategyResult = await generateStructuredResponse({
        systemPrompt: buildMesocycleStrategySystemPrompt(),
        userPrompt: buildMesocycleStrategyUserPrompt(ctx),
        schema: MesocycleStrategySchema,
        maxRetries: 2,
        maxTokens: 4096,
        temperature: 0.6,
    })

    if (!strategyResult.success) {
        console.error('[orchestrator] Head Coach strategy failed:', strategyResult.error)
        return { success: false, error: `Head Coach strategy failed: ${strategyResult.error}` }
    }

    const strategy = strategyResult.data
    console.log(`[orchestrator] Strategy: "${strategy.blockName}" — ${strategy.totalWeeks} weeks, deload week ${strategy.deloadWeek}`)

    // ── Step 2: Domain Coaches — Parallel program generation ───────────────
    // All 5 domain coaches run in parallel via Promise.all.

    const result: MesocycleGenerationResult = { strategy }
    const domainPromises: Array<Promise<void>> = []

    // ── Strength Coach ──────────────────────────────────────────────────────
    if (hasCoach(ctx.coachingTeam, 'strength')) {
        const strengthBrief = extractWeekBrief(strategy, 'strength', 1)
        if (strengthBrief) {
            console.log('[orchestrator] Step 2: Strength Coach → multi-week program')
            domainPromises.push(
                generateStructuredResponse({
                    systemPrompt: buildStrengthProgramSystemPrompt(),
                    userPrompt: buildStrengthProgramUserPrompt(
                        ctx,
                        strengthBrief,
                        methodologyContext,
                        strategy.totalWeeks,
                        hasCoach(ctx.coachingTeam, 'hypertrophy')
                    ),
                    schema: StrengthProgramSchema,
                    maxRetries: 2,
                    maxTokens: 8192,
                    temperature: 0.7,
                }).then(r => {
                    if (r.success) {
                        result.strengthProgram = r.data
                        console.log(`[orchestrator] Strength program: ${r.data.splitDesign}, ${r.data.weeks.length} weeks`)
                    } else {
                        console.error('[orchestrator] Strength Coach program failed:', r.error)
                    }
                })
            )
        } else {
            console.warn('[orchestrator] No strength allocation in strategy — skipping Strength Coach')
        }
    }

    // ── Endurance Coach ─────────────────────────────────────────────────────
    if (hasCoach(ctx.coachingTeam, 'endurance')) {
        const enduranceBrief = extractWeekBrief(strategy, 'endurance', 1)
        if (enduranceBrief) {
            console.log('[orchestrator] Step 2: Endurance Coach → multi-week program')
            domainPromises.push(
                generateStructuredResponse({
                    systemPrompt: buildEnduranceProgramSystemPrompt(),
                    userPrompt: buildEnduranceProgramUserPrompt(
                        ctx,
                        enduranceBrief,
                        enduranceMethodologyContext,
                        strategy.totalWeeks
                    ),
                    schema: EnduranceProgramSchema,
                    maxRetries: 2,
                    maxTokens: 8192,
                    temperature: 0.7,
                }).then(r => {
                    if (r.success) {
                        result.enduranceProgram = r.data
                        console.log(`[orchestrator] Endurance program: ${r.data.modalitySummary}, ${r.data.weeks.length} weeks`)
                    } else {
                        console.error('[orchestrator] Endurance Coach program failed:', r.error)
                    }
                })
            )
        } else {
            console.warn('[orchestrator] No endurance allocation in strategy — skipping Endurance Coach')
        }
    }

    // ── Hypertrophy Coach ───────────────────────────────────────────────────
    if (hasCoach(ctx.coachingTeam, 'hypertrophy')) {
        const hypertrophyBrief = extractWeekBrief(strategy, 'hypertrophy', 1)
        if (hypertrophyBrief) {
            console.log('[orchestrator] Step 2: Hypertrophy Coach → multi-week program')
            domainPromises.push(
                generateStructuredResponse({
                    systemPrompt: buildHypertrophyProgramSystemPrompt(),
                    userPrompt: buildHypertrophyProgramUserPrompt(
                        ctx,
                        hypertrophyBrief,
                        volumeTargets,
                        strategy.totalWeeks,
                        hasCoach(ctx.coachingTeam, 'strength')
                    ),
                    schema: HypertrophyProgramSchema,
                    maxRetries: 2,
                    maxTokens: 8192,
                    temperature: 0.7,
                }).then(r => {
                    if (r.success) {
                        result.hypertrophyProgram = r.data
                        console.log(`[orchestrator] Hypertrophy program: ${r.data.splitDesign}, ${r.data.weeks.length} weeks`)
                    } else {
                        console.error('[orchestrator] Hypertrophy Coach program failed:', r.error)
                    }
                })
            )
        } else {
            console.warn('[orchestrator] No hypertrophy allocation in strategy — skipping Hypertrophy Coach')
        }
    }

    // ── Conditioning Coach ──────────────────────────────────────────────────
    if (hasCoach(ctx.coachingTeam, 'conditioning')) {
        const conditioningBrief = extractWeekBrief(strategy, 'conditioning', 1)
        if (conditioningBrief) {
            console.log('[orchestrator] Step 2: Conditioning Coach → multi-week program')
            domainPromises.push(
                generateStructuredResponse({
                    systemPrompt: buildConditioningProgramSystemPrompt(),
                    userPrompt: buildConditioningProgramUserPrompt(
                        ctx,
                        conditioningBrief,
                        strategy.totalWeeks
                    ),
                    schema: ConditioningProgramSchema,
                    maxRetries: 2,
                    maxTokens: 8192,
                    temperature: 0.8, // Higher creativity for conditioning
                }).then(r => {
                    if (r.success) {
                        result.conditioningProgram = r.data
                        console.log(`[orchestrator] Conditioning program: ${r.data.methodologyUsed}, ${r.data.weeks.length} weeks`)
                    } else {
                        console.error('[orchestrator] Conditioning Coach program failed:', r.error)
                    }
                })
            )
        } else {
            console.warn('[orchestrator] No conditioning allocation in strategy — skipping Conditioning Coach')
        }
    }

    // ── Mobility Coach (always active) ──────────────────────────────────────
    const mobilityBrief = extractWeekBrief(strategy, 'mobility', 1)
    if (mobilityBrief) {
        console.log('[orchestrator] Step 2: Mobility Coach → multi-week program')

        // Build list of all other domain sessions for primer generation
        const allDomainSessions: Array<{ coach: string; sessionName: string }> = []
        for (const allocation of strategy.domainAllocations) {
            if (allocation.coach !== 'mobility') {
                for (let i = 0; i < allocation.sessionsPerWeek; i++) {
                    allDomainSessions.push({
                        coach: allocation.coach,
                        sessionName: `${allocation.coach} session ${i + 1}`,
                    })
                }
            }
        }

        domainPromises.push(
            generateStructuredResponse({
                systemPrompt: buildMobilityProgramSystemPrompt(),
                userPrompt: buildMobilityProgramUserPrompt(
                    ctx,
                    mobilityBrief,
                    strategy.totalWeeks,
                    allDomainSessions
                ),
                schema: MobilityProgramSchema,
                maxRetries: 2,
                maxTokens: 8192,
                temperature: 0.6,
            }).then(r => {
                if (r.success) {
                    result.mobilityProgram = r.data
                    console.log(`[orchestrator] Mobility program: ${r.data.methodologyUsed}, ${r.data.weeks.length} weeks`)
                } else {
                    console.error('[orchestrator] Mobility Coach program failed:', r.error)
                }
            })
        )
    } else {
        console.warn('[orchestrator] No mobility allocation in strategy — skipping Mobility Coach')
    }

    // Run all domain coaches in parallel
    if (domainPromises.length > 0) {
        await Promise.all(domainPromises)
    }

    // Check if at least one domain coach produced a program
    const hasAnyProgram = result.strengthProgram
        || result.enduranceProgram
        || result.hypertrophyProgram
        || result.conditioningProgram
        || result.mobilityProgram
    if (!hasAnyProgram) {
        return {
            success: false,
            error: 'No domain coaches produced a program. Check coaching team configuration.',
        }
    }

    // ── Step 3: Cross-Domain Check ──────────────────────────────────────────
    // Log domain interactions for observability.
    // Future: full AI-driven assembly and validation.
    const programCount = [
        result.strengthProgram && 'Strength',
        result.enduranceProgram && 'Endurance',
        result.hypertrophyProgram && 'Hypertrophy',
        result.conditioningProgram && 'Conditioning',
        result.mobilityProgram && 'Mobility',
    ].filter(Boolean)
    console.log(`[orchestrator] Step 3: Cross-domain check — ${programCount.length} programs: ${programCount.join(', ')}`)

    if (result.strengthProgram && result.hypertrophyProgram) {
        console.log('[orchestrator] Strength + Hypertrophy coexistence — verify no exercise duplication')
    }
    if (result.strengthProgram && result.enduranceProgram) {
        const s = result.strengthProgram.weeks[0]?.sessions.length ?? 0
        const e = result.enduranceProgram.weeks[0]?.sessions.length ?? 0
        console.log(`[orchestrator] Week 1: ${s} strength + ${e} endurance sessions`)
    }

    console.log('[orchestrator] Pipeline A complete')
    return { success: true, data: result }
}

// ─── Pipeline B: Weekly Adjustment ──────────────────────────────────────────

/**
 * Pipeline B — Weekly check-in and adjustment.
 *
 * Called every week after the athlete completes training.
 * Most weeks: Recovery Coach returns GREEN → serve pre-programmed sessions.
 * YELLOW/RED: Head Coach issues directive → affected coaches modify sessions.
 */
export async function runWeeklyAdjustment(
    ctx: AthleteContextPacket,
    muscleGroupVolumes?: Array<{
        muscleGroup: string
        setsThisWeek: number
        targetSets: number
        totalTonnageKg: number
        avgRIR: number | null
    }>,
    nextWeekSessions?: Array<{
        coach: string
        sessionName: string
        exercises?: string[]
    }>
): Promise<ActionResult<WeeklyAdjustmentResult>> {
    console.log(`[orchestrator] Pipeline B: Weekly adjustment for week ${ctx.weekNumber}`)

    // ── Step 1: Recovery Coach — Assessment ────────────────────────────────
    console.log('[orchestrator] Step 1: Recovery Coach → assessment')

    const recoveryResult = await generateStructuredResponse({
        systemPrompt: buildRecoveryAssessmentSystemPrompt(),
        userPrompt: buildRecoveryAssessmentUserPrompt(ctx, muscleGroupVolumes),
        schema: RecoveryAssessmentSchema,
        maxRetries: 2,
        maxTokens: 2048,
        temperature: 0.3, // Low creativity — this is analytical
    })

    if (!recoveryResult.success) {
        console.error('[orchestrator] Recovery Coach failed:', recoveryResult.error)
        return { success: false, error: `Recovery Coach assessment failed: ${recoveryResult.error}` }
    }

    const recovery = recoveryResult.data
    console.log(`[orchestrator] Recovery status: ${recovery.status} — triggerDeload: ${recovery.triggerDeload}`)

    // ── Step 2: Decision Gate (TypeScript, no AI) ──────────────────────────

    if (recovery.status === 'GREEN') {
        console.log('[orchestrator] GREEN — no adjustments needed, serve pre-programmed sessions')
        return {
            success: true,
            data: { recovery },
        }
    }

    console.log(`[orchestrator] ${recovery.status} — proceeding to adjustment pipeline`)

    // ── Step 3: Head Coach — Adjustment Directive ──────────────────────────
    console.log('[orchestrator] Step 3: Head Coach → AdjustmentDirective')

    if (!nextWeekSessions || nextWeekSessions.length === 0) {
        console.warn('[orchestrator] No next week sessions provided — cannot issue directive')
        return {
            success: true,
            data: { recovery },
        }
    }

    const directiveResult = await generateStructuredResponse({
        systemPrompt: buildAdjustmentDirectiveSystemPrompt(),
        userPrompt: buildAdjustmentDirectiveUserPrompt(
            recovery,
            nextWeekSessions,
            ctx.coachingTeam,
            ctx.weekNumber + 1
        ),
        schema: AdjustmentDirectiveSchema,
        maxRetries: 2,
        maxTokens: 2048,
        temperature: 0.4,
    })

    if (!directiveResult.success) {
        console.error('[orchestrator] Head Coach directive failed:', directiveResult.error)
        // Return the recovery assessment anyway — the UI can show the status
        return {
            success: true,
            data: { recovery },
        }
    }

    const directive = directiveResult.data
    console.log(`[orchestrator] Directive issued for week ${directive.weekNumber}: ${directive.coachDirectives.length} coach orders`)

    // ── Step 4: Affected Domain Coaches — Targeted Modification ────────────
    // Only coaches with non-"no_change" directives are called.

    const result: WeeklyAdjustmentResult = { recovery, directive }
    const modPromises: Array<Promise<void>> = []

    // ── Strength modification ──────────────────────────────────────────────
    const strengthOrder = directive.coachDirectives.find(d => d.coach === 'strength')
    if (strengthOrder && strengthOrder.action !== 'no_change') {
        console.log(`[orchestrator] Step 4: Strength Coach → modify (${strengthOrder.action})`)
        const strengthSessions = nextWeekSessions
            .filter(s => s.coach === 'strength')
            .map(s => ({
                name: s.sessionName,
                exercises: (s.exercises ?? []).map(e => ({
                    exerciseName: e,
                    sets: 0,
                    targetReps: 0,
                    targetWeightKg: null as number | null,
                    targetRir: 2,
                })),
            }))

        if (strengthSessions.length > 0) {
            modPromises.push(
                generateStructuredResponse({
                    systemPrompt: buildStrengthModificationSystemPrompt(),
                    userPrompt: buildStrengthModificationUserPrompt(
                        strengthOrder.instructions,
                        strengthSessions,
                        ctx.weekNumber + 1
                    ),
                    schema: StrengthProgramSchema,
                    maxRetries: 2,
                    maxTokens: 4096,
                    temperature: 0.4,
                }).then(r => {
                    if (r.success) {
                        result.modifiedStrengthSessions = r.data
                        console.log('[orchestrator] Strength sessions modified successfully')
                    } else {
                        console.error('[orchestrator] Strength modification failed:', r.error)
                    }
                })
            )
        }
    }

    // ── Endurance modification ─────────────────────────────────────────────
    const enduranceOrder = directive.coachDirectives.find(d => d.coach === 'endurance')
    if (enduranceOrder && enduranceOrder.action !== 'no_change') {
        console.log(`[orchestrator] Step 4: Endurance Coach → modify (${enduranceOrder.action})`)
        const enduranceSessions = nextWeekSessions
            .filter(s => s.coach === 'endurance')
            .map(s => ({
                name: s.sessionName,
                enduranceModality: 'running' as const,
                intensityZone: 'zone_2' as const,
                targetDistanceKm: null as number | null,
                estimatedDurationMinutes: 0,
            }))

        if (enduranceSessions.length > 0) {
            modPromises.push(
                generateStructuredResponse({
                    systemPrompt: buildEnduranceModificationSystemPrompt(),
                    userPrompt: buildEnduranceModificationUserPrompt(
                        enduranceOrder.instructions,
                        enduranceSessions,
                        ctx.weekNumber + 1
                    ),
                    schema: EnduranceProgramSchema,
                    maxRetries: 2,
                    maxTokens: 4096,
                    temperature: 0.4,
                }).then(r => {
                    if (r.success) {
                        result.modifiedEnduranceSessions = r.data
                        console.log('[orchestrator] Endurance sessions modified successfully')
                    } else {
                        console.error('[orchestrator] Endurance modification failed:', r.error)
                    }
                })
            )
        }
    }

    // ── Hypertrophy modification ───────────────────────────────────────────
    const hypertrophyOrder = directive.coachDirectives.find(d => d.coach === 'hypertrophy')
    if (hypertrophyOrder && hypertrophyOrder.action !== 'no_change') {
        console.log(`[orchestrator] Step 4: Hypertrophy Coach → modify (${hypertrophyOrder.action})`)
        const hypertrophySessions = nextWeekSessions
            .filter(s => s.coach === 'hypertrophy')
            .map(s => ({
                name: s.sessionName,
                muscleGroupFocus: [] as string[],
                exercises: (s.exercises ?? []).map(e => ({
                    exerciseName: e,
                    sets: 0,
                    targetReps: 0,
                    targetWeightKg: null as number | null,
                    targetRir: 2,
                })),
            }))

        if (hypertrophySessions.length > 0) {
            modPromises.push(
                generateStructuredResponse({
                    systemPrompt: buildHypertrophyModificationSystemPrompt(),
                    userPrompt: buildHypertrophyModificationUserPrompt(
                        hypertrophyOrder.instructions,
                        hypertrophySessions,
                        ctx.weekNumber + 1
                    ),
                    schema: HypertrophyProgramSchema,
                    maxRetries: 2,
                    maxTokens: 4096,
                    temperature: 0.4,
                }).then(r => {
                    if (r.success) {
                        result.modifiedHypertrophySessions = r.data
                        console.log('[orchestrator] Hypertrophy sessions modified successfully')
                    } else {
                        console.error('[orchestrator] Hypertrophy modification failed:', r.error)
                    }
                })
            )
        }
    }

    // ── Conditioning modification ──────────────────────────────────────────
    const conditioningOrder = directive.coachDirectives.find(d => d.coach === 'conditioning')
    if (conditioningOrder && conditioningOrder.action !== 'no_change') {
        console.log(`[orchestrator] Step 4: Conditioning Coach → modify (${conditioningOrder.action})`)
        const conditioningSessions = nextWeekSessions
            .filter(s => s.coach === 'conditioning')
            .map(s => ({
                name: s.sessionName,
                conditioningType: 'metcon' as const,
                targetIntensity: 'moderate' as const,
                estimatedDurationMinutes: 0,
            }))

        if (conditioningSessions.length > 0) {
            modPromises.push(
                generateStructuredResponse({
                    systemPrompt: buildConditioningModificationSystemPrompt(),
                    userPrompt: buildConditioningModificationUserPrompt(
                        conditioningOrder.instructions,
                        conditioningSessions,
                        ctx.weekNumber + 1
                    ),
                    schema: ConditioningProgramSchema,
                    maxRetries: 2,
                    maxTokens: 4096,
                    temperature: 0.4,
                }).then(r => {
                    if (r.success) {
                        result.modifiedConditioningSessions = r.data
                        console.log('[orchestrator] Conditioning sessions modified successfully')
                    } else {
                        console.error('[orchestrator] Conditioning modification failed:', r.error)
                    }
                })
            )
        }
    }

    // ── Mobility modification ──────────────────────────────────────────────
    const mobilityOrder = directive.coachDirectives.find(d => d.coach === 'mobility')
    if (mobilityOrder && mobilityOrder.action !== 'no_change') {
        console.log(`[orchestrator] Step 4: Mobility Coach → modify (${mobilityOrder.action})`)
        const mobilitySessions = nextWeekSessions
            .filter(s => s.coach === 'mobility')
            .map(s => ({
                name: s.sessionName,
                focusAreas: [] as string[],
                estimatedDurationMinutes: 0,
            }))

        if (mobilitySessions.length > 0) {
            modPromises.push(
                generateStructuredResponse({
                    systemPrompt: buildMobilityModificationSystemPrompt(),
                    userPrompt: buildMobilityModificationUserPrompt(
                        mobilityOrder.instructions,
                        mobilitySessions,
                        ctx.weekNumber + 1
                    ),
                    schema: MobilityProgramSchema,
                    maxRetries: 2,
                    maxTokens: 4096,
                    temperature: 0.4,
                }).then(r => {
                    if (r.success) {
                        result.modifiedMobilitySessions = r.data
                        console.log('[orchestrator] Mobility sessions modified successfully')
                    } else {
                        console.error('[orchestrator] Mobility modification failed:', r.error)
                    }
                })
            )
        }
    }

    // Run all modifications in parallel
    if (modPromises.length > 0) {
        await Promise.all(modPromises)
    }

    console.log('[orchestrator] Pipeline B complete')
    return { success: true, data: result }
}
