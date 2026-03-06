/**
 * Methodology Helpers — Deterministic Training Calculations
 *
 * Pure functions that compute methodology-specific targets.
 * These feed into the AI prompt pipeline to give Claude concrete numbers
 * rather than philosophy strings. The AI has creative freedom in exercise
 * selection and session structure, but main lifts, volumes, and paces
 * must match these calculated targets.
 *
 * No DB calls, no side effects — fully unit-testable.
 */

// ─── 5/3/1 Wendler ─────────────────────────────────────────────────────────

export interface FiveThreeOneSet {
    reps: number
    percentTM: number
    weightKg: number
    isAmrap: boolean
}

export interface FiveThreeOneWave {
    weekLabel: string  // "5+" | "3+" | "5/3/1" | "Deload"
    sets: FiveThreeOneSet[]
}

/**
 * Calculate 5/3/1 main lift prescription for a given week in the cycle.
 * Week 1: 3x5+ (65/75/85%)
 * Week 2: 3x3+ (70/80/90%)
 * Week 3: 5/3/1+ (75/85/95%)
 * Week 4: Deload (40/50/60%)
 */
export function calculate531Wave(
    trainingMaxKg: number,
    weekInCycle: number
): FiveThreeOneWave {
    const round = (kg: number) => Math.round(kg / 2.5) * 2.5

    switch (weekInCycle) {
        case 1:
            return {
                weekLabel: '5+',
                sets: [
                    { reps: 5, percentTM: 0.65, weightKg: round(trainingMaxKg * 0.65), isAmrap: false },
                    { reps: 5, percentTM: 0.75, weightKg: round(trainingMaxKg * 0.75), isAmrap: false },
                    { reps: 5, percentTM: 0.85, weightKg: round(trainingMaxKg * 0.85), isAmrap: true },
                ],
            }
        case 2:
            return {
                weekLabel: '3+',
                sets: [
                    { reps: 3, percentTM: 0.70, weightKg: round(trainingMaxKg * 0.70), isAmrap: false },
                    { reps: 3, percentTM: 0.80, weightKg: round(trainingMaxKg * 0.80), isAmrap: false },
                    { reps: 3, percentTM: 0.90, weightKg: round(trainingMaxKg * 0.90), isAmrap: true },
                ],
            }
        case 3:
            return {
                weekLabel: '5/3/1',
                sets: [
                    { reps: 5, percentTM: 0.75, weightKg: round(trainingMaxKg * 0.75), isAmrap: false },
                    { reps: 3, percentTM: 0.85, weightKg: round(trainingMaxKg * 0.85), isAmrap: false },
                    { reps: 1, percentTM: 0.95, weightKg: round(trainingMaxKg * 0.95), isAmrap: true },
                ],
            }
        case 4:
        default:
            return {
                weekLabel: 'Deload',
                sets: [
                    { reps: 5, percentTM: 0.40, weightKg: round(trainingMaxKg * 0.40), isAmrap: false },
                    { reps: 5, percentTM: 0.50, weightKg: round(trainingMaxKg * 0.50), isAmrap: false },
                    { reps: 5, percentTM: 0.60, weightKg: round(trainingMaxKg * 0.60), isAmrap: false },
                ],
            }
    }
}

/**
 * Estimate Training Max from a benchmark lift.
 * Uses Epley formula: 1RM = weight * (1 + reps/30)
 * Training Max = 1RM * 0.90
 */
export function estimateTrainingMax(
    benchmarkWeight: number,
    benchmarkReps: number
): number {
    if (benchmarkReps <= 0 || benchmarkWeight <= 0) return 0
    const estimated1RM = benchmarkReps === 1
        ? benchmarkWeight
        : benchmarkWeight * (1 + benchmarkReps / 30)
    return Math.round(estimated1RM * 0.90 * 2) / 2 // Round to nearest 0.5kg
}

/**
 * Estimate 1RM from weight and reps using Epley formula.
 */
export function estimate1RM(weight: number, reps: number): number {
    if (reps <= 0 || weight <= 0) return 0
    if (reps === 1) return weight
    return Math.round(weight * (1 + reps / 30) * 10) / 10
}

// ─── RP Volume Landmarks ────────────────────────────────────────────────────

export interface VolumeLandmarks {
    mev: number  // Minimum Effective Volume (sets/week)
    mav: number  // Maximum Adaptive Volume (sweet spot)
    mrv: number  // Maximum Recoverable Volume (upper limit)
}

/**
 * Evidence-based volume landmarks per muscle group per experience level.
 * Based on Renaissance Periodization guidelines (Israetel et al.).
 * Values represent sets per muscle group per week.
 */
const VOLUME_LANDMARK_TABLE: Record<string, Record<string, VolumeLandmarks>> = {
    quads:      { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 14, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
    quadriceps: { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 14, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
    hamstrings: { beginner: { mev: 4, mav: 8, mrv: 12 },  intermediate: { mev: 6, mav: 10, mrv: 14 }, advanced: { mev: 8, mav: 12, mrv: 18 } },
    chest:      { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 12, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
    pecs:       { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 12, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
    back:       { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 14, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
    lats:       { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 14, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
    shoulders:  { beginner: { mev: 4, mav: 8, mrv: 12 },  intermediate: { mev: 6, mav: 10, mrv: 14 }, advanced: { mev: 8, mav: 12, mrv: 18 } },
    delts:      { beginner: { mev: 4, mav: 8, mrv: 12 },  intermediate: { mev: 6, mav: 10, mrv: 14 }, advanced: { mev: 8, mav: 12, mrv: 18 } },
    deltoids:   { beginner: { mev: 4, mav: 8, mrv: 12 },  intermediate: { mev: 6, mav: 10, mrv: 14 }, advanced: { mev: 8, mav: 12, mrv: 18 } },
    biceps:     { beginner: { mev: 4, mav: 8, mrv: 10 },  intermediate: { mev: 6, mav: 10, mrv: 14 }, advanced: { mev: 8, mav: 14, mrv: 18 } },
    triceps:    { beginner: { mev: 4, mav: 6, mrv: 10 },  intermediate: { mev: 4, mav: 8, mrv: 12 },  advanced: { mev: 6, mav: 10, mrv: 16 } },
    glutes:     { beginner: { mev: 4, mav: 8, mrv: 12 },  intermediate: { mev: 6, mav: 12, mrv: 16 }, advanced: { mev: 8, mav: 14, mrv: 20 } },
    calves:     { beginner: { mev: 4, mav: 6, mrv: 10 },  intermediate: { mev: 6, mav: 8, mrv: 12 },  advanced: { mev: 8, mav: 12, mrv: 16 } },
    core:       { beginner: { mev: 2, mav: 4, mrv: 8 },   intermediate: { mev: 4, mav: 6, mrv: 10 },  advanced: { mev: 4, mav: 8, mrv: 12 } },
    abs:        { beginner: { mev: 2, mav: 4, mrv: 8 },   intermediate: { mev: 4, mav: 6, mrv: 10 },  advanced: { mev: 4, mav: 8, mrv: 12 } },
    traps:      { beginner: { mev: 2, mav: 6, mrv: 10 },  intermediate: { mev: 4, mav: 8, mrv: 12 },  advanced: { mev: 6, mav: 10, mrv: 16 } },
    forearms:   { beginner: { mev: 2, mav: 4, mrv: 8 },   intermediate: { mev: 4, mav: 6, mrv: 10 },  advanced: { mev: 4, mav: 8, mrv: 12 } },
    rear_delts: { beginner: { mev: 4, mav: 6, mrv: 10 },  intermediate: { mev: 6, mav: 8, mrv: 12 },  advanced: { mev: 6, mav: 10, mrv: 14 } },
}

// Default landmarks for unknown muscle groups
const DEFAULT_LANDMARKS: Record<string, VolumeLandmarks> = {
    beginner:     { mev: 4, mav: 8, mrv: 12 },
    intermediate: { mev: 6, mav: 10, mrv: 14 },
    advanced:     { mev: 8, mav: 12, mrv: 18 },
}

/**
 * Get RP volume landmarks for a muscle group at a given experience level.
 * Returns MEV, MAV, and MRV in sets per week.
 */
export function calculateRPVolumeLandmarks(
    muscleGroup: string,
    experienceLevel: 'beginner' | 'intermediate' | 'advanced'
): VolumeLandmarks {
    const normalized = muscleGroup.toLowerCase().replace(/[\s-]/g, '_')
    const entry = VOLUME_LANDMARK_TABLE[normalized]
    if (entry && entry[experienceLevel]) {
        return entry[experienceLevel]
    }
    return DEFAULT_LANDMARKS[experienceLevel] ?? DEFAULT_LANDMARKS.intermediate
}

/**
 * Calculate target weekly volume for a muscle group at a specific week in the mesocycle.
 * Linearly ramps from near MEV (week 1) toward MAV-MRV boundary (final non-deload week).
 * Deload weeks drop to 60% of MEV.
 */
export function calculateWeeklyVolumeTarget(
    landmarks: VolumeLandmarks,
    weekNumber: number,
    totalWeeks: number,
    isDeload: boolean
): number {
    if (isDeload) {
        return Math.round(landmarks.mev * 0.6)
    }

    // Non-deload weeks: ramp from ~MEV to ~MAV over the mesocycle
    // Week 1 starts slightly above MEV, final training week reaches MAV
    const trainingWeeks = totalWeeks - 1 // Exclude deload week
    const progress = Math.min((weekNumber - 1) / Math.max(trainingWeeks - 1, 1), 1)

    // Interpolate from MEV+1 to MAV
    const startVolume = landmarks.mev + 1
    const endVolume = landmarks.mav
    const target = startVolume + (endVolume - startVolume) * progress

    return Math.round(target)
}

// ─── Polarized Endurance ────────────────────────────────────────────────────

export interface PolarizedSplit {
    easyMinutes: number
    hardMinutes: number
    easyPercent: number
    hardPercent: number
}

/**
 * Calculate an 80/20 polarized endurance distribution.
 * 80% of weekly endurance minutes at easy/Zone 2 pace.
 * 20% at tempo/threshold/VO2max intensity.
 */
export function calculatePolarizedZoneDistribution(
    weeklyEnduranceMinutes: number
): PolarizedSplit {
    const easyMinutes = Math.round(weeklyEnduranceMinutes * 0.80)
    const hardMinutes = weeklyEnduranceMinutes - easyMinutes
    return {
        easyMinutes,
        hardMinutes,
        easyPercent: 80,
        hardPercent: 20,
    }
}

// ─── Daniels' VDOT ─────────────────────────────────────────────────────────

export interface TrainingPaces {
    vdot: number
    easyPaceSecPerKm: number
    tempoPaceSecPerKm: number
    thresholdPaceSecPerKm: number
    intervalPaceSecPerKm: number
}

/**
 * Simplified Daniels' VDOT calculation and training pace derivation.
 *
 * Based on the Daniels Running Formula methodology:
 * 1. Estimate VO2 from race performance
 * 2. Derive VDOT
 * 3. Calculate training paces (Easy, Tempo/Marathon, Threshold, Interval)
 *
 * This is a simplified implementation using curve-fitting approximations
 * of the Daniels tables. Accurate within ~2-3% for 1500m to marathon distances.
 */
export function calculateDanielsVDOT(
    raceDistanceKm: number,
    raceTimeSeconds: number
): TrainingPaces {
    if (raceDistanceKm <= 0 || raceTimeSeconds <= 0) {
        return { vdot: 30, easyPaceSecPerKm: 420, tempoPaceSecPerKm: 360, thresholdPaceSecPerKm: 330, intervalPaceSecPerKm: 300 }
    }

    const raceDistanceMeters = raceDistanceKm * 1000
    const raceTimeMinutes = raceTimeSeconds / 60

    // Estimate VO2 cost of running at race pace (ml/kg/min)
    // Daniels approximation: VO2 = -4.60 + 0.182258 * v + 0.000104 * v^2
    // where v = meters/min
    const velocity = raceDistanceMeters / raceTimeMinutes
    const vo2Race = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity

    // Estimate %VO2max sustained during the race based on duration
    // Daniels approximation: %VO2max = 0.8 + 0.1894393 * e^(-0.012778 * t) + 0.2989558 * e^(-0.1932605 * t)
    // where t = time in minutes
    const fractionVO2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * raceTimeMinutes)
        + 0.2989558 * Math.exp(-0.1932605 * raceTimeMinutes)

    // VDOT = VO2max estimate
    const vdot = Math.round(vo2Race / fractionVO2max * 10) / 10

    // Derive training paces from VDOT
    // These are approximate pace zones based on %VO2max targets:
    // Easy: 59-74% VO2max -> use 65%
    // Tempo/Marathon: 75-84% -> use 80%
    // Threshold: 83-88% -> use 86%
    // Interval: 95-100% -> use 98%

    const paceFromVO2 = (targetVO2: number): number => {
        // Inverse of VO2 = -4.60 + 0.182258*v + 0.000104*v^2
        // Solve for v using quadratic formula
        const a = 0.000104
        const b = 0.182258
        const c = -4.60 - targetVO2
        const discriminant = b * b - 4 * a * c
        if (discriminant < 0) return 360 // fallback ~6:00/km
        const v = (-b + Math.sqrt(discriminant)) / (2 * a) // meters per minute
        if (v <= 0) return 360
        return Math.round(1000 / v * 60) // seconds per km
    }

    const easyVO2 = vdot * 0.65
    const tempoVO2 = vdot * 0.80
    const thresholdVO2 = vdot * 0.86
    const intervalVO2 = vdot * 0.98

    return {
        vdot: Math.round(vdot * 10) / 10,
        easyPaceSecPerKm: paceFromVO2(easyVO2),
        tempoPaceSecPerKm: paceFromVO2(tempoVO2),
        thresholdPaceSecPerKm: paceFromVO2(thresholdVO2),
        intervalPaceSecPerKm: paceFromVO2(intervalVO2),
    }
}

// ─── Utility: Format Pace ───────────────────────────────────────────────────

/**
 * Convert seconds per km to "M:SS" format.
 */
export function formatPace(secPerKm: number): string {
    const minutes = Math.floor(secPerKm / 60)
    const seconds = Math.round(secPerKm % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
