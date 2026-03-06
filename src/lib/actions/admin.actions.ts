'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types/training.types'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AdminUserInfo {
    userId: string
    email: string | null
    displayName: string | null
    onboardingCompletedAt: string | null
    goalArchetype: string | null
    benchmarkDiscoveryStatus: string | null
    counts: {
        mesocycles: number
        microcycles: number
        workouts: number
        exerciseSets: number
        cardioLogs: number
        ruckingLogs: number
        injuries: number
        benchmarks: number
        recentTraining: number
        interventions: number
    }
}

export interface ResetResult {
    deletedCounts: Record<string, number>
    message: string
}

// ─── Dev-only guard ────────────────────────────────────────────────────────

function assertDev() {
    if (process.env.NODE_ENV !== 'development') {
        throw new Error('Admin actions are only available in development mode')
    }
}

// ─── Get Admin User Info ───────────────────────────────────────────────────

export async function getAdminUserInfo(): Promise<ActionResult<AdminUserInfo>> {
    assertDev()

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Fetch profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, goal_archetype, onboarding_completed_at, benchmark_discovery_status')
        .eq('id', user.id)
        .maybeSingle()

    // Count all related data
    const [
        { count: mesocycles },
        { count: microcycles },
        { count: workouts },
        { count: exerciseSets },
        { count: cardioLogs },
        { count: ruckingLogs },
        { count: injuries },
        { count: benchmarks },
        { count: recentTraining },
        { count: interventions },
    ] = await Promise.all([
        supabase.from('mesocycles').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('microcycles').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('exercise_sets').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('cardio_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('rucking_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('athlete_injuries').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('athlete_benchmarks').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('recent_training_activity').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('ai_coach_interventions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])

    return {
        success: true,
        data: {
            userId: user.id,
            email: user.email ?? null,
            displayName: profile?.display_name ?? null,
            onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
            goalArchetype: profile?.goal_archetype ?? null,
            benchmarkDiscoveryStatus: profile?.benchmark_discovery_status ?? null,
            counts: {
                mesocycles: mesocycles ?? 0,
                microcycles: microcycles ?? 0,
                workouts: workouts ?? 0,
                exerciseSets: exerciseSets ?? 0,
                cardioLogs: cardioLogs ?? 0,
                ruckingLogs: ruckingLogs ?? 0,
                injuries: injuries ?? 0,
                benchmarks: benchmarks ?? 0,
                recentTraining: recentTraining ?? 0,
                interventions: interventions ?? 0,
            },
        },
    }
}

// ─── Reset Training Data ───────────────────────────────────────────────────
// Deletes all training data in FK-safe order.
// Preserves: profile, injuries, benchmarks, recent_training (onboarding data)

export async function resetTrainingData(): Promise<ActionResult<ResetResult>> {
    assertDev()

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const deletedCounts: Record<string, number> = {}

    // 1. exercise_sets (leaf — FK to workouts)
    const { data: d1 } = await supabase
        .from('exercise_sets')
        .delete()
        .eq('user_id', user.id)
        .select('id')
    deletedCounts.exercise_sets = d1?.length ?? 0

    // 2. cardio_logs (leaf — FK to workouts)
    const { data: d2 } = await supabase
        .from('cardio_logs')
        .delete()
        .eq('user_id', user.id)
        .select('id')
    deletedCounts.cardio_logs = d2?.length ?? 0

    // 3. rucking_logs (leaf — FK to workouts)
    const { data: d3 } = await supabase
        .from('rucking_logs')
        .delete()
        .eq('user_id', user.id)
        .select('id')
    deletedCounts.rucking_logs = d3?.length ?? 0

    // 4. workouts (FK to microcycles)
    const { data: d4 } = await supabase
        .from('workouts')
        .delete()
        .eq('user_id', user.id)
        .select('id')
    deletedCounts.workouts = d4?.length ?? 0

    // 5. ai_coach_interventions
    const { data: d5 } = await supabase
        .from('ai_coach_interventions')
        .delete()
        .eq('user_id', user.id)
        .select('id')
    deletedCounts.ai_coach_interventions = d5?.length ?? 0

    // 6. microcycles (FK to mesocycles)
    const { data: d6 } = await supabase
        .from('microcycles')
        .delete()
        .eq('user_id', user.id)
        .select('id')
    deletedCounts.microcycles = d6?.length ?? 0

    // 7. mesocycles
    const { data: d7 } = await supabase
        .from('mesocycles')
        .delete()
        .eq('user_id', user.id)
        .select('id')
    deletedCounts.mesocycles = d7?.length ?? 0

    const totalDeleted = Object.values(deletedCounts).reduce((a, b) => a + b, 0)

    return {
        success: true,
        data: {
            deletedCounts,
            message: `Reset complete. Deleted ${totalDeleted} records across ${Object.keys(deletedCounts).filter(k => deletedCounts[k] > 0).length} tables.`,
        },
    }
}

// ─── Reset Onboarding ──────────────────────────────────────────────────────
// Full reset: clears all training data + onboarding data.
// User will be redirected to /onboarding on next visit.

export async function resetOnboarding(): Promise<ActionResult<ResetResult>> {
    assertDev()

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // First, reset all training data
    const trainingResult = await resetTrainingData()
    if (!trainingResult.success) {
        return trainingResult
    }

    const deletedCounts = { ...trainingResult.data.deletedCounts }

    // 8. athlete_injuries
    const { data: d8 } = await supabase
        .from('athlete_injuries')
        .delete()
        .eq('user_id', user.id)
        .select('id')
    deletedCounts.athlete_injuries = d8?.length ?? 0

    // 9. athlete_benchmarks
    const { data: d9 } = await supabase
        .from('athlete_benchmarks')
        .delete()
        .eq('user_id', user.id)
        .select('id')
    deletedCounts.athlete_benchmarks = d9?.length ?? 0

    // 10. recent_training_activity
    const { data: d10 } = await supabase
        .from('recent_training_activity')
        .delete()
        .eq('user_id', user.id)
        .select('id')
    deletedCounts.recent_training_activity = d10?.length ?? 0

    // 11. Reset profile fields to defaults (not delete — profile row stays)
    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            onboarding_completed_at: null,
            benchmark_discovery_status: 'pending',
            onboarding_path: null,
            age: null,
            sex: null,
            height_cm: null,
            bodyweight_kg: null,
            unit_preference: 'metric',
            lifting_experience: null,
            running_experience: null,
            conditioning_experience: null,
            rucking_experience: null,
            rowing_experience: null,
            swimming_experience: null,
            cycling_experience: null,
            primary_training_environment: null,
            equipment_list: [],
            available_days: null,
            session_duration_minutes: null,
            two_a_day: null,
            goal_archetype: null,
            has_injuries: false,
            movements_to_avoid: [],
            endurance_modality_preferences: [],
            conditioning_style_preferences: [],
            equipment_usage_intents: null,
            work_type: null,
            stress_level: null,
            travel_frequency: null,
            time_of_day: null,
            strength_methodology: null,
            hypertrophy_methodology: null,
            endurance_methodology: null,
            transparency: null,
            body_fat_percentage: null,
            body_comp_goal: null,
        })
        .eq('id', user.id)

    if (profileError) {
        return { success: false, error: `Profile reset failed: ${profileError.message}` }
    }

    deletedCounts.profile_fields_reset = 1

    const totalDeleted = Object.values(deletedCounts).reduce((a, b) => a + b, 0)

    return {
        success: true,
        data: {
            deletedCounts,
            message: `Full onboarding reset complete. Deleted ${totalDeleted} records. Profile fields reset to defaults. User will be redirected to onboarding.`,
        },
    }
}

// ─── Nuclear Reset ─────────────────────────────────────────────────────────
// Clears everything including the profile row itself.
// Note: Cannot delete auth.users row with anon key — that requires Supabase dashboard.

export async function deleteAllUserData(): Promise<ActionResult<ResetResult>> {
    assertDev()

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // First, do the full onboarding reset (clears everything)
    const onboardingResult = await resetOnboarding()
    if (!onboardingResult.success) {
        return onboardingResult
    }

    const deletedCounts = { ...onboardingResult.data.deletedCounts }

    // Delete the profile row itself
    const { error: profileDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

    if (profileDeleteError) {
        return { success: false, error: `Profile deletion failed: ${profileDeleteError.message}` }
    }

    deletedCounts.profile_deleted = 1

    // Sign out the user since their profile is gone
    await supabase.auth.signOut()

    const totalDeleted = Object.values(deletedCounts).reduce((a, b) => a + b, 0)

    return {
        success: true,
        data: {
            deletedCounts,
            message: `Nuclear reset complete. Deleted ${totalDeleted} records including profile. User signed out. Note: auth.users row still exists — delete via Supabase dashboard if needed.`,
        },
    }
}
