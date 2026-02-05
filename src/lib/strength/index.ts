/**
 * Strength Training Utilities
 *
 * Core calculations and logic for strength/hypertrophy training:
 * - E1RM estimation
 * - Training Max management
 * - Volume calculations with RP landmarks
 * - Progression and autoregulation
 */

// E1RM Calculator
export {
  calculateE1RM,
  calculateE1RMFromRPE,
  getBestE1RMFromSets,
  getPercentageTable,
  roundToIncrement,
  estimateRepsAtPercentage,
  getRepRangeForRPE,
  type E1RMInput,
  type E1RMResult,
} from './e1rm-calculator'

// Training Max
export {
  calculateTrainingMax,
  calculateTMFromPerformance,
  getSuggestedTMPercentage,
  getWeightFromTMPercentage,
  getTMPercentageForRPE,
  getSuggestedWeight,
  estimateE1RMFromBodyWeight,
  getInitialTMFromBodyWeight,
  BODYWEIGHT_STRENGTH_RATIOS,
  KEY_LIFTS,
  DEFAULT_TM_PERCENTAGE,
  type TrainingMaxConfig,
  type KeyLift,
} from './training-max'

// Volume Calculator
export {
  getTargetSetsForWeek,
  distributeSetsAcrossSessions,
  validateVolume,
  calculateWeeklyVolume,
  getVolumeStatus,
  getRecommendedFrequency,
  getAdjustedLandmarks,
  DEFAULT_VOLUME_LANDMARKS,
  type VolumeLandmarks,
} from './volume-calculator'

// Progression Logic
export {
  calculateProgression,
  getSuggestedStartingWeight,
  getWeeklyIntensityModifier,
  checkForPR,
  getFatigueAccumulation,
  getInSessionAutoregulation,
  type SetPerformance,
  type ExercisePerformance,
  type ProgressionResult,
} from './progression'
