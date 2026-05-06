/**
 * Microcycle persistence + conversion helpers (Task 12 — engine refactor).
 *
 * Pure helpers relocated from `src/lib/actions/programming.actions.ts`.
 * They convert AI session schemas to DB rows and write workouts'
 * downstream tables (`exercise_sets`, `cardio_logs`).
 *
 * NOTE: this file does NOT carry a 'use server' directive — it is a
 * non-action helper module imported by both `engine/microcycle/generate-pool.ts`
 * and (still) `programming.actions.ts` (`regenerateSingleSession`, until
 * that moves in Task 13).
 */

import type { createClient } from '@/lib/supabase/server'
import type {
    Session,
    LiftingSession,
    EnduranceSession,
    ConditioningSession,
    MobilitySession,
} from '@/lib/ai/schemas/programming'

/**
 * Map AI schema modality to DB workout_modality enum.
 */
export function mapModality(aiModality: Session['modality']): 'LIFTING' | 'CARDIO' | 'RUCKING' | 'METCON' | 'MOBILITY' {
    switch (aiModality) {
        case 'LIFTING': return 'LIFTING'
        case 'CARDIO': return 'CARDIO'
        case 'METCON': return 'METCON'
        case 'MOBILITY': return 'MOBILITY'
        default: return 'LIFTING'
    }
}

/**
 * Build coach notes based on session type and transparency preference.
 */
export function buildCoachNotes(session: Session, transparency: string): string | null {
    const parts: string[] = []

    // For METCON sessions, the workoutDescription IS the workout — must be persisted
    if (session.modality === 'METCON') {
        const condSession = session as ConditioningSession
        if (condSession.workoutDescription) {
            parts.push(`WORKOUT:\n${condSession.workoutDescription}`)
        }
        const meta: string[] = []
        if (condSession.conditioningType) meta.push(condSession.conditioningType.toUpperCase())
        if (condSession.targetIntensity) meta.push(`Intensity: ${condSession.targetIntensity}`)
        if (condSession.estimatedDurationMinutes) meta.push(`~${condSession.estimatedDurationMinutes} min`)
        if (meta.length > 0) parts.push(meta.join(' · '))
    }

    // For MOBILITY sessions, the description IS the session content
    if (session.modality === 'MOBILITY') {
        const mobSession = session as MobilitySession
        if (mobSession.description) {
            parts.push(`SESSION:\n${mobSession.description}`)
        }
        if (mobSession.focusAreas?.length) {
            parts.push(`Focus: ${mobSession.focusAreas.join(', ')}`)
        }
    }

    // For CARDIO sessions, build structured session prescription
    if (session.modality === 'CARDIO') {
        const endSession = session as EnduranceSession
        const sessionParts: string[] = []

        // Distance or duration
        if (endSession.targetDistanceKm !== null && endSession.targetDistanceKm > 0) {
            sessionParts.push(`${endSession.targetDistanceKm}km`)
        } else if (endSession.estimatedDurationMinutes) {
            sessionParts.push(`${endSession.estimatedDurationMinutes} minutes`)
        }

        // Pace
        if (endSession.targetPaceSecPerKm != null && endSession.targetPaceSecPerKm > 0) {
            const pace = endSession.targetPaceSecPerKm
            const paceMinutes = Math.floor(pace / 60)
            const paceSeconds = Math.round(pace % 60)
            sessionParts.push(`@ ${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}/km pace`)
        }

        // Interval structure
        if (endSession.intervalStructure) {
            sessionParts.push(endSession.intervalStructure)
        }

        if (sessionParts.length > 0) {
            parts.push(`SESSION:\n${sessionParts.join(' ')}`)
        }

        // Add metadata line
        const meta: string[] = []
        if (endSession.intensityZone) {
            meta.push(endSession.intensityZone.replace('_', ' ').toUpperCase())
        }
        if (endSession.enduranceModality) {
            meta.push(endSession.enduranceModality)
        }
        if (endSession.estimatedDurationMinutes) {
            meta.push(`~${endSession.estimatedDurationMinutes} min`)
        }
        if (meta.length > 0) {
            parts.push(meta.join(' · '))
        }
    }

    if (session.coachNotes) {
        parts.push(session.coachNotes)
    }

    if (transparency === 'detailed') {
        if (session.modality === 'LIFTING') {
            const liftSession = session as LiftingSession
            if (liftSession.mobilityPrimer) {
                parts.push(`Mobility primer: ${liftSession.mobilityPrimer}`)
            }
        }
    }

    return parts.length > 0 ? parts.join('\n\n') : null
}

/**
 * Insert exercise_sets for a lifting session.
 */
export async function insertLiftingSets(
    supabase: Awaited<ReturnType<typeof createClient>>,
    workoutId: string,
    userId: string,
    session: LiftingSession
): Promise<void> {
    const rows: Array<{
        workout_id: string
        user_id: string
        exercise_name: string
        muscle_group: string
        set_number: number
        target_reps: number
        target_weight_kg: number | null
        target_rir: number
        notes: string | null
    }> = []

    let globalSetNumber = 1
    for (const exercise of session.exercises) {
        for (let s = 0; s < exercise.sets; s++) {
            rows.push({
                workout_id: workoutId,
                user_id: userId,
                exercise_name: exercise.exerciseName,
                muscle_group: exercise.muscleGroup,
                set_number: globalSetNumber,
                target_reps: exercise.targetReps,
                target_weight_kg: exercise.targetWeightKg,
                target_rir: exercise.targetRir,
                notes: exercise.notes ?? (exercise.isBenchmarkTest ? 'BENCHMARK TEST — log carefully' : null),
            })
            globalSetNumber++
        }
    }

    if (rows.length > 0) {
        const { error } = await supabase.from('exercise_sets').insert(rows)
        if (error) {
            console.error(`[insertLiftingSets] Failed for workout ${workoutId}:`, error)
        }
    }
}

/**
 * Insert a cardio_log target entry for an endurance session.
 * This creates a "target" row that the athlete fills in with actuals during logging.
 */
export async function insertEnduranceTarget(
    supabase: Awaited<ReturnType<typeof createClient>>,
    workoutId: string,
    userId: string,
    session: EnduranceSession
): Promise<void> {
    // Map intensity zone to cardio_type
    const cardioTypeMap: Record<string, string> = {
        zone_2: 'ZONE_2',
        easy: 'EASY',
        tempo: 'TEMPO',
        threshold: 'TEMPO',
        vo2max: 'VO2_MAX',
        interval: 'VO2_MAX',
    }

    const { error } = await supabase.from('cardio_logs').insert({
        workout_id: workoutId,
        user_id: userId,
        cardio_type: cardioTypeMap[session.intensityZone] ?? 'ZONE_2',
        duration_minutes: session.estimatedDurationMinutes,
        distance_km: session.targetDistanceKm ?? null,
        avg_pace_sec_per_km: session.targetPaceSecPerKm ?? null,
    })

    if (error) {
        console.error(`[insertEnduranceTarget] Failed for workout ${workoutId}:`, error)
    }
}
