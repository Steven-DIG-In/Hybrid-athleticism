// Feedback-only: given a logged set vs its prescription, recommend next-session weight
// via the existing progression engine. RIR is converted to RPE (rpe = 10 - rir, clamped).
// Returns null when not applicable (no prescribed weight, or set unlogged). Auto-applying
// this into next-session generation is deferred to the Coordinator layer.

import { progressionEngineSkill } from '@/lib/skills/domains/strength/progression-engine'
import type { PrescribedSet, ActualSet } from './plan-vs-actual'

const rirToRpe = (rir: number): number => Math.min(10, Math.max(1, 10 - rir))

export interface ProgressionRecommendation {
  nextWeightKg: number
  incrementKg: number
  adjustment: 'increase' | 'maintain' | 'decrease'
  reason: string
}

export function nextSetRecommendation(args: {
  exerciseName: string
  prescribed: PrescribedSet
  actual: ActualSet
}): ProgressionRecommendation | null {
  const { exerciseName, prescribed, actual } = args
  if (prescribed.targetWeightKg === null || prescribed.targetWeightKg <= 0) return null
  if (actual.actualWeightKg === null || actual.actualWeightKg <= 0) return null
  if (actual.actualReps === null || actual.actualReps <= 0) return null

  const out = progressionEngineSkill.execute({
    exerciseName,
    prescribedWeightKg: prescribed.targetWeightKg,
    prescribedReps: prescribed.targetReps,
    prescribedRpe: rirToRpe(prescribed.targetRir),
    actualWeightKg: actual.actualWeightKg,
    actualReps: actual.actualReps,
    actualRpe: rirToRpe(actual.rirActual ?? prescribed.targetRir),
  })
  return {
    nextWeightKg: out.nextWeightKg,
    incrementKg: out.incrementKg,
    adjustment: out.adjustment,
    reason: out.reason,
  }
}
