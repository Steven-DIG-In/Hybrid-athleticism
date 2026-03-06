/**
 * Load-Aware Auto-Assignment Algorithm
 *
 * Replaces the naive "startDate + index" sequential assignment with a
 * greedy bin-packing scheduler that distributes sessions across the week
 * to minimize load conflicts and maximize recovery between heavy days.
 *
 * Algorithm: Largest-first bin packing
 *   1. Score each session's load
 *   2. Sort heaviest first
 *   3. For each session, pick the day with the lowest composite score
 *      (existing load + conflict penalty + adjacency penalty)
 */

import type { WorkoutWithSets } from '@/lib/types/training.types'
import type { Session, LiftingSession, EnduranceSession } from '@/lib/ai/schemas/programming'
import {
    computeSessionLoadProfile,
    computeConflictPenalty,
    type SessionLoadProfile,
} from './load-scoring'

// ─── Types ─────────────────────────────────────────────────────────────────

interface DaySlot {
    date: string              // YYYY-MM-DD
    sessions: SessionLoadProfile[]
    totalLoad: number
}

// ─── Main Auto-Assignment ──────────────────────────────────────────────────

/**
 * Assign sessions to days within a week range using load-aware scheduling.
 *
 * @param workouts Array of workouts with exercise_sets (used for load scoring)
 * @param weekStartDate Monday YYYY-MM-DD
 * @param weekEndDate Sunday YYYY-MM-DD
 * @param twoADayPreference Athlete's willingness for two-a-day sessions ('yes' | 'sometimes' | 'no')
 * @returns Map of workoutId → assigned YYYY-MM-DD date
 */
export function autoAssignSessionDates(
    workouts: WorkoutWithSets[],
    weekStartDate: string,
    weekEndDate: string,
    twoADayPreference: 'yes' | 'sometimes' | 'no' = 'no'
): Map<string, string> {
    // Build 7 day slots
    const daySlots: DaySlot[] = []
    const start = new Date(weekStartDate + 'T00:00:00')
    const end = new Date(weekEndDate + 'T00:00:00')

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        daySlots.push({
            date: d.toISOString().split('T')[0],
            sessions: [],
            totalLoad: 0,
        })
    }

    if (daySlots.length === 0) {
        return new Map()
    }

    // Compute load profiles for all sessions
    const profiles = workouts.map(w => ({
        workout: w,
        profile: computeSessionLoadProfile(w),
    }))

    // Sort by load descending (heaviest sessions get placed first — best spots)
    profiles.sort((a, b) => b.profile.totalLoad - a.profile.totalLoad)

    // Greedy assignment
    const assignments = new Map<string, string>()

    for (const { workout, profile } of profiles) {
        let bestDay = daySlots[0]
        let bestScore = Infinity

        for (const day of daySlots) {
            // Base score: existing day load + session load
            let score = day.totalLoad + profile.totalLoad

            // Conflict penalty with existing sessions on this day
            score += computeConflictPenalty(profile, day.sessions)

            // Adjacent day penalty: check neighbors
            const dayIndex = daySlots.indexOf(day)
            if (dayIndex > 0) {
                const prevDay = daySlots[dayIndex - 1]
                if (prevDay.totalLoad >= 7 && profile.totalLoad >= 5) {
                    score += 3 // Back-to-back heavy penalty
                }
            }
            if (dayIndex < daySlots.length - 1) {
                const nextDay = daySlots[dayIndex + 1]
                if (nextDay.totalLoad >= 7 && profile.totalLoad >= 5) {
                    score += 3 // Back-to-back heavy penalty
                }
            }

            // Penalize multi-session days based on two-a-day preference
            if (day.sessions.length > 0) {
                const twoADayPenalty = twoADayPreference === 'yes' ? 0
                    : twoADayPreference === 'sometimes' ? 1
                    : 2
                score += twoADayPenalty
            }

            if (score < bestScore) {
                bestScore = score
                bestDay = day
            }
        }

        // Assign to best day
        bestDay.sessions.push(profile)
        bestDay.totalLoad += profile.totalLoad
        assignments.set(workout.id, bestDay.date)
    }

    return assignments
}

// ─── Find Optimal Day for a Single New Session ─────────────────────────────
// Used by regenerateSingleSession() "add" mode

/**
 * Given an existing set of workouts already assigned to days, find the
 * optimal day for a new session.
 */
export function findOptimalDayForSession(
    newSession: WorkoutWithSets,
    existingWorkouts: WorkoutWithSets[],
    weekStartDate: string,
    weekEndDate: string
): string {
    // Build day slots with existing sessions pre-loaded
    const daySlots: DaySlot[] = []
    const start = new Date(weekStartDate + 'T00:00:00')
    const end = new Date(weekEndDate + 'T00:00:00')

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        daySlots.push({
            date: d.toISOString().split('T')[0],
            sessions: [],
            totalLoad: 0,
        })
    }

    // Pre-load existing sessions
    for (const w of existingWorkouts) {
        const profile = computeSessionLoadProfile(w)
        const day = daySlots.find(d => d.date === w.scheduled_date)
        if (day) {
            day.sessions.push(profile)
            day.totalLoad += profile.totalLoad
        }
    }

    // Score the new session against each day
    const newProfile = computeSessionLoadProfile(newSession)
    let bestDay = daySlots[0]
    let bestScore = Infinity

    for (const day of daySlots) {
        let score = day.totalLoad + newProfile.totalLoad
        score += computeConflictPenalty(newProfile, day.sessions)

        const dayIndex = daySlots.indexOf(day)
        if (dayIndex > 0 && daySlots[dayIndex - 1].totalLoad >= 7 && newProfile.totalLoad >= 5) {
            score += 3
        }
        if (dayIndex < daySlots.length - 1 && daySlots[dayIndex + 1].totalLoad >= 7 && newProfile.totalLoad >= 5) {
            score += 3
        }

        // Prefer empty days
        if (day.sessions.length > 0) score += 2

        if (score < bestScore) {
            bestScore = score
            bestDay = day
        }
    }

    return bestDay?.date ?? weekStartDate
}

// ─── Build Temp Workout from AI Session ────────────────────────────────────
// Creates a minimal WorkoutWithSets-like object from the AI's Session data
// so the load scorer can process it before DB insertion.

export function buildTempWorkoutFromSession(
    session: Session,
    index: number
): WorkoutWithSets {
    // Map AI modality to DB modality
    let modality: 'LIFTING' | 'CARDIO' | 'RUCKING' | 'METCON' | 'MOBILITY' = 'LIFTING'
    switch (session.modality) {
        case 'LIFTING': modality = 'LIFTING'; break
        case 'CARDIO': modality = 'CARDIO'; break
        case 'METCON': modality = 'METCON'; break
        case 'MOBILITY': modality = 'MOBILITY'; break
    }

    // Build exercise_sets from lifting sessions
    const exerciseSets: WorkoutWithSets['exercise_sets'] = []
    if (session.modality === 'LIFTING') {
        const liftSession = session as LiftingSession
        let setNumber = 0
        for (const exercise of (liftSession.exercises ?? [])) {
            for (let s = 0; s < (exercise.sets ?? 1); s++) {
                setNumber++
                exerciseSets.push({
                    id: `temp-set-${index}-${setNumber}`,
                    workout_id: `temp-${index}`,
                    user_id: '',
                    exercise_name: exercise.exerciseName ?? 'Unknown',
                    muscle_group: exercise.muscleGroup ?? null,
                    set_number: setNumber,
                    target_reps: exercise.targetReps ?? null,
                    target_weight_kg: exercise.targetWeightKg ?? null,
                    target_rir: exercise.targetRir ?? null,
                    actual_reps: null,
                    actual_weight_kg: null,
                    rir_actual: null,
                    rpe_actual: null,
                    notes: null,
                    is_pr: false,
                    logged_at: null,
                    created_at: new Date().toISOString(),
                } as any)
            }
        }
    }

    return {
        id: `temp-${index}`,
        microcycle_id: '',
        user_id: '',
        modality,
        name: session.name,
        scheduled_date: '', // Will be assigned by the algorithm
        is_allocated: false,
        is_completed: false,
        completed_at: null,
        actual_duration_minutes: null,
        coach_notes: session.coachNotes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        exercise_sets: exerciseSets,
    } as WorkoutWithSets
}
