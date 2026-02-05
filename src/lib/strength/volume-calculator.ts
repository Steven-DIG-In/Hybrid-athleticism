/**
 * Volume Calculator
 *
 * Calculates weekly sets per muscle group based on RP Volume Landmarks:
 * - MV: Maintenance Volume - minimum to maintain gains
 * - MEV: Minimum Effective Volume - minimum to drive adaptation
 * - MAV: Maximum Adaptive Volume - optimal volume for most
 * - MRV: Maximum Recoverable Volume - upper limit before overtraining
 *
 * During a mesocycle:
 * Week 1: Start at MEV
 * Week 2-4: Progress toward MAV
 * Week 5: Deload to ~50% of MEV
 */

import type { MuscleGroup } from '../exercise-library'

export interface VolumeLandmarks {
  mv: number   // Maintenance Volume (sets/week)
  mev: number  // Minimum Effective Volume
  mav: number  // Maximum Adaptive Volume
  mrv: number  // Maximum Recoverable Volume
}

/**
 * Default volume landmarks by muscle group
 * Based on Renaissance Periodization guidelines
 * These are starting points - users can customize
 */
export const DEFAULT_VOLUME_LANDMARKS: Record<MuscleGroup, VolumeLandmarks> = {
  chest: { mv: 6, mev: 10, mav: 18, mrv: 22 },
  back: { mv: 6, mev: 10, mav: 20, mrv: 25 },
  front_delts: { mv: 0, mev: 6, mav: 12, mrv: 16 },  // Often trained by pressing
  side_delts: { mv: 6, mev: 8, mav: 20, mrv: 26 },
  rear_delts: { mv: 0, mev: 6, mav: 16, mrv: 22 },
  biceps: { mv: 4, mev: 8, mav: 18, mrv: 26 },
  triceps: { mv: 4, mev: 6, mav: 14, mrv: 20 },  // Often trained by pressing
  quads: { mv: 6, mev: 8, mav: 16, mrv: 20 },
  hamstrings: { mv: 4, mev: 6, mav: 14, mrv: 18 },
  glutes: { mv: 0, mev: 4, mav: 12, mrv: 16 },  // Often trained by compounds
  calves: { mv: 6, mev: 8, mav: 14, mrv: 20 },
  core: { mv: 0, mev: 6, mav: 16, mrv: 20 },
  traps: { mv: 0, mev: 6, mav: 16, mrv: 22 },
  forearms: { mv: 0, mev: 4, mav: 12, mrv: 18 },
}

/**
 * Adjust landmarks based on training level
 * Beginners need less volume, advanced lifters need more
 */
export function getAdjustedLandmarks(
  base: VolumeLandmarks,
  level: 'beginner' | 'intermediate' | 'advanced' | 'elite'
): VolumeLandmarks {
  const multipliers: Record<string, number> = {
    beginner: 0.7,
    intermediate: 1.0,
    advanced: 1.2,
    elite: 1.3,
  }

  const mult = multipliers[level] || 1.0

  return {
    mv: Math.round(base.mv * mult),
    mev: Math.round(base.mev * mult),
    mav: Math.round(base.mav * mult),
    mrv: Math.round(base.mrv * mult),
  }
}

/**
 * Calculate target sets for a muscle group in a given week
 */
export function getTargetSetsForWeek(
  landmarks: VolumeLandmarks,
  weekNumber: number,
  totalWeeks: number = 5
): number {
  // Deload week
  if (weekNumber >= totalWeeks) {
    return Math.round(landmarks.mev * 0.5)
  }

  // Linear progression from MEV to MAV
  // Week 1: MEV, Week (n-1): MAV
  const progressionWeeks = totalWeeks - 1
  const progress = (weekNumber - 1) / (progressionWeeks - 1)

  const targetSets = landmarks.mev + progress * (landmarks.mav - landmarks.mev)
  return Math.round(targetSets)
}

/**
 * Distribute weekly sets across training sessions
 * Returns sets per session for a given muscle
 */
export function distributeSetsAcrossSessions(
  weeklyTarget: number,
  sessionsPerWeek: number
): number[] {
  if (sessionsPerWeek <= 0) return []

  const basePerSession = Math.floor(weeklyTarget / sessionsPerWeek)
  const remainder = weeklyTarget % sessionsPerWeek

  // Distribute sets, putting extra sets on earlier sessions
  const distribution: number[] = []
  for (let i = 0; i < sessionsPerWeek; i++) {
    distribution.push(basePerSession + (i < remainder ? 1 : 0))
  }

  return distribution
}

/**
 * Check if planned volume is within acceptable range
 */
export function validateVolume(
  plannedSets: number,
  landmarks: VolumeLandmarks,
  weekNumber: number,
  totalWeeks: number = 5
): { isValid: boolean; message: string; suggestion?: number } {
  const isDeload = weekNumber >= totalWeeks
  const target = getTargetSetsForWeek(landmarks, weekNumber, totalWeeks)

  if (isDeload) {
    if (plannedSets > landmarks.mev) {
      return {
        isValid: false,
        message: 'Deload volume too high',
        suggestion: Math.round(landmarks.mev * 0.5),
      }
    }
    return { isValid: true, message: 'Appropriate deload volume' }
  }

  if (plannedSets < landmarks.mev) {
    return {
      isValid: false,
      message: `Below MEV (${landmarks.mev} sets)`,
      suggestion: landmarks.mev,
    }
  }

  if (plannedSets > landmarks.mrv) {
    return {
      isValid: false,
      message: `Exceeds MRV (${landmarks.mrv} sets)`,
      suggestion: landmarks.mav,
    }
  }

  // Warn if significantly above MAV
  if (plannedSets > landmarks.mav + 2) {
    return {
      isValid: true,
      message: `Volume (${plannedSets}) above MAV (${landmarks.mav}) - monitor fatigue`,
    }
  }

  return { isValid: true, message: 'Volume within range' }
}

/**
 * Calculate total weekly volume from sessions
 */
export function calculateWeeklyVolume(
  sessions: Array<{ exercises: Array<{ muscle: MuscleGroup; sets: number }> }>
): Record<MuscleGroup, number> {
  const volume: Partial<Record<MuscleGroup, number>> = {}

  for (const session of sessions) {
    for (const exercise of session.exercises) {
      volume[exercise.muscle] = (volume[exercise.muscle] || 0) + exercise.sets
    }
  }

  // Fill in zeros for muscles not trained
  const allMuscles: MuscleGroup[] = [
    'chest', 'back', 'front_delts', 'side_delts', 'rear_delts',
    'biceps', 'triceps', 'quads', 'hamstrings', 'glutes',
    'calves', 'core', 'traps', 'forearms'
  ]

  for (const muscle of allMuscles) {
    if (!(muscle in volume)) {
      volume[muscle] = 0
    }
  }

  return volume as Record<MuscleGroup, number>
}

/**
 * Get volume status for all muscle groups
 */
export function getVolumeStatus(
  currentVolume: Record<MuscleGroup, number>,
  landmarks: Record<MuscleGroup, VolumeLandmarks>,
  weekNumber: number,
  totalWeeks: number = 5
): Record<MuscleGroup, { status: 'low' | 'optimal' | 'high' | 'excessive'; sets: number; target: number }> {
  const status: Record<MuscleGroup, { status: 'low' | 'optimal' | 'high' | 'excessive'; sets: number; target: number }> = {} as any

  for (const muscle of Object.keys(currentVolume) as MuscleGroup[]) {
    const sets = currentVolume[muscle]
    const muscleLandmarks = landmarks[muscle] || DEFAULT_VOLUME_LANDMARKS[muscle]
    const target = getTargetSetsForWeek(muscleLandmarks, weekNumber, totalWeeks)

    let volumeStatus: 'low' | 'optimal' | 'high' | 'excessive'
    if (sets < muscleLandmarks.mev) {
      volumeStatus = 'low'
    } else if (sets <= muscleLandmarks.mav) {
      volumeStatus = 'optimal'
    } else if (sets <= muscleLandmarks.mrv) {
      volumeStatus = 'high'
    } else {
      volumeStatus = 'excessive'
    }

    status[muscle] = { status: volumeStatus, sets, target }
  }

  return status
}

/**
 * Frequency recommendations based on weekly volume
 * How many sessions per week to hit a muscle
 */
export function getRecommendedFrequency(weeklyTarget: number): number {
  // Optimal sets per session is typically 6-10
  // More frequent = better stimulus distribution
  if (weeklyTarget <= 6) return 1
  if (weeklyTarget <= 12) return 2
  if (weeklyTarget <= 18) return 3
  return Math.min(4, Math.ceil(weeklyTarget / 6))
}
