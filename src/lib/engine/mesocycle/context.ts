/**
 * Mesocycle context builders (Task 11 — engine refactor).
 *
 * Pure helpers that load and shape the AthleteContextPacket and derived
 * methodology-context objects consumed by the mesocycle generation
 * pipeline. Relocated from `src/lib/actions/coaching.actions.ts` so the
 * engine layer owns its own context construction.
 *
 * NOTE: this file does NOT carry a 'use server' directive — it is a
 * non-action helper module imported by both the engine action
 * (`engine/mesocycle/generate.ts`) and the remaining action in
 * `coaching.actions.ts` (`runWeeklyRecoveryCheck`).
 */

import { createClient } from '@/lib/supabase/server'
import type { ActionResult, WorkoutWithSets } from '@/lib/types/training.types'
import type { AthleteBenchmark } from '@/lib/types/database.types'
import type {
    AthleteContextPacket,
    CoachingTeamEntry,
    PreviousWeekSummary,
    WeeklyLoadSummary,
} from '@/lib/types/coach-context'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'
import type { PendingPlannerNotes } from '@/lib/types/pending-planner-notes.types'
import type { MethodologyContext } from '@/lib/ai/prompts/programming'
import type { EnduranceMethodologyContext } from '@/lib/ai/prompts/endurance-coach'
import { computeWeeklyLoadSummary } from '@/lib/scheduling/load-scoring'
import {
    calculate531Wave,
    resolveTrainingMaxForExercise,
    calculateRPVolumeLandmarks,
    calculateWeeklyVolumeTarget,
    calculatePolarizedZoneDistribution,
    calculateDanielsVDOT,
    formatPace,
} from '@/lib/training/methodology-helpers'

// ─── Default Coaching Teams by Goal Archetype ───────────────────────────────

const DEFAULT_COACHING_TEAMS: Record<string, CoachingTeamEntry[]> = {
    hybrid_fitness: [
        { coach: 'strength', priority: 1 },
        { coach: 'endurance', priority: 2 },
        { coach: 'conditioning', priority: 3 },
    ],
    strength_focus: [
        { coach: 'strength', priority: 1 },
        { coach: 'hypertrophy', priority: 2 },
    ],
    endurance_focus: [
        { coach: 'endurance', priority: 1 },
        { coach: 'strength', priority: 2 },
    ],
    conditioning_focus: [
        { coach: 'conditioning', priority: 1 },
        { coach: 'strength', priority: 2 },
        { coach: 'endurance', priority: 3 },
    ],
    longevity: [
        { coach: 'strength', priority: 1 },
        { coach: 'endurance', priority: 2 },
    ],
}

/**
 * Get the coaching team for an athlete, falling back to goal-based defaults.
 */
function resolveCoachingTeam(
    storedTeam: Array<{ coach: string; priority: number }> | null,
    goalArchetype: string | null
): CoachingTeamEntry[] {
    if (storedTeam && storedTeam.length > 0) {
        return storedTeam as CoachingTeamEntry[]
    }
    const archetype = goalArchetype ?? 'hybrid_fitness'
    return DEFAULT_COACHING_TEAMS[archetype] ?? DEFAULT_COACHING_TEAMS.hybrid_fitness
}

// ─── Build Athlete Context Packet ───────────────────────────────────────────

/**
 * Load all athlete data from Supabase and build the AthleteContextPacket.
 * This is the shared Phase 0 — built once, filtered per coach.
 */
export async function buildAthleteContext(
    userId: string,
    mesocycleId: string,
    weekNumber: number,
    options?: {
        includePreviousWeek?: boolean
    }
): Promise<ActionResult<AthleteContextPacket>> {
    const supabase = await createClient()

    // Load profile + mesocycle in parallel
    const [profileResult, mesocycleResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('mesocycles').select('*').eq('id', mesocycleId).eq('user_id', userId).single(),
    ])

    if (profileResult.error || !profileResult.data) {
        return { success: false, error: 'Could not load athlete profile' }
    }
    if (mesocycleResult.error || !mesocycleResult.data) {
        return { success: false, error: 'Could not load mesocycle' }
    }

    const profile = profileResult.data
    const mesocycle = mesocycleResult.data

    // Load injuries, benchmarks, recent training in parallel
    const [injuriesResult, benchmarksResult, recentTrainingResult] = await Promise.all([
        supabase.from('athlete_injuries').select('*').eq('user_id', userId).eq('is_active', true),
        supabase.from('athlete_benchmarks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('recent_training_activity').select('*').eq('user_id', userId),
    ])

    const injuries = injuriesResult.data ?? []
    const benchmarks = deduplicateBenchmarks(benchmarksResult.data ?? [])
    const recentTraining = recentTrainingResult.data ?? []

    // Resolve coaching team
    const coachingTeam = resolveCoachingTeam(
        profile.coaching_team as Array<{ coach: string; priority: number }> | null,
        profile.goal_archetype
    )

    // Get current microcycle
    const { data: microcycle } = await supabase
        .from('microcycles')
        .select('*')
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', weekNumber)
        .eq('user_id', userId)
        .single()

    // Load retrospective + pending notes in parallel (carryover for head coach)
    const [retroResult, profileNotesResult] = await Promise.all([
        supabase
            .from('block_retrospectives')
            .select('snapshot_json')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('profiles')
            .select('pending_planner_notes')
            .eq('id', userId)
            .single(),
    ])

    const latestBlockRetrospective =
        (retroResult.data?.snapshot_json as BlockRetrospectiveSnapshot) ?? null
    const pendingPlannerNotes =
        (profileNotesResult.data?.pending_planner_notes as PendingPlannerNotes) ?? null

    const ctx: AthleteContextPacket = {
        profile,
        coachingTeam,
        injuries,
        benchmarks,
        recentTraining,
        mesocycleId,
        mesocycleGoal: mesocycle.goal,
        weekNumber,
        totalWeeks: mesocycle.week_count,
        isDeload: microcycle?.is_deload ?? false,
        targetRir: microcycle?.target_rir ?? null,
        latestBlockRetrospective,
        pendingPlannerNotes,
    }

    // Load previous week data if requested
    if (options?.includePreviousWeek && weekNumber > 1) {
        const prevWeekData = await loadPreviousWeekData(userId, mesocycleId, weekNumber - 1)
        if (prevWeekData) {
            ctx.previousWeekSessions = prevWeekData.sessions
            ctx.previousWeekLoadSummary = prevWeekData.loadSummary
        }
    }

    return { success: true, data: ctx }
}

// ─── Load Previous Week Data ────────────────────────────────────────────────

async function loadPreviousWeekData(
    userId: string,
    mesocycleId: string,
    prevWeekNumber: number
): Promise<{ sessions: PreviousWeekSummary[]; loadSummary?: WeeklyLoadSummary } | null> {
    const supabase = await createClient()

    const { data: prevMicrocycle } = await supabase
        .from('microcycles')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', prevWeekNumber)
        .eq('user_id', userId)
        .single()

    if (!prevMicrocycle) return null

    const { data: prevWorkouts } = await supabase
        .from('workouts')
        .select('id, name, modality, is_completed')
        .eq('microcycle_id', prevMicrocycle.id)
        .eq('user_id', userId)
        .order('scheduled_date', { ascending: true })

    if (!prevWorkouts || prevWorkouts.length === 0) return null

    const prevWorkoutIds = prevWorkouts.map(w => w.id)
    const { data: prevSets } = await supabase
        .from('exercise_sets')
        .select('workout_id, exercise_name, muscle_group, set_number, target_reps, target_weight_kg, actual_reps, actual_weight_kg, rir_actual, rpe_actual')
        .in('workout_id', prevWorkoutIds)
        .order('set_number', { ascending: true })

    const sessions: PreviousWeekSummary[] = prevWorkouts.map(w => {
        const workoutSets = (prevSets ?? []).filter(s => s.workout_id === w.id)
        const exerciseMap = new Map<string, {
            exerciseName: string
            muscleGroup: string
            sets: number
            targetReps: number
            targetWeightKg: number | null
            actualReps: number | null
            actualWeightKg: number | null
            rirActual: number | null
            rpeActual: number | null
            _rirCount: number
        }>()

        for (const s of workoutSets) {
            const existing = exerciseMap.get(s.exercise_name)
            if (existing) {
                existing.sets += 1
                if (s.target_weight_kg && (!existing.targetWeightKg || s.target_weight_kg > existing.targetWeightKg)) {
                    existing.targetWeightKg = s.target_weight_kg
                }
                if (s.actual_weight_kg && (!existing.actualWeightKg || s.actual_weight_kg > existing.actualWeightKg)) {
                    existing.actualWeightKg = s.actual_weight_kg
                }
                if (s.actual_reps) existing.actualReps = s.actual_reps
                if (s.rir_actual !== null) {
                    existing._rirCount += 1
                    existing.rirActual = existing.rirActual !== null
                        ? ((existing.rirActual * (existing._rirCount - 1)) + s.rir_actual) / existing._rirCount
                        : s.rir_actual
                }
                if (s.rpe_actual !== null) existing.rpeActual = s.rpe_actual
            } else {
                exerciseMap.set(s.exercise_name, {
                    exerciseName: s.exercise_name,
                    muscleGroup: s.muscle_group ?? 'unknown',
                    sets: 1,
                    targetReps: s.target_reps ?? 0,
                    targetWeightKg: s.target_weight_kg,
                    actualReps: s.actual_reps,
                    actualWeightKg: s.actual_weight_kg,
                    rirActual: s.rir_actual,
                    rpeActual: s.rpe_actual,
                    _rirCount: s.rir_actual !== null ? 1 : 0,
                })
            }
        }

        return {
            workoutId: w.id,
            name: w.name,
            modality: w.modality,
            isCompleted: w.is_completed,
            exercises: exerciseMap.size > 0
                ? Array.from(exerciseMap.values()).map(({ _rirCount, ...rest }) => ({
                    ...rest,
                    rirActual: rest.rirActual !== null ? Math.round(rest.rirActual * 10) / 10 : null,
                }))
                : undefined,
        }
    })

    // Compute load summary from completed workouts
    const { data: allPrevWorkouts } = await supabase
        .from('workouts')
        .select('*, exercise_sets(*)')
        .eq('microcycle_id', prevMicrocycle.id)
        .eq('user_id', userId)

    let loadSummary: WeeklyLoadSummary | undefined
    if (allPrevWorkouts && allPrevWorkouts.length > 0) {
        const completedWorkouts = allPrevWorkouts.filter(w => w.is_completed) as WorkoutWithSets[]
        const rawSummary = completedWorkouts.length > 0
            ? computeWeeklyLoadSummary(completedWorkouts)
            : null

        const totalCount = allPrevWorkouts.length
        const completedCount = completedWorkouts.length

        loadSummary = {
            totalSpinalLoad: rawSummary?.totalSpinalLoad ?? 0,
            totalCnsLoad: rawSummary?.totalCnsLoad ?? 0,
            totalLowerBodySets: rawSummary?.totalLowerBodySets ?? 0,
            totalUpperBodySets: rawSummary?.totalUpperBodySets ?? 0,
            avgDailyLoad: rawSummary?.avgDailyLoad ?? 0,
            peakDayLoad: rawSummary?.peakDayLoad ?? 0,
            sessionCount: totalCount,
            completedCount,
            missedCount: totalCount - completedCount,
        }
    }

    return { sessions, loadSummary }
}

// ─── Helper: Deduplicate Benchmarks ─────────────────────────────────────────

export function deduplicateBenchmarks(benchmarks: AthleteBenchmark[]): AthleteBenchmark[] {
    const seen = new Map<string, AthleteBenchmark>()
    for (const b of benchmarks) {
        if (!seen.has(b.benchmark_name)) {
            seen.set(b.benchmark_name, b)
        }
    }
    return Array.from(seen.values())
}

// ─── Helper: Build Strength Methodology Context ─────────────────────────────

export async function buildStrengthMethodologyContext(
    profile: { strength_methodology?: string | null; lifting_experience?: string | null },
    benchmarks: AthleteBenchmark[],
    weekNumber: number,
    totalWeeks: number,
    isDeload: boolean
): Promise<MethodologyContext | undefined> {
    const ctx: MethodologyContext = {}
    const strengthMethod = profile.strength_methodology ?? 'ai_decides'
    const experience = (profile.lifting_experience ?? 'intermediate') as 'beginner' | 'intermediate' | 'advanced'

    // 5/3/1 Protocol
    if (strengthMethod === '531') {
        const weekInCycle = ((weekNumber - 1) % 4) + 1
        const liftMap: Array<[string, string[]]> = [
            ['Squat', ['squat', 'back_squat']],
            ['Bench Press', ['bench', 'bench_press']],
            ['Deadlift', ['deadlift']],
            ['OHP', ['ohp', 'overhead_press', 'overhead']],
        ]
        const lines: string[] = []
        for (const [displayName, keywords] of liftMap) {
            const bm = benchmarks.find(b =>
                keywords.some(kw => b.benchmark_name.toLowerCase().includes(kw))
            )
            if (bm) {
                const tm = await resolveTrainingMaxForExercise(displayName, bm.value, 1)
                const wave = calculate531Wave(tm, weekInCycle)
                const setsStr = wave.sets.map(s =>
                    `${s.reps}${s.isAmrap ? '+' : ''} @ ${s.weightKg}kg (${Math.round(s.percentTM * 100)}%TM)`
                ).join(', ')
                lines.push(`  ${displayName} (TM: ${tm}kg): ${wave.weekLabel} — ${setsStr}`)
            }
        }
        if (lines.length > 0) {
            ctx.liftingProtocol = `5/3/1 Cycle Week ${weekInCycle}${isDeload && weekInCycle === 4 ? ' (DELOAD)' : ''}:\n${lines.join('\n')}`
        }
    }

    // RP Volume landmarks (if hypertrophy is in the team or AI decides)
    const majorGroups = ['Quads', 'Hamstrings', 'Chest', 'Back', 'Shoulders', 'Glutes', 'Biceps', 'Triceps']
    const volumeLines = majorGroups.map(mg => {
        const landmarks = calculateRPVolumeLandmarks(mg, experience)
        const weekTarget = calculateWeeklyVolumeTarget(landmarks, weekNumber, totalWeeks, isDeload)
        return `  ${mg}: ${weekTarget} sets (MEV=${landmarks.mev}, MAV=${landmarks.mav}, MRV=${landmarks.mrv})`
    })
    ctx.volumeTargets = volumeLines.join('\n')

    if (ctx.liftingProtocol || ctx.volumeTargets) {
        return ctx
    }
    return undefined
}

// ─── Helper: Build Endurance Methodology Context ────────────────────────────

export function buildEnduranceMethodologyContext(
    profile: {
        endurance_methodology?: string | null
        available_days?: number | null
        session_duration_minutes?: number | null
        running_experience?: string | null
    },
    benchmarks: AthleteBenchmark[]
): EnduranceMethodologyContext | undefined {
    const ctx: EnduranceMethodologyContext = {}
    const enduranceMethod = profile.endurance_methodology ?? 'ai_decides'
    const experience = profile.running_experience ?? 'beginner'

    // Polarized 80/20 split
    if (enduranceMethod === 'polarized_80_20' || (enduranceMethod === 'ai_decides' && experience !== 'beginner')) {
        const enduranceSessions = Math.ceil((profile.available_days ?? 4) * 0.3)
        const weeklyEnduranceMinutes = (profile.session_duration_minutes ?? 60) * enduranceSessions
        const split = calculatePolarizedZoneDistribution(weeklyEnduranceMinutes)
        ctx.polarizedSplit = `Polarized 80/20: ~${split.easyMinutes} min easy (Zone 2), ~${split.hardMinutes} min hard (Tempo/Threshold/VO2max) across ${enduranceSessions} sessions per week`
    }

    // Daniels' VDOT paces
    if (enduranceMethod === 'daniels_formula' || enduranceMethod === 'ai_decides') {
        const runBenchmark = benchmarks.find(b =>
            ['5k', '10k', 'mile', '1_mile'].some(kw => b.benchmark_name.toLowerCase().includes(kw))
        )
        if (runBenchmark) {
            const distanceKm = runBenchmark.benchmark_name.toLowerCase().includes('10k') ? 10
                : runBenchmark.benchmark_name.toLowerCase().includes('mile') ? 1.609
                : 5
            const timeSeconds = runBenchmark.unit === 'seconds' ? runBenchmark.value
                : runBenchmark.value * 60
            const paces = calculateDanielsVDOT(distanceKm, timeSeconds)
            ctx.trainingPaces = `VDOT: ${paces.vdot}. Easy: ${formatPace(paces.easyPaceSecPerKm)}/km, Tempo: ${formatPace(paces.tempoPaceSecPerKm)}/km, Threshold: ${formatPace(paces.thresholdPaceSecPerKm)}/km, Intervals: ${formatPace(paces.intervalPaceSecPerKm)}/km`
        }
    }

    if (ctx.trainingPaces || ctx.polarizedSplit) {
        return ctx
    }
    return undefined
}

// ─── Helper: Build Volume Targets String for Hypertrophy Coach ───────────────

export function buildVolumeTargetsString(
    profile: { lifting_experience?: string | null },
    weekNumber: number,
    totalWeeks: number,
    isDeload: boolean
): string | undefined {
    const experience = (profile.lifting_experience ?? 'intermediate') as 'beginner' | 'intermediate' | 'advanced'

    const majorGroups = ['Quads', 'Hamstrings', 'Chest', 'Back', 'Shoulders', 'Glutes', 'Biceps', 'Triceps', 'Calves', 'Core']
    const lines = majorGroups.map(mg => {
        const landmarks = calculateRPVolumeLandmarks(mg, experience)
        const weekTarget = calculateWeeklyVolumeTarget(landmarks, weekNumber, totalWeeks, isDeload)
        return `  ${mg}: ${weekTarget} sets/week (MEV=${landmarks.mev}, MAV=${landmarks.mav}, MRV=${landmarks.mrv})`
    })
    return lines.join('\n')
}
