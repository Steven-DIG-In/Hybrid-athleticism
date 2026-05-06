/**
 * Methodology context builder — relocated from
 * src/lib/actions/programming.actions.ts.
 *
 * Pure helper that composes a `MethodologyContext` from profile preferences
 * + benchmarks. Calls `resolveTrainingMaxForExercise` (which itself reads
 * stored TMs through the authenticated supabase client). No direct DB
 * access from this file; the helper takes pre-resolved profile + benchmarks
 * as arguments.
 *
 * NOTE: this file does NOT carry a 'use server' directive — it is a pure
 * helper imported by server actions, not itself an action.
 */

import type { AthleteBenchmark } from '@/lib/types/database.types'
import type { MethodologyContext } from '@/lib/ai/prompts/programming'
import {
    calculate531Wave,
    resolveTrainingMaxForExercise,
    calculateRPVolumeLandmarks,
    calculateWeeklyVolumeTarget,
    calculatePolarizedZoneDistribution,
    calculateDanielsVDOT,
    formatPace,
} from '@/lib/training/methodology-helpers'

/**
 * Build a methodology context object from profile preferences + benchmarks.
 *
 * Translates user-selected methodologies (5/3/1, RP volume, polarized,
 * Daniels' formula) into concrete prescriptions Claude can copy verbatim.
 * These give Claude exact numbers to follow rather than philosophy strings.
 *
 * Async: the 5/3/1 branch now prefers the stored TM in `profiles.training_maxes`
 * (populated by the recalibration flow) over the raw benchmark-derived estimate.
 */
export async function buildMethodologyContext(
    profile: { strength_methodology?: string | null; hypertrophy_methodology?: string | null; endurance_methodology?: string | null; lifting_experience?: string | null; available_days?: number | null; session_duration_minutes?: number | null },
    benchmarks: AthleteBenchmark[],
    weekNumber: number,
    totalWeeks: number,
    isDeload: boolean
): Promise<MethodologyContext | undefined> {
    const ctx: MethodologyContext = {}
    const strengthMethod = profile.strength_methodology ?? 'ai_decides'
    const hypertrophyMethod = profile.hypertrophy_methodology ?? 'ai_decides'
    const enduranceMethod = profile.endurance_methodology ?? 'ai_decides'
    const experience = (profile.lifting_experience ?? 'intermediate') as 'beginner' | 'intermediate' | 'advanced'

    // ─── 5/3/1 Protocol ──────────────────────────────────────────────────
    if (strengthMethod === '531') {
        const weekInCycle = ((weekNumber - 1) % 4) + 1
        const liftMap: Array<[string, string[]]> = [
            ['Squat', ['squat', 'back_squat']],
            ['Bench Press', ['bench', 'bench_press']],
            ['Deadlift', ['deadlift']],
            ['OHP', ['ohp', 'overhead_press', 'overhead']],
        ]
        const lines: string[] = []
        for (const [displayName, keywords] of liftMap) {
            const bm = benchmarks.find(b =>
                keywords.some(kw => b.benchmark_name.toLowerCase().includes(kw))
            )
            if (bm) {
                const tm = await resolveTrainingMaxForExercise(displayName, bm.value, 1)
                const wave = calculate531Wave(tm, weekInCycle)
                const setsStr = wave.sets.map(s =>
                    `${s.reps}${s.isAmrap ? '+' : ''} @ ${s.weightKg}kg (${Math.round(s.percentTM * 100)}%TM)`
                ).join(', ')
                lines.push(`  ${displayName} (TM: ${tm}kg): ${wave.weekLabel} — ${setsStr}`)
            }
        }
        if (lines.length > 0) {
            ctx.liftingProtocol = `5/3/1 Cycle Week ${weekInCycle}${isDeload && weekInCycle === 4 ? ' (DELOAD)' : ''}:\n${lines.join('\n')}`
        }
    }

    // ─── RP Volume Landmarks ─────────────────────────────────────────────
    if (hypertrophyMethod === 'rp_volume' || hypertrophyMethod === 'ai_decides') {
        const majorGroups = ['Quads', 'Hamstrings', 'Chest', 'Back', 'Shoulders', 'Glutes', 'Biceps', 'Triceps']
        const volumeLines = majorGroups.map(mg => {
            const landmarks = calculateRPVolumeLandmarks(mg, experience)
            const weekTarget = calculateWeeklyVolumeTarget(landmarks, weekNumber, totalWeeks, isDeload)
            return `  ${mg}: ${weekTarget} sets (MEV=${landmarks.mev}, MAV=${landmarks.mav}, MRV=${landmarks.mrv})`
        })
        ctx.volumeTargets = volumeLines.join('\n')
    }

    // ─── Polarized Endurance ─────────────────────────────────────────────
    if (enduranceMethod === 'polarized_80_20' || (enduranceMethod === 'ai_decides' && experience !== 'beginner')) {
        const enduranceSessions = Math.ceil((profile.available_days ?? 4) * 0.3)
        const weeklyEnduranceMinutes = (profile.session_duration_minutes ?? 60) * enduranceSessions
        const split = calculatePolarizedZoneDistribution(weeklyEnduranceMinutes)
        ctx.endurancePlan = `Polarized 80/20: ~${split.easyMinutes} min easy (Zone 2), ~${split.hardMinutes} min hard (Tempo/Threshold/VO2max) across ${enduranceSessions} sessions`
    }

    // ─── Daniels' Paces ──────────────────────────────────────────────────
    if (enduranceMethod === 'daniels_formula') {
        const runBenchmark = benchmarks.find(b =>
            ['5k', '10k', 'mile', '1_mile'].some(kw => b.benchmark_name.toLowerCase().includes(kw))
        )
        if (runBenchmark) {
            const distanceKm = runBenchmark.benchmark_name.toLowerCase().includes('10k') ? 10
                : runBenchmark.benchmark_name.toLowerCase().includes('mile') ? 1.609
                : 5 // default to 5k
            // Benchmark value is assumed to be in the unit stored (check unit field)
            const timeSeconds = runBenchmark.unit === 'seconds' ? runBenchmark.value
                : runBenchmark.unit === 'minutes' ? runBenchmark.value * 60
                : runBenchmark.value * 60 // default assume minutes
            const paces = calculateDanielsVDOT(distanceKm, timeSeconds)
            ctx.trainingPaces = `VDOT: ${paces.vdot}. Easy: ${formatPace(paces.easyPaceSecPerKm)}/km, Tempo: ${formatPace(paces.tempoPaceSecPerKm)}/km, Threshold: ${formatPace(paces.thresholdPaceSecPerKm)}/km, Intervals: ${formatPace(paces.intervalPaceSecPerKm)}/km`
        }
    }

    // Only return if we computed something
    if (ctx.liftingProtocol || ctx.volumeTargets || ctx.endurancePlan || ctx.trainingPaces) {
        return ctx
    }
    return undefined
}
