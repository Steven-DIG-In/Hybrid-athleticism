// Resolve a usable training max from a Layer-1 StrengthCapability. Training-max
// sources (recalibration/manual/test, written via setTrainingMax) are already TMs;
// a raw onboarding value is converted via the training-max skill (mirrors the legacy
// resolveTrainingMaxForExercise behaviour).

import type { StrengthCapability } from '@/lib/types/athlete-state.types'
import { trainingMaxSkill } from '@/lib/skills/domains/strength/training-max-estimation'

export function trainingMaxFromCapability(cap: StrengthCapability): number {
  if (cap.source === 'onboarding') {
    return trainingMaxSkill.execute({ weightKg: cap.currentValueKg, reps: 1 }).trainingMax
  }
  return cap.currentValueKg
}
