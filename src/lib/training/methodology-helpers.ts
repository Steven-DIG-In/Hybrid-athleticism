// src/lib/training/methodology-helpers.ts
// DEPRECATED: Use skills directly from src/lib/skills/
// This file re-exports for backward compatibility with UI components.

// ─── Types ───────────────────────────────────────────────────────────────────
// These interfaces match the shapes returned by the underlying skills.
// Callers that previously imported these types should migrate to the skill
// output types directly, but they are preserved here for compatibility.

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

export interface VolumeLandmarks {
    mev: number  // Minimum Effective Volume (sets/week)
    mav: number  // Maximum Adaptive Volume (sweet spot)
    mrv: number  // Maximum Recoverable Volume (upper limit)
}

export interface PolarizedSplit {
    easyMinutes: number
    hardMinutes: number
    easyPercent: number
    hardPercent: number
}

export interface TrainingPaces {
    vdot: number
    easyPaceSecPerKm: number
    tempoPaceSecPerKm: number
    thresholdPaceSecPerKm: number
    intervalPaceSecPerKm: number
}

// ─── 5/3/1 Wendler ───────────────────────────────────────────────────────────

import { fiveThreeOneSkill } from '@/lib/skills/domains/strength/531-progression'

export const calculate531Wave = (
    trainingMaxKg: number,
    weekInCycle: number,
): FiveThreeOneWave =>
    fiveThreeOneSkill.execute({
        trainingMaxKg,
        weekInCycle: weekInCycle as 1 | 2 | 3 | 4,
    })

// ─── Training Max Estimation ─────────────────────────────────────────────────

import { trainingMaxSkill } from '@/lib/skills/domains/strength/training-max-estimation'

export const estimateTrainingMax = (
    benchmarkWeight: number,
    benchmarkReps: number,
): number => {
    if (benchmarkReps <= 0 || benchmarkWeight <= 0) return 0
    return trainingMaxSkill.execute({ weightKg: benchmarkWeight, reps: benchmarkReps }).trainingMax
}

export const estimate1RM = (weight: number, reps: number): number => {
    if (reps <= 0 || weight <= 0) return 0
    if (reps === 1) return weight
    const raw = trainingMaxSkill.execute({ weightKg: weight, reps }).estimated1RM
    return Math.round(raw * 10) / 10
}

// ─── RP Volume Landmarks ─────────────────────────────────────────────────────

import { volumeLandmarksSkill } from '@/lib/skills/domains/hypertrophy/volume-landmarks'

export const calculateRPVolumeLandmarks = (
    muscleGroup: string,
    experienceLevel: 'beginner' | 'intermediate' | 'advanced',
): VolumeLandmarks => {
    const r = volumeLandmarksSkill.execute({ muscleGroup, experienceLevel })
    return { mev: r.mev, mav: r.mav, mrv: r.mrv }
}

// NOTE: The original function accepted pre-computed landmarks. The skill looks them up
// internally. This shim preserves the original behavior by computing directly from the
// passed landmarks, not delegating to the skill. Callers should migrate to the skill directly.
export function calculateWeeklyVolumeTarget(
    landmarks: VolumeLandmarks,
    weekNumber: number,
    totalWeeks: number,
    isDeload: boolean,
): number {
    if (isDeload) return Math.round(landmarks.mev * 0.6)
    const trainingWeeks = totalWeeks - 1
    const progress = Math.min((weekNumber - 1) / Math.max(trainingWeeks - 1, 1), 1)
    const startVolume = landmarks.mev + 1
    const endVolume = landmarks.mav
    return Math.round(startVolume + (endVolume - startVolume) * progress)
}

// ─── Polarized Endurance ─────────────────────────────────────────────────────

import { zoneDistributorSkill } from '@/lib/skills/domains/endurance/zone-distributor'

export const calculatePolarizedZoneDistribution = (
    weeklyEnduranceMinutes: number,
): PolarizedSplit =>
    zoneDistributorSkill.execute({ weeklyEnduranceMinutes })

// ─── Daniels' VDOT ───────────────────────────────────────────────────────────

import { vdotPacerSkill } from '@/lib/skills/domains/endurance/vdot-pacer'

export const calculateDanielsVDOT = (
    raceDistanceKm: number,
    raceTimeSeconds: number,
): TrainingPaces => {
    if (raceDistanceKm <= 0 || raceTimeSeconds <= 0) {
        return {
            vdot: 30,
            easyPaceSecPerKm: 420,
            tempoPaceSecPerKm: 360,
            thresholdPaceSecPerKm: 330,
            intervalPaceSecPerKm: 300,
        }
    }
    return vdotPacerSkill.execute({ raceDistanceKm, raceTimeSeconds })
}

// ─── Utility: Format Pace ────────────────────────────────────────────────────

export const formatPace = (secPerKm: number): string => {
    const minutes = Math.floor(secPerKm / 60)
    const seconds = Math.round(secPerKm % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
