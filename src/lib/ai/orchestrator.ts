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
import { skillRegistry, SkillInputError } from '@/lib/skills'
import type { CoachConfig } from '@/lib/coaches'
import type { CoachDomain } from '@/lib/skills/types'
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

// TM resolver — prefers stored training_maxes, falls back to benchmark-derived
import { resolveTrainingMaxForExercise } from '@/lib/training/methodology-helpers'

import type {
    MesocycleGenerationResult,
    WeeklyAdjustmentResult,
    ProgrammingMeta,
} from '@/lib/engine/types'

export type { MesocycleGenerationResult, WeeklyAdjustmentResult } from '@/lib/engine/types'

// ─── Domain Coach Registry — maps coach domain to schema + prompt builders ──

/**
 * Build the mapping from domain to schema/prompt/result-key.
 * This avoids repetitive switch statements and enables the generic loop.
 */
export function getDomainMeta(): Record<string, ProgrammingMeta> {
    return {
        strength: {
            schema: StrengthProgramSchema,
            buildSystemPrompt: buildStrengthProgramSystemPrompt,
            buildUserPrompt: buildStrengthProgramUserPrompt as (...args: unknown[]) => string,
            buildModSystemPrompt: buildStrengthModificationSystemPrompt,
            buildModUserPrompt: buildStrengthModificationUserPrompt as (...args: unknown[]) => string,
            resultKey: 'strengthProgram',
            modifiedKey: 'modifiedStrengthSessions',
            maxTokens: 8192,
            temperature: 0.7,
            modTemperature: 0.4,
            logLabel: 'Strength',
            logSummary: (d: unknown) => {
                const data = d as StrengthProgramValidated
                return `${data.splitDesign}, ${data.weeks.length} weeks`
            },
        },
        endurance: {
            schema: EnduranceProgramSchema,
            buildSystemPrompt: buildEnduranceProgramSystemPrompt,
            buildUserPrompt: buildEnduranceProgramUserPrompt as (...args: unknown[]) => string,
            buildModSystemPrompt: buildEnduranceModificationSystemPrompt,
            buildModUserPrompt: buildEnduranceModificationUserPrompt as (...args: unknown[]) => string,
            resultKey: 'enduranceProgram',
            modifiedKey: 'modifiedEnduranceSessions',
            maxTokens: 8192,
            temperature: 0.7,
            modTemperature: 0.4,
            logLabel: 'Endurance',
            logSummary: (d: unknown) => {
                const data = d as EnduranceProgramValidated
                return `${data.modalitySummary}, ${data.weeks.length} weeks`
            },
        },
        hypertrophy: {
            schema: HypertrophyProgramSchema,
            buildSystemPrompt: buildHypertrophyProgramSystemPrompt,
            buildUserPrompt: buildHypertrophyProgramUserPrompt as (...args: unknown[]) => string,
            buildModSystemPrompt: buildHypertrophyModificationSystemPrompt,
            buildModUserPrompt: buildHypertrophyModificationUserPrompt as (...args: unknown[]) => string,
            resultKey: 'hypertrophyProgram',
            modifiedKey: 'modifiedHypertrophySessions',
            maxTokens: 8192,
            temperature: 0.7,
            modTemperature: 0.4,
            logLabel: 'Hypertrophy',
            logSummary: (d: unknown) => {
                const data = d as HypertrophyProgramValidated
                return `${data.splitDesign}, ${data.weeks.length} weeks`
            },
        },
        conditioning: {
            schema: ConditioningProgramSchema,
            buildSystemPrompt: buildConditioningProgramSystemPrompt,
            buildUserPrompt: buildConditioningProgramUserPrompt as (...args: unknown[]) => string,
            buildModSystemPrompt: buildConditioningModificationSystemPrompt,
            buildModUserPrompt: buildConditioningModificationUserPrompt as (...args: unknown[]) => string,
            resultKey: 'conditioningProgram',
            modifiedKey: 'modifiedConditioningSessions',
            maxTokens: 8192,
            temperature: 0.8,
            modTemperature: 0.4,
            logLabel: 'Conditioning',
            logSummary: (d: unknown) => {
                const data = d as ConditioningProgramValidated
                return `${data.methodologyUsed}, ${data.weeks.length} weeks`
            },
        },
        mobility: {
            schema: MobilityProgramSchema,
            buildSystemPrompt: buildMobilityProgramSystemPrompt,
            buildUserPrompt: buildMobilityProgramUserPrompt as (...args: unknown[]) => string,
            buildModSystemPrompt: buildMobilityModificationSystemPrompt,
            buildModUserPrompt: buildMobilityModificationUserPrompt as (...args: unknown[]) => string,
            resultKey: 'mobilityProgram',
            modifiedKey: 'modifiedMobilitySessions',
            maxTokens: 8192,
            temperature: 0.6,
            modTemperature: 0.4,
            logLabel: 'Mobility',
            logSummary: (d: unknown) => {
                const data = d as MobilityProgramValidated
                return `${data.methodologyUsed}, ${data.weeks.length} weeks`
            },
        },
    }
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

/**
 * Build skill input from the available context for a given skill name.
 * Returns undefined if the skill cannot be executed with available data.
 *
 * Async: the `531-progression` branch now consults the stored
 * `profiles.training_maxes` before falling back to the benchmark-derived
 * estimate, so fresh recalibrations propagate into next-session prescriptions.
 */
async function buildSkillInput(
    skillName: string,
    ctx: AthleteContextPacket,
    strategy: MesocycleStrategyValidated,
    domain: CoachDomain
): Promise<unknown | undefined> {
    switch (skillName) {
        case 'deload-calculator': {
            // Compute a deload prescription for this domain
            const allocation = strategy.domainAllocations.find(d => d.coach === domain)
            if (!allocation) return undefined
            return {
                domain,
                currentIntensity: allocation.loadBudgetPerSession,
                currentVolumeSets: allocation.sessionsPerWeek * 4, // approximate sets per week
            }
        }
        case 'interference-checker': {
            // Build a session schedule from strategy allocations
            // This is a simplified version — real sessions have specific dates
            const sessions: Array<{ date: string; modality: string; domain: string; isHeavyLegs: boolean }> = []
            const baseDate = new Date()
            let dayOffset = 0
            for (const alloc of strategy.domainAllocations) {
                for (let i = 0; i < alloc.sessionsPerWeek; i++) {
                    const date = new Date(baseDate)
                    date.setDate(date.getDate() + dayOffset)
                    const modality = alloc.coach === 'strength' || alloc.coach === 'hypertrophy'
                        ? 'LIFTING'
                        : alloc.coach === 'endurance' ? 'CARDIO'
                        : alloc.coach === 'conditioning' ? 'METCON'
                        : 'MOBILITY'
                    sessions.push({
                        date: date.toISOString(),
                        modality: modality as 'LIFTING' | 'CARDIO' | 'METCON' | 'RUCKING' | 'MOBILITY',
                        domain: alloc.coach,
                        isHeavyLegs: alloc.coach === 'strength' && alloc.loadBudgetPerSession >= 7,
                    })
                    dayOffset++
                }
            }
            return { sessions }
        }
        case '531-progression':
        case 'training-max-estimation':
        case 'progression-engine': {
            // Strength-specific skills need benchmarks
            const benchmarks = ctx.benchmarks.filter(b =>
                ['back_squat_1rm', 'bench_press_1rm', 'deadlift_1rm', 'overhead_press_1rm',
                 'back_squat_3rm', 'bench_press_3rm', 'deadlift_3rm', 'overhead_press_3rm',
                 'back_squat_5rm', 'bench_press_5rm', 'deadlift_5rm', 'overhead_press_5rm'].includes(b.benchmark_name)
            )
            if (benchmarks.length === 0) return undefined

            if (skillName === 'training-max-estimation') {
                // Return input for the first available benchmark
                const b = benchmarks[0]
                const repCount = b.benchmark_name.includes('1rm') ? 1
                    : b.benchmark_name.includes('3rm') ? 3 : 5
                return {
                    liftName: b.benchmark_name.replace(/_\d+rm$/, '').replace(/_/g, ' '),
                    weightKg: b.value,
                    reps: repCount,
                    rpe: 10,
                }
            }
            if (skillName === '531-progression') {
                // Normalize benchmark_name (e.g. `back_squat_1rm`) to the exercise
                // display name we store training maxes under (e.g. `back squat`).
                const exerciseName = benchmarks[0].benchmark_name
                    .replace(/_\d+rm$/, '')
                    .replace(/_/g, ' ')
                    .trim()
                const repCount = benchmarks[0].benchmark_name.includes('1rm') ? 1
                    : benchmarks[0].benchmark_name.includes('3rm') ? 3 : 5
                const tm = await resolveTrainingMaxForExercise(
                    exerciseName, benchmarks[0].value, repCount
                )
                return {
                    trainingMaxKg: tm,
                    week: ctx.weekNumber <= 4 ? ctx.weekNumber : ((ctx.weekNumber - 1) % 4) + 1,
                }
            }
            // progression-engine needs more context than we have at this stage
            return undefined
        }
        case 'volume-landmarks': {
            return {
                experienceLevel: ctx.profile.lifting_experience ?? 'intermediate',
                muscleGroups: ['Quads', 'Hamstrings', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
            }
        }
        case 'hypertrophy-volume-tracker': {
            // Needs previous week data
            return undefined
        }
        case 'vdot-pacer': {
            const enduranceBenchmarks = ctx.benchmarks.filter(b =>
                ['5k', '10k', 'mile', '1_mile'].some(kw => b.benchmark_name.toLowerCase().includes(kw))
            )
            if (enduranceBenchmarks.length === 0) return undefined
            const best = enduranceBenchmarks[0]
            return {
                raceDistanceMeters: best.benchmark_name.toLowerCase().includes('5k') ? 5000
                    : best.benchmark_name.toLowerCase().includes('10k') ? 10000
                    : 1609,
                raceTimeSeconds: typeof best.value === 'number' ? best.value : undefined,
            }
        }
        case 'zone-distributor': {
            const allocation = strategy.domainAllocations.find(d => d.coach === 'endurance')
            if (!allocation) return undefined
            return {
                totalWeeklyMinutes: allocation.sessionsPerWeek * (ctx.profile.session_duration_minutes ?? 45),
                sessionsPerWeek: allocation.sessionsPerWeek,
            }
        }
        case 'conditioning-scaler': {
            return {
                loadBudget: strategy.domainAllocations.find(d => d.coach === 'conditioning')?.loadBudgetPerSession ?? 5,
                athleteExperience: ctx.profile.conditioning_experience ?? 'intermediate',
            }
        }
        default:
            return undefined
    }
}

/**
 * Run all assigned skills for a coach config, returning pre-computed results.
 * Shared skills are run once and cached in executedSharedSkills.
 */
async function executeAssignedSkills(
    config: CoachConfig,
    ctx: AthleteContextPacket,
    strategy: MesocycleStrategyValidated,
    executedSharedSkills: Map<string, unknown>
): Promise<Map<string, unknown>> {
    const preComputed = new Map<string, unknown>()

    for (const skillName of config.assignedSkills) {
        const skill = skillRegistry.getSkill(skillName)
        if (!skill) continue

        // Shared skills run once per cycle
        if (skill.domain === 'shared') {
            if (executedSharedSkills.has(skillName)) {
                preComputed.set(skillName, executedSharedSkills.get(skillName))
                continue
            }
        }

        // Build input for this skill
        const input = await buildSkillInput(skillName, ctx, strategy, config.id)
        if (input === undefined) {
            console.log(`[orchestrator] Skill ${skillName}: insufficient data, will rely on AI`)
            continue
        }

        // Execute skill with error handling
        try {
            const result = skillRegistry.executeSkill(skillName, input)
            preComputed.set(skillName, result)
            if (skill.domain === 'shared') {
                executedSharedSkills.set(skillName, result)
            }
            console.log(`[orchestrator] Skill ${skillName}: executed successfully`)
        } catch (err) {
            if (err instanceof SkillInputError) {
                console.warn(`[orchestrator] Skill ${skillName} input validation failed, will rely on AI: ${err.message}`)
            } else {
                console.warn(`[orchestrator] Skill ${skillName} failed, will rely on AI: ${err}`)
            }
        }
    }

    return preComputed
}

/**
 * Build a pre-computed data addendum for injection into the user prompt.
 * This converts skill outputs into natural language that augments the prompt.
 */
function buildPreComputedAddendum(preComputed: Map<string, unknown>): string {
    if (preComputed.size === 0) return ''

    const sections: string[] = []

    for (const [skillName, result] of preComputed) {
        switch (skillName) {
            case 'deload-calculator': {
                const data = result as {
                    domain: string
                    deloadIntensity: number
                    deloadVolumeSets: number
                    intensityMultiplier: number
                    volumeMultiplier: number
                }
                sections.push(
                    `DELOAD CALCULATOR (pre-computed — use these exact numbers for deload weeks):\n` +
                    `  Domain: ${data.domain}\n` +
                    `  Deload intensity: ${data.deloadIntensity}/10\n` +
                    `  Deload volume sets: ${data.deloadVolumeSets}\n` +
                    `  Intensity multiplier: ${data.intensityMultiplier}\n` +
                    `  Volume multiplier: ${data.volumeMultiplier}`
                )
                break
            }
            case 'interference-checker': {
                const data = result as { violations: Array<{ type: string; rule: string; sessionA: string; sessionB: string }>; isClean: boolean }
                if (!data.isClean) {
                    const violationStr = data.violations.map(v => `  - ${v.type}: ${v.rule}`).join('\n')
                    sections.push(
                        `INTERFERENCE CHECK (pre-computed — address these violations):\n${violationStr}`
                    )
                } else {
                    sections.push('INTERFERENCE CHECK: Clean — no scheduling violations detected.')
                }
                break
            }
            case '531-progression': {
                const data = result as { sets: Array<{ percent: number; reps: number; isAmrap: boolean }> }
                const setsStr = data.sets.map(s =>
                    `  ${s.percent}% TM x ${s.reps}${s.isAmrap ? '+' : ''}`
                ).join('\n')
                sections.push(
                    `5/3/1 PROGRESSION (pre-computed — use these exact percentages):\n${setsStr}`
                )
                break
            }
            case 'training-max-estimation': {
                const data = result as { estimatedOneRepMax: number; trainingMax: number }
                sections.push(
                    `TRAINING MAX (pre-computed):\n` +
                    `  Estimated 1RM: ${data.estimatedOneRepMax}kg\n` +
                    `  Training Max (90%): ${data.trainingMax}kg`
                )
                break
            }
            case 'volume-landmarks': {
                const data = result as { landmarks: Record<string, { mev: number; mav: number; mrv: number }> }
                if (data.landmarks) {
                    const landmarksStr = Object.entries(data.landmarks)
                        .map(([mg, lm]) => `  ${mg}: MEV=${lm.mev}, MAV=${lm.mav}, MRV=${lm.mrv}`)
                        .join('\n')
                    sections.push(
                        `VOLUME LANDMARKS (pre-computed — use these set counts):\n${landmarksStr}`
                    )
                }
                break
            }
            case 'vdot-pacer': {
                const data = result as { vdot: number; paces: Record<string, number> }
                if (data.paces) {
                    const pacesStr = Object.entries(data.paces)
                        .map(([zone, pace]) => `  ${zone}: ${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')}/km`)
                        .join('\n')
                    sections.push(
                        `VDOT PACES (pre-computed — use these exact paces):\n  VDOT: ${data.vdot}\n${pacesStr}`
                    )
                }
                break
            }
            case 'zone-distributor': {
                const data = result as { zone2Minutes: number; hardMinutes: number; zone2Percent: number }
                sections.push(
                    `ZONE DISTRIBUTION (pre-computed):\n` +
                    `  Zone 2: ${data.zone2Minutes} min (${data.zone2Percent}%)\n` +
                    `  Hard: ${data.hardMinutes} min (${100 - data.zone2Percent}%)`
                )
                break
            }
            case 'conditioning-scaler': {
                sections.push(
                    `CONDITIONING SCALING (pre-computed): ${JSON.stringify(result)}`
                )
                break
            }
            default:
                sections.push(`${skillName.toUpperCase()} (pre-computed): ${JSON.stringify(result)}`)
        }
    }

    if (sections.length === 0) return ''

    return `\n── PRE-COMPUTED SKILL DATA (use these exact values, do NOT recalculate) ──\n${sections.join('\n\n')}\n`
}

/**
 * Build domain-specific user prompt args based on coach type.
 * Each domain coach has a slightly different user prompt signature.
 */
function buildDomainUserPromptArgs(
    domain: string,
    ctx: AthleteContextPacket,
    brief: WeekBrief,
    strategy: MesocycleStrategyValidated,
    methodologyContext?: MethodologyContext,
    enduranceMethodologyContext?: EnduranceMethodologyContext,
    volumeTargets?: string
): unknown[] {
    switch (domain) {
        case 'strength':
            return [ctx, brief, methodologyContext, strategy.totalWeeks, hasCoach(ctx.coachingTeam, 'hypertrophy')]
        case 'endurance':
            return [ctx, brief, enduranceMethodologyContext, strategy.totalWeeks]
        case 'hypertrophy':
            return [ctx, brief, volumeTargets, strategy.totalWeeks, hasCoach(ctx.coachingTeam, 'strength')]
        case 'conditioning':
            return [ctx, brief, strategy.totalWeeks]
        case 'mobility': {
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
            return [ctx, brief, strategy.totalWeeks, allDomainSessions]
        }
        default:
            return [ctx, brief, strategy.totalWeeks]
    }
}

/**
 * Build modification sessions from next-week data for a specific domain.
 * Returns the appropriate typed session array for the modification prompt.
 */
function buildModSessions(
    domain: string,
    nextWeekSessions: Array<{ coach: string; sessionName: string; exercises?: string[] }>
): unknown[] {
    const domainSessions = nextWeekSessions.filter(s => s.coach === domain)
    if (domainSessions.length === 0) return []

    switch (domain) {
        case 'strength':
            return domainSessions.map(s => ({
                name: s.sessionName,
                exercises: (s.exercises ?? []).map(e => ({
                    exerciseName: e,
                    sets: 0,
                    targetReps: 0,
                    targetWeightKg: null as number | null,
                    targetRir: 2,
                })),
            }))
        case 'endurance':
            return domainSessions.map(s => ({
                name: s.sessionName,
                enduranceModality: 'running' as const,
                intensityZone: 'zone_2' as const,
                targetDistanceKm: null as number | null,
                estimatedDurationMinutes: 0,
            }))
        case 'hypertrophy':
            return domainSessions.map(s => ({
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
        case 'conditioning':
            return domainSessions.map(s => ({
                name: s.sessionName,
                conditioningType: 'metcon' as const,
                targetIntensity: 'moderate' as const,
                estimatedDurationMinutes: 0,
            }))
        case 'mobility':
            return domainSessions.map(s => ({
                name: s.sessionName,
                focusAreas: [] as string[],
                estimatedDurationMinutes: 0,
            }))
        default:
            return []
    }
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

    const domainMeta = getDomainMeta()

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
        if (coach.id !== 'recovery' && domainMeta[coach.id]) {
            coachDomains.add(coach.id)
        }
    }

    for (const domain of coachDomains) {
        const meta = domainMeta[domain]
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

    const domainMeta = getDomainMeta()

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
        return await runAdjustmentPipeline(ctx, recovery, nextWeekSessions, domainMeta)
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

    return await runAdjustmentPipeline(ctx, recovery, nextWeekSessions, domainMeta)
}

/**
 * Steps 3-4 of Pipeline B: Head Coach directive + domain coach modifications.
 * Extracted so it can be called from both the skill-driven and fallback paths.
 */
async function runAdjustmentPipeline(
    ctx: AthleteContextPacket,
    recovery: RecoveryAssessmentValidated,
    nextWeekSessions: Array<{ coach: string; sessionName: string; exercises?: string[] }> | undefined,
    domainMeta: Record<string, ProgrammingMeta>
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
        const meta = domainMeta[domain]
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
