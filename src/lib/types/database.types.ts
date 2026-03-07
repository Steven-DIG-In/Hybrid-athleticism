/**
 * TypeScript Database Row Types
 * Hand-crafted to match 001_initial_schema.sql + 003_onboarding_v2.sql
 */

// ─── Existing Enums ──────────────────────────────────────────────────────────

export type WorkoutModality = 'LIFTING' | 'CARDIO' | 'RUCKING' | 'METCON' | 'MOBILITY'
export type MesocycleGoal = 'HYPERTROPHY' | 'STRENGTH' | 'ENDURANCE' | 'HYBRID_PEAKING'
export type EquipmentType =
    | 'FULL_GYM'
    | 'BARBELL_RACK'
    | 'KETTLEBELLS'
    | 'DUMBBELLS_ONLY'
    | 'BODYWEIGHT_ONLY'
    | 'TRAVEL_MINIMAL'

// ─── New Enums (Onboarding V2) ──────────────────────────────────────────────

export type OnboardingPath = 'quick' | 'deep'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

export type TrainingEnvironment =
    | 'commercial_gym'
    | 'home_gym'
    | 'outdoor_minimal'
    | 'mix'

export type GoalArchetype =
    | 'hybrid_fitness'
    | 'strength_focus'
    | 'endurance_focus'
    | 'conditioning_focus'
    | 'longevity'

export type WorkType = 'desk' | 'active' | 'physical_labor' | 'mixed'
export type StressLevel = 'low' | 'moderate' | 'high' | 'variable'
export type TravelFrequency = 'rarely' | 'monthly' | 'weekly'
export type TwoADayWillingness = 'yes' | 'sometimes' | 'no'
export type TimeOfDayPreference = 'morning' | 'midday' | 'evening' | 'no_preference' | 'varies'

export type MethodologyPreference =
    | 'ai_decides'
    | 'linear_progression'
    | '531'
    | 'percentage_based'
    | 'conjugate'
    | 'rp_volume'
    | 'high_frequency'
    | 'traditional_split'
    | 'polarized_80_20'
    | 'maf_aerobic'
    | 'daniels_formula'
    | 'hybrid_mixed'
    | 'other'

export type TransparencyPreference = 'minimal' | 'detailed'
export type BodyCompGoal = 'gain_muscle' | 'lose_fat' | 'recomp' | 'maintain' | 'no_preference'
export type BenchmarkDiscoveryStatus = 'pending' | 'in_progress' | 'complete'
export type InjurySeverity = 'minor' | 'moderate' | 'significant'
export type InjuryBodyArea = 'shoulder' | 'lower_back' | 'knee' | 'hip' | 'ankle' | 'wrist' | 'elbow' | 'neck' | 'other'
export type BenchmarkSource = 'self_reported' | 'tested' | 'estimated'
export type PerceivedIntensity = 'low' | 'moderate' | 'high' | 'very_high'
export type EquipmentUsageIntent = 'endurance' | 'conditioning' | 'both'

// ─── profiles ────────────────────────────────────────────────────────────────

export interface Profile {
    id: string
    display_name: string | null
    avatar_url: string | null

    // Legacy fields (still used by existing features)
    training_age_years: number | null
    sex: 'MALE' | 'FEMALE' | string | null
    primary_goal: MesocycleGoal
    equipment_access: EquipmentType[]
    available_days: number
    bodyweight_kg: number | null
    benchmark_week_complete: boolean

    // Onboarding V2 fields
    onboarding_path: OnboardingPath | null
    age: number | null
    height_cm: number | null
    unit_preference: string

    // Experience per modality
    lifting_experience: ExperienceLevel | null
    running_experience: ExperienceLevel | null
    rucking_experience: ExperienceLevel | null
    rowing_experience: ExperienceLevel | null
    swimming_experience: ExperienceLevel | null
    cycling_experience: ExperienceLevel | null
    conditioning_experience: ExperienceLevel | null

    // Environment & equipment
    primary_training_environment: TrainingEnvironment | null
    equipment_list: string[]
    equipment_usage_intents: Record<string, EquipmentUsageIntent>

    // Modality preferences
    endurance_modality_preferences: string[]
    conditioning_style_preferences: string[]

    // Availability
    session_duration_minutes: number
    two_a_day: TwoADayWillingness
    time_of_day: TimeOfDayPreference

    // Lifestyle
    work_type: WorkType | null
    stress_level: StressLevel | null
    travel_frequency: TravelFrequency | null

    // Goals
    goal_archetype: GoalArchetype | null

    // Methodology
    strength_methodology: MethodologyPreference
    hypertrophy_methodology: MethodologyPreference
    endurance_methodology: MethodologyPreference
    transparency: TransparencyPreference

    // Body comp
    body_fat_percentage: number | null
    body_comp_goal: BodyCompGoal | null

    // Onboarding gate
    onboarding_completed_at: string | null
    benchmark_discovery_status: BenchmarkDiscoveryStatus

    // Injuries
    has_injuries: boolean
    movements_to_avoid: string[]

    // Multi-agent coaching team (Phase 1)
    coaching_team: Array<{ coach: string; priority: number }>

    created_at: string
    updated_at: string
}

// ─── athlete_injuries ────────────────────────────────────────────────────────

export interface AthleteInjury {
    id: string
    user_id: string
    body_area: InjuryBodyArea
    description: string | null
    severity: InjurySeverity
    movements_to_avoid: string[]
    is_active: boolean
    created_at: string
    updated_at: string
}

// ─── athlete_benchmarks ──────────────────────────────────────────────────────

export interface AthleteBenchmark {
    id: string
    user_id: string
    modality: string
    benchmark_name: string
    value: number
    unit: string
    source: BenchmarkSource
    tested_at: string | null
    created_at: string
}

// ─── recent_training_activity ────────────────────────────────────────────────

export interface RecentTrainingActivity {
    id: string
    user_id: string
    modality: string
    frequency_per_week: number
    approximate_volume: string | null
    captured_at: string
}

// ─── external_load_logs ──────────────────────────────────────────────────────

export interface ExternalLoadLog {
    id: string
    user_id: string
    activity_type: string
    duration_minutes: number | null
    perceived_intensity: PerceivedIntensity
    notes: string | null
    logged_at: string
    created_at: string
}

// ─── mesocycles ───────────────────────────────────────────────────────────────
export interface Mesocycle {
    id: string
    user_id: string
    name: string
    goal: MesocycleGoal
    week_count: number
    start_date: string
    end_date: string
    is_active: boolean
    is_complete: boolean
    completed_at: string | null
    ai_context_json: Record<string, unknown> | null

    // Multi-agent coaching
    mesocycle_strategy: Record<string, unknown> | null
    strength_program: Record<string, unknown> | null
    endurance_program: Record<string, unknown> | null
    hypertrophy_program: Record<string, unknown> | null
    conditioning_program: Record<string, unknown> | null
    mobility_program: Record<string, unknown> | null

    created_at: string
    updated_at: string
}

// ─── microcycles ──────────────────────────────────────────────────────────────
export interface Microcycle {
    id: string
    mesocycle_id: string
    user_id: string
    week_number: number
    start_date: string
    end_date: string
    target_rir: number | null
    is_deload: boolean
    reviewed_at: string | null
    review_summary: string | null

    // Multi-agent coaching (Phase 1)
    recovery_status: 'GREEN' | 'YELLOW' | 'RED' | null
    recovery_assessment: Record<string, unknown> | null
    adjustment_directive: Record<string, unknown> | null

    created_at: string
    updated_at: string
}

// ─── workouts ─────────────────────────────────────────────────────────────────
export interface Workout {
    id: string
    microcycle_id: string
    user_id: string
    modality: WorkoutModality
    name: string
    scheduled_date: string
    is_allocated: boolean
    is_completed: boolean
    completed_at: string | null
    actual_duration_minutes: number | null
    coach_notes: string | null
    created_at: string
    updated_at: string
}

// ─── exercise_sets ────────────────────────────────────────────────────────────
export interface ExerciseSet {
    id: string
    workout_id: string
    user_id: string
    exercise_name: string
    muscle_group: string | null
    set_number: number
    target_reps: number | null
    target_weight_kg: number | null
    target_rir: number | null
    actual_reps: number | null
    actual_weight_kg: number | null
    rir_actual: number | null
    rpe_actual: number | null
    notes: string | null
    is_pr: boolean
    logged_at: string | null
    created_at: string
}

// ─── cardio_logs ──────────────────────────────────────────────────────────────
export interface CardioLog {
    id: string
    workout_id: string
    user_id: string
    cardio_type: 'ZONE_2' | 'VO2_MAX' | 'TEMPO' | 'EASY'
    duration_minutes: number
    distance_km: number | null
    avg_pace_sec_per_km: number | null
    avg_heart_rate_bpm: number | null
    max_heart_rate_bpm: number | null
    calories_burned: number | null
    perceived_effort_rpe: number | null
    device_source: string | null
    raw_data_json: Record<string, unknown> | null
    logged_at: string
    created_at: string
}

// ─── rucking_logs ─────────────────────────────────────────────────────────────
export interface RuckingLog {
    id: string
    workout_id: string
    user_id: string
    distance_km: number
    pack_weight_lbs: number
    elevation_gain_m: number | null
    duration_minutes: number
    avg_pace_sec_per_km: number | null
    total_load_index: number
    terrain: string | null
    avg_heart_rate_bpm: number | null
    perceived_effort_rpe: number | null
    notes: string | null
    fatigue_flag: boolean
    logged_at: string
    created_at: string
}

// ─── conditioning_logs ───────────────────────────────────────────────────────
export type ConditioningFormat = 'amrap' | 'emom' | 'for_time' | 'intervals' | 'circuit' | 'chipper' | 'metcon'

export interface ConditioningLog {
    id: string
    workout_id: string
    user_id: string
    workout_format: ConditioningFormat
    is_rx: boolean
    result_time_seconds: number | null
    result_rounds: number | null
    result_partial_reps: number | null
    result_completed: boolean | null
    perceived_effort_rpe: number | null
    modifications: string | null
    athlete_notes: string | null
    logged_at: string
    created_at: string
}

// ─── ai_coach_interventions ───────────────────────────────────────────────────
export interface AICoachIntervention {
    id: string
    microcycle_id: string
    user_id: string
    trigger_type: 'WEEKLY_REVIEW' | 'RUCK_FATIGUE' | 'RPE_SPIKE' | 'CARDIO_LOAD'
    rationale: string
    volume_adjustments: Record<string, number> | null
    exercise_swaps: Array<{ from: string; to: string; reason: string }> | null
    rir_adjustment: number | null
    model_used: string
    input_payload: Record<string, unknown> | null
    raw_response: string | null
    presented_to_user: boolean
    user_accepted: boolean | null
    user_feedback: string | null
    created_at: string
}

// ─── Supabase Database shape ─────────────────────────────────────────────────
export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile
                Insert: Omit<Profile, 'created_at' | 'updated_at'>
                Update: Partial<Omit<Profile, 'id' | 'created_at'>>
            }
            mesocycles: {
                Row: Mesocycle
                Insert: Omit<Mesocycle, 'id' | 'end_date' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Mesocycle, 'id' | 'end_date' | 'created_at'>>
            }
            microcycles: {
                Row: Microcycle
                Insert: Omit<Microcycle, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Microcycle, 'id' | 'created_at'>>
            }
            workouts: {
                Row: Workout
                Insert: Omit<Workout, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Workout, 'id' | 'created_at'>>
            }
            exercise_sets: {
                Row: ExerciseSet
                Insert: Omit<ExerciseSet, 'id' | 'created_at'>
                Update: Partial<Omit<ExerciseSet, 'id' | 'created_at'>>
            }
            cardio_logs: {
                Row: CardioLog
                Insert: Omit<CardioLog, 'id' | 'created_at'>
                Update: Partial<Omit<CardioLog, 'id' | 'created_at'>>
            }
            rucking_logs: {
                Row: RuckingLog
                Insert: Omit<RuckingLog, 'id' | 'total_load_index' | 'created_at'>
                Update: Partial<Omit<RuckingLog, 'id' | 'total_load_index' | 'created_at'>>
            }
            conditioning_logs: {
                Row: ConditioningLog
                Insert: Omit<ConditioningLog, 'id' | 'created_at'>
                Update: Partial<Omit<ConditioningLog, 'id' | 'created_at'>>
            }
            ai_coach_interventions: {
                Row: AICoachIntervention
                Insert: Omit<AICoachIntervention, 'id' | 'created_at'>
                Update: Partial<Omit<AICoachIntervention, 'id' | 'created_at'>>
            }
            athlete_injuries: {
                Row: AthleteInjury
                Insert: Omit<AthleteInjury, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<AthleteInjury, 'id' | 'created_at'>>
            }
            athlete_benchmarks: {
                Row: AthleteBenchmark
                Insert: Omit<AthleteBenchmark, 'id' | 'created_at'>
                Update: Partial<Omit<AthleteBenchmark, 'id' | 'created_at'>>
            }
            recent_training_activity: {
                Row: RecentTrainingActivity
                Insert: Omit<RecentTrainingActivity, 'id'>
                Update: Partial<Omit<RecentTrainingActivity, 'id'>>
            }
            external_load_logs: {
                Row: ExternalLoadLog
                Insert: Omit<ExternalLoadLog, 'id' | 'created_at'>
                Update: Partial<Omit<ExternalLoadLog, 'id' | 'created_at'>>
            }
        }
        Enums: {
            workout_modality: WorkoutModality
            mesocycle_goal: MesocycleGoal
            equipment_type: EquipmentType
            onboarding_path: OnboardingPath
            experience_level: ExperienceLevel
            training_environment: TrainingEnvironment
            goal_archetype: GoalArchetype
            work_type: WorkType
            stress_level: StressLevel
            travel_frequency: TravelFrequency
            two_a_day_willingness: TwoADayWillingness
            time_of_day_preference: TimeOfDayPreference
            methodology_preference: MethodologyPreference
            transparency_preference: TransparencyPreference
            body_comp_goal: BodyCompGoal
            benchmark_discovery_status: BenchmarkDiscoveryStatus
            injury_severity: InjurySeverity
            injury_body_area: InjuryBodyArea
            benchmark_source: BenchmarkSource
            perceived_intensity: PerceivedIntensity
        }
    }
}
