/**
 * Types for the Multi-Agent Coaching Architecture.
 *
 * These types define the communication contracts between coaches:
 * - AthleteContextPacket: shared context built once per cycle
 * - CoachingTeamEntry: athlete's coach selection + priority
 * - MesocycleStrategy: Head Coach's strategic plan (Pipeline A)
 * - DomainAllocation: per-coach session/load mandate
 * - RecoveryAssessment: Recovery Coach's weekly GREEN/YELLOW/RED
 * - AdjustmentDirective: Head Coach's targeted modification order
 */

import type { Profile, AthleteInjury, AthleteBenchmark, RecentTrainingActivity } from './database.types'
import type { MuscleGroupVolume } from './training.types'

// ─── Coaching Team ──────────────────────────────────────────────────────────

export type CoachType =
    | 'strength'
    | 'hypertrophy'
    | 'endurance'
    | 'conditioning'
    | 'mobility'     // always active, not in coaching_team
    | 'recovery'     // always active, not in coaching_team
    | 'nutrition'
    | 'gymnastics'

export interface CoachingTeamEntry {
    coach: CoachType
    priority: number // 1 = highest priority
}

// ─── Athlete Context Packet ─────────────────────────────────────────────────
// Built once per programming cycle (Phase 0), filtered per coach.

export interface AthleteContextPacket {
    // Identity
    profile: Profile
    coachingTeam: CoachingTeamEntry[]

    // Health & limitations
    injuries: AthleteInjury[]

    // Performance data
    benchmarks: AthleteBenchmark[]
    recentTraining: RecentTrainingActivity[]

    // Current training phase
    mesocycleId: string
    mesocycleGoal: string
    weekNumber: number
    totalWeeks: number
    isDeload: boolean
    targetRir: number | null

    // Previous week data (for weekly adjustments)
    previousWeekSessions?: PreviousWeekSummary[]
    previousWeekLoadSummary?: WeeklyLoadSummary
}

export interface PreviousWeekSummary {
    workoutId: string
    name: string
    modality: string
    isCompleted: boolean
    exercises?: Array<{
        exerciseName: string
        muscleGroup: string
        sets: number
        targetReps: number
        targetWeightKg: number | null
        actualReps: number | null
        actualWeightKg: number | null
        rirActual: number | null
        rpeActual: number | null
    }>
}

export interface WeeklyLoadSummary {
    totalSpinalLoad: number
    totalCnsLoad: number
    totalLowerBodySets: number
    totalUpperBodySets: number
    avgDailyLoad: number
    peakDayLoad: number
    sessionCount: number
    completedCount: number
    missedCount: number
}

// ─── Head Coach: Mesocycle Strategy ─────────────────────────────────────────
// Output of Pipeline A Step 1 — the overarching plan.

export interface MesocycleStrategy {
    blockName: string
    blockEmphasis: string // e.g. "Strength emphasis with endurance maintenance"
    totalWeeks: number
    deloadWeek: number // which week is the planned deload

    // Per-domain allocation across the mesocycle
    domainAllocations: DomainAllocation[]

    // Week-by-week emphasis
    weeklyEmphasis: Array<{
        weekNumber: number
        volumePercent: number // as % of MRV
        emphasis: string
        isDeload: boolean
    }>

    // Strategic notes
    strategyRationale: string
    keyProgressions: string[]
    interferenceNotes: string // cross-domain conflict management strategy
}

export interface DomainAllocation {
    coach: CoachType
    sessionsPerWeek: number
    loadBudgetPerSession: number // 1-10
    weeklyFatigueBudget: number // percentage of total recovery budget
    constraints: string[] // e.g. "no heavy spinal loading day before endurance"
    methodologyDirective: string // e.g. "5/3/1 waves, weeks 1-3 = 5+/3+/5-3-1+, week 4 = deload"
}

// ─── Head Coach: Week Brief ─────────────────────────────────────────────────
// Per-week mandate sent to each domain coach during Pipeline A Step 2.
// Contains the coach-specific slice of the MesocycleStrategy for this week.

export interface WeekBrief {
    weekNumber: number
    isDeload: boolean
    weekEmphasis: string
    volumePercent: number

    // This coach's specific mandate
    sessionsToGenerate: number
    loadBudget: number // 1-10
    constraints: string[]
    methodologyDirective: string

    // Cross-domain context (so the coach knows what else is happening this week)
    otherDomainsThisWeek: Array<{
        domain: string
        sessionCount: number
        loadBudget: number
    }>
}

// ─── Recovery Coach: Assessment ─────────────────────────────────────────────
// Output of Pipeline B Step 1 — weekly training review.

export type RecoveryStatus = 'GREEN' | 'YELLOW' | 'RED'

export interface RecoveryAssessment {
    status: RecoveryStatus
    rationale: string // 1-3 sentence explanation

    // Only present for YELLOW/RED
    recommendations?: RecoveryRecommendation[]

    // Specific signals that drove the assessment
    signals: {
        avgRirDeviation: number // positive = easier than target, negative = harder
        rpeSpikes: string[] // exercises with RPE >= 9.5
        missedSessions: number
        completionRate: number // 0-1
        hadHighFatigueEvent: boolean // heavy ruck, external load, etc.
    }

    // Reactive deload override
    triggerDeload: boolean
}

export interface RecoveryRecommendation {
    targetDomain: CoachType
    type: 'intensity_reduction' | 'volume_reduction' | 'exercise_swap' | 'session_skip' | 'deload_modification'
    description: string // e.g. "Reduce squat intensity by 10%"
    magnitude?: number // e.g. -10 for "reduce by 10%"
}

// ─── Head Coach: Adjustment Directive ───────────────────────────────────────
// Output of Pipeline B Step 3 — targeted modification orders.

export interface AdjustmentDirective {
    weekNumber: number
    rationale: string // why adjustments are needed

    // Per-coach modification orders
    coachDirectives: CoachModificationOrder[]
}

export interface CoachModificationOrder {
    coach: CoachType
    action: 'modify' | 'skip' | 'replace' | 'no_change'
    instructions: string // natural language: "Reduce lower body intensity by 10%, keep movements the same"

    // Structured modification data (in addition to instructions)
    intensityAdjustment?: number // percentage change, e.g. -10
    volumeAdjustment?: number // set count change, e.g. -2
    exerciseSwaps?: Array<{ from: string; to: string; reason: string }>
}

// ─── Strength Coach: Program Output ─────────────────────────────────────────
// Multi-week strength program produced by the Strength Coach.

export interface StrengthProgramWeek {
    weekNumber: number
    isDeload: boolean
    sessions: StrengthSession[]
}

export interface StrengthSession {
    name: string
    splitType: string // e.g. "Upper A", "Lower B", "Push", "Pull"
    estimatedDurationMinutes: number
    loadBudget: number // 1-10
    exercises: StrengthExercise[]
    mobilityPrimerRequest?: string // what mobility is needed (Mobility Coach fills this)
    coachNotes: string | null
}

export interface StrengthExercise {
    exerciseName: string
    muscleGroup: string
    category: 'primary_compound' | 'secondary_compound' | 'accessory' | 'warm_up'
    sets: number
    targetReps: number
    targetWeightKg: number | null
    targetRir: number
    notes: string | null
    isBenchmarkTest?: boolean

    // For formula-driven lifts: the methodology source
    methodologySource?: string // e.g. "5/3/1 week 1: 3x5+ @ 65/75/85%"
}

// ─── Endurance Coach: Program Output ────────────────────────────────────────
// Multi-week endurance program produced by the Endurance Coach.

export interface EnduranceProgramWeek {
    weekNumber: number
    isDeload: boolean
    totalDistanceKm: number | null
    totalDurationMinutes: number
    sessions: EnduranceProgramSession[]
}

export interface EnduranceProgramSession {
    name: string
    enduranceModality: 'running' | 'rucking' | 'rowing' | 'swimming' | 'cycling'
    estimatedDurationMinutes: number
    loadBudget: number // 1-10
    intensityZone: 'zone_2' | 'tempo' | 'threshold' | 'vo2max' | 'easy' | 'interval'
    targetDistanceKm: number | null
    targetPaceSecPerKm: number | null
    intervalStructure: string | null // e.g. "8x400m @ 5K pace, 90s rest"
    ruckWeightLbs: number | null // only for rucking
    coachNotes: string | null
    methodologySource?: string // e.g. "Daniels VDOT 45: Threshold @ 4:30/km"
}

// ─── Hypertrophy Coach: Program Output ──────────────────────────────────────
// Multi-week hypertrophy program produced by the Hypertrophy Coach.

export interface HypertrophyProgramWeek {
    weekNumber: number
    isDeload: boolean
    weekNotes: string | null
    sessions: HypertrophySession[]
}

export interface HypertrophySession {
    name: string
    muscleGroupFocus: string[] // e.g. ["Chest", "Triceps"]
    estimatedDurationMinutes: number
    loadBudget: number
    exercises: HypertrophyExercise[]
    mobilityPrimerRequest?: string
    coachNotes: string | null
}

export interface HypertrophyExercise {
    exerciseName: string
    muscleGroup: string
    category: 'compound' | 'isolation' | 'machine' | 'warm_up'
    sets: number
    targetReps: number
    targetWeightKg: number | null
    targetRir: number
    tempo: string | null // e.g. "3-0-1-0"
    restSeconds: number | null // e.g. 90
    notes: string | null
    methodologySource?: string // e.g. "RP: Chest MAV week 3 = 16 sets"
}

// ─── Conditioning Coach: Program Output ─────────────────────────────────────
// Multi-week conditioning program produced by the Conditioning Coach.

export interface ConditioningProgramWeek {
    weekNumber: number
    isDeload: boolean
    weekNotes: string | null
    sessions: ConditioningProgramSession[]
}

export interface ConditioningProgramSession {
    name: string
    conditioningType: 'metcon' | 'amrap' | 'emom' | 'for_time' | 'intervals' | 'circuit' | 'chipper'
    estimatedDurationMinutes: number
    loadBudget: number
    targetIntensity: 'moderate' | 'high' | 'max_effort'
    workoutDescription: string
    equipmentNeeded: string[]
    energySystemTarget: 'glycolytic' | 'oxidative' | 'phosphagen' | 'mixed'
    coachNotes: string | null
}

// ─── Mobility Coach: Program Output ─────────────────────────────────────────
// Multi-week mobility program produced by the Mobility Coach.

export interface MobilityProgramWeek {
    weekNumber: number
    isDeload: boolean
    weekNotes: string | null
    standaloneSessions: MobilityProgramSession[]
    sessionPrimers: MobilityPrimer[] // injected into lifting/conditioning sessions
}

export interface MobilityProgramSession {
    name: string
    estimatedDurationMinutes: number
    focusAreas: string[]
    exercises: MobilityExercise[]
    coachNotes: string | null
}

export interface MobilityExercise {
    exerciseName: string
    bodyArea: string
    durationSeconds: number | null
    sets: number | null
    reps: number | null
    notes: string | null
}

export interface MobilityPrimer {
    targetSessionName: string // which lifting/conditioning session this primes
    focusAreas: string[]
    durationMinutes: number
    exercises: MobilityExercise[]
}
