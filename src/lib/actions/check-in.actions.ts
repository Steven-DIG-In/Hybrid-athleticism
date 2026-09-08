'use server'

/**
 * Check-In System Actions
 *
 * Implements the weekly check-in trigger, athlete self-report submission,
 * and the tiered coaching adjustment pipeline.
 *
 * Tier 1: Auto-adjustments via progression-engine skill (weight tweaks)
 * Tier 2: YELLOW recovery — AI reasoning placeholder (Task 14 orchestrator refactor)
 * Tier 3: RED recovery — creates a pending coaching_adjustment requiring confirmation
 */

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types/training.types'
import { recoveryScorerSkill } from '@/lib/skills/domains/recovery/recovery-scorer'
import { progressionEngineSkill } from '@/lib/skills/domains/strength/progression-engine'
import {
    evaluateCheckInTrigger,
    type CheckInWindowStatus,
} from '@/lib/check-in/trigger'

// ─── Shared queries ──────────────────────────────────────────────────────────
// Not exported: a 'use server' file turns every export into a callable endpoint,
// and these are internal. Both the writing path (checkAndTriggerCheckIn) and the
// read-only path (getDueCheckIn) feed the SAME pure rule, so they must also agree
// on how the rule's inputs are fetched — two copies of these queries would drift
// exactly the way two copies of the rule itself would.

type ServerClient = Awaited<ReturnType<typeof createClient>>

async function loadCheckInWindow(
    supabase: ServerClient,
    userId: string,
    mesocycleId: string,
    weekNumber: number
) {
    return supabase
        .from('check_in_windows')
        .select('*')
        .eq('user_id', userId)
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', weekNumber)
        .maybeSingle()
}

/** Sessions this week that were allocated to a training day AND completed. */
async function countCompletedAllocatedSessions(
    supabase: ServerClient,
    userId: string,
    mesocycleId: string,
    weekNumber: number
) {
    return supabase
        .from('session_inventory')
        .select('id', { count: 'exact', head: true })
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', userId)
        .eq('week_number', weekNumber)
        // Allocation signal is training_day, never scheduled_date (which stays null
        // on inventory even after auto-allocate).
        .not('training_day', 'is', null)
        // Completion signal is `status`, NEVER `completed_at`. completed_at is only
        // stamped from 2026-07-26, so older completed rows have it null: as of
        // 2026-09-08, 46 of the 53 rows with status='completed' have a null
        // completed_at. Filtering on completed_at counted 7 of 53 — which understates
        // `completed`, inflates `missed_sessions = totalAllocated - completed`, and
        // pushes the recovery score toward a false RED. It also meant the "all
        // allocated sessions completed" trigger could essentially never fire.
        // (Fixed 2026-09-08; the bug predates the check-in wiring — it was in
        // checkAndTriggerCheckIn from the start. Repo gotcha: see CLAUDE.md.)
        .eq('status', 'completed')
}

/** What the athlete tells us about the week — the half no logged set can measure. */
export interface SelfReportInput {
    sleepQuality: number
    energyLevel: number
    stressLevel: number
    motivation: number
    soreness: Record<string, number>
    notes?: string
}

// ─── Check and Trigger Check-In ─────────────────────────────────────────────

/**
 * Evaluate whether a check-in should be triggered for this user/mesocycle/week.
 *
 * Trigger condition 1: All allocated sessions completed
 *   → triggers immediately; marks early_completion if within the 7-day window
 * Trigger condition 2: 7 days have elapsed since allocation_start
 *   → triggers the time-based gate regardless of completion
 *
 * If already triggered or completed, returns { triggered: false }.
 */
export async function checkAndTriggerCheckIn(
    userId: string,
    mesocycleId: string,
    weekNumber: number
): Promise<{ triggered: boolean; reason?: string }> {
    const supabase = await createClient()

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.id !== userId) {
        return { triggered: false, reason: 'Not authenticated' }
    }

    // Load the check-in window for this week
    const { data: window, error: windowError } = await loadCheckInWindow(
        supabase, userId, mesocycleId, weekNumber
    )

    if (windowError) {
        console.error('[checkAndTriggerCheckIn] window query error:', windowError)
        return { triggered: false, reason: 'Database error loading check-in window' }
    }

    // No window means allocation hasn't happened yet
    if (!window) {
        return { triggered: false, reason: 'No check-in window found for this week' }
    }

    const { count: completedCount, error: countError } = await countCompletedAllocatedSessions(
        supabase, userId, mesocycleId, weekNumber
    )

    if (countError) {
        console.error('[checkAndTriggerCheckIn] completed count error:', countError)
        return { triggered: false, reason: 'Database error counting completed sessions' }
    }

    const completed = completedCount ?? 0
    const now = new Date()
    const decision = evaluateCheckInTrigger({
        status: window.status as CheckInWindowStatus,
        totalAllocated: window.total_allocated ?? 0,
        completed,
        allocationStart: new Date(window.allocation_start),
        now,
    })

    if (!decision.due) {
        return { triggered: false, reason: decision.reason }
    }

    const updatePayload: Record<string, unknown> = {
        status: 'triggered',
        triggered_at: now.toISOString(),
        total_completed: completed,
        missed_sessions: decision.missedSessions,
    }
    if (decision.earlyCompletion) updatePayload.early_completion = true
    if (decision.missedSessions > 0) updatePayload.incomplete_week = true

    // Persist the triggered state
    const { error: updateError } = await supabase
        .from('check_in_windows')
        .update(updatePayload)
        .eq('id', window.id)
        .eq('user_id', userId)

    if (updateError) {
        console.error('[checkAndTriggerCheckIn] update error:', updateError)
        return { triggered: false, reason: 'Failed to update check-in window status' }
    }

    return { triggered: true, reason: decision.reason }
}

// ─── Submit Self-Report ──────────────────────────────────────────────────────

/**
 * Insert an athlete self-report for the given week.
 * Called from the UI after the athlete completes the weekly check-in form.
 */
export async function submitSelfReport(
    userId: string,
    mesocycleId: string,
    weekNumber: number,
    data: SelfReportInput
): Promise<ActionResult<void>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.id !== userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('athlete_self_reports')
        .insert({
            user_id: userId,
            mesocycle_id: mesocycleId,
            week_number: weekNumber,
            sleep_quality: data.sleepQuality,
            energy_level: data.energyLevel,
            stress_level: data.stressLevel,
            motivation: data.motivation,
            soreness: data.soreness,
            notes: data.notes ?? null,
        })

    if (error) {
        console.error('[submitSelfReport]', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: undefined }
}

// ─── Run Check-In Cycle ──────────────────────────────────────────────────────

/**
 * Run the full check-in cycle for a triggered week.
 *
 * Step 1: Load performance deltas for this week
 * Step 2: Load self-report for this week
 * Step 3: Compute recovery score via recovery-scorer skill
 * Step 4: Tier 1 — auto weight adjustments via progression-engine skill
 * Step 5: Tier 2 — YELLOW placeholder (Task 14: AI orchestrator integration)
 * Step 6: Tier 3 — RED creates a pending coaching_adjustment
 * Step 7: Mark check-in window as completed
 */
export async function runCheckInCycle(
    userId: string,
    mesocycleId: string,
    weekNumber: number
): Promise<ActionResult<{ adjustments: unknown[] }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.id !== userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Load the check-in window
    const { data: window, error: windowError } = await loadCheckInWindow(
        supabase, userId, mesocycleId, weekNumber
    )

    if (windowError || !window) {
        return { success: false, error: 'No check-in window found for this week' }
    }

    if (window.status === 'completed') {
        return { success: false, error: 'Check-in cycle already completed for this week' }
    }

    // ── Step 1: Load performance deltas ────────────────────────────────────
    const { data: sessionIds } = await supabase
        .from('session_inventory')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', userId)
        .eq('week_number', weekNumber)

    const inventoryIds = (sessionIds ?? []).map(s => s.id)

    const { data: performanceDeltas } = inventoryIds.length > 0
        ? await supabase
            .from('performance_deltas')
            .select('*')
            .in('session_inventory_id', inventoryIds)
        : { data: [] }

    const deltas = performanceDeltas ?? []

    // ── Step 2: Load self-report ────────────────────────────────────────────
    const { data: selfReport } = await supabase
        .from('athlete_self_reports')
        .select('*')
        .eq('user_id', userId)
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', weekNumber)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    // ── Step 3: Compute recovery score ─────────────────────────────────────
    // Derive signal inputs from available data; fall back to neutral values
    // when data is absent (new user, no self-report submitted yet).

    const avgRpeDeviation = deltas.length > 0
        ? deltas.reduce((sum, d) => {
            const prescribed = (d.prescribed_rpe as number | null) ?? 7
            const actual = (d.actual_rpe as number | null) ?? prescribed
            return sum + (actual - prescribed)
        }, 0) / deltas.length
        : 0

    const avgRirDeviation = 0 // RIR delta not stored in performance_deltas schema

    const totalAllocated = window.total_allocated ?? 1
    const totalCompleted = window.total_completed ?? 0
    const completionRate = totalAllocated > 0 ? Math.min(totalCompleted / totalAllocated, 1) : 1

    const missedSessions = window.missed_sessions ?? 0
    const earlyCompletion = window.early_completion ?? false

    // Average soreness from map — default to 3 (neutral) if no report
    let avgSoreness = 3
    if (selfReport?.soreness) {
        const sorenessValues = Object.values(selfReport.soreness as Record<string, number>)
        if (sorenessValues.length > 0) {
            avgSoreness = sorenessValues.reduce((a, b) => a + b, 0) / sorenessValues.length
        }
    }

    const recoveryInput = {
        avgRpeDeviation,
        avgRirDeviation,
        completionRate,
        missedSessions,
        earlyCompletion,
        selfReport: {
            sleepQuality: selfReport?.sleep_quality ?? 3,
            energyLevel: selfReport?.energy_level ?? 3,
            stressLevel: selfReport?.stress_level ?? 3,
            motivation: selfReport?.motivation ?? 3,
            avgSoreness,
        },
        // Default balanced weights
        signalWeights: {
            rpeDeviation: 0.15,
            rirDeviation: 0.10,
            completionRate: 0.20,
            earlyCompletion: 0.05,
            missedSessions: 0.15,
            selfReportEnergy: 0.10,
            selfReportSoreness: 0.10,
            selfReportSleep: 0.08,
            selfReportStress: 0.05,
            selfReportMotivation: 0.02,
        },
    }

    const recoveryResult = recoveryScorerSkill.execute(recoveryInput)
    const { score: recoveryScore, status: recoveryStatus } = recoveryResult

    console.log(`[runCheckInCycle] Recovery score: ${recoveryScore} (${recoveryStatus})`)

    const appliedAdjustments: unknown[] = []

    // ── Step 4: Tier 1 — auto weight adjustments (GREEN or any status) ──────
    // Run the progression-engine for each exercise delta where we have enough data.
    for (const delta of deltas) {
        const prescribedWeight = delta.prescribed_weight as number | null
        const actualWeight = delta.actual_weight as number | null
        const prescribedReps = delta.prescribed_reps as number | null
        const actualReps = delta.actual_reps as number | null
        const prescribedRpe = delta.prescribed_rpe as number | null
        const actualRpe = delta.actual_rpe as number | null

        // Progression engine requires all fields — skip incomplete records
        if (
            !delta.exercise_name ||
            prescribedWeight == null || prescribedWeight <= 0 ||
            actualWeight == null || actualWeight <= 0 ||
            prescribedReps == null || prescribedReps <= 0 ||
            actualReps == null || actualReps <= 0 ||
            prescribedRpe == null ||
            actualRpe == null
        ) {
            continue
        }

        try {
            const progressionResult = progressionEngineSkill.execute({
                exerciseName: delta.exercise_name as string,
                prescribedWeightKg: prescribedWeight,
                prescribedReps,
                prescribedRpe,
                actualWeightKg: actualWeight,
                actualReps,
                actualRpe,
            })

            if (progressionResult.adjustment !== 'maintain') {
                appliedAdjustments.push({
                    tier: 1,
                    exerciseName: delta.exercise_name,
                    adjustment: progressionResult.adjustment,
                    nextWeightKg: progressionResult.nextWeightKg,
                    incrementKg: progressionResult.incrementKg,
                    reason: progressionResult.reason,
                    autoApplied: true,
                })
            }
        } catch (err) {
            // Skill validation error — log and skip this exercise
            console.warn(`[runCheckInCycle] Tier 1 progression engine skipped ${delta.exercise_name}:`, err)
        }
    }

    // ── Step 5: Tier 2 — YELLOW recovery ───────────────────────────────────
    // TODO (Task 14): Wire to AI orchestrator for contextual reasoning.
    // The orchestrator will analyse the full weekly payload, produce a narrative
    // directive, and surface a recommended adjustment plan for athlete review.
    if (recoveryStatus === 'YELLOW') {
        console.log('[runCheckInCycle] Tier 2: YELLOW recovery detected — AI reasoning would happen here (Task 14)')
    }

    // ── Step 6: Tier 3 — RED recovery creates pending coaching_adjustment ──
    if (recoveryStatus === 'RED') {
        // Find the most recent session inventory ID for this week to anchor the adjustment
        const anchorSessionId = inventoryIds[0] ?? null

        if (anchorSessionId) {
            const { error: adjustmentError } = await supabase
                .from('coaching_adjustments')
                .insert({
                    session_inventory_id: anchorSessionId,
                    user_id: userId,
                    adjustment_type: 'reduce_intensity',
                    original_prescription: { recoveryScore, recoveryStatus },
                    modified_prescription: {
                        directive: 'Reduce training intensity — recovery score is critically low',
                        recoveryScore,
                        weekNumber,
                    },
                    reason: `RED recovery status detected (score: ${recoveryScore}). Week ${weekNumber} performance signals indicate significant fatigue accumulation. Manual coach review required.`,
                    status: 'pending',
                    tier: 3,
                    auto_applied: false,
                    athlete_confirmed: false,
                    coach_persona_note: `Recovery Coach: Score ${recoveryScore} is in RED zone. This week showed ${missedSessions > 0 ? `${missedSessions} missed session(s) and ` : ''}concerning subjective wellbeing markers. Recommend deload or major load reduction before proceeding.`,
                })

            if (adjustmentError) {
                console.error('[runCheckInCycle] Tier 3 adjustment insert error:', adjustmentError)
            } else {
                appliedAdjustments.push({
                    tier: 3,
                    type: 'reduce_intensity',
                    status: 'pending',
                    reason: 'RED recovery — requires athlete confirmation',
                    autoApplied: false,
                })
            }
        } else {
            console.warn('[runCheckInCycle] Tier 3: no session inventory ID available to anchor the adjustment')
        }
    }

    // ── Step 7: Mark check-in window as completed ───────────────────────────
    const { error: closeError } = await supabase
        .from('check_in_windows')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
        })
        .eq('id', window.id)
        .eq('user_id', userId)

    if (closeError) {
        console.error('[runCheckInCycle] failed to close check-in window:', closeError)
        return { success: false, error: 'Check-in cycle ran but failed to mark window as completed' }
    }

    return {
        success: true,
        data: { adjustments: appliedAdjustments },
    }
}

// ─── Is a check-in due? (read-only) ──────────────────────────────────────────

export interface DueCheckIn {
    due: boolean
    reason: string
    weekNumber: number
    mesocycleId: string
    /** True once a self-report exists for this week — the banner should stop nagging. */
    alreadyReported: boolean
}

/**
 * Read-only counterpart to checkAndTriggerCheckIn, for the dashboard.
 *
 * Deliberately does not write. The dashboard calls this during render, and a render
 * that flips window state would mean merely LOOKING at the dashboard advances the
 * coaching cycle. The state transition belongs to completeWeeklyCheckIn, on submit.
 */
export async function getDueCheckIn(
    mesocycleId: string,
    weekNumber: number
): Promise<DueCheckIn | null> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: window, error: windowError } = await loadCheckInWindow(
        supabase, user.id, mesocycleId, weekNumber
    )

    if (windowError || !window) return null

    const { count: completedCount } = await countCompletedAllocatedSessions(
        supabase, user.id, mesocycleId, weekNumber
    )

    const decision = evaluateCheckInTrigger({
        status: window.status as CheckInWindowStatus,
        totalAllocated: window.total_allocated ?? 0,
        completed: completedCount ?? 0,
        allocationStart: new Date(window.allocation_start),
        now: new Date(),
    })

    const { count: reportCount } = await supabase
        .from('athlete_self_reports')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', weekNumber)

    // A window already moved to 'triggered' is still due — the athlete has been asked
    // but has not answered yet. Only a submitted report settles it. The pure rule
    // reports those as NOT due (it refuses to re-trigger), so the reason has to be
    // restated here — otherwise a due check-in carries the reason it was not due.
    const awaitingAnswer = !decision.due && window.status === 'triggered'

    return {
        due: decision.due || awaitingAnswer,
        reason: awaitingAnswer ? 'Already triggered, awaiting self-report' : decision.reason,
        weekNumber,
        mesocycleId,
        alreadyReported: (reportCount ?? 0) > 0,
    }
}

// ─── Complete the weekly check-in (the wiring that was missing) ──────────────

export interface WeeklyCheckInResult {
    adjustments: unknown[]
}

/**
 * The single entry point the check-in UI calls.
 *
 * Until 2026-09-07 every stage of this subsystem existed and NONE of it ran:
 * checkAndTriggerCheckIn, submitSelfReport and runCheckInCycle each had zero callers,
 * so athlete_self_reports stayed empty, all 14 check_in_windows sat at 'open', and
 * runCheckInCycle's self-report signals (35% of the recovery weighting) were
 * permanently pinned to their neutral fallbacks. This function is that wiring.
 *
 * Order matters: the report must land before the cycle reads it, and the trigger must
 * run in between because it is what writes total_completed / missed_sessions /
 * early_completion — the performance half of the same recovery score.
 */
export async function completeWeeklyCheckIn(
    mesocycleId: string,
    weekNumber: number,
    data: SelfReportInput
): Promise<ActionResult<WeeklyCheckInResult>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const submitted = await submitSelfReport(user.id, mesocycleId, weekNumber, data)
    if (!submitted.success) return submitted

    // Moves the window 'open' -> 'triggered' and stamps the completion counters.
    // A window already triggered returns false here; that is fine, not an error.
    await checkAndTriggerCheckIn(user.id, mesocycleId, weekNumber)

    const cycle = await runCheckInCycle(user.id, mesocycleId, weekNumber)
    if (!cycle.success) {
        // The report IS saved — readiness and next week's scoring already improve.
        // Surface the failure without pretending the whole check-in was lost.
        return {
            success: false,
            error: `Self-report saved, but the coaching cycle failed: ${cycle.error}`,
        }
    }

    return { success: true, data: { adjustments: cycle.data.adjustments } }
}
