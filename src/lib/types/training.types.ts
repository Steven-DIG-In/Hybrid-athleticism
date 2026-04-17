/**
 * Domain-level TypeScript types for the Hybrid Athleticism training engine.
 * These are higher-level abstractions on top of the raw DB row types.
 */

import type {
    Mesocycle, Microcycle, Workout, ExerciseSet, MesocycleGoal, EquipmentType,
    OnboardingPath, ExperienceLevel, TrainingEnvironment, GoalArchetype,
    WorkType, StressLevel, TravelFrequency, TwoADayWillingness,
    TimeOfDayPreference, MethodologyPreference, TransparencyPreference,
    BodyCompGoal, InjuryBodyArea, InjurySeverity, EquipmentUsageIntent,
} from './database.types'
import type { SessionInventory } from './inventory.types'

// ─── Onboarding payload ───────────────────────────────────────────────────────

/** Full onboarding data covering both quick and deep paths. */
export interface OnboardingData {
    // Path selection
    onboardingPath: OnboardingPath

    // Screen 2: Athlete Profile
    age: number
    sex: 'MALE' | 'FEMALE'
    heightCm: number
    bodyweightKg: number
    unitPreference: 'metric' | 'imperial'

    // Screen 3: Experience Snapshot
    liftingExperience: ExperienceLevel
    runningExperience: ExperienceLevel
    conditioningExperience: ExperienceLevel
    ruckingExperience?: ExperienceLevel | null
    rowingExperience?: ExperienceLevel | null
    swimmingExperience?: ExperienceLevel | null
    cyclingExperience?: ExperienceLevel | null

    // Screen 4: Equipment & Access
    primaryTrainingEnvironment: TrainingEnvironment
    equipmentList: string[]

    // Screen 5: Training Availability
    availableDays: number
    sessionDurationMinutes: number
    twoADay: TwoADayWillingness

    // Screen 6: Goal Selection
    goalArchetype: GoalArchetype

    // Screen 7: Injuries & Limitations
    hasInjuries: boolean
    injuries?: OnboardingInjury[]
    movementsToAvoid?: string[]

    // Deep path additions
    recentTraining?: OnboardingRecentTraining[]
    benchmarks?: OnboardingBenchmark[]
    enduranceModalityPreferences?: string[]
    conditioningStylePreferences?: string[]
    equipmentUsageIntents?: Record<string, EquipmentUsageIntent>
    workType?: WorkType
    stressLevel?: StressLevel
    travelFrequency?: TravelFrequency
    timeOfDay?: TimeOfDayPreference
    strengthMethodology?: MethodologyPreference
    hypertrophyMethodology?: MethodologyPreference
    enduranceMethodology?: MethodologyPreference
    transparency?: TransparencyPreference
    bodyFatPercentage?: number | null
    bodyCompGoal?: BodyCompGoal | null
}

export interface OnboardingInjury {
    bodyArea: InjuryBodyArea
    description?: string
    severity: InjurySeverity
    movementsToAvoid?: string[]
}

export interface OnboardingRecentTraining {
    modality: string
    frequencyPerWeek: number
    approximateVolume?: string
}

export interface OnboardingBenchmark {
    modality: string
    benchmarkName: string
    value: number
    unit: string
}

// ─── Mesocycle with its weeks ─────────────────────────────────────────────────

export interface MesocycleWithWeeks extends Mesocycle {
    microcycles: Microcycle[]
}

// ─── Workout with its sets / logs ─────────────────────────────────────────────

export interface WorkoutWithSets extends Workout {
    exercise_sets: ExerciseSet[]
}

// ─── Daily view (the "Today" screen) ─────────────────────────────────────────

export interface TodayViewData {
    workout: WorkoutWithSets | null
    currentWeek: Microcycle | null
    currentMesocycle: Mesocycle | null
    hasUnreviewedIntervention: boolean
}

// ─── Dashboard Session Pool View ─────────────────────────────────────────────

export interface DashboardData {
    currentMesocycle: Mesocycle | null
    currentWeek: Microcycle | null
    sessionPool: WorkoutWithSets[]
    allWorkouts: WorkoutWithSets[]
    completedCount: number
    totalCount: number
    totalWeeks: number
    hasUnreviewedIntervention: boolean
    weekHasWorkouts: boolean
    hasUnallocatedSessions: boolean
    athleteName: string | null
    goalArchetype: string | null
    equipmentList: string[]
    endurancePreferences: string[]
    conditioningPreferences: string[]
    previousWeekIsDeload: boolean
    mesocycleStartDate: string | null
    mesocycleEndDate: string | null
    trainingDays: Array<{
        dayNumber: number
        sessions: SessionInventory[]
        isComplete: boolean  // all sessions in this day have completed_at
    }>
    /**
     * Flattened session_inventory rows for the active week that have been
     * scheduled to a date. Shape matches `WeekViewSession` in
     * `src/components/dashboard/WeekViewClient.tsx`.
     */
    weekViewSessions: WeekViewSession[]
}

// ─── WeekView session (calendar view on the dashboard) ──────────────────────

/** Status tokens shared with WeekViewClient. */
export type WeekViewSessionStatus =
    | 'pending'
    | 'active'
    | 'completed'
    | 'missed'
    | 'off_plan'

/**
 * Flattened view of `session_inventory` for the active week, with the linked
 * workout id folded in. Consumed by `WeekViewClient`.
 */
export interface WeekViewSession {
    id: string              // session_inventory.id
    training_day: number
    session_slot: number | null
    scheduled_date: string | null
    status: WeekViewSessionStatus
    modality: string
    name: string
    workout_id: string | null
    estimated_duration_minutes: number | null
}

// ─── Volume tracking ──────────────────────────────────────────────────────────

export interface MuscleGroupVolume {
    muscleGroup: string
    setsThisWeek: number
    targetSets: number
    totalTonnageKg: number
    avgRIR: number | null
}

// ─── Weekly review payload ────────────────────────────────────────────────────

export interface WeeklyReviewPayload {
    userId: string
    microcycleId: string
    weekNumber: number
    mesocycleGoal: MesocycleGoal

    muscleGroupVolumes: MuscleGroupVolume[]
    avgRIRDeviation: number
    rpeSpikes: string[]

    totalCardioMinutes: number
    avgHeartRateCardio: number | null

    totalRuckDistanceKm: number
    totalRuckLoadIndex: number
    hadHighFatigueRuck: boolean

    equipmentAccess: EquipmentType[]
}

// ─── AI Coach structured response ────────────────────────────────────────────

export interface CoachResponse {
    triggerType: 'WEEKLY_REVIEW' | 'RUCK_FATIGUE' | 'RPE_SPIKE' | 'CARDIO_LOAD'
    rationale: string
    volumeAdjustments: Record<string, number>
    exerciseSwaps: Array<{
        from: string
        to: string
        reason: string
    }>
    rirAdjustment: number | null
}

// ─── Load Scoring (re-exported from scheduling module) ──────────────────

export type { SessionLoadProfile, DayLoadSummary, ConflictWarning, LoadStatus, LoadStatusColors } from '@/lib/scheduling/load-scoring'

// ─── Server Action response wrapper ──────────────────────────────────────────

export type ActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string }
