import { SkillRegistry } from './registry'
import { fiveThreeOneSkill } from './domains/strength/531-progression'
import { trainingMaxSkill } from './domains/strength/training-max-estimation'
import { progressionEngineSkill } from './domains/strength/progression-engine'
import { volumeLandmarksSkill } from './domains/hypertrophy/volume-landmarks'
import { hypertrophyVolumeTrackerSkill } from './domains/hypertrophy/hypertrophy-volume-tracker'
import { vdotPacerSkill } from './domains/endurance/vdot-pacer'
import { zoneDistributorSkill } from './domains/endurance/zone-distributor'
import { conditioningScalerSkill } from './domains/conditioning/conditioning-scaler'
import { recoveryScorerSkill } from './domains/recovery/recovery-scorer'
import { deloadCalculatorSkill } from './domains/shared/deload-calculator'
import { interferenceCheckerSkill } from './domains/shared/interference-checker'

export const skillRegistry = new SkillRegistry()
skillRegistry.register(fiveThreeOneSkill)
skillRegistry.register(trainingMaxSkill)
skillRegistry.register(progressionEngineSkill)
skillRegistry.register(volumeLandmarksSkill)
skillRegistry.register(hypertrophyVolumeTrackerSkill)
skillRegistry.register(vdotPacerSkill)
skillRegistry.register(zoneDistributorSkill)
skillRegistry.register(conditioningScalerSkill)
skillRegistry.register(recoveryScorerSkill)
skillRegistry.register(deloadCalculatorSkill)
skillRegistry.register(interferenceCheckerSkill)

export { SkillRegistry } from './registry'
export type { Skill, CoachDomain, SkillDomain } from './types'
export { SkillInputError } from './types'
