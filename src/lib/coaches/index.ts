import { CoachRegistry } from './registry'
import { strengthCoachConfig } from './configs/strength'
import { hypertrophyCoachConfig } from './configs/hypertrophy'
import { enduranceCoachConfig } from './configs/endurance'
import { conditioningCoachConfig } from './configs/conditioning'
import { mobilityCoachConfig } from './configs/mobility'
import { recoveryCoachConfig } from './configs/recovery'

export const coachRegistry = new CoachRegistry()
coachRegistry.register(strengthCoachConfig)
coachRegistry.register(hypertrophyCoachConfig)
coachRegistry.register(enduranceCoachConfig)
coachRegistry.register(conditioningCoachConfig)
coachRegistry.register(mobilityCoachConfig)
coachRegistry.register(recoveryCoachConfig)

export type { CoachConfig } from './types'
export { CoachRegistry } from './registry'
