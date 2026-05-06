/**
 * Multi-Agent Coaching Orchestrator (Config-Driven)
 *
 * Central coordinator for the coaching staff architecture.
 * Two pipelines:
 *
 * Pipeline A — Mesocycle Generation (runs once per mesocycle):
 *   Step 1: Head Coach → MesocycleStrategy
 *   Step 2: Domain Coaches → multi-week programs (parallel, config-driven loop)
 *   Step 3: (Future) Head Coach assembly + validation
 *
 * Pipeline B — Weekly Adjustment (runs every week):
 *   Step 1: Recovery Scorer Skill → GREEN / YELLOW / RED (deterministic)
 *   Step 2: Decision Gate (TypeScript, no AI)
 *   Step 3: Head Coach → AdjustmentDirective (if YELLOW/RED)
 *   Step 4: Affected Domain Coaches → targeted modification (generic loop)
 *
 * All 5 domain coaches: Strength, Endurance, Hypertrophy, Conditioning, Mobility.
 *
 * The orchestrator reads coach configs from coachRegistry and executes
 * assigned skills before each AI call, injecting pre-computed data into prompts.
 */

import { generateStructuredResponse } from './client'
import { coachRegistry } from '@/lib/coaches'
import type { CoachDomain } from '@/lib/skills/types'
import type { ActionResult } from '@/lib/types/training.types'
import type {
    AthleteContextPacket,
    WeekBrief,
} from '@/lib/types/coach-context'
import type { MethodologyContext } from './prompts/programming'
import type { EnduranceMethodologyContext } from './prompts/endurance-coach'

// Relocated shared helpers (Task 10 — engine refactor)
import {
    executeAssignedSkills,
    buildPreComputedAddendum,
} from '@/lib/engine/_shared/skill-execution'
import {
    buildDomainUserPromptArgs,
    buildModSessions,
} from '@/lib/engine/_shared/domain-prompt-args'

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

// Prompts — existing prompt builders (backward compat)
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

// Recovery scorer skill (replaces AI-driven recovery assessment)
import { recoveryScorerSkill } from '@/lib/skills/domains/recovery/recovery-scorer'

import type {
    MesocycleGenerationResult,
    WeeklyAdjustmentResult,
} from '@/lib/engine/types'

export type { MesocycleGenerationResult, WeeklyAdjustmentResult } from '@/lib/engine/types'

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

// hasCoach, buildSkillInput, executeAssignedSkills, buildPreComputedAddendum,
// buildDomainUserPromptArgs, and buildModSessions were relocated to
// `@/lib/engine/_shared/{skill-execution,domain-prompt-args}.ts` in Task 10
// of the engine refactor.

// ─── Pipeline A: Mesocycle Generation ───────────────────────────────────────

/**
 * Pipeline A — Full mesocycle program generation.
 *
 * Called at:
 * - New mesocycle creation
 * - Athlete changes coaching team
 * - Manual re-generation
 *
 * Step 1: Head Coach generates strategy (AI, unchanged).
 * Step 2: Generic loop over coaching team — run assigned skills, then AI.
 * Step 3: Cross-domain observability check.
 */
export async function generateMesocycleProgram(
    ctx: AthleteContextPacket,
    methodologyContext?: MethodologyContext,
    enduranceMethodologyContext?: EnduranceMethodologyContext,
    volumeTargets?: string
): Promise<ActionResult<MesocycleGenerationResult>> {
    console.log('[orchestrator] Pipeline A: Starting mesocycle generation')

    // ── Step 1: Head Coach — Mesocycle Strategy ────────────────────────────
    // This step stays AS-IS — it is AI-only, no skills involved.
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

    // ── Step 2: Domain Coaches — Parallel program generation (config-driven) ─

    const result: MesocycleGenerationResult = { strategy }
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
            console.warn(`[orchestrator] No ${domain} allocation in strategy — skipping ${meta.logLabel} Coach`)
            continue
        }

        console.log(`[orchestrator] Step 2: ${meta.logLabel} Coach → multi-week program`)

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
                    ;(result as unknown as Record<string, unknown>)[meta.resultKey] = r.data
                    console.log(`[orchestrator] ${meta.logLabel} program: ${meta.logSummary(r.data)}`)
                } else {
                    console.error(`[orchestrator] ${meta.logLabel} Coach program failed:`, r.error)
                }
            })
        )
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
 * Step 1: Recovery Scorer Skill (deterministic, no AI).
 * Step 2: Decision Gate.
 * Step 3: Head Coach → AdjustmentDirective (if YELLOW/RED).
 * Step 4: Generic loop over affected domain coaches (config-driven).
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

    // ── Step 1: Recovery Scorer Skill — Deterministic Assessment ─────────
    // Replaces the AI-driven Recovery Coach call with the recovery-scorer skill.
    console.log('[orchestrator] Step 1: Recovery Scorer Skill → deterministic assessment')

    // Compute aggregate signals from previous week sessions
    const allRir: number[] = []
    const rpeSpikes: string[] = []
    let missedSessions = 0
    let completedSessions = 0
    let totalSessions = 0

    ctx.previousWeekSessions?.forEach(s => {
        totalSessions++
        if (s.isCompleted) {
            completedSessions++
        } else {
            missedSessions++
        }
        s.exercises?.forEach(e => {
            if (e.rirActual !== null && e.targetReps > 0) {
                const prescribedRir = ctx.targetRir ?? 2
                allRir.push(e.rirActual - prescribedRir)
            }
            if (e.rpeActual !== null && e.rpeActual >= 9.5) {
                rpeSpikes.push(`${e.exerciseName} (RPE ${e.rpeActual})`)
            }
        })
    })

    const avgRirDeviation = allRir.length > 0
        ? allRir.reduce((sum, v) => sum + v, 0) / allRir.length
        : 0
    const avgRpeDeviation = 0 // Approximation: we use RIR as the primary signal
    const completionRate = totalSessions > 0 ? completedSessions / totalSessions : 1

    // Get signal weights from the Recovery Coach config
    const recoveryConfig = coachRegistry.getCoach('recovery')
    const signalWeights = recoveryConfig?.checkIn.signalWeights ?? {
        rpeDeviation: 0.9,
        rirDeviation: 0.95,
        completionRate: 0.85,
        earlyCompletion: 0.7,
        missedSessions: 0.9,
        selfReportEnergy: 0.8,
        selfReportSoreness: 0.85,
        selfReportSleep: 0.8,
        selfReportStress: 0.75,
        selfReportMotivation: 0.7,
    }

    // Execute the recovery scorer skill
    let recoveryScore: { score: number; status: 'GREEN' | 'YELLOW' | 'RED'; signals: Record<string, number> }
    try {
        recoveryScore = recoveryScorerSkill.execute({
            avgRpeDeviation,
            avgRirDeviation,
            completionRate,
            missedSessions,
            earlyCompletion: false, // Default — would come from session data
            selfReport: {
                sleepQuality: 3,    // Default mid-range — would come from athlete check-in
                energyLevel: 3,
                stressLevel: 3,
                motivation: 3,
                avgSoreness: 3,
            },
            signalWeights,
        })
    } catch (err) {
        console.error('[orchestrator] Recovery Scorer Skill failed, falling back to AI:', err)
        // Fallback to AI-driven recovery assessment
        const { buildRecoveryAssessmentSystemPrompt, buildRecoveryAssessmentUserPrompt } = await import('./prompts/recovery-coach')
        const recoveryResult = await generateStructuredResponse({
            systemPrompt: buildRecoveryAssessmentSystemPrompt(),
            userPrompt: buildRecoveryAssessmentUserPrompt(ctx, muscleGroupVolumes),
            schema: RecoveryAssessmentSchema,
            maxRetries: 2,
            maxTokens: 2048,
            temperature: 0.3,
        })
        if (!recoveryResult.success) {
            return { success: false, error: `Recovery assessment failed: ${recoveryResult.error}` }
        }
        const recovery = recoveryResult.data
        console.log(`[orchestrator] Recovery status (AI fallback): ${recovery.status}`)

        if (recovery.status === 'GREEN') {
            return { success: true, data: { recovery } }
        }

        // Continue to Step 3 with AI-assessed recovery
        return await runAdjustmentPipeline(ctx, recovery, nextWeekSessions)
    }

    console.log(`[orchestrator] Recovery score: ${recoveryScore.score} → ${recoveryScore.status}`)

    // Build a RecoveryAssessmentValidated from the skill output
    const recovery: RecoveryAssessmentValidated = {
        status: recoveryScore.status,
        rationale: `Deterministic recovery score: ${recoveryScore.score}. ` +
            `Avg RIR deviation: ${avgRirDeviation.toFixed(2)}, ` +
            `completion rate: ${(completionRate * 100).toFixed(0)}%, ` +
            `missed sessions: ${missedSessions}, ` +
            `RPE spikes: ${rpeSpikes.length}.`,
        signals: {
            avgRirDeviation,
            rpeSpikes,
            missedSessions,
            completionRate,
            hadHighFatigueEvent: false, // Would come from external load data
        },
        triggerDeload: recoveryScore.status === 'RED' && (
            (avgRirDeviation < -1.5 && rpeSpikes.length >= 2) ||
            missedSessions >= 3
        ),
    }

    // ── Step 2: Decision Gate (TypeScript, no AI) ──────────────────────────

    if (recovery.status === 'GREEN') {
        console.log('[orchestrator] GREEN — no adjustments needed, serve pre-programmed sessions')
        return {
            success: true,
            data: { recovery },
        }
    }

    console.log(`[orchestrator] ${recovery.status} — proceeding to adjustment pipeline`)

    return await runAdjustmentPipeline(ctx, recovery, nextWeekSessions)
}

/**
 * Steps 3-4 of Pipeline B: Head Coach directive + domain coach modifications.
 * Extracted so it can be called from both the skill-driven and fallback paths.
 */
async function runAdjustmentPipeline(
    ctx: AthleteContextPacket,
    recovery: RecoveryAssessmentValidated,
    nextWeekSessions: Array<{ coach: string; sessionName: string; exercises?: string[] }> | undefined,
): Promise<ActionResult<WeeklyAdjustmentResult>> {

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
        return {
            success: true,
            data: { recovery },
        }
    }

    const directive = directiveResult.data
    console.log(`[orchestrator] Directive issued for week ${directive.weekNumber}: ${directive.coachDirectives.length} coach orders`)

    // ── Step 4: Affected Domain Coaches — Generic Modification Loop ───────
    // Only coaches with non-"no_change" directives are called.

    const result: WeeklyAdjustmentResult = { recovery, directive }
    const modPromises: Array<Promise<void>> = []

    for (const coachDirective of directive.coachDirectives) {
        if (coachDirective.action === 'no_change') continue

        const domain = coachDirective.coach
        const meta = coachRegistry.getCoach(domain as CoachDomain)?.programming
        if (!meta) {
            console.warn(`[orchestrator] No meta for domain ${domain} — skipping modification`)
            continue
        }

        console.log(`[orchestrator] Step 4: ${meta.logLabel} Coach → modify (${coachDirective.action})`)

        const sessions = buildModSessions(domain, nextWeekSessions)
        if (sessions.length === 0) continue

        modPromises.push(
            generateStructuredResponse({
                systemPrompt: meta.buildModSystemPrompt(),
                userPrompt: meta.buildModUserPrompt(
                    coachDirective.instructions,
                    sessions,
                    ctx.weekNumber + 1
                ),
                schema: meta.schema,
                maxRetries: 2,
                maxTokens: 4096,
                temperature: meta.modTemperature,
            }).then(r => {
                if (r.success) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ;(result as unknown as Record<string, unknown>)[meta.modifiedKey] = r.data
                    console.log(`[orchestrator] ${meta.logLabel} sessions modified successfully`)
                } else {
                    console.error(`[orchestrator] ${meta.logLabel} modification failed:`, r.error)
                }
            })
        )
    }

    // Run all modifications in parallel
    if (modPromises.length > 0) {
        await Promise.all(modPromises)
    }

    console.log('[orchestrator] Pipeline B complete')
    return { success: true, data: result }
}
