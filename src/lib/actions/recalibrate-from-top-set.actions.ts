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

interface TopSet {
    exercise_name: string
    target_weight_kg: number
    target_reps: number
    actual_weight_kg: number
    actual_reps: number
    rpe_actual: number | null
}

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
    // Top set = max target_weight_kg
    return usable.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (top: any, s: any) =>
            s.target_weight_kg > (top?.target_weight_kg ?? -Infinity) ? s : top,
        null
    )
}

export async function recalibrateFromTopSet(workoutId: string): Promise<void> {
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
                actual_weight_kg, actual_reps, rpe_actual
            )
        `)
        .eq('id', workoutId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (workoutErr) {
        console.error('[recalibrateFromTopSet] workout read failed', workoutErr)
        return
    }
    if (!workout || workout.modality !== 'LIFTING') return

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

    // Group by exercise_name, pick top set per exercise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byExercise = new Map<string, any[]>()
    for (const s of sets) {
        if (!byExercise.has(s.exercise_name)) byExercise.set(s.exercise_name, [])
        byExercise.get(s.exercise_name)!.push(s)
    }

    for (const [exercise, exerciseSets] of byExercise) {
        const top = pickTopSet(exerciseSets)
        if (!top) continue

        const previousMaxOut = trainingMaxSkill.execute({
            weightKg: top.target_weight_kg,
            reps: top.target_reps
        })
        const observedMaxOut = trainingMaxSkill.execute({
            weightKg: top.actual_weight_kg,
            reps: top.actual_reps,
            rpe: top.rpe_actual ?? undefined
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
            if (result.tier === 'visible' || result.tier === 'logged') {
                try {
                    await setTrainingMax({
                        exercise,
                        trainingMaxKg: observedMaxOut.trainingMax,
                        source: 'recalibration'
                    })
                } catch (err) {
                    console.error(
                        `[recalibrateFromTopSet] setTrainingMax failed for ${exercise}`,
                        err
                    )
                }
            }
        } catch (err) {
            console.error(
                `[recalibrateFromTopSet] failed for exercise ${exercise}`, err
            )
        }
    }
}
