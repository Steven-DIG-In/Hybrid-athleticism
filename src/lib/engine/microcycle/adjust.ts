'use server'

/**
 * Microcycle weekly recovery + adjustment pipeline (Task 12 — engine refactor).
 *
 * Pipeline B — Weekly check-in and adjustment.
 * Called every week after the athlete completes training.
 *
 *   Step 1: Recovery Scorer Skill → GREEN / YELLOW / RED (deterministic)
 *   Step 2: Decision Gate (TypeScript, no AI)
 *   Step 3: Head Coach → AdjustmentDirective (if YELLOW/RED)
 *   Step 4: Affected Domain Coaches → targeted modification (generic loop)
 *
 * Merged from:
 *   - `coaching.actions.runWeeklyRecoveryCheck` (public wrapper)
 *   - `orchestrator.runWeeklyAdjustment` (pipeline)
 *   - `orchestrator.runAdjustmentPipeline` (per-coach helper)
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { coachRegistry } from '@/lib/coaches'
import type { CoachDomain } from '@/lib/skills/types'
import type { ActionResult } from '@/lib/types/training.types'
import type { AthleteContextPacket } from '@/lib/types/coach-context'
import type { WeeklyAdjustmentResult } from '@/lib/engine/types'

import { generateStructuredResponse } from '@/lib/ai/client'
import {
    RecoveryAssessmentSchema,
    AdjustmentDirectiveSchema,
} from '@/lib/ai/schemas/week-brief'
import type { RecoveryAssessmentValidated } from '@/lib/ai/schemas/week-brief'
import {
    buildAdjustmentDirectiveSystemPrompt,
    buildAdjustmentDirectiveUserPrompt,
} from '@/lib/ai/prompts/head-coach'
import { recoveryScorerSkill } from '@/lib/skills/domains/recovery/recovery-scorer'

import { buildModSessions } from '@/lib/engine/_shared/domain-prompt-args'
import { buildAthleteContext } from '@/lib/engine/mesocycle/context'

// ─── Pipeline B: Weekly Recovery Check ──────────────────────────────────────

/**
 * Run the weekly recovery check-in for a specific microcycle.
 *
 * Recovery Coach reviews last week's data → GREEN/YELLOW/RED.
 * If YELLOW/RED: Head Coach issues directive → Strength Coach modifies.
 */
export async function runWeeklyRecoveryCheck(
    microcycleId: string
): Promise<ActionResult<WeeklyAdjustmentResult>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Load microcycle
    const { data: microcycle, error: mcError } = await supabase
        .from('microcycles')
        .select('*, mesocycles!inner(id, goal, week_count)')
        .eq('id', microcycleId)
        .eq('user_id', user.id)
        .single()

    if (mcError || !microcycle) {
        return { success: false, error: 'Microcycle not found' }
    }

    const mesocycleData = microcycle.mesocycles as {
        id: string
        goal: string
        week_count: number
    }

    // Build athlete context with previous week data
    const ctxResult = await buildAthleteContext(
        user.id,
        mesocycleData.id,
        microcycle.week_number,
        { includePreviousWeek: true }
    )
    if (!ctxResult.success) {
        return { success: false, error: ctxResult.error }
    }
    const ctx = ctxResult.data

    // Build muscle group volumes from exercise sets
    const muscleGroupVolumes = await computeMuscleGroupVolumes(user.id, microcycleId)

    // Build next week's sessions for adjustment context
    const nextWeekSessions = await loadNextWeekSessions(
        user.id,
        mesocycleData.id,
        microcycle.week_number + 1
    )

    // ── Run Pipeline B (formerly runWeeklyAdjustment) ────────────────────────
    const result = await runWeeklyAdjustmentInline(ctx, muscleGroupVolumes, nextWeekSessions)

    if (!result.success) {
        return { success: false, error: result.error }
    }

    // Persist recovery assessment to microcycle
    await supabase
        .from('microcycles')
        .update({
            recovery_status: result.data.recovery.status,
            recovery_assessment: result.data.recovery as unknown as Record<string, unknown>,
            adjustment_directive: result.data.directive
                ? (result.data.directive as unknown as Record<string, unknown>)
                : null,
        })
        .eq('id', microcycleId)
        .eq('user_id', user.id)

    revalidatePath('/dashboard')
    return result
}

// ─── Pipeline B Body (inlined from orchestrator.runWeeklyAdjustment) ────────

/**
 * Pipeline B body — recovery scoring + decision gate.
 * Inlined from orchestrator.runWeeklyAdjustment; private to this module.
 */
async function runWeeklyAdjustmentInline(
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
        const { buildRecoveryAssessmentSystemPrompt, buildRecoveryAssessmentUserPrompt } = await import('@/lib/ai/prompts/recovery-coach')
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
 * Private to this module (formerly orchestrator.runAdjustmentPipeline).
 * Called from both the skill-driven and AI-fallback paths in
 * runWeeklyAdjustmentInline above.
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

// ─── Helper: Compute Muscle Group Volumes ───────────────────────────────────

async function computeMuscleGroupVolumes(
    userId: string,
    microcycleId: string
): Promise<Array<{
    muscleGroup: string
    setsThisWeek: number
    targetSets: number
    totalTonnageKg: number
    avgRIR: number | null
}> | undefined> {
    const supabase = await createClient()

    const { data: workouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('microcycle_id', microcycleId)
        .eq('user_id', userId)

    if (!workouts || workouts.length === 0) return undefined

    const workoutIds = workouts.map(w => w.id)
    const { data: sets } = await supabase
        .from('exercise_sets')
        .select('muscle_group, target_reps, target_weight_kg, actual_reps, actual_weight_kg, rir_actual')
        .in('workout_id', workoutIds)

    if (!sets || sets.length === 0) return undefined

    const grouped = new Map<string, {
        sets: number
        tonnage: number
        rirSum: number
        rirCount: number
    }>()

    for (const s of sets) {
        const mg = s.muscle_group ?? 'unknown'
        const existing = grouped.get(mg) ?? { sets: 0, tonnage: 0, rirSum: 0, rirCount: 0 }
        existing.sets += 1
        const weight = s.actual_weight_kg ?? s.target_weight_kg ?? 0
        const reps = s.actual_reps ?? s.target_reps ?? 0
        existing.tonnage += weight * reps
        if (s.rir_actual !== null) {
            existing.rirSum += s.rir_actual
            existing.rirCount += 1
        }
        grouped.set(mg, existing)
    }

    return Array.from(grouped.entries()).map(([muscleGroup, data]) => ({
        muscleGroup,
        setsThisWeek: data.sets,
        targetSets: 0, // Would come from strategy — simplified for Phase 1
        totalTonnageKg: data.tonnage,
        avgRIR: data.rirCount > 0 ? data.rirSum / data.rirCount : null,
    }))
}

// ─── Helper: Load Next Week Sessions ────────────────────────────────────────

async function loadNextWeekSessions(
    userId: string,
    mesocycleId: string,
    nextWeekNumber: number
): Promise<Array<{ coach: string; sessionName: string; exercises?: string[] }> | undefined> {
    const supabase = await createClient()

    const { data: nextMicrocycle } = await supabase
        .from('microcycles')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', nextWeekNumber)
        .eq('user_id', userId)
        .maybeSingle()

    if (!nextMicrocycle) return undefined

    const { data: workouts } = await supabase
        .from('workouts')
        .select('id, name, modality')
        .eq('microcycle_id', nextMicrocycle.id)
        .eq('user_id', userId)

    if (!workouts || workouts.length === 0) return undefined

    const result: Array<{ coach: string; sessionName: string; exercises?: string[] }> = []

    for (const w of workouts) {
        // Map modality to coach type
        const coach = w.modality === 'lifting' ? 'strength'
            : w.modality === 'cardio' ? 'endurance'
            : w.modality === 'conditioning' ? 'conditioning'
            : w.modality === 'mobility' ? 'mobility'
            : 'strength'

        // Load exercise names
        const { data: sets } = await supabase
            .from('exercise_sets')
            .select('exercise_name')
            .eq('workout_id', w.id)

        const uniqueExercises = sets
            ? [...new Set(sets.map(s => s.exercise_name))]
            : undefined

        result.push({
            coach,
            sessionName: w.name,
            exercises: uniqueExercises,
        })
    }

    return result
}
