/**
 * Estimated 1-Rep Max (E1RM) Calculator
 *
 * Uses the Epley formula with RIR adjustment for more accurate estimates.
 * E1RM = weight × (1 + reps/30)
 * With RIR: E1RM = weight × (1 + (reps + rir)/30)
 */

export interface E1RMInput {
  weight: number      // kg
  reps: number        // completed reps
  rir?: number        // reps in reserve (optional)
}

export interface E1RMResult {
  e1rm: number        // estimated 1RM in kg
  formula: string     // which formula was used
  confidence: 'high' | 'medium' | 'low'  // based on rep range
}

/**
 * Calculate E1RM using Epley formula with optional RIR adjustment
 *
 * Confidence levels:
 * - High: 1-5 reps (closest to actual 1RM)
 * - Medium: 6-10 reps
 * - Low: 11+ reps (formula less accurate at high reps)
 */
export function calculateE1RM({ weight, reps, rir = 0 }: E1RMInput): E1RMResult {
  if (weight <= 0 || reps < 1) {
    return { e1rm: 0, formula: 'invalid', confidence: 'low' }
  }

  // If 1 rep, E1RM is the weight itself (adjusted for RIR)
  if (reps === 1 && rir === 0) {
    return { e1rm: weight, formula: 'direct', confidence: 'high' }
  }

  // Epley formula with RIR adjustment
  // Effective reps = actual reps + RIR (total reps you could have done)
  const effectiveReps = reps + rir
  const e1rm = weight * (1 + effectiveReps / 30)

  // Determine confidence based on rep range
  let confidence: 'high' | 'medium' | 'low'
  if (effectiveReps <= 5) {
    confidence = 'high'
  } else if (effectiveReps <= 10) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  return {
    e1rm: Math.round(e1rm * 100) / 100,  // Round to 2 decimal places
    formula: 'epley',
    confidence,
  }
}

/**
 * Calculate E1RM from RPE instead of RIR
 * RPE 10 = 0 RIR, RPE 9 = 1 RIR, etc.
 */
export function calculateE1RMFromRPE(weight: number, reps: number, rpe: number): E1RMResult {
  const rir = Math.max(0, 10 - rpe)
  return calculateE1RM({ weight, reps, rir })
}

/**
 * Get the best E1RM from a set of logged sets
 * Returns the highest E1RM among working sets
 */
export function getBestE1RMFromSets(
  sets: Array<{ weight_kg: number; reps: number; rir: number | null; set_type: string | null }>
): E1RMResult | null {
  const workingSets = sets.filter(s => s.set_type === 'working' || s.set_type === null)

  if (workingSets.length === 0) return null

  let best: E1RMResult | null = null

  for (const set of workingSets) {
    const result = calculateE1RM({
      weight: set.weight_kg,
      reps: set.reps,
      rir: set.rir ?? 0,
    })

    if (!best || result.e1rm > best.e1rm) {
      best = result
    }
  }

  return best
}

/**
 * Calculate percentage tables for strength training
 * Returns weights at various percentages of E1RM
 */
export function getPercentageTable(e1rm: number): Record<number, number> {
  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]
  const table: Record<number, number> = {}

  for (const pct of percentages) {
    table[pct] = roundToIncrement(e1rm * (pct / 100), 2.5)
  }

  return table
}

/**
 * Round weight to nearest increment (usually 2.5kg or 1.25kg)
 */
export function roundToIncrement(weight: number, increment: number = 2.5): number {
  return Math.round(weight / increment) * increment
}

/**
 * Estimate rep max at a given percentage
 * e.g., at 80% of 1RM, you can typically do ~8 reps
 */
export function estimateRepsAtPercentage(percentage: number): number {
  // Inverse of Epley: reps = 30 × ((100/percentage) - 1)
  const reps = 30 * ((100 / percentage) - 1)
  return Math.round(reps)
}

/**
 * Get the expected rep range at different RPE levels
 */
export function getRepRangeForRPE(rpe: number): { min: number; max: number } {
  // Based on typical strength training guidelines
  const rpeRanges: Record<number, { min: number; max: number }> = {
    6: { min: 6, max: 15 },   // 4+ RIR - light work
    7: { min: 5, max: 12 },   // 3 RIR
    7.5: { min: 4, max: 10 }, // 2-3 RIR
    8: { min: 3, max: 8 },    // 2 RIR
    8.5: { min: 2, max: 6 },  // 1-2 RIR
    9: { min: 1, max: 5 },    // 1 RIR
    9.5: { min: 1, max: 3 },  // 0-1 RIR
    10: { min: 1, max: 2 },   // 0 RIR - true max
  }

  return rpeRanges[rpe] || { min: 3, max: 8 }
}
