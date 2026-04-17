'use server'

/**
 * Recalibration gate — INTERNAL to server actions.
 *
 * Evaluates a performance delta and decides how to respond:
 *   - drift < 5%   → auto-apply, log a visible note, create agent_activity row
 *   - drift 5–10%  → auto-apply, log agent_activity row
 *   - drift > 10%  → do NOT auto-apply; create ai_coach_intervention + agent_activity row
 *
 * Throws on auth/DB errors. Callers (completeWorkout) wrap in ActionResult.
 */

import { logDecision, type AgentCoach } from './agent-activity.actions'
import { saveCoachIntervention } from './ai-coach.actions'

export type RecalibrationTier = 'visible' | 'logged' | 'intervention'

export interface RecalibrationInput {
    coach: AgentCoach
    previousMax: number
    observedMax: number
    evidence: { sessionIds: string[]; [k: string]: unknown }
    targetEntity?: Record<string, unknown>
    mesocycleId?: string
    weekNumber?: number
    /** Required to create an ai_coach_intervention on the top tier. */
    microcycleId?: string
}

export interface RecalibrationResult {
    tier: RecalibrationTier
    applied: boolean
    newMax: number
    driftPct: number
}

const VISIBLE_THRESHOLD = 0.05
const LOGGED_THRESHOLD = 0.10

export async function evaluateRecalibration(
    input: RecalibrationInput
): Promise<RecalibrationResult> {
    if (input.previousMax === 0) {
        throw new Error('previousMax cannot be zero')
    }

    const driftPct = (input.observedMax - input.previousMax) / input.previousMax
    const absDrift = Math.abs(driftPct)

    const base = {
        coach: input.coach,
        targetEntity: input.targetEntity ?? { type: 'training_max' },
        mesocycleId: input.mesocycleId,
        weekNumber: input.weekNumber
    }

    if (absDrift < VISIBLE_THRESHOLD) {
        await logDecision({
            ...base,
            decisionType: 'recalibration',
            reasoningStructured: {
                previousMax: input.previousMax,
                newMax: input.observedMax,
                driftPct: Number(driftPct.toFixed(4)),
                tier: 'visible',
                evidence: input.evidence
            },
            reasoningText:
                `Training max: ${input.previousMax}→${input.observedMax}kg ` +
                `(${(driftPct * 100).toFixed(1)}%)`
        })
        return { tier: 'visible', applied: true, newMax: input.observedMax, driftPct }
    }

    if (absDrift <= LOGGED_THRESHOLD) {
        await logDecision({
            ...base,
            decisionType: 'recalibration',
            reasoningStructured: {
                previousMax: input.previousMax,
                newMax: input.observedMax,
                driftPct: Number(driftPct.toFixed(4)),
                tier: 'logged',
                evidence: input.evidence
            },
            reasoningText:
                `Training max recalibrated ${input.previousMax}→${input.observedMax}kg`
        })
        return { tier: 'logged', applied: true, newMax: input.observedMax, driftPct }
    }

    // > 10% — create intervention (if microcycleId known), always log agent_activity.
    let interventionId: string | null = null
    if (input.microcycleId) {
        const result = await saveCoachIntervention({
            microcycleId: input.microcycleId,
            triggerType: 'recalibration_prompt',
            rationale:
                `${input.coach} coach detected large drift ` +
                `(${(driftPct * 100).toFixed(1)}%). Previous max ${input.previousMax}kg, ` +
                `observed ${input.observedMax}kg across ${input.evidence.sessionIds.length} ` +
                `sessions. Athlete decides: keep prescription / apply harder / recalibrate down.`,
            inputPayload: {
                previousMax: input.previousMax,
                observedMax: input.observedMax,
                driftPct: Number(driftPct.toFixed(4)),
                evidence: input.evidence
            }
        })
        if (!result.success) {
            console.error('saveCoachIntervention failed in recalibration', result.error)
        } else {
            interventionId = result.data?.id ?? null
        }
    } else {
        console.error(
            'evaluateRecalibration: drift > 10% but no microcycleId provided — ' +
            'skipping ai_coach_intervention; agent_activity will still be logged.'
        )
    }

    await logDecision({
        ...base,
        decisionType: 'intervention_fired',
        targetEntity: interventionId
            ? { type: 'intervention', id: interventionId }
            : { type: 'intervention', id: null, note: 'skipped-no-microcycle' },
        reasoningStructured: {
            previousMax: input.previousMax,
            observedMax: input.observedMax,
            driftPct: Number(driftPct.toFixed(4)),
            tier: 'intervention',
            interventionId,
            evidence: input.evidence
        },
        reasoningText:
            `Large drift (${(driftPct * 100).toFixed(1)}%) — coach asked to decide`
    })

    return {
        tier: 'intervention',
        applied: false,
        newMax: input.previousMax,
        driftPct
    }
}
