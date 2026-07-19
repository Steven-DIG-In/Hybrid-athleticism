/**
 * Skill execution helpers — relocated from src/lib/ai/orchestrator.ts.
 *
 * Pure helpers that build inputs for skill execution and convert their
 * results into prompt addenda. They take pre-resolved arguments and do not
 * touch Supabase directly.
 */

import { skillRegistry, SkillInputError } from '@/lib/skills'
import type { CoachConfig } from '@/lib/coaches'
import type { CoachDomain } from '@/lib/skills/types'
import type { AthleteContextPacket } from '@/lib/types/coach-context'
import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'
import { resolveTrainingMaxForExercise } from '@/lib/training/methodology-helpers'
import { formatPace } from '@/lib/skills/domains/endurance/vdot-pacer'

// Running benchmark keys (canonical capability) → race distance in km, for VDOT.
const RUN_BENCHMARK_KM: Record<string, number> = {
    run_5k: 5,
    run_10k: 10,
    run_1mile: 1.609,
}

/**
 * Build skill input from the available context for a given skill name.
 * Returns undefined if the skill cannot be executed with available data.
 *
 * Async: the `531-progression` branch now consults the stored
 * `profiles.training_maxes` before falling back to the benchmark-derived
 * estimate, so fresh recalibrations propagate into next-session prescriptions.
 */
export async function buildSkillInput(
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
                // A benchmark is present here, so resolve never returns null —
                // but the signature allows it, and a 5/3/1 wave off a null TM
                // would be nonsense. Skip the skill rather than invent a number.
                if (tm == null) return undefined
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
            // Prefer Layer 1's canonical endurance capability (run_5k/run_10k/run_1mile);
            // fall back to the legacy athlete_benchmarks list. Emits raceDistanceKm — the
            // key vdotPacerSkill actually validates (was raceDistanceMeters → always rejected).
            const runCap = (ctx.athleteState?.capabilities.endurance ?? [])
                .find(c => RUN_BENCHMARK_KM[c.key] !== undefined && c.currentValueSeconds > 0)
            if (runCap) {
                return { raceDistanceKm: RUN_BENCHMARK_KM[runCap.key], raceTimeSeconds: runCap.currentValueSeconds }
            }
            const best = ctx.benchmarks.find(b =>
                ['5k', '10k', 'mile', '1_mile'].some(kw => b.benchmark_name.toLowerCase().includes(kw))
            )
            if (!best || typeof best.value !== 'number') return undefined
            const name = best.benchmark_name.toLowerCase()
            return {
                raceDistanceKm: name.includes('5k') ? 5 : name.includes('10k') ? 10 : 1.609,
                raceTimeSeconds: best.value,
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
export async function executeAssignedSkills(
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
export function buildPreComputedAddendum(preComputed: Map<string, unknown>): string {
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
                // vdotPacerSkill returns flat pace fields (not a `paces` record).
                const data = result as {
                    vdot: number
                    easyPaceSecPerKm: number
                    tempoPaceSecPerKm: number
                    thresholdPaceSecPerKm: number
                    intervalPaceSecPerKm: number
                }
                sections.push(
                    `VDOT PACES (pre-computed — use these exact paces):\n  VDOT: ${data.vdot}\n` +
                    `  easy: ${formatPace(data.easyPaceSecPerKm)}/km\n` +
                    `  tempo: ${formatPace(data.tempoPaceSecPerKm)}/km\n` +
                    `  threshold: ${formatPace(data.thresholdPaceSecPerKm)}/km\n` +
                    `  interval: ${formatPace(data.intervalPaceSecPerKm)}/km`
                )
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
