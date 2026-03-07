/**
 * Standalone test script for the Multi-Agent Coaching Architecture.
 * Tests prompt generation for all coaches and optionally calls the AI.
 *
 * Usage:
 *   npx tsx scripts/test-coaching.ts                     # Prompt inspection only
 *   npx tsx scripts/test-coaching.ts --call-ai            # Head Coach strategy only
 *   npx tsx scripts/test-coaching.ts --call-ai --full     # Full pipeline (all coaches)
 */

import {
    calculate531Wave,
    estimateTrainingMax,
    calculateRPVolumeLandmarks,
    calculateWeeklyVolumeTarget,
    calculatePolarizedZoneDistribution,
    calculateDanielsVDOT,
    formatPace,
} from '../src/lib/training/methodology-helpers'

import {
    buildMesocycleStrategySystemPrompt,
    buildMesocycleStrategyUserPrompt,
} from '../src/lib/ai/prompts/head-coach'

import {
    buildStrengthProgramSystemPrompt,
    buildStrengthProgramUserPrompt,
} from '../src/lib/ai/prompts/strength-coach'

import {
    buildEnduranceProgramSystemPrompt,
    buildEnduranceProgramUserPrompt,
} from '../src/lib/ai/prompts/endurance-coach'

import {
    buildHypertrophyProgramSystemPrompt,
    buildHypertrophyProgramUserPrompt,
} from '../src/lib/ai/prompts/hypertrophy-coach'

import {
    buildConditioningProgramSystemPrompt,
    buildConditioningProgramUserPrompt,
} from '../src/lib/ai/prompts/conditioning-coach'

import {
    buildMobilityProgramSystemPrompt,
    buildMobilityProgramUserPrompt,
} from '../src/lib/ai/prompts/mobility-coach'

import {
    buildRecoveryAssessmentSystemPrompt,
    buildRecoveryAssessmentUserPrompt,
} from '../src/lib/ai/prompts/recovery-coach'

import {
    MesocycleStrategySchema,
    StrengthProgramSchema,
    EnduranceProgramSchema,
    HypertrophyProgramSchema,
    ConditioningProgramSchema,
    MobilityProgramSchema,
} from '../src/lib/ai/schemas/week-brief'

import { extractWeekBrief } from '../src/lib/ai/orchestrator'

import type { AthleteContextPacket } from '../src/lib/types/coach-context'
import type { Profile, AthleteInjury, AthleteBenchmark, RecentTrainingActivity } from '../src/lib/types/database.types'

const CALL_AI = process.argv.includes('--call-ai')
const FULL_PIPELINE = process.argv.includes('--full')

// ─── Mock Athlete: "Hybrid Hank" ────────────────────────────────────────────
// Intermediate hybrid athlete: 5 training days, full gym, 5/3/1 strength,
// runs 2x/week, does metcons, desk worker with a shoulder niggle.

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
    equipment_list: ['barbell', 'dumbbells', 'pull_up_bar', 'cable_machine', 'assault_bike', 'rower', 'kettlebells'],
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
    coaching_team: [
        { coach: 'strength', priority: 1 },
        { coach: 'endurance', priority: 2 },
        { coach: 'conditioning', priority: 3 },
    ],
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
    { id: 'bm-1', user_id: 'test-user-001', modality: 'strength', benchmark_name: 'back_squat_1rm', value: 120, unit: 'kg', source: 'tested', tested_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 'bm-2', user_id: 'test-user-001', modality: 'strength', benchmark_name: 'bench_press_1rm', value: 90, unit: 'kg', source: 'tested', tested_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 'bm-3', user_id: 'test-user-001', modality: 'strength', benchmark_name: 'deadlift_1rm', value: 150, unit: 'kg', source: 'tested', tested_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 'bm-4', user_id: 'test-user-001', modality: 'strength', benchmark_name: 'overhead_press_1rm', value: 60, unit: 'kg', source: 'tested', tested_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 'bm-5', user_id: 'test-user-001', modality: 'endurance', benchmark_name: '5k', value: 1500, unit: 'seconds', source: 'tested', tested_at: new Date().toISOString(), created_at: new Date().toISOString() },
]

const mockRecentTraining: RecentTrainingActivity[] = [
    { id: 'rt-1', user_id: 'test-user-001', modality: 'lifting', frequency_per_week: 3, approximate_volume: '15-20 sets per session', captured_at: new Date().toISOString() },
    { id: 'rt-2', user_id: 'test-user-001', modality: 'running', frequency_per_week: 2, approximate_volume: '3-5km per run', captured_at: new Date().toISOString() },
    { id: 'rt-3', user_id: 'test-user-001', modality: 'conditioning', frequency_per_week: 1, approximate_volume: '20-30min metcons', captured_at: new Date().toISOString() },
]

const mockCtx: AthleteContextPacket = {
    profile: mockProfile,
    coachingTeam: [
        { coach: 'strength', priority: 1 },
        { coach: 'endurance', priority: 2 },
        { coach: 'conditioning', priority: 3 },
    ],
    injuries: mockInjuries,
    benchmarks: mockBenchmarks,
    recentTraining: mockRecentTraining,
    mesocycleId: 'meso-test-001',
    mesocycleGoal: 'HYBRID_PEAKING',
    weekNumber: 1,
    totalWeeks: 6,
    isDeload: false,
    targetRir: 2,
}

// ─── Build Methodology Contexts ─────────────────────────────────────────────

// Strength methodology (5/3/1)
const weekInCycle = 1
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

const methodologyContext = {
    liftingProtocol: `5/3/1 Cycle Week ${weekInCycle}:\n${lines531.join('\n')}`,
    volumeTargets: ['Quads', 'Hamstrings', 'Chest', 'Back', 'Shoulders', 'Glutes', 'Biceps', 'Triceps']
        .map(mg => {
            const l = calculateRPVolumeLandmarks(mg, 'intermediate')
            const t = calculateWeeklyVolumeTarget(l, 1, 6, false)
            return `  ${mg}: ${t} sets (MEV=${l.mev}, MAV=${l.mav}, MRV=${l.mrv})`
        }).join('\n'),
}

// Endurance methodology
const paces = calculateDanielsVDOT(5, 1500) // 5K in 25:00
const polarized = calculatePolarizedZoneDistribution(120)
const enduranceMethodologyContext = {
    trainingPaces: `VDOT: ${paces.vdot}. Easy: ${formatPace(paces.easyPaceSecPerKm)}/km, Tempo: ${formatPace(paces.tempoPaceSecPerKm)}/km, Threshold: ${formatPace(paces.thresholdPaceSecPerKm)}/km, Intervals: ${formatPace(paces.intervalPaceSecPerKm)}/km`,
    polarizedSplit: `Polarized 80/20: ~${polarized.easyMinutes} min easy (Zone 2), ~${polarized.hardMinutes} min hard across 2 sessions`,
}

// Volume targets for Hypertrophy Coach
const volumeTargets = ['Quads', 'Hamstrings', 'Chest', 'Back', 'Shoulders', 'Glutes', 'Biceps', 'Triceps', 'Calves', 'Core']
    .map(mg => {
        const l = calculateRPVolumeLandmarks(mg, 'intermediate')
        const t = calculateWeeklyVolumeTarget(l, 1, 6, false)
        return `  ${mg}: ${t} sets/week (MEV=${l.mev}, MAV=${l.mav}, MRV=${l.mrv})`
    }).join('\n')

// ─── Helpers ────────────────────────────────────────────────────────────────

function printPromptSummary(name: string, system: string, user: string) {
    console.log(`\n┌─── ${name} ───`)
    console.log(`│ System prompt: ${system.length} chars`)
    console.log(`│ User prompt:   ${user.length} chars`)
    console.log(`│ Total:         ${system.length + user.length} chars`)
    console.log(`└──────────────────────────────────────`)
}

async function callAI(
    name: string,
    systemPrompt: string,
    userPrompt: string,
    schema: any,
    maxTokens = 16384
): Promise<any> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        console.error('ANTHROPIC_API_KEY not set. Add it to .env.local')
        process.exit(1)
    }

    console.log(`\n  [${name}] Calling Claude...`)
    const start = Date.now()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: maxTokens,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        }),
    })

    if (!response.ok) {
        const errText = await response.text()
        console.error(`  [${name}] API Error: ${response.status} ${errText}`)
        return null
    }

    const result = await response.json() as { content: Array<{ text: string }>; usage: { input_tokens: number; output_tokens: number } }
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    const aiText = result.content[0].text

    console.log(`  [${name}] Response: ${aiText.length} chars in ${elapsed}s (${result.usage.input_tokens} in / ${result.usage.output_tokens} out)`)

    // Parse
    const jsonText = aiText.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    const objectMatch = jsonText.match(/(\{[\s\S]*\})/)
    const jsonStr = objectMatch?.[1] ?? jsonText

    try {
        const parsed = JSON.parse(jsonStr)
        const validation = schema.safeParse(parsed)
        if (validation.success) {
            console.log(`  [${name}] Schema validation: PASS`)
            return validation.data
        } else {
            console.error(`  [${name}] Schema validation: FAIL`)
            for (const issue of validation.error.issues.slice(0, 5)) {
                console.error(`    - ${issue.path.join('.')}: ${issue.message}`)
            }
            return null
        }
    } catch (e) {
        console.error(`  [${name}] JSON parse failed`)
        console.error(`  First 300 chars: ${jsonStr.slice(0, 300)}`)
        return null
    }
}

// ─── Part 1: Prompt Inspection ──────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════')
console.log('MULTI-AGENT COACHING ARCHITECTURE — TEST HARNESS')
console.log('═══════════════════════════════════════════════════════════')
console.log(`\nAthlete: ${mockProfile.display_name}, ${mockProfile.age}yo, ${mockProfile.bodyweight_kg}kg`)
console.log(`Goal: ${mockProfile.goal_archetype} | Experience: ${mockProfile.lifting_experience}`)
console.log(`Equipment: ${mockProfile.equipment_list.join(', ')}`)
console.log(`Coaching Team: ${mockCtx.coachingTeam.map(c => `${c.priority}. ${c.coach}`).join(', ')}`)
console.log(`Injuries: ${mockInjuries.map(i => `${i.body_area} (${i.severity})`).join(', ')}`)

console.log('\n═══════════════════════════════════════════════════════════')
console.log('PART 1: PROMPT GENERATION (all 7 coaches)')
console.log('═══════════════════════════════════════════════════════════')

// Head Coach
const headSystem = buildMesocycleStrategySystemPrompt()
const headUser = buildMesocycleStrategyUserPrompt(mockCtx)
printPromptSummary('HEAD COACH — MesocycleStrategy', headSystem, headUser)

// Recovery Coach
const recoverySystem = buildRecoveryAssessmentSystemPrompt()
const recoveryUser = buildRecoveryAssessmentUserPrompt(mockCtx)
printPromptSummary('RECOVERY COACH — Assessment', recoverySystem, recoveryUser)

// We need a mock strategy to build domain coach prompts
// Build a mock WeekBrief for each domain coach
const mockBrief = {
    weekNumber: 1,
    isDeload: false,
    weekEmphasis: 'Strength accumulation',
    volumePercent: 65,
    sessionsToGenerate: 2,
    loadBudget: 7,
    constraints: ['No heavy spinal loading day before endurance'],
    methodologyDirective: '5/3/1 Wendler — Leader template, 3-week wave + deload',
    otherDomainsThisWeek: [
        { domain: 'endurance', sessionCount: 2, loadBudget: 5 },
        { domain: 'conditioning', sessionCount: 1, loadBudget: 6 },
        { domain: 'mobility', sessionCount: 1, loadBudget: 2 },
    ],
}

// Strength Coach
const strengthSystem = buildStrengthProgramSystemPrompt()
const strengthUser = buildStrengthProgramUserPrompt(mockCtx, mockBrief, methodologyContext, 6, false)
printPromptSummary('STRENGTH COACH — Program', strengthSystem, strengthUser)

// Endurance Coach
const enduranceBrief = { ...mockBrief, sessionsToGenerate: 2, loadBudget: 5, methodologyDirective: '80/20 Polarized, build running base', otherDomainsThisWeek: [{ domain: 'strength', sessionCount: 2, loadBudget: 7 }, { domain: 'conditioning', sessionCount: 1, loadBudget: 6 }] }
const enduranceSystem = buildEnduranceProgramSystemPrompt()
const enduranceUser = buildEnduranceProgramUserPrompt(mockCtx, enduranceBrief, enduranceMethodologyContext, 6)
printPromptSummary('ENDURANCE COACH — Program', enduranceSystem, enduranceUser)

// Hypertrophy Coach
const hypertrophyBrief = { ...mockBrief, sessionsToGenerate: 2, loadBudget: 6, methodologyDirective: 'RP Volume Landmarks — MEV to MAV progression', otherDomainsThisWeek: [{ domain: 'strength', sessionCount: 2, loadBudget: 7 }] }
const hypertrophySystem = buildHypertrophyProgramSystemPrompt()
const hypertrophyUser = buildHypertrophyProgramUserPrompt(mockCtx, hypertrophyBrief, volumeTargets, 6, true)
printPromptSummary('HYPERTROPHY COACH — Program', hypertrophySystem, hypertrophyUser)

// Conditioning Coach
const conditioningBrief = { ...mockBrief, sessionsToGenerate: 1, loadBudget: 6, methodologyDirective: 'Balanced energy system development, mix of formats', otherDomainsThisWeek: [{ domain: 'strength', sessionCount: 2, loadBudget: 7 }, { domain: 'endurance', sessionCount: 2, loadBudget: 5 }] }
const conditioningSystem = buildConditioningProgramSystemPrompt()
const conditioningUser = buildConditioningProgramUserPrompt(mockCtx, conditioningBrief, 6)
printPromptSummary('CONDITIONING COACH — Program', conditioningSystem, conditioningUser)

// Mobility Coach
const mobilityBrief = { ...mockBrief, sessionsToGenerate: 1, loadBudget: 2, methodologyDirective: 'FRC-inspired mobility + session-specific primers', otherDomainsThisWeek: [{ domain: 'strength', sessionCount: 2, loadBudget: 7 }, { domain: 'endurance', sessionCount: 2, loadBudget: 5 }] }
const mobilitySystem = buildMobilityProgramSystemPrompt()
const mobilityUser = buildMobilityProgramUserPrompt(
    mockCtx,
    mobilityBrief,
    6,
    [
        { coach: 'strength', sessionName: 'Upper Body Strength A' },
        { coach: 'strength', sessionName: 'Lower Body Strength B' },
        { coach: 'endurance', sessionName: 'Long Run' },
        { coach: 'endurance', sessionName: 'Easy Recovery Run' },
        { coach: 'conditioning', sessionName: 'MetCon AMRAP' },
    ]
)
printPromptSummary('MOBILITY COACH — Program', mobilitySystem, mobilityUser)

// Total token estimate
const totalChars = [headSystem, headUser, strengthSystem, strengthUser, enduranceSystem, enduranceUser, hypertrophySystem, hypertrophyUser, conditioningSystem, conditioningUser, mobilitySystem, mobilityUser, recoverySystem, recoveryUser]
    .reduce((sum, s) => sum + s.length, 0)
console.log(`\n  Total prompt chars across all coaches: ${totalChars.toLocaleString()} (~${Math.round(totalChars / 4).toLocaleString()} tokens estimated)`)

// ─── Part 2: AI Calls ──────────────────────────────────────────────────────

if (CALL_AI) {
    ;(async () => {
        // Load env from .env.local
        const fs = await import('fs')
        const envPath = `${process.cwd()}/.env.local`
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8')
            for (const line of envContent.split('\n')) {
                const match = line.match(/^([^#=]+)=(.*)$/)
                if (match && !process.env[match[1].trim()]) {
                    process.env[match[1].trim()] = match[2].trim()
                }
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════')
        console.log(FULL_PIPELINE
            ? 'PART 2: FULL PIPELINE — Head Coach → All Domain Coaches'
            : 'PART 2: HEAD COACH ONLY — MesocycleStrategy')
        console.log('═══════════════════════════════════════════════════════════\n')

        const pipelineStart = Date.now()

        // Step 1: Head Coach → MesocycleStrategy
        const strategy = await callAI('Head Coach', headSystem, headUser, MesocycleStrategySchema, 4096)
        if (!strategy) {
            console.error('\nHead Coach failed — cannot continue.')
            process.exit(1)
        }

        console.log(`\n  Strategy: "${strategy.blockName}"`)
        console.log(`  Weeks: ${strategy.totalWeeks}, Deload: week ${strategy.deloadWeek}`)
        console.log(`  Domains: ${strategy.domainAllocations.map((d: any) => `${d.coach} (${d.sessionsPerWeek}/wk)`).join(', ')}`)
        console.log(`  Key progressions: ${strategy.keyProgressions.join('; ')}`)

        if (!FULL_PIPELINE) {
            console.log('\n  (Use --full to run all domain coaches)')
            process.exit(0)
        }

        // Step 2: Domain coaches in parallel
        console.log('\n  Running domain coaches in parallel...')

        const domainResults: Record<string, any> = {}
        const domainPromises: Array<Promise<void>> = []

        // Strength
        const sBrief = extractWeekBrief(strategy, 'strength', 1)
        if (sBrief) {
            const sUser = buildStrengthProgramUserPrompt(mockCtx, sBrief, methodologyContext, strategy.totalWeeks, false)
            domainPromises.push(
                callAI('Strength', strengthSystem, sUser, StrengthProgramSchema).then(r => { domainResults.strength = r })
            )
        }

        // Endurance
        const eBrief = extractWeekBrief(strategy, 'endurance', 1)
        if (eBrief) {
            const eUser = buildEnduranceProgramUserPrompt(mockCtx, eBrief, enduranceMethodologyContext, strategy.totalWeeks)
            domainPromises.push(
                callAI('Endurance', enduranceSystem, eUser, EnduranceProgramSchema).then(r => { domainResults.endurance = r })
            )
        }

        // Hypertrophy (if in strategy)
        const hBrief = extractWeekBrief(strategy, 'hypertrophy', 1)
        if (hBrief) {
            const hUser = buildHypertrophyProgramUserPrompt(mockCtx, hBrief, volumeTargets, strategy.totalWeeks, !!sBrief)
            domainPromises.push(
                callAI('Hypertrophy', hypertrophySystem, hUser, HypertrophyProgramSchema).then(r => { domainResults.hypertrophy = r })
            )
        }

        // Conditioning
        const cBrief = extractWeekBrief(strategy, 'conditioning', 1)
        if (cBrief) {
            const cUser = buildConditioningProgramUserPrompt(mockCtx, cBrief, strategy.totalWeeks)
            domainPromises.push(
                callAI('Conditioning', conditioningSystem, cUser, ConditioningProgramSchema).then(r => { domainResults.conditioning = r })
            )
        }

        // Mobility
        const mBrief = extractWeekBrief(strategy, 'mobility', 1)
        if (mBrief) {
            const allSessions: Array<{ coach: string; sessionName: string }> = []
            for (const alloc of strategy.domainAllocations) {
                if (alloc.coach !== 'mobility') {
                    for (let i = 0; i < alloc.sessionsPerWeek; i++) {
                        allSessions.push({ coach: alloc.coach, sessionName: `${alloc.coach} session ${i + 1}` })
                    }
                }
            }
            const mUser = buildMobilityProgramUserPrompt(mockCtx, mBrief, strategy.totalWeeks, allSessions)
            domainPromises.push(
                callAI('Mobility', mobilitySystem, mUser, MobilityProgramSchema).then(r => { domainResults.mobility = r })
            )
        }

        await Promise.all(domainPromises)

        // Summary
        const pipelineElapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1)

        console.log('\n═══════════════════════════════════════════════════════════')
        console.log('PIPELINE RESULTS')
        console.log('═══════════════════════════════════════════════════════════')
        console.log(`  Total time: ${pipelineElapsed}s`)
        console.log(`  Strategy: ${strategy.blockName} (${strategy.totalWeeks} weeks)`)

        for (const [coach, result] of Object.entries(domainResults)) {
            if (result) {
                const weekCount = result.weeks?.length ?? 0
                const sessionCount = result.weeks?.[0]?.sessions?.length ?? result.weeks?.[0]?.standaloneSessions?.length ?? 0
                console.log(`  ${coach}: ${weekCount} weeks, ${sessionCount} sessions/week — ${result.methodologyUsed ?? result.splitDesign ?? ''}`)
            } else {
                console.log(`  ${coach}: FAILED`)
            }
        }

        const successCount = Object.values(domainResults).filter(Boolean).length
        const totalCount = Object.keys(domainResults).length
        console.log(`\n  ${successCount}/${totalCount} coaches succeeded`)

        if (successCount === totalCount) {
            console.log('  PIPELINE: PASS')
        } else {
            console.log('  PIPELINE: PARTIAL (some coaches failed)')
        }
    })()
} else {
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('To test with live AI calls:')
    console.log('  npx tsx scripts/test-coaching.ts --call-ai          # Head Coach only')
    console.log('  npx tsx scripts/test-coaching.ts --call-ai --full   # Full pipeline')
    console.log('═══════════════════════════════════════════════════════════')
}
