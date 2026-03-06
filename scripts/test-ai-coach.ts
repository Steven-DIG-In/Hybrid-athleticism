/**
 * AI Coach Weekly Review Test Script
 *
 * Tests the full AI Coach pipeline:
 * 1. Build the weekly payload (aggregate workout data for a microcycle)
 * 2. Send to Anthropic Claude for analysis
 * 3. Parse the structured response
 * 4. Save to ai_coach_interventions table
 *
 * This script simulates the generateWeeklyReview() server action flow
 * using the Supabase client directly (no Next.js runtime needed).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/test-ai-coach.ts
 *
 * Prerequisites:
 *   - Run test-onboarding.ts first (creates mesocycle + microcycles)
 *   - Run test-workout-logging.ts first (creates workout data to review)
 *   - ANTHROPIC_API_KEY env var set
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kuqgtholljrxnbxtmrnz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cWd0aG9sbGpyeG5ieHRtcm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTEzNjksImV4cCI6MjA4NDY4NzM2OX0.igC97nDDN2JByM9ApaiQQznU9woSwtJlR5TGG9tATUk'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'test@hybridathleticism.dev'
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'testpassword123!'

const COACH_MODEL = 'claude-sonnet-4-5-20250929'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function pass(label: string) {
    console.log(`  ✅ ${label}`)
}

function fail(label: string, detail?: string) {
    console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`)
    process.exitCode = 1
}

async function main() {
    console.log('\n🤖 Hybrid Athleticism — AI Coach Weekly Review Test\n')
    console.log(`  Target: ${SUPABASE_URL}`)
    console.log(`  User:   ${TEST_EMAIL}`)
    console.log(`  Model:  ${COACH_MODEL}\n`)

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
        fail('ANTHROPIC_API_KEY not set')
        console.log('\n  💡 Usage: ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/test-ai-coach.ts\n')
        return
    }

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

    // ── Step 1: Find a microcycle with workout data ──────────────────────────
    console.log('\nStep 1: Find microcycle with logged workouts')

    const { data: microcycles } = await supabase
        .from('microcycles')
        .select('*')
        .eq('user_id', userId)
        .order('week_number', { ascending: true })

    if (!microcycles || microcycles.length === 0) {
        fail('No microcycles found. Run test-onboarding.ts first.')
        return
    }

    // Find the first microcycle that has completed workouts
    let targetMicrocycle = null
    for (const mc of microcycles) {
        const { count } = await supabase
            .from('workouts')
            .select('id', { count: 'exact', head: true })
            .eq('microcycle_id', mc.id)
            .eq('is_completed', true)

        if (count && count > 0) {
            targetMicrocycle = mc
            break
        }
    }

    if (!targetMicrocycle) {
        fail('No microcycle with completed workouts. Run test-workout-logging.ts first.')
        return
    }

    pass(`Using microcycle: Week ${targetMicrocycle.week_number} (${targetMicrocycle.id})`)

    // ── Step 2: Build the weekly payload ──────────────────────────────────────
    console.log('\nStep 2: Aggregate weekly training data')

    const { data: workouts } = await supabase
        .from('workouts')
        .select('id, modality, is_completed')
        .eq('microcycle_id', targetMicrocycle.id)
        .eq('user_id', userId)

    if (!workouts) {
        fail('No workouts found')
        return
    }

    const workoutIds = workouts.map(w => w.id)
    pass(`${workouts.length} workout(s) found (${workouts.filter(w => w.is_completed).length} completed)`)

    // Lifting summary
    const { data: sets } = await supabase
        .from('exercise_sets')
        .select('exercise_name, muscle_group, actual_reps, actual_weight_kg, rir_actual, rpe_actual, target_rir')
        .in('workout_id', workoutIds)
        .not('actual_reps', 'is', null)

    // Cardio summary
    const { data: cardioLogs } = await supabase
        .from('cardio_logs')
        .select('duration_minutes, avg_heart_rate_bpm')
        .in('workout_id', workoutIds)

    // Rucking summary
    const { data: ruckingLogs } = await supabase
        .from('rucking_logs')
        .select('distance_km, total_load_index, fatigue_flag')
        .in('workout_id', workoutIds)

    // Profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('equipment_access, primary_goal')
        .eq('id', userId)
        .single()

    // Mesocycle
    const { data: mesocycle } = await supabase
        .from('mesocycles')
        .select('goal, name')
        .eq('id', targetMicrocycle.mesocycle_id)
        .single()

    // Aggregate muscle group volumes
    const muscleGroupMap = new Map<string, {
        sets: number; tonnage: number; rirValues: number[]
    }>()

    for (const set of sets ?? []) {
        const mg = set.muscle_group ?? 'Unknown'
        const entry = muscleGroupMap.get(mg) ?? { sets: 0, tonnage: 0, rirValues: [] }
        entry.sets += 1
        entry.tonnage += (set.actual_reps ?? 0) * (set.actual_weight_kg ?? 0)
        if (set.rir_actual !== null) entry.rirValues.push(set.rir_actual)
        muscleGroupMap.set(mg, entry)
    }

    const muscleGroupVolumes = Array.from(muscleGroupMap.entries()).map(([mg, v]) => ({
        muscleGroup: mg,
        setsThisWeek: v.sets,
        targetSets: 12,
        totalTonnageKg: v.tonnage,
        avgRIR: v.rirValues.length > 0
            ? v.rirValues.reduce((a, b) => a + b, 0) / v.rirValues.length
            : null,
    }))

    // RIR deviation
    const setsWithBothRir = (sets ?? []).filter(s => s.rir_actual !== null && s.target_rir !== null)
    const avgRIRDeviation = setsWithBothRir.length > 0
        ? setsWithBothRir.reduce((sum, s) => sum + ((s.rir_actual ?? 0) - (s.target_rir ?? 0)), 0) / setsWithBothRir.length
        : 0

    // RPE spikes
    const rpeSpikes = [...new Set(
        (sets ?? []).filter(s => (s.rpe_actual ?? 0) >= 9.5).map(s => s.exercise_name)
    )]

    // Cardio HR
    const cardioWithHr = (cardioLogs ?? []).filter(c => c.avg_heart_rate_bpm !== null)
    const avgHeartRateCardio = cardioWithHr.length > 0
        ? Math.round(cardioWithHr.reduce((sum, c) => sum + (c.avg_heart_rate_bpm ?? 0), 0) / cardioWithHr.length)
        : null

    console.log(`\n  📊 Weekly Data Summary:`)
    console.log(`    Muscle groups logged: ${muscleGroupVolumes.length}`)
    for (const mg of muscleGroupVolumes) {
        console.log(`      ${mg.muscleGroup}: ${mg.setsThisWeek} sets, ${Math.round(mg.totalTonnageKg)}kg tonnage, avg RIR ${mg.avgRIR?.toFixed(1) ?? 'N/A'}`)
    }
    console.log(`    Avg RIR deviation: ${avgRIRDeviation.toFixed(2)}`)
    console.log(`    RPE spikes: ${rpeSpikes.length > 0 ? rpeSpikes.join(', ') : 'None'}`)
    console.log(`    Cardio: ${(cardioLogs ?? []).reduce((sum, c) => sum + c.duration_minutes, 0)} min`)
    console.log(`    Ruck distance: ${(ruckingLogs ?? []).reduce((sum, r) => sum + r.distance_km, 0)}km`)
    console.log(`    Ruck load index: ${(ruckingLogs ?? []).reduce((sum, r) => sum + (r.total_load_index ?? 0), 0)}`)
    console.log(`    High-fatigue ruck: ${(ruckingLogs ?? []).some(r => r.fatigue_flag) ? 'YES' : 'No'}`)

    pass('Weekly payload aggregated')

    // ── Step 3: Call Anthropic Claude ─────────────────────────────────────────
    console.log('\nStep 3: Send to Anthropic Claude for analysis')

    const anthropic = new Anthropic()

    const systemPrompt = `You are an elite hybrid-athletics coach embedded in a training app. Your job is to review a user's weekly training data and provide intelligent, actionable adjustments for the next week.

TRAINING PHILOSOPHY:
- You program across FOUR modalities: Hypertrophy/Strength lifting, Endurance cardio, Rucking (tactical), and MetCon.
- You understand that heavy rucking generates massive systemic fatigue (CNS + spinal loading). A brutal Sunday ruck means Monday's heavy squats should be swapped for machine-based leg work.
- You track sets per muscle group per week. Going below MEV (Minimum Effective Volume) wastes time. Going above MRV (Maximum Recoverable Volume) causes regression.
- RIR (Reps in Reserve) is the primary intensity control. Negative RIR deviation (user training harder than prescribed) signals accumulating fatigue.
- RPE spikes (>= 9.5) on non-peak exercises are red flags for fatigue or technique breakdown.

RESPONSE FORMAT:
You MUST respond with valid JSON only. No markdown, no explanations outside the JSON. Use this exact schema:
{
  "triggerType": "WEEKLY_REVIEW" | "RUCK_FATIGUE" | "RPE_SPIKE" | "CARDIO_LOAD",
  "rationale": "1-3 sentence human-readable explanation of your analysis",
  "volumeAdjustments": { "MuscleGroup": delta_sets_integer },
  "exerciseSwaps": [{ "from": "ExerciseName", "to": "ReplacementExercise", "reason": "why" }],
  "rirAdjustment": number_or_null
}

RULES:
- triggerType: Pick the MOST relevant trigger. "WEEKLY_REVIEW" is the default. Use "RUCK_FATIGUE" if high ruck load is the dominant concern. Use "RPE_SPIKE" if multiple exercises showed RPE >= 9.5. Use "CARDIO_LOAD" if cardio volume is impacting lifting recovery.
- volumeAdjustments: Only include muscle groups that need changes. Positive = add sets, negative = reduce sets. Keep deltas between -3 and +3.
- exerciseSwaps: Only suggest swaps that respect the user's equipment access. Never suggest equipment they don't have.
- rirAdjustment: If the user is consistently undershooting target RIR, suggest a positive adjustment. null if no change needed.
- If the week looks clean, keep adjustments minimal.`

    const muscleGroupSummary = muscleGroupVolumes.map(mg =>
        `  - ${mg.muscleGroup}: ${mg.setsThisWeek} sets (target: ${mg.targetSets}), tonnage: ${Math.round(mg.totalTonnageKg)}kg, avg RIR: ${mg.avgRIR !== null ? mg.avgRIR.toFixed(1) : 'N/A'}`
    ).join('\n')

    const userPrompt = `WEEKLY TRAINING REVIEW — Week ${targetMicrocycle.week_number}
Mesocycle Goal: ${mesocycle?.goal ?? 'HYBRID_PEAKING'}
Target RIR this week: ${targetMicrocycle.target_rir ?? 'Not set'}
Is Deload Week: ${targetMicrocycle.is_deload ? 'YES' : 'No'}
Equipment Available: ${(profile?.equipment_access ?? []).join(', ') || 'Unknown'}

── LIFTING VOLUME ──
${muscleGroupSummary || '  No lifting data logged.'}
Average RIR Deviation: ${avgRIRDeviation.toFixed(2)} (positive = easier than target, negative = harder)
RPE Spikes (>= 9.5): ${rpeSpikes.length > 0 ? rpeSpikes.join(', ') : 'None'}

── CARDIO ──
Total Cardio: ${(cardioLogs ?? []).reduce((sum, c) => sum + c.duration_minutes, 0)} minutes
Average Heart Rate: ${avgHeartRateCardio ?? 'N/A'} bpm

── RUCKING ──
Total Ruck Distance: ${(ruckingLogs ?? []).reduce((sum, r) => sum + r.distance_km, 0).toFixed(1)} km
Total Ruck Load Index: ${(ruckingLogs ?? []).reduce((sum, r) => sum + (r.total_load_index ?? 0), 0).toFixed(0)} (distance × pack weight)
High-Fatigue Ruck Detected: ${(ruckingLogs ?? []).some(r => r.fatigue_flag) ? 'YES — heavy systemic fatigue event' : 'No'}

Analyze this data and provide your JSON coaching response.`

    console.log('\n  📤 Sending prompt to Anthropic...')

    let rawResponse: string
    try {
        const message = await anthropic.messages.create({
            model: COACH_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = message.content.find(b => b.type === 'text')
        rawResponse = textBlock?.text ?? ''
    } catch (err) {
        fail('Anthropic API call', err instanceof Error ? err.message : String(err))
        return
    }

    pass('Received AI Coach response')
    console.log(`\n  📥 Raw response (${rawResponse.length} chars):`)
    console.log('  ' + rawResponse.split('\n').join('\n  '))

    // ── Step 4: Parse the structured response ─────────────────────────────────
    console.log('\nStep 4: Parse structured JSON response')

    interface CoachResponse {
        triggerType: string
        rationale: string
        volumeAdjustments: Record<string, number>
        exerciseSwaps: Array<{ from: string; to: string; reason: string }>
        rirAdjustment: number | null
    }

    let coachResponse: CoachResponse
    try {
        const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/) ?? rawResponse.match(/(\{[\s\S]*\})/)
        const jsonStr = jsonMatch?.[1]?.trim() ?? rawResponse.trim()
        coachResponse = JSON.parse(jsonStr) as CoachResponse
    } catch (parseErr) {
        fail('JSON parse', parseErr instanceof Error ? parseErr.message : String(parseErr))
        console.log('  Raw response was not valid JSON. Falling back...')
        coachResponse = {
            triggerType: 'WEEKLY_REVIEW',
            rationale: rawResponse.slice(0, 500),
            volumeAdjustments: {},
            exerciseSwaps: [],
            rirAdjustment: null,
        }
    }

    const responseChecks = [
        { label: `triggerType = "${coachResponse.triggerType}"`, ok: ['WEEKLY_REVIEW', 'RUCK_FATIGUE', 'RPE_SPIKE', 'CARDIO_LOAD'].includes(coachResponse.triggerType) },
        { label: `rationale present (${coachResponse.rationale.length} chars)`, ok: coachResponse.rationale.length > 10 },
        { label: `volumeAdjustments is object`, ok: typeof coachResponse.volumeAdjustments === 'object' },
        { label: `exerciseSwaps is array`, ok: Array.isArray(coachResponse.exerciseSwaps) },
    ]

    for (const c of responseChecks) {
        c.ok ? pass(c.label) : fail(c.label)
    }

    console.log(`\n  🧠 Coach Analysis:`)
    console.log(`    Trigger: ${coachResponse.triggerType}`)
    console.log(`    Rationale: ${coachResponse.rationale}`)
    if (Object.keys(coachResponse.volumeAdjustments).length > 0) {
        console.log(`    Volume adjustments:`)
        for (const [mg, delta] of Object.entries(coachResponse.volumeAdjustments)) {
            console.log(`      ${mg}: ${delta > 0 ? '+' : ''}${delta} sets`)
        }
    }
    if (coachResponse.exerciseSwaps.length > 0) {
        console.log(`    Exercise swaps:`)
        for (const swap of coachResponse.exerciseSwaps) {
            console.log(`      ${swap.from} → ${swap.to} (${swap.reason})`)
        }
    }
    if (coachResponse.rirAdjustment !== null) {
        console.log(`    RIR adjustment: ${coachResponse.rirAdjustment > 0 ? '+' : ''}${coachResponse.rirAdjustment}`)
    }

    // ── Step 5: Save to DB ────────────────────────────────────────────────────
    console.log('\nStep 5: Persist AI Coach intervention to DB')

    // Clean up old test interventions for this microcycle
    await supabase
        .from('ai_coach_interventions')
        .delete()
        .eq('microcycle_id', targetMicrocycle.id)
        .eq('user_id', userId)

    const { data: intervention, error: saveError } = await supabase
        .from('ai_coach_interventions')
        .insert({
            microcycle_id: targetMicrocycle.id,
            user_id: userId,
            trigger_type: coachResponse.triggerType,
            rationale: coachResponse.rationale,
            volume_adjustments: coachResponse.volumeAdjustments,
            exercise_swaps: coachResponse.exerciseSwaps,
            rir_adjustment: coachResponse.rirAdjustment,
            model_used: COACH_MODEL,
            input_payload: { userPrompt, muscleGroupVolumes, avgRIRDeviation, rpeSpikes },
            raw_response: rawResponse,
            presented_to_user: false,
        })
        .select()
        .single()

    if (saveError || !intervention) {
        fail('Save intervention', saveError?.message)
        return
    }

    pass(`Intervention saved: ${intervention.id}`)

    // Mark microcycle as reviewed
    const { error: reviewError } = await supabase
        .from('microcycles')
        .update({
            reviewed_at: new Date().toISOString(),
            review_summary: coachResponse.rationale,
        })
        .eq('id', targetMicrocycle.id)

    if (reviewError) {
        fail('Mark microcycle reviewed', reviewError.message)
    } else {
        pass('Microcycle marked as reviewed')
    }

    // ── Step 6: Verify we can read it back ────────────────────────────────────
    console.log('\nStep 6: Verify intervention is readable')

    const { data: readBack } = await supabase
        .from('ai_coach_interventions')
        .select('*')
        .eq('id', intervention.id)
        .single()

    if (readBack) {
        pass(`Intervention read back: trigger=${readBack.trigger_type}, presented=${readBack.presented_to_user}`)
    } else {
        fail('Could not read back intervention')
    }

    // ── Done ─────────────────────────────────────────────────────────────────
    console.log('\n' + (process.exitCode ? '❌ SOME CHECKS FAILED' : '✅ ALL CHECKS PASSED') + '\n')
}

main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
})
