/**
 * Training Max (TM) Calculator
 *
 * Based on Wendler 5/3/1 principles:
 * - TM is a submaximal load used for programming (typically 85-90% of 1RM)
 * - Provides a buffer for consistent progress and injury prevention
 * - Used to calculate working weights for sets
 */

import { calculateE1RM, roundToIncrement } from './e1rm-calculator'

export interface TrainingMaxConfig {
  percentage: number  // 0.85-0.95, typically 0.90
}

export const DEFAULT_TM_PERCENTAGE = 0.90  // 90% of E1RM

/**
 * Calculate Training Max from a tested or estimated 1RM
 */
export function calculateTrainingMax(e1rm: number, percentage: number = DEFAULT_TM_PERCENTAGE): number {
  if (e1rm <= 0 || percentage <= 0 || percentage > 1) {
    return 0
  }

  const tm = e1rm * percentage
  return roundToIncrement(tm, 2.5)
}

/**
 * Calculate Training Max directly from a performance set
 * Useful during onboarding when user enters a recent lift
 */
export function calculateTMFromPerformance(
  weight: number,
  reps: number,
  rir: number = 0,
  tmPercentage: number = DEFAULT_TM_PERCENTAGE
): { e1rm: number; trainingMax: number } {
  const { e1rm } = calculateE1RM({ weight, reps, rir })
  const trainingMax = calculateTrainingMax(e1rm, tmPercentage)

  return { e1rm, trainingMax }
}

/**
 * Get suggested TM percentage based on training level
 * More advanced lifters can use higher percentages
 */
export function getSuggestedTMPercentage(
  level: 'beginner' | 'intermediate' | 'advanced' | 'elite'
): number {
  const percentages: Record<string, number> = {
    beginner: 0.85,      // More conservative for form learning
    intermediate: 0.90,  // Standard
    advanced: 0.90,      // Standard (volume handles intensity)
    elite: 0.85,         // Conservative due to CNS demands
  }

  return percentages[level] || 0.90
}

/**
 * Calculate working weight for a given percentage of Training Max
 */
export function getWeightFromTMPercentage(
  trainingMax: number,
  percentage: number,
  increment: number = 2.5
): number {
  return roundToIncrement(trainingMax * percentage, increment)
}

/**
 * Get the standard working percentages for different RPE targets
 * Maps RPE to approximate percentage of TM
 */
export function getTMPercentageForRPE(targetRPE: number): number {
  // RPE to TM percentage mapping
  // Based on typical responses at each RPE level
  const rpeToPercentage: Record<number, number> = {
    6: 0.65,    // ~4+ RIR - warmup/light
    6.5: 0.68,
    7: 0.72,    // 3 RIR
    7.5: 0.76,  // 2-3 RIR
    8: 0.80,    // 2 RIR
    8.5: 0.85,  // 1-2 RIR
    9: 0.90,    // 1 RIR
    9.5: 0.95,  // 0-1 RIR
    10: 1.00,   // 0 RIR - true max attempt
  }

  // Find closest RPE match
  const rpes = Object.keys(rpeToPercentage).map(Number).sort((a, b) => a - b)
  let closest = rpes[0]
  for (const rpe of rpes) {
    if (Math.abs(rpe - targetRPE) < Math.abs(closest - targetRPE)) {
      closest = rpe
    }
  }

  return rpeToPercentage[closest]
}

/**
 * Calculate suggested weight for an exercise given TM and target RPE
 */
export function getSuggestedWeight(
  trainingMax: number,
  targetRPE: number,
  increment: number = 2.5
): number {
  const percentage = getTMPercentageForRPE(targetRPE)
  return getWeightFromTMPercentage(trainingMax, percentage, increment)
}

/**
 * Standard body weight ratios for estimating initial TM
 * Used when user is new and doesn't know their maxes
 * Values are multipliers of body weight
 */
export const BODYWEIGHT_STRENGTH_RATIOS: Record<
  string,
  Record<'beginner' | 'intermediate' | 'advanced' | 'elite', number>
> = {
  bench_press: {
    beginner: 0.5,
    intermediate: 1.0,
    advanced: 1.5,
    elite: 2.0,
  },
  squat: {
    beginner: 0.75,
    intermediate: 1.25,
    advanced: 1.75,
    elite: 2.5,
  },
  deadlift: {
    beginner: 1.0,
    intermediate: 1.5,
    advanced: 2.0,
    elite: 3.0,
  },
  overhead_press: {
    beginner: 0.35,
    intermediate: 0.65,
    advanced: 1.0,
    elite: 1.35,
  },
  barbell_row: {
    beginner: 0.5,
    intermediate: 0.85,
    advanced: 1.2,
    elite: 1.5,
  },
}

/**
 * Estimate initial E1RM based on body weight and training level
 */
export function estimateE1RMFromBodyWeight(
  exerciseKey: string,
  bodyWeightKg: number,
  level: 'beginner' | 'intermediate' | 'advanced' | 'elite'
): number {
  const ratios = BODYWEIGHT_STRENGTH_RATIOS[exerciseKey]
  if (!ratios) {
    // Default ratio for unknown exercises
    return bodyWeightKg * 0.5
  }

  const ratio = ratios[level]
  return roundToIncrement(bodyWeightKg * ratio, 2.5)
}

/**
 * Calculate initial TM from body weight (for onboarding)
 */
export function getInitialTMFromBodyWeight(
  exerciseKey: string,
  bodyWeightKg: number,
  level: 'beginner' | 'intermediate' | 'advanced' | 'elite'
): number {
  const e1rm = estimateE1RMFromBodyWeight(exerciseKey, bodyWeightKg, level)
  const tmPercentage = getSuggestedTMPercentage(level)
  return calculateTrainingMax(e1rm, tmPercentage)
}

/**
 * Key compound lifts for TM tracking
 * These are the lifts we'll assess during onboarding
 */
export const KEY_LIFTS = [
  {
    key: 'bench_press',
    name: 'Bench Press',
    muscle: 'chest',
    pattern: 'push',
    equipment: ['barbell', 'bench'],
  },
  {
    key: 'overhead_press',
    name: 'Overhead Press',
    muscle: 'front_delts',
    pattern: 'push',
    equipment: ['barbell'],
  },
  {
    key: 'squat',
    name: 'Back Squat',
    muscle: 'quads',
    pattern: 'squat',
    equipment: ['barbell', 'squat_rack'],
  },
  {
    key: 'deadlift',
    name: 'Deadlift',
    muscle: 'hamstrings',
    pattern: 'hinge',
    equipment: ['barbell'],
  },
  {
    key: 'barbell_row',
    name: 'Barbell Row',
    muscle: 'back',
    pattern: 'pull',
    equipment: ['barbell'],
  },
] as const

export type KeyLift = typeof KEY_LIFTS[number]['key']
