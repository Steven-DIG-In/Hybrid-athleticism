'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types/training.types'
import { latestBloodworkSnapshot } from '@/lib/analytics/health/bloodwork-snapshot'
import { garminSevenDayTrends } from '@/lib/analytics/health/garmin-trends'
import { activeSupplementsSnapshot } from '@/lib/analytics/health/supplements-snapshot'
import type {
    TrainingOverviewData,
    WeeklyLoadData,
    ModalityDistribution,
    RecentSession,
    StrengthAnalyticsData,
    PersonalRecord,
    MuscleGroupVolume,
    WeeklyTonnage,
    EnduranceAnalyticsData,
    ZoneDistribution,
    WeeklyEnduranceVolume,
    CardioSessionSummary,
    RuckSessionSummary,
    RecoveryAnalyticsData,
    WeeklyRecoveryStatus,
    InterventionSummary,
} from '@/lib/types/data.types'

const MODALITY_COLORS: Record<string, string> = {
    LIFTING: '#22d3ee',     // cyan-400
    CARDIO: '#34d399',      // emerald-400
    RUCKING: '#fbbf24',     // amber-400
    METCON: '#a78bfa',      // violet-400
    MOBILITY: '#f472b6',    // pink-400
}

export async function getTrainingOverview(): Promise<ActionResult<TrainingOverviewData>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get active mesocycle
    const { data: mesocycle } = await supabase
        .from('mesocycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

    if (!mesocycle) {
        return {
            success: true,
            data: {
                mesocycleName: null,
                mesocycleGoal: null,
                currentWeek: 0,
                totalWeeks: 0,
                mesocycleStartDate: null,
                mesocycleEndDate: null,
                totalScheduled: 0,
                totalCompleted: 0,
                complianceRate: 0,
                weeklyData: [],
                modalityDistribution: [],
                recentSessions: [],
            },
        }
    }

    // Parallel queries
    const [microcyclesResult, workoutsResult, recentResult] = await Promise.all([
        // All microcycles for this mesocycle
        supabase
            .from('microcycles')
            .select('id, week_number, is_deload, start_date, end_date')
            .eq('mesocycle_id', mesocycle.id)
            .order('week_number', { ascending: true }),

        // All workouts for this mesocycle (via microcycle join)
        supabase
            .from('workouts')
            .select('id, microcycle_id, modality, name, scheduled_date, is_completed, completed_at, actual_duration_minutes')
            .eq('user_id', user.id)
            .not('microcycle_id', 'is', null)
            .order('scheduled_date', { ascending: true }),

        // Recent completed workouts (last 7)
        supabase
            .from('workouts')
            .select('id, name, modality, scheduled_date, completed_at, actual_duration_minutes, exercise_sets(id)')
            .eq('user_id', user.id)
            .eq('is_completed', true)
            .order('completed_at', { ascending: false })
            .limit(7),
    ])

    const microcycles = microcyclesResult.data ?? []
    const microcycleIds = new Set(microcycles.map(m => m.id))

    // Filter workouts to this mesocycle
    const allWorkouts = (workoutsResult.data ?? []).filter(w => microcycleIds.has(w.microcycle_id))

    // Determine current week
    const today = new Date().toISOString().split('T')[0]
    const currentMicrocycle = microcycles.find(m => m.start_date <= today && m.end_date >= today)
    const currentWeek = currentMicrocycle?.week_number ?? microcycles.length

    // Compliance
    const totalScheduled = allWorkouts.length
    const totalCompleted = allWorkouts.filter(w => w.is_completed).length
    const complianceRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0

    // Build week-by-week data
    const microcycleMap = new Map(microcycles.map(m => [m.id, m]))
    const weeklyData: WeeklyLoadData[] = microcycles.map(micro => {
        const weekWorkouts = allWorkouts.filter(w => w.microcycle_id === micro.id)
        const completed = weekWorkouts.filter(w => w.is_completed)

        return {
            weekNumber: micro.week_number,
            weekLabel: `W${micro.week_number}`,
            isDeload: micro.is_deload,
            lifting: weekWorkouts.filter(w => w.modality === 'LIFTING').length,
            cardio: weekWorkouts.filter(w => w.modality === 'CARDIO').length,
            rucking: weekWorkouts.filter(w => w.modality === 'RUCKING').length,
            conditioning: weekWorkouts.filter(w => w.modality === 'METCON').length,
            mobility: weekWorkouts.filter(w => w.modality === 'MOBILITY').length,
            totalSessions: weekWorkouts.length,
            completedSessions: completed.length,
        }
    })

    // Modality distribution (across entire mesocycle)
    const modalityCounts: Record<string, number> = {}
    for (const w of allWorkouts) {
        modalityCounts[w.modality] = (modalityCounts[w.modality] ?? 0) + 1
    }
    const totalModality = Object.values(modalityCounts).reduce((a, b) => a + b, 0)
    const modalityDistribution: ModalityDistribution[] = Object.entries(modalityCounts)
        .map(([modality, count]) => ({
            modality,
            count,
            percentage: totalModality > 0 ? Math.round((count / totalModality) * 100) : 0,
            color: MODALITY_COLORS[modality] ?? '#6b7280',
        }))
        .sort((a, b) => b.count - a.count)

    // Recent sessions
    const recentSessions: RecentSession[] = (recentResult.data ?? []).map(w => {
        const setCount = Array.isArray(w.exercise_sets) ? w.exercise_sets.length : 0
        let keyMetric: string | null = null

        if (w.modality === 'LIFTING' && setCount > 0) {
            keyMetric = `${setCount} sets logged`
        } else if (w.actual_duration_minutes) {
            keyMetric = `${w.actual_duration_minutes} min`
        }

        return {
            id: w.id,
            name: w.name,
            modality: w.modality,
            completedAt: w.completed_at,
            scheduledDate: w.scheduled_date,
            durationMinutes: w.actual_duration_minutes,
            keyMetric,
        }
    })

    return {
        success: true,
        data: {
            mesocycleName: mesocycle.name,
            mesocycleGoal: mesocycle.goal,
            currentWeek,
            totalWeeks: mesocycle.week_count,
            mesocycleStartDate: mesocycle.start_date,
            mesocycleEndDate: mesocycle.end_date,
            totalScheduled,
            totalCompleted,
            complianceRate,
            weeklyData,
            modalityDistribution,
            recentSessions,
        },
    }
}

// ─── Strength & PRs ──────────────────────────────────────────────────────────

export async function getStrengthAnalytics(): Promise<ActionResult<StrengthAnalyticsData>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get active mesocycle + microcycles
    const { data: mesocycle } = await supabase
        .from('mesocycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

    if (!mesocycle) {
        return {
            success: true,
            data: {
                recentPRs: [],
                allTimePRs: [],
                totalPRsThisCycle: 0,
                muscleGroupVolumes: [],
                weeklyTonnage: [],
                avgRirDeviation: null,
                avgRpe: null,
                totalSetsLogged: 0,
                mesocycleName: null,
                currentWeek: 0,
                totalWeeks: 0,
            },
        }
    }

    const { data: microcycles } = await supabase
        .from('microcycles')
        .select('id, week_number, is_deload, start_date, end_date')
        .eq('mesocycle_id', mesocycle.id)
        .order('week_number', { ascending: true })

    const microList = microcycles ?? []
    const microcycleIds = microList.map(m => m.id)

    const today = new Date().toISOString().split('T')[0]
    const currentMicro = microList.find(m => m.start_date <= today && m.end_date >= today)
    const currentWeek = currentMicro?.week_number ?? microList.length

    // Get workout IDs for this mesocycle
    const { data: workouts } = await supabase
        .from('workouts')
        .select('id, microcycle_id')
        .eq('user_id', user.id)
        .in('microcycle_id', microcycleIds.length > 0 ? microcycleIds : ['__none__'])

    const workoutList = workouts ?? []
    const workoutIds = workoutList.map(w => w.id)
    const workoutToMicro = new Map(workoutList.map(w => [w.id, w.microcycle_id]))

    // Parallel queries for exercise sets
    const [cycleSetResult, allTimePrResult] = await Promise.all([
        // All exercise sets in this mesocycle
        supabase
            .from('exercise_sets')
            .select('*')
            .eq('user_id', user.id)
            .in('workout_id', workoutIds.length > 0 ? workoutIds : ['__none__'])
            .order('logged_at', { ascending: false }),

        // All-time PRs (is_pr = true, all exercises)
        supabase
            .from('exercise_sets')
            .select('exercise_name, muscle_group, actual_weight_kg, actual_reps, logged_at')
            .eq('user_id', user.id)
            .eq('is_pr', true)
            .not('actual_weight_kg', 'is', null)
            .order('actual_weight_kg', { ascending: false }),
    ])

    const cycleSets = cycleSetResult.data ?? []
    const allPrSets = allTimePrResult.data ?? []

    // ── Recent PRs (this mesocycle) ──
    const recentPRs: PersonalRecord[] = cycleSets
        .filter(s => s.is_pr && s.actual_weight_kg != null)
        .slice(0, 10)
        .map(s => ({
            exerciseName: s.exercise_name,
            muscleGroup: s.muscle_group,
            weightKg: s.actual_weight_kg!,
            reps: s.actual_reps ?? 0,
            date: s.logged_at ?? s.created_at,
            isAllTime: false,
        }))

    const totalPRsThisCycle = cycleSets.filter(s => s.is_pr).length

    // ── All-time PRs (best per exercise) ──
    const bestByExercise = new Map<string, typeof allPrSets[0]>()
    for (const s of allPrSets) {
        const existing = bestByExercise.get(s.exercise_name)
        if (!existing || (s.actual_weight_kg ?? 0) > (existing.actual_weight_kg ?? 0)) {
            bestByExercise.set(s.exercise_name, s)
        }
    }
    const allTimePRs: PersonalRecord[] = Array.from(bestByExercise.values())
        .sort((a, b) => (b.actual_weight_kg ?? 0) - (a.actual_weight_kg ?? 0))
        .slice(0, 15)
        .map(s => ({
            exerciseName: s.exercise_name,
            muscleGroup: s.muscle_group,
            weightKg: s.actual_weight_kg!,
            reps: s.actual_reps ?? 0,
            date: s.logged_at ?? '',
            isAllTime: true,
        }))

    // ── Volume by muscle group ──
    const muscleMap = new Map<string, { totalSets: number; loggedSets: number; tonnage: number; rirSum: number; rirCount: number; rpeSum: number; rpeCount: number }>()
    for (const s of cycleSets) {
        const group = s.muscle_group ?? 'Other'
        const existing = muscleMap.get(group) ?? { totalSets: 0, loggedSets: 0, tonnage: 0, rirSum: 0, rirCount: 0, rpeSum: 0, rpeCount: 0 }
        existing.totalSets++
        if (s.actual_reps != null && s.actual_weight_kg != null) {
            existing.loggedSets++
            existing.tonnage += s.actual_reps * s.actual_weight_kg
        }
        if (s.rir_actual != null) {
            existing.rirSum += s.rir_actual
            existing.rirCount++
        }
        if (s.rpe_actual != null) {
            existing.rpeSum += s.rpe_actual
            existing.rpeCount++
        }
        muscleMap.set(group, existing)
    }
    const muscleGroupVolumes: MuscleGroupVolume[] = Array.from(muscleMap.entries())
        .map(([group, v]) => ({
            muscleGroup: group,
            totalSets: v.totalSets,
            loggedSets: v.loggedSets,
            avgRir: v.rirCount > 0 ? Math.round((v.rirSum / v.rirCount) * 10) / 10 : null,
            avgRpe: v.rpeCount > 0 ? Math.round((v.rpeSum / v.rpeCount) * 10) / 10 : null,
            totalTonnageKg: Math.round(v.tonnage),
        }))
        .sort((a, b) => b.totalSets - a.totalSets)

    // ── Weekly tonnage trend ──
    const microMap = new Map(microList.map(m => [m.id, m]))
    const weekTonnageMap = new Map<number, { tonnage: number; sets: number }>()
    for (const s of cycleSets) {
        if (s.actual_reps == null || s.actual_weight_kg == null) continue
        const microId = workoutToMicro.get(s.workout_id)
        if (!microId) continue
        const micro = microMap.get(microId)
        if (!micro) continue

        const existing = weekTonnageMap.get(micro.week_number) ?? { tonnage: 0, sets: 0 }
        existing.tonnage += s.actual_reps * s.actual_weight_kg
        existing.sets++
        weekTonnageMap.set(micro.week_number, existing)
    }
    const weeklyTonnage: WeeklyTonnage[] = microList.map(m => ({
        weekNumber: m.week_number,
        weekLabel: `W${m.week_number}`,
        tonnageKg: Math.round(weekTonnageMap.get(m.week_number)?.tonnage ?? 0),
        setCount: weekTonnageMap.get(m.week_number)?.sets ?? 0,
    }))

    // ── RIR/RPE accuracy ──
    let rirDeviationSum = 0
    let rirDeviationCount = 0
    let rpeSum = 0
    let rpeCount = 0

    for (const s of cycleSets) {
        if (s.target_rir != null && s.rir_actual != null) {
            rirDeviationSum += s.target_rir - s.rir_actual
            rirDeviationCount++
        }
        if (s.rpe_actual != null) {
            rpeSum += s.rpe_actual
            rpeCount++
        }
    }

    return {
        success: true,
        data: {
            recentPRs,
            allTimePRs,
            totalPRsThisCycle,
            muscleGroupVolumes,
            weeklyTonnage,
            avgRirDeviation: rirDeviationCount > 0 ? Math.round((rirDeviationSum / rirDeviationCount) * 10) / 10 : null,
            avgRpe: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : null,
            totalSetsLogged: cycleSets.filter(s => s.actual_reps != null).length,
            mesocycleName: mesocycle.name,
            currentWeek,
            totalWeeks: mesocycle.week_count,
        },
    }
}

// ─── Endurance & Cardio ─────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, string> = {
    ZONE_2: '#34d399',     // emerald
    TEMPO: '#fbbf24',      // amber
    THRESHOLD: '#f97316',  // orange
    INTERVAL: '#ef4444',   // red
    SPRINT: '#dc2626',     // red-600
}

export async function getEnduranceAnalytics(): Promise<ActionResult<EnduranceAnalyticsData>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: mesocycle } = await supabase
        .from('mesocycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

    if (!mesocycle) {
        return {
            success: true,
            data: {
                totalCardioSessions: 0,
                totalCardioMinutes: 0,
                totalCardioDistanceKm: 0,
                avgPaceSecPerKm: null,
                avgHeartRateBpm: null,
                totalRuckSessions: 0,
                totalRuckDistanceKm: 0,
                totalLoadIndex: 0,
                fatigueFlags: 0,
                zoneDistribution: [],
                weeklyVolume: [],
                recentCardio: [],
                recentRucks: [],
                mesocycleName: null,
                currentWeek: 0,
                totalWeeks: 0,
            },
        }
    }

    const { data: microcycles } = await supabase
        .from('microcycles')
        .select('id, week_number, is_deload, start_date, end_date')
        .eq('mesocycle_id', mesocycle.id)
        .order('week_number', { ascending: true })

    const microList = microcycles ?? []
    const microcycleIds = microList.map(m => m.id)

    const today = new Date().toISOString().split('T')[0]
    const currentMicro = microList.find(m => m.start_date <= today && m.end_date >= today)
    const currentWeek = currentMicro?.week_number ?? microList.length

    // Get workout IDs for this mesocycle
    const { data: workouts } = await supabase
        .from('workouts')
        .select('id, microcycle_id, modality, scheduled_date')
        .eq('user_id', user.id)
        .in('microcycle_id', microcycleIds.length > 0 ? microcycleIds : ['__none__'])

    const workoutList = workouts ?? []
    const workoutIds = workoutList.map(w => w.id)
    const workoutToMicro = new Map(workoutList.map(w => [w.id, w.microcycle_id]))

    // Parallel queries
    const [cardioResult, ruckResult] = await Promise.all([
        supabase
            .from('cardio_logs')
            .select('*')
            .eq('user_id', user.id)
            .in('workout_id', workoutIds.length > 0 ? workoutIds : ['__none__'])
            .order('logged_at', { ascending: false }),

        supabase
            .from('rucking_logs')
            .select('*')
            .eq('user_id', user.id)
            .in('workout_id', workoutIds.length > 0 ? workoutIds : ['__none__'])
            .order('logged_at', { ascending: false }),
    ])

    const cardioLogs = cardioResult.data ?? []
    const ruckLogs = ruckResult.data ?? []

    // ── Cardio totals ──
    const totalCardioMinutes = cardioLogs.reduce((sum, c) => sum + (Number(c.duration_minutes) || 0), 0)
    const totalCardioDistanceKm = cardioLogs.reduce((sum, c) => sum + (Number(c.distance_km) || 0), 0)

    let paceSum = 0, paceCount = 0, hrSum = 0, hrCount = 0
    for (const c of cardioLogs) {
        if (c.avg_pace_sec_per_km != null) { paceSum += Number(c.avg_pace_sec_per_km); paceCount++ }
        if (c.avg_heart_rate_bpm != null) { hrSum += c.avg_heart_rate_bpm; hrCount++ }
    }

    // ── Ruck totals ──
    const totalRuckDistanceKm = ruckLogs.reduce((sum, r) => sum + (Number(r.distance_km) || 0), 0)
    const totalLoadIndex = ruckLogs.reduce((sum, r) => sum + (Number(r.total_load_index) || 0), 0)
    const fatigueFlags = ruckLogs.filter(r => r.fatigue_flag).length

    // ── Zone distribution ──
    const zoneMap = new Map<string, { count: number; minutes: number }>()
    for (const c of cardioLogs) {
        const zone = c.cardio_type ?? 'ZONE_2'
        const existing = zoneMap.get(zone) ?? { count: 0, minutes: 0 }
        existing.count++
        existing.minutes += Number(c.duration_minutes) || 0
        zoneMap.set(zone, existing)
    }
    const totalZoneMinutes = Array.from(zoneMap.values()).reduce((s, v) => s + v.minutes, 0)
    const zoneDistribution: ZoneDistribution[] = Array.from(zoneMap.entries())
        .map(([zone, v]) => ({
            zone,
            sessionCount: v.count,
            totalMinutes: Math.round(v.minutes),
            percentage: totalZoneMinutes > 0 ? Math.round((v.minutes / totalZoneMinutes) * 100) : 0,
            color: ZONE_COLORS[zone] ?? '#6b7280',
        }))
        .sort((a, b) => b.totalMinutes - a.totalMinutes)

    // ── Weekly volume ──
    const microMap = new Map(microList.map(m => [m.id, m]))
    const weekVolumeMap = new Map<number, { cardioMin: number; ruckMin: number; distKm: number }>()

    for (const c of cardioLogs) {
        const microId = workoutToMicro.get(c.workout_id)
        if (!microId) continue
        const micro = microMap.get(microId)
        if (!micro) continue
        const existing = weekVolumeMap.get(micro.week_number) ?? { cardioMin: 0, ruckMin: 0, distKm: 0 }
        existing.cardioMin += Number(c.duration_minutes) || 0
        existing.distKm += Number(c.distance_km) || 0
        weekVolumeMap.set(micro.week_number, existing)
    }
    for (const r of ruckLogs) {
        const microId = workoutToMicro.get(r.workout_id)
        if (!microId) continue
        const micro = microMap.get(microId)
        if (!micro) continue
        const existing = weekVolumeMap.get(micro.week_number) ?? { cardioMin: 0, ruckMin: 0, distKm: 0 }
        existing.ruckMin += Number(r.duration_minutes) || 0
        existing.distKm += Number(r.distance_km) || 0
        weekVolumeMap.set(micro.week_number, existing)
    }

    const weeklyVolume: WeeklyEnduranceVolume[] = microList.map(m => {
        const v = weekVolumeMap.get(m.week_number)
        return {
            weekNumber: m.week_number,
            weekLabel: `W${m.week_number}`,
            cardioMinutes: Math.round(v?.cardioMin ?? 0),
            ruckMinutes: Math.round(v?.ruckMin ?? 0),
            totalDistanceKm: Math.round((v?.distKm ?? 0) * 10) / 10,
        }
    })

    // ── Recent sessions ──
    const recentCardio: CardioSessionSummary[] = cardioLogs.slice(0, 7).map(c => ({
        id: c.id,
        cardioType: c.cardio_type ?? 'ZONE_2',
        date: c.logged_at ?? c.created_at,
        durationMinutes: Number(c.duration_minutes) || 0,
        distanceKm: c.distance_km != null ? Number(c.distance_km) : null,
        avgPaceSecPerKm: c.avg_pace_sec_per_km != null ? Number(c.avg_pace_sec_per_km) : null,
        avgHeartRateBpm: c.avg_heart_rate_bpm,
        rpe: c.perceived_effort_rpe != null ? Number(c.perceived_effort_rpe) : null,
    }))

    const recentRucks: RuckSessionSummary[] = ruckLogs.slice(0, 7).map(r => ({
        id: r.id,
        date: r.logged_at ?? r.created_at,
        distanceKm: Number(r.distance_km),
        packWeightLbs: Number(r.pack_weight_lbs),
        durationMinutes: Number(r.duration_minutes),
        loadIndex: Number(r.total_load_index) || 0,
        avgPaceSecPerKm: r.avg_pace_sec_per_km != null ? Number(r.avg_pace_sec_per_km) : null,
        fatigueFlag: r.fatigue_flag ?? false,
    }))

    return {
        success: true,
        data: {
            totalCardioSessions: cardioLogs.length,
            totalCardioMinutes: Math.round(totalCardioMinutes),
            totalCardioDistanceKm: Math.round(totalCardioDistanceKm * 10) / 10,
            avgPaceSecPerKm: paceCount > 0 ? Math.round(paceSum / paceCount) : null,
            avgHeartRateBpm: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
            totalRuckSessions: ruckLogs.length,
            totalRuckDistanceKm: Math.round(totalRuckDistanceKm * 10) / 10,
            totalLoadIndex: Math.round(totalLoadIndex),
            fatigueFlags,
            zoneDistribution,
            weeklyVolume,
            recentCardio,
            recentRucks,
            mesocycleName: mesocycle.name,
            currentWeek,
            totalWeeks: mesocycle.week_count,
        },
    }
}

// ─── Recovery & Readiness ───────────────────────────────────────────────────

export async function getRecoveryAnalytics(): Promise<ActionResult<RecoveryAnalyticsData>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: mesocycle } = await supabase
        .from('mesocycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

    if (!mesocycle) {
        return {
            success: true,
            data: {
                weeklyRecovery: [],
                totalInterventions: 0,
                acceptedInterventions: 0,
                recentInterventions: [],
                avgEnergyLevel: null,
                avgOverallFeeling: null,
                painReports: 0,
                mesocycleName: null,
                currentWeek: 0,
                totalWeeks: 0,
            },
        }
    }

    const { data: microcycles } = await supabase
        .from('microcycles')
        .select('id, week_number, is_deload, start_date, end_date')
        .eq('mesocycle_id', mesocycle.id)
        .order('week_number', { ascending: true })

    const microList = microcycles ?? []
    const microcycleIds = microList.map(m => m.id)

    const today = new Date().toISOString().split('T')[0]
    const currentMicro = microList.find(m => m.start_date <= today && m.end_date >= today)
    const currentWeek = currentMicro?.week_number ?? microList.length

    // Get workouts for this mesocycle
    const { data: workouts } = await supabase
        .from('workouts')
        .select('id, microcycle_id')
        .eq('user_id', user.id)
        .in('microcycle_id', microcycleIds.length > 0 ? microcycleIds : ['__none__'])

    const workoutList = workouts ?? []
    const workoutIds = workoutList.map(w => w.id)
    const workoutToMicro = new Map(workoutList.map(w => [w.id, w.microcycle_id]))

    // Parallel queries
    const [interventionsResult, assessmentsResult] = await Promise.all([
        supabase
            .from('ai_coach_interventions')
            .select('id, trigger_type, rationale, user_accepted, created_at, microcycle_id')
            .eq('user_id', user.id)
            .in('microcycle_id', microcycleIds.length > 0 ? microcycleIds : ['__none__'])
            .order('created_at', { ascending: false }),

        supabase
            .from('session_assessments')
            .select('id, workout_id, overall_feeling, energy_level, had_pain, assessed_at')
            .eq('user_id', user.id)
            .in('workout_id', workoutIds.length > 0 ? workoutIds : ['__none__'])
            .order('assessed_at', { ascending: false }),
    ])

    const interventions = interventionsResult.data ?? []
    const assessments = assessmentsResult.data ?? []

    // ── Weekly recovery status ──
    const ENERGY_MAP: Record<string, number> = { high: 4, normal: 3, low: 2, very_low: 1 }
    const FEELING_MAP: Record<string, number> = { great: 4, as_expected: 3, struggled: 2, skipped: 1 }

    const microMap = new Map(microList.map(m => [m.id, m]))
    const weekAssessments = new Map<number, { energySum: number; energyCount: number; feelingSum: number; feelingCount: number; painCount: number; total: number }>()

    for (const a of assessments) {
        const microId = workoutToMicro.get(a.workout_id)
        if (!microId) continue
        const micro = microMap.get(microId)
        if (!micro) continue

        const existing = weekAssessments.get(micro.week_number) ?? { energySum: 0, energyCount: 0, feelingSum: 0, feelingCount: 0, painCount: 0, total: 0 }
        existing.total++
        if (a.energy_level && ENERGY_MAP[a.energy_level] != null) {
            existing.energySum += ENERGY_MAP[a.energy_level]
            existing.energyCount++
        }
        if (a.overall_feeling && FEELING_MAP[a.overall_feeling] != null) {
            existing.feelingSum += FEELING_MAP[a.overall_feeling]
            existing.feelingCount++
        }
        if (a.had_pain) existing.painCount++
        weekAssessments.set(micro.week_number, existing)
    }

    const weeklyRecovery: WeeklyRecoveryStatus[] = microList.map(m => {
        const wa = weekAssessments.get(m.week_number)
        let status: string | null = null
        if (wa && wa.energyCount > 0) {
            const avgEnergy = wa.energySum / wa.energyCount
            if (avgEnergy >= 3) status = 'GREEN'
            else if (avgEnergy >= 2) status = 'YELLOW'
            else status = 'RED'
        }
        return {
            weekNumber: m.week_number,
            weekLabel: `W${m.week_number}`,
            status,
            assessmentCount: wa?.total ?? 0,
        }
    })

    // ── Interventions ──
    const acceptedInterventions = interventions.filter(i => i.user_accepted === true).length
    const recentInterventions: InterventionSummary[] = interventions.slice(0, 10).map(i => ({
        id: i.id,
        date: i.created_at,
        triggerType: i.trigger_type,
        rationale: i.rationale,
        accepted: i.user_accepted,
    }))

    // ── Overall assessment averages ──
    let energyTotal = 0, energyN = 0, feelingTotal = 0, feelingN = 0, painTotal = 0
    for (const a of assessments) {
        if (a.energy_level && ENERGY_MAP[a.energy_level] != null) {
            energyTotal += ENERGY_MAP[a.energy_level]
            energyN++
        }
        if (a.overall_feeling && FEELING_MAP[a.overall_feeling] != null) {
            feelingTotal += FEELING_MAP[a.overall_feeling]
            feelingN++
        }
        if (a.had_pain) painTotal++
    }

    return {
        success: true,
        data: {
            weeklyRecovery,
            totalInterventions: interventions.length,
            acceptedInterventions,
            recentInterventions,
            avgEnergyLevel: energyN > 0 ? Math.round((energyTotal / energyN) * 10) / 10 : null,
            avgOverallFeeling: feelingN > 0 ? Math.round((feelingTotal / feelingN) * 10) / 10 : null,
            painReports: painTotal,
            mesocycleName: mesocycle.name,
            currentWeek,
            totalWeeks: mesocycle.week_count,
        },
    }
}

// ─── Health Snapshot ────────────────────────────────────────────────────────

export async function getHealthSnapshot() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false as const, error: 'unauthenticated' }
    const [bloodwork, garmin, sup] = await Promise.all([
        latestBloodworkSnapshot(user.id),
        garminSevenDayTrends(user.id),
        activeSupplementsSnapshot(user.id),
    ])
    return { success: true as const, data: {
        bloodwork, garmin, activeSupplements: sup.count,
    } }
}

// ─── Training Adherence (overview tiles) ────────────────────────────────────

import type { HeatmapCell } from '@/lib/analytics/block-adherence'
import type { RAG } from '@/lib/analytics/coach-bias'
import type { OffPlanTally as OffPlanTallyData } from '@/lib/analytics/off-plan-tally'
import type { Database } from '@/lib/types/database.types'

type AICoachInterventionRow = Database['public']['Tables']['ai_coach_interventions']['Row']

export interface TrainingAdherenceData {
    cells: HeatmapCell[]
    ragByCoach: Record<string, RAG>
    tally: OffPlanTallyData
    interventions: AICoachInterventionRow[]
}

export async function getTrainingAdherence(): Promise<ActionResult<TrainingAdherenceData>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    const { currentBlockHeatmap } = await import('@/lib/analytics/block-adherence')
    const { allCoachesRAG } = await import('@/lib/analytics/coach-bias')
    const { currentBlockTally } = await import('@/lib/analytics/off-plan-tally')
    const { getUnreviewedInterventions } = await import('@/lib/actions/ai-coach.actions')

    // Resolve active mesocycle + current week from block_pointer.
    const { data: activeMesocycle } = await supabase
        .from('mesocycles')
        .select('id, start_date')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

    let cells: HeatmapCell[] = []
    let tally: OffPlanTallyData = { total: 0, byModality: {} }
    if (activeMesocycle) {
        const { data: pointer } = await supabase
            .from('block_pointer')
            .select('week_number')
            .eq('user_id', user.id)
            .eq('mesocycle_id', activeMesocycle.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        const weekNumber = pointer?.week_number ?? 1
        ;[cells, tally] = await Promise.all([
            currentBlockHeatmap(user.id, activeMesocycle.id, weekNumber),
            currentBlockTally(user.id, activeMesocycle.start_date),
        ])
    }
    const [ragByCoach, interventionsRes] = await Promise.all([
        allCoachesRAG(user.id),
        getUnreviewedInterventions(),
    ])
    const interventions: AICoachInterventionRow[] = interventionsRes.success ? interventionsRes.data : []

    return { success: true, data: { cells, ragByCoach, tally, interventions } }
}
