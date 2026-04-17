/**
 * Load Scoring System for Hybrid Athleticism
 *
 * Computes per-session load profiles and per-day aggregate load summaries.
 * Used by:
 *   - Auto-assignment algorithm (server-side, at generation time)
 *   - Week calendar UI (client-side, for load indicators)
 *
 * All functions are pure — no DB calls, no side effects.
 */

import type { WorkoutWithSets } from '@/lib/types/training.types'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SessionLoadProfile {
    sessionId: string
    sessionName: string
    totalLoad: number            // 0–10 aggregate
    cnsLoad: number              // 0–10
    muscularLoad: number         // 0–10
    primaryMuscleGroups: string[]
    modality: string
    isHighIntensity: boolean
    isBenchmarkTest: boolean
    isLowerBodyDominant: boolean
    isUpperBodyDominant: boolean
}

export interface DayLoadSummary {
    date: string                 // YYYY-MM-DD
    dayOfWeek: string            // 'Mon', 'Tue', etc.
    sessions: SessionLoadProfile[]
    totalLoad: number            // sum of session loads
    status: LoadStatus
    conflicts: ConflictWarning[]
}

export type LoadStatus = 'rest' | 'light' | 'moderate' | 'heavy' | 'overloaded'

export interface ConflictWarning {
    type: 'same_muscles' | 'high_cns_stack' | 'benchmark_not_isolated' | 'adjacent_heavy'
    severity: 'warning' | 'critical'
    message: string
    sessionIds: [string, string]
}

export interface LoadStatusColors {
    bg: string
    border: string
    text: string
    dot: string
}

// ─── Constants ─────────────────────────────────────────────────────────────

const LOWER_BODY_MUSCLES = new Set([
    'quads', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors',
    'hip_flexors', 'legs', 'lower_body', 'posterior_chain',
])

const UPPER_BODY_MUSCLES = new Set([
    'chest', 'pecs', 'back', 'lats', 'shoulders', 'delts', 'deltoids',
    'biceps', 'triceps', 'forearms', 'upper_body', 'traps', 'rhomboids',
])

const COMPOUND_EXERCISES = new Set([
    'back squat', 'front squat', 'squat', 'deadlift', 'conventional deadlift',
    'sumo deadlift', 'romanian deadlift', 'rdl', 'bench press', 'overhead press',
    'ohp', 'military press', 'barbell row', 'bent over row', 'pull up', 'pull-up',
    'chin up', 'chin-up', 'clean', 'power clean', 'snatch', 'clean and jerk',
    'thruster', 'push press', 'hip thrust', 'lunge', 'walking lunge',
    'bulgarian split squat', 'step up', 'dip', 'dips', 'pendlay row',
])

const HEAVY_LOWER_EXERCISES = new Set([
    'back squat', 'front squat', 'squat', 'deadlift', 'conventional deadlift',
    'sumo deadlift', 'hip thrust', 'leg press',
])

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Session Load Profile ──────────────────────────────────────────────────

export function computeSessionLoadProfile(workout: WorkoutWithSets): SessionLoadProfile {
    const modality = workout.modality
    const name = (workout.name ?? '').toLowerCase()
    const sets = workout.exercise_sets ?? []
    const coachNotes = (workout.coach_notes ?? '').toLowerCase()

    // Detect benchmark test
    const isBenchmarkTest = name.includes('benchmark') || name.includes('test') ||
        coachNotes.includes('benchmark') || coachNotes.includes('max test')

    // Detect mobility
    const isMobility = name.includes('mobility') || name.includes('stretch') ||
        name.includes('recovery') || name.includes('yoga') || name.includes('flexibility')

    // Extract muscle groups from exercise sets
    const muscleGroups = [...new Set(
        sets
            .map(s => (s.muscle_group ?? '').toLowerCase().trim())
            .filter(Boolean)
    )]

    const isLowerBodyDominant = muscleGroups.some(mg => LOWER_BODY_MUSCLES.has(mg))
    const isUpperBodyDominant = muscleGroups.some(mg => UPPER_BODY_MUSCLES.has(mg))

    // Count compound movements and heavy lower body exercises
    const exerciseNames = [...new Set(sets.map(s => (s.exercise_name ?? '').toLowerCase().trim()))]
    const compoundCount = exerciseNames.filter(e => COMPOUND_EXERCISES.has(e)).length
    const hasHeavyLower = exerciseNames.some(e => HEAVY_LOWER_EXERCISES.has(e))
    const totalSets = sets.length

    let totalLoad = 0
    let cnsLoad = 0
    let muscularLoad = 0
    let isHighIntensity = false

    if (isMobility) {
        // Mobility sessions are always low
        totalLoad = 1
        cnsLoad = 0
        muscularLoad = 1
    } else if (modality === 'LIFTING') {
        totalLoad = 5
        cnsLoad = 3
        muscularLoad = 5

        // Compound modifier
        if (compoundCount >= 2) { totalLoad += 1; cnsLoad += 1 }

        // Heavy lower body modifier
        if (hasHeavyLower) { totalLoad += 1; cnsLoad += 1; muscularLoad += 1 }

        // Volume modifier
        if (totalSets > 20) { totalLoad += 1; muscularLoad += 1 }

        isHighIntensity = hasHeavyLower && compoundCount >= 2
    } else if (modality === 'METCON') {
        totalLoad = 6
        cnsLoad = 5
        muscularLoad = 4
        isHighIntensity = true

        // Max effort modifier
        if (coachNotes.includes('max') || coachNotes.includes('amrap') || name.includes('max')) {
            totalLoad += 1
            cnsLoad += 1
        }

        // Duration modifier
        if (coachNotes.includes('30') || coachNotes.includes('40') || coachNotes.includes('45')) {
            totalLoad += 1
        }
    } else if (modality === 'CARDIO') {
        // Detect intensity from name/notes
        const isEasy = name.includes('easy') || name.includes('zone 2') || name.includes('z2') ||
            coachNotes.includes('easy') || coachNotes.includes('zone 2') || name.includes('recovery')
        const isTempo = name.includes('tempo') || name.includes('steady') || name.includes('moderate') ||
            coachNotes.includes('tempo')
        const isHard = name.includes('interval') || name.includes('threshold') || name.includes('vo2') ||
            name.includes('time trial') || name.includes('sprint') || name.includes('fartlek') ||
            coachNotes.includes('interval') || coachNotes.includes('threshold')

        if (isEasy) {
            totalLoad = 2
            cnsLoad = 1
            muscularLoad = 2
        } else if (isTempo) {
            totalLoad = 4
            cnsLoad = 2
            muscularLoad = 3
        } else if (isHard || isBenchmarkTest) {
            totalLoad = 6
            cnsLoad = 4
            muscularLoad = 4
            isHighIntensity = true
        } else {
            // Default moderate
            totalLoad = 3
            cnsLoad = 2
            muscularLoad = 3
        }

        // Benchmark test modifier
        if (isBenchmarkTest) { totalLoad += 1; cnsLoad += 1 }

        // Infer muscle groups from cardio type
        if (name.includes('run') || name.includes('ruck') || name.includes('cycle') || name.includes('bike')) {
            if (!isLowerBodyDominant) muscleGroups.push('lower_body')
        }
        if (name.includes('row') || name.includes('swim')) {
            if (!isUpperBodyDominant) muscleGroups.push('upper_body')
        }
    } else if (modality === 'MOBILITY') {
        // Explicit MOBILITY modality — always low load
        totalLoad = 1
        cnsLoad = 0
        muscularLoad = 1
    } else if (modality === 'RUCKING') {
        totalLoad = 4
        cnsLoad = 2
        muscularLoad = 4

        // Rucking is always lower body dominant
        if (!isLowerBodyDominant) muscleGroups.push('lower_body')

        // Heavy ruck modifier
        if (coachNotes.includes('heavy') || name.includes('heavy')) {
            totalLoad += 1
            muscularLoad += 1
        }
    }

    // Clamp values to 0-10
    totalLoad = Math.min(10, Math.max(0, totalLoad))
    cnsLoad = Math.min(10, Math.max(0, cnsLoad))
    muscularLoad = Math.min(10, Math.max(0, muscularLoad))

    return {
        sessionId: workout.id,
        sessionName: workout.name,
        totalLoad,
        cnsLoad,
        muscularLoad,
        primaryMuscleGroups: muscleGroups,
        modality,
        isHighIntensity,
        isBenchmarkTest,
        isLowerBodyDominant: muscleGroups.some(mg => LOWER_BODY_MUSCLES.has(mg)) || false,
        isUpperBodyDominant: muscleGroups.some(mg => UPPER_BODY_MUSCLES.has(mg)) || false,
    }
}

// ─── Day Aggregate & Conflict Detection ────────────────────────────────────

export function computeWeekLoad(
    workouts: WorkoutWithSets[],
    weekStartDate: string,
    weekEndDate: string
): DayLoadSummary[] {
    // Build 7-day array from start to end
    const days: DayLoadSummary[] = []
    const start = new Date(weekStartDate + 'T00:00:00')
    const end = new Date(weekEndDate + 'T00:00:00')

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        const dateStr = `${y}-${m}-${dd}`
        const dayIndex = (d.getDay() + 6) % 7 // Convert Sun=0 to Mon=0 indexing
        days.push({
            date: dateStr,
            dayOfWeek: DAY_NAMES[dayIndex] ?? 'Day',
            sessions: [],
            totalLoad: 0,
            status: 'rest',
            conflicts: [],
        })
    }

    // Assign sessions to days — skip unallocated workouts
    const loadProfiles = new Map<string, SessionLoadProfile>()
    for (const workout of workouts) {
        // Skip unallocated sessions (they aren't on the calendar yet)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((workout as any).is_allocated === false) continue

        const profile = computeSessionLoadProfile(workout)
        loadProfiles.set(workout.id, profile)

        const day = days.find(d => d.date === workout.scheduled_date)
        if (day) {
            day.sessions.push(profile)
            day.totalLoad += profile.totalLoad
        }
    }

    // Compute status and conflicts for each day
    for (const day of days) {
        day.status = getLoadStatus(day.totalLoad)
        day.conflicts = detectDayConflicts(day.sessions)
    }

    // Check adjacent-day conflicts
    for (let i = 1; i < days.length; i++) {
        const prev = days[i - 1]
        const curr = days[i]
        if (
            (prev.status === 'heavy' || prev.status === 'overloaded') &&
            (curr.status === 'heavy' || curr.status === 'overloaded')
        ) {
            // Only add if both days have sessions
            if (prev.sessions.length > 0 && curr.sessions.length > 0) {
                const warning: ConflictWarning = {
                    type: 'adjacent_heavy',
                    severity: 'warning',
                    message: `Back-to-back heavy days (${prev.dayOfWeek} + ${curr.dayOfWeek}) may impact recovery.`,
                    sessionIds: [prev.sessions[0].sessionId, curr.sessions[0].sessionId],
                }
                // Add to both days
                curr.conflicts.push(warning)
            }
        }
    }

    return days
}

function getLoadStatus(totalLoad: number): LoadStatus {
    if (totalLoad === 0) return 'rest'
    if (totalLoad <= 3) return 'light'
    if (totalLoad <= 6) return 'moderate'
    if (totalLoad <= 8) return 'heavy'
    return 'overloaded'
}

function detectDayConflicts(sessions: SessionLoadProfile[]): ConflictWarning[] {
    const conflicts: ConflictWarning[] = []
    if (sessions.length < 2) return conflicts

    for (let i = 0; i < sessions.length; i++) {
        for (let j = i + 1; j < sessions.length; j++) {
            const a = sessions[i]
            const b = sessions[j]

            // Same muscle group overlap
            const sharedMuscles = a.primaryMuscleGroups.filter(mg => b.primaryMuscleGroups.includes(mg))
            if (sharedMuscles.length > 0 && a.modality === 'LIFTING' && b.modality === 'LIFTING') {
                conflicts.push({
                    type: 'same_muscles',
                    severity: 'warning',
                    message: `Both "${a.sessionName}" and "${b.sessionName}" target ${sharedMuscles.join(', ')}. Consider spacing these out.`,
                    sessionIds: [a.sessionId, b.sessionId],
                })
            }

            // High CNS stack: METCON + heavy lifting or two high-intensity sessions
            if (
                (a.modality === 'METCON' && b.isHighIntensity) ||
                (b.modality === 'METCON' && a.isHighIntensity) ||
                (a.isHighIntensity && b.isHighIntensity && a.modality !== b.modality)
            ) {
                conflicts.push({
                    type: 'high_cns_stack',
                    severity: 'critical',
                    message: `"${a.sessionName}" + "${b.sessionName}" on the same day is a high CNS load. Consider separating.`,
                    sessionIds: [a.sessionId, b.sessionId],
                })
            }

            // Benchmark not isolated
            if (
                (a.isBenchmarkTest && b.totalLoad >= 4) ||
                (b.isBenchmarkTest && a.totalLoad >= 4)
            ) {
                conflicts.push({
                    type: 'benchmark_not_isolated',
                    severity: 'warning',
                    message: `Benchmark test should ideally be on its own day for accurate results.`,
                    sessionIds: [a.sessionId, b.sessionId],
                })
            }
        }
    }

    return conflicts
}

// ─── Spinal Loading Exercises ──────────────────────────────────────────────

const SPINAL_LOADING_EXERCISES = new Set([
    'back squat', 'front squat', 'squat', 'deadlift', 'conventional deadlift',
    'sumo deadlift', 'romanian deadlift', 'rdl', 'barbell row', 'bent over row',
    'pendlay row', 'overhead press', 'ohp', 'military press', 'good morning',
    'clean', 'power clean', 'snatch', 'clean and jerk', 'thruster', 'push press',
])

// ─── Weekly Load Summary ──────────────────────────────────────────────────

export interface WeeklyLoadSummary {
    totalSpinalLoad: number
    totalCnsLoad: number
    totalMuscularLoad: number
    totalLowerBodySets: number
    totalUpperBodySets: number
    avgDailyLoad: number
    peakDayLoad: number
    sessionCount: number
}

/**
 * Compute aggregate load metrics for an entire week of training.
 * Used to feed back into the AI programming prompt for the next week.
 */
export function computeWeeklyLoadSummary(
    workouts: WorkoutWithSets[]
): WeeklyLoadSummary {
    let totalSpinalLoad = 0
    let totalCnsLoad = 0
    let totalMuscularLoad = 0
    let totalLowerBodySets = 0
    let totalUpperBodySets = 0
    let peakDayLoad = 0

    const dayLoadMap = new Map<string, number>()

    for (const w of workouts) {
        const profile = computeSessionLoadProfile(w)
        totalCnsLoad += profile.cnsLoad
        totalMuscularLoad += profile.muscularLoad

        // Track daily loads for peak calculation
        const day = w.scheduled_date
        const dayLoad = (dayLoadMap.get(day) ?? 0) + profile.totalLoad
        dayLoadMap.set(day, dayLoad)
        if (dayLoad > peakDayLoad) peakDayLoad = dayLoad

        // Count body part sets and spinal load from exercise data
        for (const s of w.exercise_sets ?? []) {
            const mg = (s.muscle_group ?? '').toLowerCase()
            if (LOWER_BODY_MUSCLES.has(mg)) totalLowerBodySets++
            if (UPPER_BODY_MUSCLES.has(mg)) totalUpperBodySets++

            // Spinal load: tonnage from spinal-loading exercises
            const en = (s.exercise_name ?? '').toLowerCase()
            if (SPINAL_LOADING_EXERCISES.has(en)) {
                const weight = s.actual_weight_kg ?? s.target_weight_kg ?? 0
                const reps = s.actual_reps ?? s.target_reps ?? 0
                totalSpinalLoad += (weight * reps) / 1000
            }
        }

        // Rucking adds systemic spinal load
        if (w.modality === 'RUCKING' || (w.name ?? '').toLowerCase().includes('ruck')) {
            totalSpinalLoad += profile.totalLoad * 0.5
        }
    }

    const activeDays = dayLoadMap.size || 1

    return {
        totalSpinalLoad: Math.round(totalSpinalLoad * 10) / 10,
        totalCnsLoad,
        totalMuscularLoad,
        totalLowerBodySets,
        totalUpperBodySets,
        avgDailyLoad: Math.round((totalCnsLoad + totalMuscularLoad) / activeDays * 10) / 10,
        peakDayLoad,
        sessionCount: workouts.length,
    }
}

// ─── computeDayLoad (unit-testable aggregation helper) ─────────────────────

/**
 * Minimal input shape for `computeDayLoad`. Sessions with a null
 * `scheduled_date` are treated as unscheduled and excluded.
 *
 * This helper is the explicit contract for "aggregate load by calendar date,
 * not training_day". `computeWeekLoad` and `computeWeeklyLoadSummary` follow
 * the same invariant but operate on richer `WorkoutWithSets` inputs; this
 * helper lets unit tests pin the invariant without needing full workout fixtures.
 */
export interface DayLoadInput {
    scheduled_date: string | null
    training_day: number
    cns_load?: number
    muscular_load?: number
}

export function computeDayLoad(
    sessions: DayLoadInput[]
): Record<string, { cns: number; muscular: number }> {
    const out: Record<string, { cns: number; muscular: number }> = {}
    for (const s of sessions) {
        if (!s.scheduled_date) continue
        const key = s.scheduled_date
        if (!out[key]) out[key] = { cns: 0, muscular: 0 }
        out[key].cns += s.cns_load ?? 0
        out[key].muscular += s.muscular_load ?? 0
    }
    return out
}

// ─── Load Status Colors ────────────────────────────────────────────────────

export function getLoadStatusColors(status: LoadStatus): LoadStatusColors {
    switch (status) {
        case 'rest':
            return {
                bg: 'bg-[#0a0a0a]',
                border: 'border-[#222]',
                text: 'text-neutral-600',
                dot: '',
            }
        case 'light':
            return {
                bg: 'bg-emerald-950/10',
                border: 'border-emerald-900/30',
                text: 'text-emerald-400',
                dot: 'bg-emerald-400',
            }
        case 'moderate':
            return {
                bg: 'bg-cyan-950/10',
                border: 'border-cyan-900/30',
                text: 'text-cyan-400',
                dot: 'bg-cyan-400',
            }
        case 'heavy':
            return {
                bg: 'bg-amber-950/10',
                border: 'border-amber-900/30',
                text: 'text-amber-400',
                dot: 'bg-amber-400',
            }
        case 'overloaded':
            return {
                bg: 'bg-red-950/10',
                border: 'border-red-900/30',
                text: 'text-red-400',
                dot: 'bg-red-400',
            }
    }
}

// ─── Utility: Compute conflict penalty for a candidate day assignment ──────
// Used by the auto-assign algorithm (Phase 3)

export function computeConflictPenalty(
    candidateSession: SessionLoadProfile,
    existingSessions: SessionLoadProfile[]
): number {
    let penalty = 0

    for (const existing of existingSessions) {
        // Same muscle overlap
        const sharedMuscles = candidateSession.primaryMuscleGroups.filter(
            mg => existing.primaryMuscleGroups.includes(mg)
        )
        if (sharedMuscles.length > 0) penalty += 5

        // METCON + heavy lifting
        if (
            (candidateSession.modality === 'METCON' && existing.isHighIntensity) ||
            (existing.modality === 'METCON' && candidateSession.isHighIntensity)
        ) penalty += 5

        // Two high-intensity sessions
        if (candidateSession.isHighIntensity && existing.isHighIntensity) penalty += 5

        // Benchmark not isolated
        if (candidateSession.isBenchmarkTest || existing.isBenchmarkTest) penalty += 10
    }

    return penalty
}
