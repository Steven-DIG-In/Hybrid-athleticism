'use server'

/**
 * Recalibration hook — INTERNAL to server actions.
 *
 * After a LIFTING workout completes, evaluate training-max drift per exercise
 * top set and dispatch to the recalibration gate. Errors are logged — never
 * surface to the athlete. The gate writes `agent_activity` rows and fires
 * coach interventions on large drift; next-session prescriptions are NOT
 * auto-updated in this phase (Phase 2.5).
 */

import { createClient } from '@/lib/supabase/server'
import { trainingMaxSkill } from '@/lib/skills/domains/strength/training-max-estimation'
import { evaluateRecalibration } from './recalibration.actions'
import { setTrainingMax } from './training-maxes.actions'
import { normalizeExerciseKey } from '@/lib/training/exercise-key'
import { estimate1RM } from '@/lib/training/methodology-helpers'

/** What a completed session revealed about one main lift. */
export interface RecalibrationSummaryEntry {
    exercise: string
    previousTrainingMaxKg: number
    observedTrainingMaxKg: number
    estimated1RMKg: number
    /** True when the new training max was actually persisted. */
    applied: boolean
    isPR: boolean
}

interface TopSet {
    exercise_name: string
    target_weight_kg: number
    target_reps: number
    actual_weight_kg: number
    actual_reps: number
    rpe_actual: number | null
    rir_actual: number | null
    is_amrap: boolean | null
}

/**
 * The set that best reveals current strength: the AMRAP if there is one — its
 * rep count is the entire point of the set — otherwise the heaviest actual load.
 *
 * Was max(target_weight_kg), which ignored an athlete who self-regulated up and
 * could not distinguish a 3-rep top single from an 8-rep AMRAP at the same load.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickTopSet(sets: any[]): TopSet | null {
    const usable = sets.filter(
        s =>
            s.target_weight_kg != null &&
            s.target_reps != null &&
            s.actual_weight_kg != null &&
            s.actual_reps != null
    )
    if (!usable.length) return null
    const amraps = usable.filter(s => s.is_amrap)
    const pool = amraps.length ? amraps : usable
    return pool.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (top: any, s: any) =>
            s.actual_weight_kg > (top?.actual_weight_kg ?? -Infinity) ? s : top,
        null
    )
}

export async function recalibrateFromTopSet(
    workoutId: string
): Promise<RecalibrationSummaryEntry[]> {
    const summary: RecalibrationSummaryEntry[] = []
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const { data: workout, error: workoutErr } = await supabase
        .from('workouts')
        .select(`
            id, modality, microcycle_id, session_inventory_id,
            exercise_sets (
                id, exercise_name, set_number,
                target_weight_kg, target_reps,
                actual_weight_kg, actual_reps, rpe_actual, rir_actual, is_amrap
            )
        `)
        .eq('id', workoutId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (workoutErr) {
        console.error('[recalibrateFromTopSet] workout read failed', workoutErr)
        return summary
    }
    if (!workout || workout.modality !== 'LIFTING') return summary

    // Look up mesocycle_id + week_number from session_inventory (if linked)
    let mesocycleId: string | undefined
    let weekNumber: number | undefined
    if (workout.session_inventory_id) {
        const { data: inv } = await supabase
            .from('session_inventory')
            .select('mesocycle_id, week_number')
            .eq('id', workout.session_inventory_id)
            .eq('user_id', user.id)
            .maybeSingle()
        if (inv) {
            mesocycleId = inv.mesocycle_id
            weekNumber = inv.week_number
        }
    }

    const sets = workout.exercise_sets ?? []

    // Group by canonical lift so warm-up / FSL / supplemental variants of the
    // same movement recalibrate together instead of each writing its own max.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byExercise = new Map<string, { label: string; sets: any[] }>()
    for (const s of sets) {
        const key = normalizeExerciseKey(s.exercise_name)
        // Accessories carry no training max — they progress via the
        // week-to-week loop that reads last week's actuals directly.
        if (!key) continue
        if (!byExercise.has(key)) {
            byExercise.set(key, { label: s.exercise_name, sets: [] })
        }
        const group = byExercise.get(key)!
        group.sets.push(s)
        // Prefer the plainest display label ("Back Squat" over "Back Squat (FSL)").
        if (s.exercise_name.length < group.label.length) group.label = s.exercise_name
    }

    for (const [, { label: exercise, sets: exerciseSets }] of byExercise) {
        const top = pickTopSet(exerciseSets)
        if (!top) continue

        const previousMaxOut = trainingMaxSkill.execute({
            weightKg: top.target_weight_kg,
            reps: top.target_reps
        })
        // The logger only ever writes rir_actual — rpe_actual is permanently
        // null for lifting — so the estimator's effort correction was dead and
        // 85kg x3 @ RIR 1 scored identically to the same set at RIR 4.
        // RPE and RIR are complements on the 1-10 scale: rpe = 10 - rir.
        const effectiveRpe =
            top.rpe_actual ?? (top.rir_actual != null ? 10 - top.rir_actual : undefined)

        const observedMaxOut = trainingMaxSkill.execute({
            weightKg: top.actual_weight_kg,
            reps: top.actual_reps,
            rpe: effectiveRpe
        })

        try {
            const result = await evaluateRecalibration({
                coach: 'strength',
                previousMax: previousMaxOut.trainingMax,
                observedMax: observedMaxOut.trainingMax,
                evidence: {
                    sessionIds: [workoutId],
                    exercise,
                    topSet: {
                        targetWeightKg: top.target_weight_kg,
                        targetReps: top.target_reps,
                        actualWeightKg: top.actual_weight_kg,
                        actualReps: top.actual_reps,
                        rpeActual: top.rpe_actual
                    }
                },
                targetEntity: { type: 'training_max', exercise },
                mesocycleId,
                weekNumber,
                microcycleId: workout.microcycle_id
            })

            // Tiers 'visible' and 'logged' auto-apply the new TM. The
            // 'intervention' tier waits for athlete acknowledgment before
            // persisting (handled in respondToIntervention).
            let applied = false
            if (result.tier === 'visible' || result.tier === 'logged') {
                try {
                    // Returns null when the lift isn't a main lift — treat that
                    // as "nothing recorded", not as a successful write.
                    applied = (await setTrainingMax({
                        exercise,
                        trainingMaxKg: observedMaxOut.trainingMax,
                        source: 'recalibration'
                    })) !== null
                } catch (err) {
                    console.error(
                        `[recalibrateFromTopSet] setTrainingMax failed for ${exercise}`,
                        err
                    )
                }
            }

            summary.push({
                exercise,
                previousTrainingMaxKg: previousMaxOut.trainingMax,
                observedTrainingMaxKg: observedMaxOut.trainingMax,
                estimated1RMKg: estimate1RM(top.actual_weight_kg, top.actual_reps),
                applied,
                isPR: observedMaxOut.trainingMax > previousMaxOut.trainingMax,
            })
        } catch (err) {
            console.error(
                `[recalibrateFromTopSet] failed for exercise ${exercise}`, err
            )
        }
    }

    return summary
}
