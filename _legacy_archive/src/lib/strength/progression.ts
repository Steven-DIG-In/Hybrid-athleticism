/**
 * Progression Logic
 *
 * Implements Double Progression + RPE-based autoregulation:
 *
 * 1. Double Progression:
 *    - First progress reps within the target range
 *    - When hitting top of range at target RIR, increase weight
 *
 * 2. RPE-based Adjustment:
 *    - If actual RPE >> target RPE: reduce weight next session
 *    - If actual RPE << target RPE: consider small increase
 */

import { roundToIncrement } from './e1rm-calculator'

export interface SetPerformance {
  weight_kg: number
  reps: number
  rir: number | null
  rpe?: number | null
  set_type: string | null
}

export interface ExercisePerformance {
  exerciseId: string
  sets: SetPerformance[]
  repRangeMin: number
  repRangeMax: number
  targetRPE: number
}

export interface ProgressionResult {
  recommendation: 'increase_weight' | 'maintain' | 'decrease_weight' | 'increase_reps'
  nextWeight: number
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Determine progression for next session based on performance
 */
export function calculateProgression(
  performance: ExercisePerformance,
  currentWeight: number,
  isCompound: boolean = true
): ProgressionResult {
  const workingSets = performance.sets.filter(
    s => s.set_type === 'working' || s.set_type === null
  )

  if (workingSets.length === 0) {
    return {
      recommendation: 'maintain',
      nextWeight: currentWeight,
      reason: 'No working sets logged',
      confidence: 'low',
    }
  }

  // Calculate averages across working sets
  const avgReps = workingSets.reduce((sum, s) => sum + s.reps, 0) / workingSets.length
  const avgRIR = workingSets.reduce((sum, s) => sum + (s.rir ?? 2), 0) / workingSets.length

  // Weight increment based on exercise type
  const increment = isCompound ? 2.5 : 1.25

  // Check if all sets hit top of rep range with low RIR
  const allSetsHitTarget = workingSets.every(
    set => set.reps >= performance.repRangeMax && (set.rir ?? 2) <= 1
  )

  // Check if struggling (not hitting minimum reps or RPE too high)
  const struggling = workingSets.some(
    set => set.reps < performance.repRangeMin || (set.rir ?? 2) < 0
  )

  // Determine progression
  if (allSetsHitTarget) {
    // Perfect performance - increase weight
    return {
      recommendation: 'increase_weight',
      nextWeight: roundToIncrement(currentWeight + increment, increment),
      reason: `All sets hit ${performance.repRangeMax} reps with ${avgRIR.toFixed(1)} RIR average`,
      confidence: 'high',
    }
  }

  if (struggling) {
    // Reduce weight if consistently failing
    const failedSets = workingSets.filter(s => s.reps < performance.repRangeMin).length
    if (failedSets >= workingSets.length / 2) {
      return {
        recommendation: 'decrease_weight',
        nextWeight: roundToIncrement(currentWeight - increment, increment),
        reason: `${failedSets}/${workingSets.length} sets below target range`,
        confidence: 'high',
      }
    }
  }

  // Check RPE deviation
  const avgActualRPE = 10 - avgRIR
  const rpeDiff = avgActualRPE - performance.targetRPE

  if (rpeDiff > 1) {
    // Too hard - consider reducing
    return {
      recommendation: 'decrease_weight',
      nextWeight: roundToIncrement(currentWeight * 0.95, increment),
      reason: `RPE ${avgActualRPE.toFixed(1)} vs target ${performance.targetRPE} - too hard`,
      confidence: 'medium',
    }
  }

  if (rpeDiff < -1.5 && avgReps >= performance.repRangeMax - 1) {
    // Too easy and near top of range
    return {
      recommendation: 'increase_weight',
      nextWeight: roundToIncrement(currentWeight + increment, increment),
      reason: `RPE ${avgActualRPE.toFixed(1)} well below target ${performance.targetRPE}`,
      confidence: 'medium',
    }
  }

  // Not all sets at top - focus on adding reps
  if (avgReps < performance.repRangeMax) {
    return {
      recommendation: 'increase_reps',
      nextWeight: currentWeight,
      reason: `Avg ${avgReps.toFixed(1)} reps - aim for ${performance.repRangeMax} before adding weight`,
      confidence: 'high',
    }
  }

  // Default: maintain
  return {
    recommendation: 'maintain',
    nextWeight: currentWeight,
    reason: 'Performance on track - continue current progression',
    confidence: 'medium',
  }
}

/**
 * Calculate suggested starting weight for a new exercise
 * Based on Training Max and target RPE
 */
export function getSuggestedStartingWeight(
  trainingMax: number | null,
  targetRPE: number,
  isCompound: boolean = true
): number {
  if (!trainingMax || trainingMax <= 0) {
    return 0  // Can't suggest without TM
  }

  // RPE to percentage of TM
  const rpePercentages: Record<number, number> = {
    6: 0.60,
    7: 0.70,
    7.5: 0.75,
    8: 0.80,
    8.5: 0.85,
    9: 0.90,
    9.5: 0.95,
    10: 1.00,
  }

  const percentage = rpePercentages[targetRPE] ?? 0.75
  const increment = isCompound ? 2.5 : 1.25

  return roundToIncrement(trainingMax * percentage, increment)
}

/**
 * Weekly weight adjustment for mesocycle periodization
 * As the weeks progress, relative intensity increases while absolute intensity may stay similar
 */
export function getWeeklyIntensityModifier(
  weekNumber: number,
  totalWeeks: number = 5
): number {
  if (weekNumber >= totalWeeks) {
    // Deload week
    return 0.60
  }

  // Linear increase from week 1 to peak week
  // Week 1: ~0.70, Week 4: ~0.85 of TM
  const baseIntensity = 0.70
  const peakIntensity = 0.85
  const progression = (weekNumber - 1) / (totalWeeks - 2)

  return baseIntensity + progression * (peakIntensity - baseIntensity)
}

/**
 * Determine if a PR (Personal Record) was achieved
 */
export function checkForPR(
  currentE1RM: number,
  previousBestE1RM: number | null
): { isPR: boolean; improvement: number } {
  if (!previousBestE1RM || previousBestE1RM <= 0) {
    return { isPR: true, improvement: 0 }  // First record is always a PR
  }

  const isPR = currentE1RM > previousBestE1RM
  const improvement = currentE1RM - previousBestE1RM

  return { isPR, improvement }
}

/**
 * Calculate fatigue accumulation factor
 * Used to adjust volume/intensity as mesocycle progresses
 */
export function getFatigueAccumulation(
  weekNumber: number,
  totalWeeks: number = 5,
  completedSessions: number,
  plannedSessions: number
): number {
  // Base fatigue increases linearly through the block
  const weeklyFatigue = (weekNumber - 1) / (totalWeeks - 1)

  // Adjust for compliance (missed sessions = less fatigue)
  const compliance = plannedSessions > 0 ? completedSessions / plannedSessions : 1

  return weeklyFatigue * compliance
}

/**
 * Suggest auto-regulation adjustment based on session performance
 * Returns a multiplier for the remaining exercises in session
 */
export function getInSessionAutoregulation(
  performedRPE: number,
  targetRPE: number,
  exercisesRemaining: number
): number {
  const rpeDiff = performedRPE - targetRPE

  if (rpeDiff > 0.5 && exercisesRemaining > 0) {
    // Fatigue higher than expected - reduce volume slightly
    return 0.90 + (0.10 / exercisesRemaining)  // Gradual reduction
  }

  if (rpeDiff < -1 && exercisesRemaining > 2) {
    // Feeling good - can maintain or slight increase
    return 1.05
  }

  return 1.0  // On target
}
