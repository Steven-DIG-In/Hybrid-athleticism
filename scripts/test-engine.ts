/**
 * Standalone test script for the Programming Engine intelligence layer.
 * Bypasses auth entirely — tests pure functions + prompt generation + optional AI call.
 *
 * Usage:
 *   npx tsx scripts/test-engine.ts              # Prompt inspection only (no API call)
 *   npx tsx scripts/test-engine.ts --call-ai    # Full AI call with response
 */

import {
    calculate531Wave,
    estimateTrainingMax,
    estimate1RM,
    calculateRPVolumeLandmarks,
    calculateWeeklyVolumeTarget,
    calculatePolarizedZoneDistribution,
    calculateDanielsVDOT,
    formatPace,
} from '../src/lib/training/methodology-helpers'

import { buildProgrammingSystemPrompt, buildProgrammingUserPrompt } from '../src/lib/ai/prompts/programming'
import type { ProgrammingContext, MethodologyContext, MesocyclePlanContext } from '../src/lib/ai/prompts/programming'
import type { Profile, AthleteInjury, AthleteBenchmark, RecentTrainingActivity } from '../src/lib/types/database.types'

const CALL_AI = process.argv.includes('--call-ai')

// ─── Part 1: Test Methodology Helpers ─────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════')
console.log('PART 1: METHODOLOGY HELPERS — PURE FUNCTION TESTS')
console.log('═══════════════════════════════════════════════════════════\n')

// 5/3/1 Calculations
const squat1RM = estimate1RM(120, 1)
const squatTM = estimateTrainingMax(120, 1)
console.log(`Squat 1RM from 120kg x 1: ${squat1RM}kg`)
console.log(`Squat Training Max (90%): ${squatTM}kg`)

for (let week = 1; week <= 4; week++) {
    const wave = calculate531Wave(squatTM, week)
    const setsStr = wave.sets.map(s =>
        `${s.reps}${s.isAmrap ? '+' : ''} @ ${s.weightKg}kg (${Math.round(s.percentTM * 100)}%)`
    ).join(' → ')
    console.log(`  Week ${week} (${wave.weekLabel}): ${setsStr}`)
}

console.log('')

// RP Volume Landmarks
console.log('RP Volume Landmarks (Intermediate):')
const muscleGroups = ['Quads', 'Chest', 'Back', 'Shoulders', 'Hamstrings', 'Biceps']
for (const mg of muscleGroups) {
    const landmarks = calculateRPVolumeLandmarks(mg, 'intermediate')
    const week1Target = calculateWeeklyVolumeTarget(landmarks, 1, 6, false)
    const week5Target = calculateWeeklyVolumeTarget(landmarks, 5, 6, false)
    const deloadTarget = calculateWeeklyVolumeTarget(landmarks, 6, 6, true)
    console.log(`  ${mg}: MEV=${landmarks.mev} MAV=${landmarks.mav} MRV=${landmarks.mrv} | W1=${week1Target} W5=${week5Target} Deload=${deloadTarget}`)
}

console.log('')

// Polarized Endurance
const split = calculatePolarizedZoneDistribution(180)
console.log(`Polarized 80/20 (180min/week): Easy=${split.easyMinutes}min, Hard=${split.hardMinutes}min`)

// Daniels' VDOT
const paces = calculateDanielsVDOT(5, 25 * 60) // 5K in 25 minutes
console.log(`Daniels VDOT from 25:00 5K: VDOT=${paces.vdot}`)
console.log(`  Easy: ${formatPace(paces.easyPaceSecPerKm)}/km`)
console.log(`  Tempo: ${formatPace(paces.tempoPaceSecPerKm)}/km`)
console.log(`  Threshold: ${formatPace(paces.thresholdPaceSecPerKm)}/km`)
console.log(`  Intervals: ${formatPace(paces.intervalPaceSecPerKm)}/km`)

// ─── Part 2: Build Full Programming Prompt ────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════')
console.log('PART 2: FULL PROMPT GENERATION')
console.log('═══════════════════════════════════════════════════════════\n')

// Mock athlete profile
const mockProfile: Profile = {
    id: 'test-user-001',
    display_name: 'Test Athlete',
    avatar_url: null,
    training_age_years: 4,
    sex: 'MALE',
    primary_goal: 'HYBRID_PEAKING',
    equipment_access: ['FULL_GYM'],
    available_days: 5,
    bodyweight_kg: 85,
    benchmark_week_complete: false,
    onboarding_path: 'deep',
    age: 32,
    height_cm: 180,
    unit_preference: 'metric',
    lifting_experience: 'intermediate',
    running_experience: 'beginner',
    rucking_experience: null,
    rowing_experience: null,
    swimming_experience: null,
    cycling_experience: null,
    conditioning_experience: 'intermediate',
    primary_training_environment: 'commercial_gym',
    equipment_list: ['barbell', 'dumbbells', 'pull_up_bar', 'cable_machine', 'assault_bike', 'rower'],
    equipment_usage_intents: { rower: 'both', assault_bike: 'conditioning' },
    endurance_modality_preferences: ['running'],
    conditioning_style_preferences: ['metcon', 'amrap'],
    session_duration_minutes: 60,
    two_a_day: 'sometimes',
    time_of_day: 'morning',
    work_type: 'desk',
    stress_level: 'moderate',
    travel_frequency: 'rarely',
    goal_archetype: 'hybrid_fitness',
    strength_methodology: '531',
    hypertrophy_methodology: 'rp_volume',
    endurance_methodology: 'polarized_80_20',
    transparency: 'detailed',
    body_fat_percentage: 18,
    body_comp_goal: 'recomp',
    onboarding_completed_at: new Date().toISOString(),
    benchmark_discovery_status: 'complete',
    has_injuries: true,
    movements_to_avoid: ['behind the neck press'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}

const mockInjuries: AthleteInjury[] = [
    {
        id: 'inj-1',
        user_id: 'test-user-001',
        body_area: 'shoulder',
        description: 'Minor rotator cuff impingement, left side',
        severity: 'minor',
        movements_to_avoid: ['behind the neck press', 'upright rows'],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
]

const mockBenchmarks: AthleteBenchmark[] = [
    { id: 'bm-1', user_id: 'test-user-001', modality: 'strength', benchmark_name: 'back_squat', value: 120, unit: 'kg', source: 'tested', tested_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 'bm-2', user_id: 'test-user-001', modality: 'strength', benchmark_name: 'bench_press', value: 90, unit: 'kg', source: 'tested', tested_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 'bm-3', user_id: 'test-user-001', modality: 'strength', benchmark_name: 'deadlift', value: 150, unit: 'kg', source: 'tested', tested_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 'bm-4', user_id: 'test-user-001', modality: 'strength', benchmark_name: 'ohp', value: 60, unit: 'kg', source: 'tested', tested_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 'bm-5', user_id: 'test-user-001', modality: 'endurance', benchmark_name: '5k', value: 25, unit: 'minutes', source: 'tested', tested_at: new Date().toISOString(), created_at: new Date().toISOString() },
]

const mockRecentTraining: RecentTrainingActivity[] = [
    { id: 'rt-1', user_id: 'test-user-001', modality: 'lifting', frequency_per_week: 3, approximate_volume: '15-20 sets per session', captured_at: new Date().toISOString() },
    { id: 'rt-2', user_id: 'test-user-001', modality: 'running', frequency_per_week: 2, approximate_volume: '3-5km per run', captured_at: new Date().toISOString() },
    { id: 'rt-3', user_id: 'test-user-001', modality: 'conditioning', frequency_per_week: 1, approximate_volume: '20-30min metcons', captured_at: new Date().toISOString() },
]

// Build methodology context (same logic as buildMethodologyContext in programming.actions.ts)
const methodologyContext: MethodologyContext = {}

// 5/3/1 for week 2
const weekInCycle = ((2 - 1) % 4) + 1
const liftMap: Array<[string, string[]]> = [
    ['Squat', ['squat', 'back_squat']],
    ['Bench Press', ['bench', 'bench_press']],
    ['Deadlift', ['deadlift']],
    ['OHP', ['ohp', 'overhead_press', 'overhead']],
]
const lines531: string[] = []
for (const [displayName, keywords] of liftMap) {
    const bm = mockBenchmarks.find(b => keywords.some(kw => b.benchmark_name.toLowerCase().includes(kw)))
    if (bm) {
        const tm = estimateTrainingMax(bm.value, 1)
        const wave = calculate531Wave(tm, weekInCycle)
        const setsStr = wave.sets.map(s =>
            `${s.reps}${s.isAmrap ? '+' : ''} @ ${s.weightKg}kg (${Math.round(s.percentTM * 100)}%TM)`
        ).join(', ')
        lines531.push(`  ${displayName} (TM: ${tm}kg): ${wave.weekLabel} — ${setsStr}`)
    }
}
methodologyContext.liftingProtocol = `5/3/1 Cycle Week ${weekInCycle}:\n${lines531.join('\n')}`

// RP Volume
const majorGroups = ['Quads', 'Hamstrings', 'Chest', 'Back', 'Shoulders', 'Glutes', 'Biceps', 'Triceps']
const volumeLines = majorGroups.map(mg => {
    const landmarks = calculateRPVolumeLandmarks(mg, 'intermediate')
    const weekTarget = calculateWeeklyVolumeTarget(landmarks, 2, 6, false)
    return `  ${mg}: ${weekTarget} sets (MEV=${landmarks.mev}, MAV=${landmarks.mav}, MRV=${landmarks.mrv})`
})
methodologyContext.volumeTargets = volumeLines.join('\n')

// Polarized
const polarized = calculatePolarizedZoneDistribution(120)
methodologyContext.endurancePlan = `Polarized 80/20: ~${polarized.easyMinutes} min easy (Zone 2), ~${polarized.hardMinutes} min hard across 2 sessions`

// Mesocycle plan context
const mesocyclePlan: MesocyclePlanContext = {
    blockEmphasis: 'Balanced hybrid development with slight strength bias. Building aerobic base while progressing compound lifts through 5/3/1 wave loading.',
    deloadTiming: 'Week 6 is a planned deload. Volume drops to 50% of MRV with reduced intensity.',
    keyProgressions: [
        'Squat from 120kg to 130kg (5/3/1 cycle progression)',
        'Build running base from 3km to 5km continuous',
        'Progress from 14 to 18 weekly lifting sets per muscle group',
        'Add one metcon per week by block end',
    ],
    weekVolumePercent: 65,
    weekEmphasis: 'Strength accumulation — moderate volume, establishing movement patterns',
}

// Build the full context
const programmingContext: ProgrammingContext = {
    profile: mockProfile,
    injuries: mockInjuries,
    benchmarks: mockBenchmarks,
    recentTraining: mockRecentTraining,
    weekNumber: 2,
    totalWeeks: 6,
    isDeload: false,
    targetRir: 2,
    mesocycleGoal: 'HYBRID_PEAKING',
    isBenchmarkDiscovery: false,
    previousWeekSessions: [
        {
            name: 'Upper Body Strength A',
            modality: 'LIFTING',
            exercises: [
                { exerciseName: 'Bench Press', muscleGroup: 'Chest', sets: 3, targetReps: 5, targetWeightKg: 77, actualReps: 5, actualWeightKg: 80, rirActual: 1.5, rpeActual: 8.5 },
                { exerciseName: 'Barbell Row', muscleGroup: 'Back', sets: 3, targetReps: 8, targetWeightKg: 70, actualReps: 8, actualWeightKg: 72.5, rirActual: 2, rpeActual: 8 },
                { exerciseName: 'OHP', muscleGroup: 'Shoulders', sets: 3, targetReps: 5, targetWeightKg: 51, actualReps: 5, actualWeightKg: 52.5, rirActual: 1, rpeActual: 9 },
                { exerciseName: 'Dumbbell Curl', muscleGroup: 'Biceps', sets: 3, targetReps: 12, targetWeightKg: 14, actualReps: 12, actualWeightKg: 14, rirActual: 2, rpeActual: 8 },
            ],
            coachNotes: 'Upper body strength focus — 5/3/1 week 1 for bench and OHP',
        },
        {
            name: 'Lower Body Strength',
            modality: 'LIFTING',
            exercises: [
                { exerciseName: 'Back Squat', muscleGroup: 'Quads', sets: 3, targetReps: 5, targetWeightKg: 102, actualReps: 5, actualWeightKg: 105, rirActual: 1, rpeActual: 9 },
                { exerciseName: 'Romanian Deadlift', muscleGroup: 'Hamstrings', sets: 3, targetReps: 8, targetWeightKg: 90, actualReps: 8, actualWeightKg: 90, rirActual: 2, rpeActual: 8 },
                { exerciseName: 'Bulgarian Split Squat', muscleGroup: 'Quads', sets: 3, targetReps: 10, targetWeightKg: 20, actualReps: 10, actualWeightKg: 20, rirActual: 2, rpeActual: 8 },
            ],
            coachNotes: 'Lower body — 5/3/1 week 1 squat, accessory hypertrophy work',
        },
        {
            name: 'Zone 2 Easy Run',
            modality: 'CARDIO',
            exercises: undefined,
            coachNotes: '30min easy run, Zone 2 HR. Building aerobic base.',
        },
        {
            name: 'Metcon — AMRAP 20',
            modality: 'METCON',
            exercises: undefined,
            coachNotes: 'AMRAP 20: 5 pull-ups, 10 push-ups, 15 air squats. Moderate intensity.',
        },
    ],
    coachAdjustments: {
        volumeAdjustments: { 'Chest': 2, 'Back': 1 },
        exerciseSwaps: null,
        rirAdjustment: null,
        rationale: 'Athlete handled Week 1 volume well. Chest and Back responding — increase by 1-2 sets.',
    },
    externalLoads: [
        { activityType: 'hiking', durationMinutes: 90, perceivedIntensity: 'moderate', loggedAt: '2026-03-02' },
    ],
    previousWeekLoadSummary: {
        totalSpinalLoad: 4.2,
        totalCnsLoad: 14,
        totalLowerBodySets: 18,
        totalUpperBodySets: 24,
        avgDailyLoad: 5.6,
        peakDayLoad: 8,
        sessionCount: 4,
    },
    methodologyContext,
    mesocyclePlan,
}

// Generate prompts
const systemPrompt = buildProgrammingSystemPrompt()
const userPrompt = buildProgrammingUserPrompt(programmingContext)

console.log('─── SYSTEM PROMPT ───')
console.log(systemPrompt)
console.log(`\n[Length: ${systemPrompt.length} chars]\n`)
console.log('─── USER PROMPT ───')
console.log(userPrompt)
console.log(`\n[Length: ${userPrompt.length} chars]\n`)

console.log('─── CONTEXT FLAGS ───')
console.log(JSON.stringify({
    weekNumber: 2,
    totalWeeks: 6,
    isDeload: false,
    mesocycleGoal: 'HYBRID_PEAKING',
    hasCoachAdjustments: true,
    hasExternalLoads: true,
    hasLoadSummary: true,
    hasMethodologyContext: true,
    hasMesocyclePlan: true,
    previousSessionCount: 4,
    benchmarkCount: 5,
    injuryCount: 1,
}, null, 2))

// ─── Part 3: Optional AI Call ──────────────────────────────────────────────

if (CALL_AI) {
    ;(async () => {
        console.log('\n═══════════════════════════════════════════════════════════')
        console.log('PART 3: CALLING ANTHROPIC API')
        console.log('═══════════════════════════════════════════════════════════\n')

        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            console.error('ANTHROPIC_API_KEY not set. Add it to .env.local')
            process.exit(1)
        }

        console.log('Calling Claude with full programming prompt...')
        console.log('(This may take 15-30 seconds)\n')

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 8192,
                temperature: 0.7,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            }),
        })

        if (!response.ok) {
            console.error('API Error:', response.status, await response.text())
            process.exit(1)
        }

        const result = await response.json() as { content: Array<{ text: string }> }
        const aiText = result.content[0].text

        console.log('─── RAW AI RESPONSE ───')
        console.log(aiText)

        // Strip markdown fencing if present
        const jsonText = aiText.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()

        // Try to parse as JSON
        try {
            const parsed = JSON.parse(jsonText)
            console.log('\n─── PARSED RESPONSE ───')
            console.log(`Sessions: ${parsed.sessions?.length}`)
            console.log(`Session types: ${parsed.sessions?.map((s: any) => `${s.name} (${s.modality})`).join(', ')}`)
            console.log(`Volume: ${JSON.stringify(parsed.volumeDistribution)}`)
            console.log(`Rationale: ${parsed.weekRationale}`)
            console.log(`Fatigue: ${parsed.fatigueNotes}`)
            console.log(`Benchmark notes: ${parsed.benchmarkDiscoveryNotes}`)

            // Check for 5/3/1 compliance
            const liftingSessions = parsed.sessions?.filter((s: any) => s.modality === 'LIFTING') ?? []
            for (const ls of liftingSessions) {
                console.log(`\n  ${ls.name}:`)
                for (const ex of ls.exercises ?? []) {
                    console.log(`    ${ex.exerciseName} (${ex.muscleGroup}): ${ex.sets}x${ex.targetReps} @ ${ex.targetWeightKg}kg, RIR ${ex.targetRir}`)
                }
            }

            // Check for MOBILITY session
            const mobilitySessions = parsed.sessions?.filter((s: any) => s.modality === 'MOBILITY') ?? []
            if (mobilitySessions.length > 0) {
                console.log('\n✓ MOBILITY session present!')
                for (const ms of mobilitySessions) {
                    console.log(`  ${ms.name}: ${ms.focusAreas?.join(', ')} (${ms.estimatedDurationMinutes}min)`)
                }
            } else {
                console.log('\n✗ No MOBILITY session — check archetype ranges')
            }
        } catch {
            console.log('\n(Could not parse as JSON — check for markdown fencing or preamble)')
        }
    })()
} else {
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('To test with a live AI call, run:')
    console.log('  npx tsx scripts/test-engine.ts --call-ai')
    console.log('═══════════════════════════════════════════════════════════')
}
