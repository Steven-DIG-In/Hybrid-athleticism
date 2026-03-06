/**
 * Workout Logging Flow Test Script
 *
 * Tests the full workout execution lifecycle:
 * 1. Scaffold a workout with pre-built exercise_sets (target values)
 * 2. Update sets with actual performance data (updateExerciseSet flow)
 * 3. Complete the workout with duration
 * 4. Verify final state
 *
 * Usage:
 *   npx tsx scripts/test-workout-logging.ts
 *
 * Prerequisites:
 *   - A test user with a completed onboarding (run test-onboarding.ts first)
 *   - Set TEST_EMAIL and TEST_PASSWORD via env vars or defaults below
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kuqgtholljrxnbxtmrnz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cWd0aG9sbGpyeG5ieHRtcm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTEzNjksImV4cCI6MjA4NDY4NzM2OX0.igC97nDDN2JByM9ApaiQQznU9woSwtJlR5TGG9tATUk'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'test@hybridathleticism.dev'
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'testpassword123!'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function pass(label: string) {
    console.log(`  ✅ ${label}`)
}

function fail(label: string, detail?: string) {
    console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`)
    process.exitCode = 1
}

async function main() {
    console.log('\n🏋️ Hybrid Athleticism — Workout Logging Flow Test\n')
    console.log(`  Target: ${SUPABASE_URL}`)
    console.log(`  User:   ${TEST_EMAIL}\n`)

    // ── Step 0: Authenticate ─────────────────────────────────────────────────
    console.log('Step 0: Authentication')

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    })

    if (authError || !authData.user) {
        fail('Sign in', authError?.message ?? 'No user returned')
        return
    }

    const userId = authData.user.id
    pass(`Signed in as ${userId}`)

    // ── Step 1: Find or create a microcycle for today ────────────────────────
    console.log('\nStep 1: Get active microcycle')

    const today = new Date().toISOString().split('T')[0]

    let { data: microcycle } = await supabase
        .from('microcycles')
        .select('*')
        .eq('user_id', userId)
        .lte('start_date', today)
        .gte('end_date', today)
        .maybeSingle()

    if (!microcycle) {
        // No active microcycle for today — try to get the first one from the active mesocycle
        const { data: meso } = await supabase
            .from('mesocycles')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle()

        if (!meso) {
            fail('No active mesocycle. Run test-onboarding.ts first.')
            return
        }

        const { data: firstWeek } = await supabase
            .from('microcycles')
            .select('*')
            .eq('mesocycle_id', meso.id)
            .order('week_number', { ascending: true })
            .limit(1)
            .single()

        if (!firstWeek) {
            fail('No microcycles found')
            return
        }

        microcycle = firstWeek
        pass(`Using microcycle Week ${microcycle.week_number} (${microcycle.start_date} → ${microcycle.end_date})`)
    } else {
        pass(`Found active microcycle: Week ${microcycle.week_number}`)
    }

    // ── Step 2: Clean up old test workouts ────────────────────────────────────
    console.log('\nStep 2: Cleanup old test data')

    const { data: oldWorkouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('microcycle_id', microcycle.id)
        .eq('name', 'TEST: Upper Body Push')

    if (oldWorkouts && oldWorkouts.length > 0) {
        const oldIds = oldWorkouts.map(w => w.id)
        await supabase.from('exercise_sets').delete().in('workout_id', oldIds)
        await supabase.from('workouts').delete().in('id', oldIds)
        pass(`Cleaned up ${oldWorkouts.length} old test workout(s)`)
    } else {
        pass('No old test workouts to clean up')
    }

    // ── Step 3: Scaffold a workout with exercise sets ─────────────────────────
    console.log('\nStep 3: Scaffold workout + exercise sets (target values)')

    const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
            microcycle_id: microcycle.id,
            user_id: userId,
            modality: 'LIFTING',
            name: 'TEST: Upper Body Push',
            scheduled_date: today,
            is_completed: false,
        })
        .select()
        .single()

    if (workoutError || !workout) {
        fail('Workout creation', workoutError?.message)
        return
    }

    pass(`Workout created: ${workout.id} — "${workout.name}"`)

    // Scaffold 9 exercise sets across 3 exercises
    const targetSets = [
        // Bench Press — 3 sets
        { exercise_name: 'Barbell Bench Press', muscle_group: 'Chest', set_number: 1, target_reps: 8, target_weight_kg: 100, target_rir: 2 },
        { exercise_name: 'Barbell Bench Press', muscle_group: 'Chest', set_number: 2, target_reps: 8, target_weight_kg: 100, target_rir: 2 },
        { exercise_name: 'Barbell Bench Press', muscle_group: 'Chest', set_number: 3, target_reps: 8, target_weight_kg: 100, target_rir: 2 },
        // OHP — 3 sets
        { exercise_name: 'Overhead Press', muscle_group: 'Shoulders', set_number: 1, target_reps: 10, target_weight_kg: 60, target_rir: 2 },
        { exercise_name: 'Overhead Press', muscle_group: 'Shoulders', set_number: 2, target_reps: 10, target_weight_kg: 60, target_rir: 2 },
        { exercise_name: 'Overhead Press', muscle_group: 'Shoulders', set_number: 3, target_reps: 10, target_weight_kg: 60, target_rir: 2 },
        // Tricep Pushdowns — 3 sets
        { exercise_name: 'Cable Tricep Pushdowns', muscle_group: 'Triceps', set_number: 1, target_reps: 12, target_weight_kg: 30, target_rir: 1 },
        { exercise_name: 'Cable Tricep Pushdowns', muscle_group: 'Triceps', set_number: 2, target_reps: 12, target_weight_kg: 30, target_rir: 1 },
        { exercise_name: 'Cable Tricep Pushdowns', muscle_group: 'Triceps', set_number: 3, target_reps: 12, target_weight_kg: 30, target_rir: 1 },
    ]

    const setsToInsert = targetSets.map(s => ({
        workout_id: workout.id,
        user_id: userId,
        ...s,
    }))

    const { data: createdSets, error: setsError } = await supabase
        .from('exercise_sets')
        .insert(setsToInsert)
        .select()

    if (setsError || !createdSets) {
        fail('Exercise sets creation', setsError?.message)
        return
    }

    pass(`${createdSets.length} exercise sets scaffolded with target values`)

    // ── Step 4: Simulate workout execution — update sets with actuals ──────────
    console.log('\nStep 4: Log actual performance (updateExerciseSet flow)')

    const actualPerformance = [
        // Bench: good day, slight overperformance
        { actualReps: 9, actualWeightKg: 100, rirActual: 1.5, rpeActual: 8.5 },
        { actualReps: 8, actualWeightKg: 100, rirActual: 1, rpeActual: 9 },
        { actualReps: 7, actualWeightKg: 100, rirActual: 0.5, rpeActual: 9.5 },
        // OHP: hit targets
        { actualReps: 10, actualWeightKg: 60, rirActual: 2, rpeActual: 8 },
        { actualReps: 10, actualWeightKg: 60, rirActual: 1.5, rpeActual: 8.5 },
        { actualReps: 9, actualWeightKg: 60, rirActual: 1, rpeActual: 9 },
        // Triceps: pushed hard
        { actualReps: 13, actualWeightKg: 30, rirActual: 0.5, rpeActual: 9.5 },
        { actualReps: 12, actualWeightKg: 30, rirActual: 0, rpeActual: 10 },
        { actualReps: 10, actualWeightKg: 30, rirActual: 0, rpeActual: 10 },
    ]

    let updateSuccessCount = 0

    for (let i = 0; i < createdSets.length; i++) {
        const set = createdSets[i]
        const perf = actualPerformance[i]

        const { data: updatedSet, error: updateError } = await supabase
            .from('exercise_sets')
            .update({
                actual_reps: perf.actualReps,
                actual_weight_kg: perf.actualWeightKg,
                rir_actual: perf.rirActual,
                rpe_actual: perf.rpeActual,
                is_pr: i === 0,  // First bench set is a simulated PR
                logged_at: new Date().toISOString(),
            })
            .eq('id', set.id)
            .eq('user_id', userId)
            .select()
            .single()

        if (updateError || !updatedSet) {
            fail(`Update set ${set.exercise_name} #${set.set_number}`, updateError?.message)
        } else {
            updateSuccessCount++
        }
    }

    if (updateSuccessCount === createdSets.length) {
        pass(`All ${updateSuccessCount} sets logged with actual performance`)
    } else {
        fail(`Only ${updateSuccessCount}/${createdSets.length} sets updated`)
    }

    // ── Step 5: Complete the workout ──────────────────────────────────────────
    console.log('\nStep 5: Complete workout')

    const { data: completedWorkout, error: completeError } = await supabase
        .from('workouts')
        .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
            actual_duration_minutes: 55,
        })
        .eq('id', workout.id)
        .eq('user_id', userId)
        .select()
        .single()

    if (completeError || !completedWorkout) {
        fail('Complete workout', completeError?.message)
        return
    }

    pass(`Workout completed: duration=${completedWorkout.actual_duration_minutes} min`)

    // ── Step 6: Verify final state ────────────────────────────────────────────
    console.log('\nStep 6: Final verification')

    const { data: finalWorkout } = await supabase
        .from('workouts')
        .select('*, exercise_sets(*)')
        .eq('id', workout.id)
        .single()

    if (!finalWorkout) {
        fail('Final workout read')
        return
    }

    const sets = (finalWorkout as { exercise_sets: Array<{
        actual_reps: number | null; is_pr: boolean; exercise_name: string
    }> }).exercise_sets

    const checks = [
        { label: 'is_completed', ok: finalWorkout.is_completed === true },
        { label: 'actual_duration_minutes', ok: finalWorkout.actual_duration_minutes === 55 },
        { label: 'all sets have actual_reps', ok: sets.every(s => s.actual_reps !== null) },
        { label: 'PR flagged on first set', ok: sets.some(s => s.is_pr) },
    ]

    for (const c of checks) {
        c.ok ? pass(c.label) : fail(c.label)
    }

    // Summary
    console.log('\n  📊 Workout Summary:')
    const exercises = new Set(sets.map(s => s.exercise_name))
    for (const ex of exercises) {
        const exSets = sets.filter(s => s.exercise_name === ex)
        const reps = exSets.map(s => s.actual_reps).join(', ')
        console.log(`    ${ex}: ${exSets.length} sets — reps: [${reps}]`)
    }

    // ── Step 7: Test rucking log with fatigue flag ────────────────────────────
    console.log('\nStep 7: Log a high-fatigue rucking session')

    // Create a rucking workout first
    const { data: ruckWorkout, error: ruckWError } = await supabase
        .from('workouts')
        .insert({
            microcycle_id: microcycle.id,
            user_id: userId,
            modality: 'RUCKING',
            name: 'TEST: Sunday Heavy Ruck',
            scheduled_date: today,
            is_completed: false,
        })
        .select()
        .single()

    if (ruckWError || !ruckWorkout) {
        fail('Rucking workout creation', ruckWError?.message)
        return
    }

    // Log the ruck: 8km at 65lbs = load index 520 (> 300 threshold → fatigue flag)
    const loadIndex = 8 * 65  // 520
    const { data: ruckLog, error: ruckLogError } = await supabase
        .from('rucking_logs')
        .insert({
            workout_id: ruckWorkout.id,
            user_id: userId,
            distance_km: 8,
            pack_weight_lbs: 65,
            duration_minutes: 95,
            elevation_gain_m: 150,
            terrain: 'mixed trail',
            avg_heart_rate_bpm: 155,
            perceived_effort_rpe: 8.5,
            fatigue_flag: loadIndex > 300,
            logged_at: new Date().toISOString(),
        })
        .select()
        .single()

    if (ruckLogError || !ruckLog) {
        fail('Rucking log', ruckLogError?.message)
        return
    }

    const ruckChecks = [
        { label: `total_load_index = ${ruckLog.total_load_index} (computed)`, ok: Number(ruckLog.total_load_index) === 520 },
        { label: 'fatigue_flag = true (load > 300)', ok: ruckLog.fatigue_flag === true },
    ]

    for (const c of ruckChecks) {
        c.ok ? pass(c.label) : fail(c.label)
    }

    // Complete the ruck workout
    await supabase
        .from('workouts')
        .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
            actual_duration_minutes: 95,
        })
        .eq('id', ruckWorkout.id)

    pass('Rucking workout completed')

    // ── Done ─────────────────────────────────────────────────────────────────
    console.log('\n' + (process.exitCode ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED') + '\n')
}

main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
})
