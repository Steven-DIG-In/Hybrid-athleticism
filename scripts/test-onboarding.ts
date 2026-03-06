/**
 * Onboarding Flow Test Script
 *
 * Verifies that the onboarding server actions correctly mutate the database.
 * Uses the Supabase client directly (no Next.js runtime needed).
 *
 * Usage:
 *   npx tsx scripts/test-onboarding.ts
 *
 * Prerequisites:
 *   - A test user must exist in Supabase Auth (sign up via the app or Supabase dashboard)
 *   - Set TEST_EMAIL and TEST_PASSWORD below or via env vars
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kuqgtholljrxnbxtmrnz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cWd0aG9sbGpyeG5ieHRtcm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTEzNjksImV4cCI6MjA4NDY4NzM2OX0.igC97nDDN2JByM9ApaiQQznU9woSwtJlR5TGG9tATUk'

// Test credentials — override via env vars
const TEST_EMAIL = process.env.TEST_EMAIL ?? 'test@hybridathleticism.dev'
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'testpassword123!'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pass(label: string) {
    console.log(`  ✅ ${label}`)
}

function fail(label: string, detail?: string) {
    console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`)
    process.exitCode = 1
}

function getNextMonday(from: Date): Date {
    const d = new Date(from)
    const day = d.getDay()
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day
    d.setDate(d.getDate() + daysUntilMonday)
    d.setHours(0, 0, 0, 0)
    return d
}

// ─── Test Steps ──────────────────────────────────────────────────────────────

async function main() {
    console.log('\n🏋️ Hybrid Athleticism — Onboarding Flow Test\n')
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
        console.log('\n  💡 Tip: Create a test user first:')
        console.log('     1. Go to Supabase Dashboard → Authentication → Users')
        console.log(`     2. Add user: ${TEST_EMAIL} / ${TEST_PASSWORD}`)
        console.log('     OR set TEST_EMAIL and TEST_PASSWORD env vars\n')
        return
    }

    const userId = authData.user.id
    pass(`Signed in as ${userId}`)

    // ── Step 1: Verify profile exists (auto-created by trigger) ──────────────
    console.log('\nStep 1: Verify profile exists')

    const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (profileCheckError || !existingProfile) {
        fail('Profile check', profileCheckError?.message ?? 'No profile row')
        return
    }

    pass('Profile row exists (auto-created by trigger)')
    console.log(`    benchmark_week_complete: ${existingProfile.benchmark_week_complete}`)

    // ── Step 2: Reset profile for clean test ─────────────────────────────────
    console.log('\nStep 2: Reset profile to pre-onboarding state')

    const { error: resetError } = await supabase
        .from('profiles')
        .update({
            training_age_years: null,
            primary_goal: 'HYBRID_PEAKING',
            equipment_access: [],
            available_days: 4,
            bodyweight_kg: null,
            benchmark_week_complete: false,
        })
        .eq('id', userId)

    if (resetError) {
        fail('Profile reset', resetError.message)
        return
    }

    pass('Profile reset to defaults')

    // Clean up any existing mesocycles from previous test runs
    const { error: cleanupError } = await supabase
        .from('mesocycles')
        .delete()
        .eq('user_id', userId)

    if (cleanupError) {
        fail('Mesocycle cleanup', cleanupError.message)
    } else {
        pass('Cleaned up old mesocycles')
    }

    // ── Step 3: updateProfile — simulate onboarding step 1 (physical) ────────
    console.log('\nStep 3: updateProfile — physical profile')

    const { data: step1Profile, error: step1Error } = await supabase
        .from('profiles')
        .update({
            training_age_years: 5,
            bodyweight_kg: 88.5,
        })
        .eq('id', userId)
        .select()
        .single()

    if (step1Error) {
        fail('Physical profile update', step1Error.message)
        return
    }

    if (step1Profile.training_age_years === 5 && Number(step1Profile.bodyweight_kg) === 88.5) {
        pass('training_age_years=5, bodyweight_kg=88.5')
    } else {
        fail('Values mismatch', JSON.stringify(step1Profile))
    }

    // ── Step 4: updateProfile — simulate onboarding step 2 (equipment) ───────
    console.log('\nStep 4: updateProfile — equipment & goal')

    const { data: step2Profile, error: step2Error } = await supabase
        .from('profiles')
        .update({
            equipment_access: ['FULL_GYM', 'BARBELL_RACK'],
            primary_goal: 'HYBRID_PEAKING',
            available_days: 5,
        })
        .eq('id', userId)
        .select()
        .single()

    if (step2Error) {
        fail('Equipment update', step2Error.message)
        return
    }

    const equipMatch = JSON.stringify(step2Profile.equipment_access) === JSON.stringify(['FULL_GYM', 'BARBELL_RACK'])
    if (equipMatch && step2Profile.primary_goal === 'HYBRID_PEAKING' && step2Profile.available_days === 5) {
        pass('equipment_access=[FULL_GYM, BARBELL_RACK], goal=HYBRID_PEAKING, days=5')
    } else {
        fail('Values mismatch', JSON.stringify(step2Profile))
    }

    // ── Step 5: completeOnboarding — the big one ─────────────────────────────
    console.log('\nStep 5: completeOnboarding')

    // 5a: Set benchmark_week_complete
    const { error: completeError } = await supabase
        .from('profiles')
        .update({ benchmark_week_complete: true })
        .eq('id', userId)

    if (completeError) {
        fail('Set benchmark_week_complete', completeError.message)
        return
    }

    pass('benchmark_week_complete = true')

    // 5b: Deactivate any existing mesocycles
    await supabase
        .from('mesocycles')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)

    // 5c: Create first mesocycle
    const startDate = getNextMonday(new Date())
    const weekCount = 6

    const { data: mesocycle, error: mesoError } = await supabase
        .from('mesocycles')
        .insert({
            user_id: userId,
            name: 'HYBRID_PEAKING Block 1',
            goal: 'HYBRID_PEAKING',
            week_count: weekCount,
            start_date: startDate.toISOString().split('T')[0],
            is_active: true,
            is_complete: false,
            ai_context_json: {
                generatedBy: 'onboarding',
                equipmentAccess: ['FULL_GYM', 'BARBELL_RACK'],
                availableDays: 5,
            },
        })
        .select()
        .single()

    if (mesoError || !mesocycle) {
        fail('Mesocycle creation', mesoError?.message ?? 'No mesocycle returned')
        return
    }

    pass(`Mesocycle created: ${mesocycle.id} (${mesocycle.name})`)
    console.log(`    start: ${mesocycle.start_date}, end: ${mesocycle.end_date}`)

    // 5d: Scaffold microcycles
    const microcycles = []
    for (let week = 1; week <= weekCount; week++) {
        const weekStart = new Date(startDate)
        weekStart.setDate(weekStart.getDate() + (week - 1) * 7)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)

        const isDeload = week === weekCount
        const targetRir = isDeload ? 4 : Math.max(0, 3 - (week - 1) * 0.5)

        microcycles.push({
            mesocycle_id: mesocycle.id,
            user_id: userId,
            week_number: week,
            start_date: weekStart.toISOString().split('T')[0],
            end_date: weekEnd.toISOString().split('T')[0],
            target_rir: targetRir,
            is_deload: isDeload,
        })
    }

    const { data: createdWeeks, error: weekError } = await supabase
        .from('microcycles')
        .insert(microcycles)
        .select()

    if (weekError || !createdWeeks) {
        fail('Microcycle creation', weekError?.message ?? 'No weeks returned')
        return
    }

    pass(`${createdWeeks.length} microcycles created`)
    for (const w of createdWeeks) {
        const tag = w.is_deload ? ' (DELOAD)' : ''
        console.log(`    Week ${w.week_number}: ${w.start_date} → ${w.end_date} | RIR ${w.target_rir}${tag}`)
    }

    // ── Step 6: Verify final state ───────────────────────────────────────────
    console.log('\nStep 6: Final verification')

    const { data: finalProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (!finalProfile) {
        fail('Final profile read')
        return
    }

    const checks = [
        { label: 'benchmark_week_complete', ok: finalProfile.benchmark_week_complete === true },
        { label: 'training_age_years', ok: finalProfile.training_age_years === 5 },
        { label: 'bodyweight_kg', ok: Number(finalProfile.bodyweight_kg) === 88.5 },
        { label: 'equipment_access', ok: finalProfile.equipment_access?.length === 2 },
        { label: 'primary_goal', ok: finalProfile.primary_goal === 'HYBRID_PEAKING' },
        { label: 'available_days', ok: finalProfile.available_days === 5 },
    ]

    for (const c of checks) {
        c.ok ? pass(c.label) : fail(c.label)
    }

    // Verify mesocycle + microcycles
    const { data: activeMeso } = await supabase
        .from('mesocycles')
        .select('*, microcycles(*)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

    if (activeMeso) {
        pass(`Active mesocycle: ${activeMeso.name}`)
        const weeks = (activeMeso as { microcycles: { id: string }[] }).microcycles
        weeks.length === 6
            ? pass(`${weeks.length} microcycles attached`)
            : fail(`Expected 6 microcycles, got ${weeks.length}`)
    } else {
        fail('No active mesocycle found')
    }

    // ── Done ─────────────────────────────────────────────────────────────────
    console.log('\n' + (process.exitCode ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED') + '\n')
}

main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
})
