'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, OnboardingInjury, OnboardingBenchmark, OnboardingRecentTraining } from '@/lib/types/training.types'
import type {
    Profile,
    AthleteInjury,
    AthleteBenchmark,
    RecentTrainingActivity,
    OnboardingPath,
    ExperienceLevel,
    TrainingEnvironment,
    GoalArchetype,
    TwoADayWillingness,
    TimeOfDayPreference,
    WorkType,
    StressLevel,
    TravelFrequency,
    MethodologyPreference,
    TransparencyPreference,
    BodyCompGoal,
    EquipmentUsageIntent,
} from '@/lib/types/database.types'

// ─── Input types ─────────────────────────────────────────────────────────────

export interface UpdateOnboardingProfileInput {
    // Path selection
    onboardingPath?: OnboardingPath

    // Athlete profile
    age?: number
    sex?: 'MALE' | 'FEMALE'
    heightCm?: number
    bodyweightKg?: number
    unitPreference?: 'metric' | 'imperial'

    // Experience per modality
    liftingExperience?: ExperienceLevel
    runningExperience?: ExperienceLevel
    conditioningExperience?: ExperienceLevel
    ruckingExperience?: ExperienceLevel | null
    rowingExperience?: ExperienceLevel | null
    swimmingExperience?: ExperienceLevel | null
    cyclingExperience?: ExperienceLevel | null

    // Equipment & environment
    primaryTrainingEnvironment?: TrainingEnvironment
    equipmentList?: string[]
    equipmentUsageIntents?: Record<string, EquipmentUsageIntent>

    // Modality preferences
    enduranceModalityPreferences?: string[]
    conditioningStylePreferences?: string[]

    // Availability
    availableDays?: number
    sessionDurationMinutes?: number
    twoADay?: TwoADayWillingness
    timeOfDay?: TimeOfDayPreference

    // Lifestyle
    workType?: WorkType
    stressLevel?: StressLevel
    travelFrequency?: TravelFrequency

    // Goals
    goalArchetype?: GoalArchetype

    // Methodology
    strengthMethodology?: MethodologyPreference
    hypertrophyMethodology?: MethodologyPreference
    enduranceMethodology?: MethodologyPreference
    transparency?: TransparencyPreference

    // Body comp
    bodyFatPercentage?: number | null
    bodyCompGoal?: BodyCompGoal | null

    // Injuries
    hasInjuries?: boolean
    movementsToAvoid?: string[]

    // Coaching team
    coachingTeam?: Array<{ coach: string; priority: number }>

    // Legacy — still needed for mesocycle creation
    displayName?: string
}

// ─── getOnboardingProfile ────────────────────────────────────────────────────

export async function getOnboardingProfile(): Promise<ActionResult<Profile>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error('[getOnboardingProfile]', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: profile }
}

// ─── updateOnboardingProfile ─────────────────────────────────────────────────

export async function updateOnboardingProfile(
    input: UpdateOnboardingProfileInput
): Promise<ActionResult<Profile>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Map camelCase input to snake_case DB columns
    const updateData: Record<string, unknown> = {}

    if (input.onboardingPath !== undefined) updateData.onboarding_path = input.onboardingPath
    if (input.age !== undefined) updateData.age = input.age
    if (input.sex !== undefined) updateData.sex = input.sex
    if (input.heightCm !== undefined) updateData.height_cm = input.heightCm
    if (input.bodyweightKg !== undefined) updateData.bodyweight_kg = input.bodyweightKg
    if (input.unitPreference !== undefined) updateData.unit_preference = input.unitPreference
    if (input.displayName !== undefined) updateData.display_name = input.displayName

    // Experience levels
    if (input.liftingExperience !== undefined) updateData.lifting_experience = input.liftingExperience
    if (input.runningExperience !== undefined) updateData.running_experience = input.runningExperience
    if (input.conditioningExperience !== undefined) updateData.conditioning_experience = input.conditioningExperience
    if (input.ruckingExperience !== undefined) updateData.rucking_experience = input.ruckingExperience
    if (input.rowingExperience !== undefined) updateData.rowing_experience = input.rowingExperience
    if (input.swimmingExperience !== undefined) updateData.swimming_experience = input.swimmingExperience
    if (input.cyclingExperience !== undefined) updateData.cycling_experience = input.cyclingExperience

    // Equipment & environment
    if (input.primaryTrainingEnvironment !== undefined) updateData.primary_training_environment = input.primaryTrainingEnvironment
    if (input.equipmentList !== undefined) updateData.equipment_list = input.equipmentList
    if (input.equipmentUsageIntents !== undefined) updateData.equipment_usage_intents = input.equipmentUsageIntents

    // Preferences
    if (input.enduranceModalityPreferences !== undefined) updateData.endurance_modality_preferences = input.enduranceModalityPreferences
    if (input.conditioningStylePreferences !== undefined) updateData.conditioning_style_preferences = input.conditioningStylePreferences

    // Availability
    if (input.availableDays !== undefined) updateData.available_days = input.availableDays
    if (input.sessionDurationMinutes !== undefined) updateData.session_duration_minutes = input.sessionDurationMinutes
    if (input.twoADay !== undefined) updateData.two_a_day = input.twoADay
    if (input.timeOfDay !== undefined) updateData.time_of_day = input.timeOfDay

    // Lifestyle
    if (input.workType !== undefined) updateData.work_type = input.workType
    if (input.stressLevel !== undefined) updateData.stress_level = input.stressLevel
    if (input.travelFrequency !== undefined) updateData.travel_frequency = input.travelFrequency

    // Goals
    if (input.goalArchetype !== undefined) updateData.goal_archetype = input.goalArchetype

    // Methodology
    if (input.strengthMethodology !== undefined) updateData.strength_methodology = input.strengthMethodology
    if (input.hypertrophyMethodology !== undefined) updateData.hypertrophy_methodology = input.hypertrophyMethodology
    if (input.enduranceMethodology !== undefined) updateData.endurance_methodology = input.enduranceMethodology
    if (input.transparency !== undefined) updateData.transparency = input.transparency

    // Body comp
    if (input.bodyFatPercentage !== undefined) updateData.body_fat_percentage = input.bodyFatPercentage
    if (input.bodyCompGoal !== undefined) updateData.body_comp_goal = input.bodyCompGoal

    // Injuries
    if (input.hasInjuries !== undefined) updateData.has_injuries = input.hasInjuries
    if (input.movementsToAvoid !== undefined) updateData.movements_to_avoid = input.movementsToAvoid

    // Coaching team
    if (input.coachingTeam !== undefined) updateData.coaching_team = input.coachingTeam

    if (Object.keys(updateData).length === 0) {
        return { success: false, error: 'No fields to update' }
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...updateData, updated_at: new Date().toISOString() })
        .select()
        .single()

    if (error) {
        console.error('[updateOnboardingProfile]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/onboarding')
    return { success: true, data: profile }
}

// ─── saveInjuries ────────────────────────────────────────────────────────────

export async function saveInjuries(
    injuries: OnboardingInjury[]
): Promise<ActionResult<AthleteInjury[]>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Mark all existing active injuries as inactive
    await supabase
        .from('athlete_injuries')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_active', true)

    if (injuries.length === 0) {
        return { success: true, data: [] }
    }

    // Insert new injuries
    const rows = injuries.map((inj) => ({
        user_id: user.id,
        body_area: inj.bodyArea,
        description: inj.description || null,
        severity: inj.severity,
        movements_to_avoid: inj.movementsToAvoid || [],
        is_active: true,
    }))

    const { data, error } = await supabase
        .from('athlete_injuries')
        .insert(rows)
        .select()

    if (error) {
        console.error('[saveInjuries]', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [] }
}

// ─── saveBenchmarks ──────────────────────────────────────────────────────────

export async function saveBenchmarks(
    benchmarks: OnboardingBenchmark[]
): Promise<ActionResult<AthleteBenchmark[]>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    if (benchmarks.length === 0) {
        return { success: true, data: [] }
    }

    // Append-only — new rows, preserves history
    const rows = benchmarks.map((b) => ({
        user_id: user.id,
        modality: b.modality,
        benchmark_name: b.benchmarkName,
        value: b.value,
        unit: b.unit,
        source: 'self_reported' as const,
        tested_at: null,
    }))

    const { data, error } = await supabase
        .from('athlete_benchmarks')
        .insert(rows)
        .select()

    if (error) {
        console.error('[saveBenchmarks]', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [] }
}

// ─── saveRecentTraining ──────────────────────────────────────────────────────

export async function saveRecentTraining(
    activities: OnboardingRecentTraining[]
): Promise<ActionResult<RecentTrainingActivity[]>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Delete existing recent training for this user (snapshot replacement)
    await supabase
        .from('recent_training_activity')
        .delete()
        .eq('user_id', user.id)

    if (activities.length === 0) {
        return { success: true, data: [] }
    }

    const rows = activities.map((a) => ({
        user_id: user.id,
        modality: a.modality,
        frequency_per_week: a.frequencyPerWeek,
        approximate_volume: a.approximateVolume || null,
        captured_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase
        .from('recent_training_activity')
        .insert(rows)
        .select()

    if (error) {
        console.error('[saveRecentTraining]', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [] }
}

// ─── completeOnboarding ──────────────────────────────────────────────────────

export async function completeOnboarding(
    benchmarkPath: string = 'ai_estimated'
): Promise<ActionResult<{ ok: true }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('goal_archetype, primary_goal')
        .eq('id', user.id)
        .maybeSingle()

    if (profileError || !profile) {
        console.error('[completeOnboarding] profile fetch', profileError)
        return { success: false, error: 'Could not fetch profile.' }
    }

    const goalMap: Record<string, string> = {
        hybrid_fitness: 'HYBRID_PEAKING',
        strength_focus: 'STRENGTH',
        endurance_focus: 'ENDURANCE',
        conditioning_focus: 'HYBRID_PEAKING',
        longevity: 'HYBRID_PEAKING',
    }
    const mesocycleGoal = goalMap[profile.goal_archetype ?? ''] ?? profile.primary_goal ?? 'HYBRID_PEAKING'

    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            onboarding_completed_at: new Date().toISOString(),
            benchmark_discovery_status: benchmarkPath === 'discovery' ? 'pending' : 'complete',
            benchmark_week_complete: true,
            primary_goal: mesocycleGoal,
        })
        .eq('id', user.id)

    if (updateError) {
        console.error('[completeOnboarding] profile update', updateError)
        return { success: false, error: updateError.message }
    }

    revalidatePath('/onboarding')
    revalidatePath('/dashboard')
    return { success: true, data: { ok: true } }
}

// ─── Legacy compat: getProfile (used by other features) ─────────────────────

export async function getProfile(): Promise<ActionResult<Profile>> {
    return getOnboardingProfile()
}

export async function updateProfile(
    input: { displayName?: string; trainingAgeYears?: number; sex?: string; primaryGoal?: string; equipmentAccess?: string[]; availableDays?: number; bodyweightKg?: number }
): Promise<ActionResult<Profile>> {
    const updateData: Record<string, unknown> = {}
    if (input.displayName !== undefined) updateData.display_name = input.displayName
    if (input.trainingAgeYears !== undefined) updateData.training_age_years = input.trainingAgeYears
    if (input.sex !== undefined) updateData.sex = input.sex
    if (input.primaryGoal !== undefined) updateData.primary_goal = input.primaryGoal
    if (input.equipmentAccess !== undefined) updateData.equipment_access = input.equipmentAccess
    if (input.availableDays !== undefined) updateData.available_days = input.availableDays
    if (input.bodyweightKg !== undefined) updateData.bodyweight_kg = input.bodyweightKg

    if (Object.keys(updateData).length === 0) {
        return { success: false, error: 'No fields to update' }
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()

    if (error) {
        console.error('[updateProfile]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/onboarding')
    return { success: true, data: profile }
}
