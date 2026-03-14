/**
 * Data Centre Types
 *
 * Types for the athlete performance analytics dashboard.
 */

export interface WeeklyLoadData {
    weekNumber: number
    weekLabel: string // e.g. "W1", "W2"
    isDeload: boolean
    lifting: number   // session count
    cardio: number
    rucking: number
    conditioning: number
    mobility: number
    totalSessions: number
    completedSessions: number
}

export interface ModalityDistribution {
    modality: string
    count: number
    percentage: number
    color: string
}

export interface RecentSession {
    id: string
    name: string
    modality: string
    completedAt: string
    scheduledDate: string | null
    durationMinutes: number | null
    keyMetric: string | null // e.g. "6 exercises, 18 sets" or "5.2km @ 5:30/km"
}

export interface TrainingOverviewData {
    // Mesocycle context
    mesocycleName: string | null
    mesocycleGoal: string | null
    currentWeek: number
    totalWeeks: number
    mesocycleStartDate: string | null
    mesocycleEndDate: string | null

    // Compliance
    totalScheduled: number
    totalCompleted: number
    complianceRate: number // 0-100

    // Weekly breakdown
    weeklyData: WeeklyLoadData[]

    // Modality split
    modalityDistribution: ModalityDistribution[]

    // Recent activity
    recentSessions: RecentSession[]
}

// ─── Strength & PRs ──────────────────────────────────────────────────────────

export interface PersonalRecord {
    exerciseName: string
    muscleGroup: string | null
    weightKg: number
    reps: number
    date: string
    isAllTime: boolean // true if this is the all-time best
}

export interface ExerciseProgress {
    exerciseName: string
    muscleGroup: string | null
    entries: { date: string; bestWeightKg: number; bestReps: number }[]
}

export interface MuscleGroupVolume {
    muscleGroup: string
    totalSets: number
    loggedSets: number // sets with actual data
    avgRir: number | null
    avgRpe: number | null
    totalTonnageKg: number
}

export interface WeeklyTonnage {
    weekNumber: number
    weekLabel: string
    tonnageKg: number
    setCount: number
}

export interface StrengthAnalyticsData {
    // PRs
    recentPRs: PersonalRecord[]  // PRs from current mesocycle
    allTimePRs: PersonalRecord[] // top PR per exercise (all time)
    totalPRsThisCycle: number

    // Volume by muscle group (current mesocycle)
    muscleGroupVolumes: MuscleGroupVolume[]

    // Weekly tonnage trend
    weeklyTonnage: WeeklyTonnage[]

    // RIR/RPE accuracy
    avgRirDeviation: number | null // target_rir - rir_actual (positive = too easy)
    avgRpe: number | null
    totalSetsLogged: number

    // Context
    mesocycleName: string | null
    currentWeek: number
    totalWeeks: number
}

// ─── Endurance & Cardio ──────────────────────────────────────────────────────

export interface CardioSessionSummary {
    id: string
    cardioType: string
    date: string
    durationMinutes: number
    distanceKm: number | null
    avgPaceSecPerKm: number | null
    avgHeartRateBpm: number | null
    rpe: number | null
}

export interface RuckSessionSummary {
    id: string
    date: string
    distanceKm: number
    packWeightLbs: number
    durationMinutes: number
    loadIndex: number
    avgPaceSecPerKm: number | null
    fatigueFlag: boolean
}

export interface ZoneDistribution {
    zone: string
    sessionCount: number
    totalMinutes: number
    percentage: number
    color: string
}

export interface WeeklyEnduranceVolume {
    weekNumber: number
    weekLabel: string
    cardioMinutes: number
    ruckMinutes: number
    totalDistanceKm: number
}

export interface EnduranceAnalyticsData {
    // Cardio totals
    totalCardioSessions: number
    totalCardioMinutes: number
    totalCardioDistanceKm: number
    avgPaceSecPerKm: number | null
    avgHeartRateBpm: number | null

    // Rucking totals
    totalRuckSessions: number
    totalRuckDistanceKm: number
    totalLoadIndex: number
    fatigueFlags: number

    // Zone distribution
    zoneDistribution: ZoneDistribution[]

    // Weekly volume
    weeklyVolume: WeeklyEnduranceVolume[]

    // Recent sessions
    recentCardio: CardioSessionSummary[]
    recentRucks: RuckSessionSummary[]

    // Context
    mesocycleName: string | null
    currentWeek: number
    totalWeeks: number
}

// ─── Recovery & Readiness ────────────────────────────────────────────────────

export interface WeeklyRecoveryStatus {
    weekNumber: number
    weekLabel: string
    status: string | null // GREEN, YELLOW, RED
    assessmentCount: number
}

export interface InterventionSummary {
    id: string
    date: string
    triggerType: string
    rationale: string
    accepted: boolean | null
}

export interface RecoveryAnalyticsData {
    // Recovery timeline
    weeklyRecovery: WeeklyRecoveryStatus[]

    // AI interventions
    totalInterventions: number
    acceptedInterventions: number
    recentInterventions: InterventionSummary[]

    // Session assessments
    avgEnergyLevel: number | null
    avgOverallFeeling: number | null
    painReports: number

    // Context
    mesocycleName: string | null
    currentWeek: number
    totalWeeks: number
}
