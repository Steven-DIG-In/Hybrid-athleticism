/**
 * Session Templates
 *
 * Maps session types to muscle group targets and exercise selection.
 * These templates define the structure of each workout type.
 */

import { type MuscleGroup, type Equipment, getBalancedExercisesForMuscle, type Exercise } from './exercise-library'

export type SessionType =
  | 'upper_push'
  | 'upper_pull'
  | 'lower'
  | 'full_body'
  | 'push'
  | 'pull'
  | 'legs'

export interface MuscleTarget {
  muscle: MuscleGroup
  priority: 'primary' | 'secondary' // Primary gets more volume
  exerciseCount: number // How many exercises for this muscle
}

export interface SessionTemplate {
  id: SessionType
  name: string
  description: string
  muscleTargets: MuscleTarget[]
  estimatedDuration: number // minutes
  systemicFatigueLevel: 'low' | 'medium' | 'high'
}

/**
 * Session templates for different split types
 */
export const SESSION_TEMPLATES: Record<SessionType, SessionTemplate> = {
  // Upper/Lower Split
  upper_push: {
    id: 'upper_push',
    name: 'Upper Push',
    description: 'Chest, shoulders, and triceps focused',
    muscleTargets: [
      { muscle: 'chest', priority: 'primary', exerciseCount: 2 },
      { muscle: 'front_delts', priority: 'secondary', exerciseCount: 1 },
      { muscle: 'side_delts', priority: 'secondary', exerciseCount: 1 },
      { muscle: 'triceps', priority: 'secondary', exerciseCount: 2 },
    ],
    estimatedDuration: 60,
    systemicFatigueLevel: 'medium',
  },

  upper_pull: {
    id: 'upper_pull',
    name: 'Upper Pull',
    description: 'Back, rear delts, and biceps focused',
    muscleTargets: [
      { muscle: 'back', priority: 'primary', exerciseCount: 3 },
      { muscle: 'rear_delts', priority: 'secondary', exerciseCount: 1 },
      { muscle: 'biceps', priority: 'secondary', exerciseCount: 2 },
    ],
    estimatedDuration: 60,
    systemicFatigueLevel: 'medium',
  },

  lower: {
    id: 'lower',
    name: 'Lower Body',
    description: 'Quads, hamstrings, glutes, and calves',
    muscleTargets: [
      { muscle: 'quads', priority: 'primary', exerciseCount: 2 },
      { muscle: 'hamstrings', priority: 'primary', exerciseCount: 2 },
      { muscle: 'glutes', priority: 'secondary', exerciseCount: 1 },
      { muscle: 'calves', priority: 'secondary', exerciseCount: 1 },
    ],
    estimatedDuration: 60,
    systemicFatigueLevel: 'high',
  },

  full_body: {
    id: 'full_body',
    name: 'Full Body',
    description: 'All major muscle groups',
    muscleTargets: [
      { muscle: 'chest', priority: 'primary', exerciseCount: 1 },
      { muscle: 'back', priority: 'primary', exerciseCount: 1 },
      { muscle: 'quads', priority: 'primary', exerciseCount: 1 },
      { muscle: 'hamstrings', priority: 'secondary', exerciseCount: 1 },
      { muscle: 'side_delts', priority: 'secondary', exerciseCount: 1 },
      { muscle: 'biceps', priority: 'secondary', exerciseCount: 1 },
      { muscle: 'triceps', priority: 'secondary', exerciseCount: 1 },
    ],
    estimatedDuration: 75,
    systemicFatigueLevel: 'high',
  },

  // PPL Split
  push: {
    id: 'push',
    name: 'Push Day',
    description: 'Chest, shoulders, and triceps',
    muscleTargets: [
      { muscle: 'chest', priority: 'primary', exerciseCount: 3 },
      { muscle: 'front_delts', priority: 'secondary', exerciseCount: 1 },
      { muscle: 'side_delts', priority: 'secondary', exerciseCount: 2 },
      { muscle: 'triceps', priority: 'secondary', exerciseCount: 2 },
    ],
    estimatedDuration: 70,
    systemicFatigueLevel: 'medium',
  },

  pull: {
    id: 'pull',
    name: 'Pull Day',
    description: 'Back, rear delts, and biceps',
    muscleTargets: [
      { muscle: 'back', priority: 'primary', exerciseCount: 4 },
      { muscle: 'rear_delts', priority: 'secondary', exerciseCount: 2 },
      { muscle: 'biceps', priority: 'secondary', exerciseCount: 2 },
    ],
    estimatedDuration: 70,
    systemicFatigueLevel: 'medium',
  },

  legs: {
    id: 'legs',
    name: 'Leg Day',
    description: 'Complete lower body workout',
    muscleTargets: [
      { muscle: 'quads', priority: 'primary', exerciseCount: 3 },
      { muscle: 'hamstrings', priority: 'primary', exerciseCount: 2 },
      { muscle: 'glutes', priority: 'secondary', exerciseCount: 1 },
      { muscle: 'calves', priority: 'secondary', exerciseCount: 2 },
    ],
    estimatedDuration: 75,
    systemicFatigueLevel: 'high',
  },
}

/**
 * Map our program generator session types to templates
 */
export function getTemplateForSession(sessionType: string): SessionTemplate {
  const mapping: Record<string, SessionType> = {
    'Upper Push': 'upper_push',
    'Upper Pull': 'upper_pull',
    'Lower': 'lower',
    'Full Body': 'full_body',
    'Push': 'push',
    'Pull': 'pull',
    'Legs': 'legs',
  }

  const templateId = mapping[sessionType] || 'full_body'
  return SESSION_TEMPLATES[templateId]
}

export interface PlannedExercise {
  exercise: Exercise
  muscle: MuscleGroup
  sets: number
  repRangeMin: number
  repRangeMax: number
  targetRPE: number
  restSeconds: number
  notes: string
}

export interface GeneratedSession {
  template: SessionTemplate
  exercises: PlannedExercise[]
  totalSets: number
  estimatedDuration: number
}

/**
 * Generate a complete session with exercises based on template and user equipment
 */
export function generateSessionExercises(
  template: SessionTemplate,
  userEquipment: Equipment[],
  weekNumber: number,
  volumeMultiplier: number = 1.0 // For mesocycle progression
): GeneratedSession {
  const exercises: PlannedExercise[] = []

  // RPE targets by week (RP-style periodization)
  const weeklyRPE: Record<number, number> = {
    1: 7, // 3 RIR
    2: 7.5, // 2-3 RIR
    3: 8, // 2 RIR
    4: 8.5, // 1-2 RIR
    5: 6, // Deload
  }
  const targetRPE = weeklyRPE[weekNumber] || 8

  console.log(`[Session Generator] Template: ${template.id}, Equipment: [${userEquipment.join(', ')}]`)

  for (const target of template.muscleTargets) {
    const muscleExercises = getBalancedExercisesForMuscle(
      target.muscle,
      userEquipment,
      target.exerciseCount
    )

    console.log(`[Session Generator] Muscle: ${target.muscle}, Requested: ${target.exerciseCount}, Found: ${muscleExercises.length}`)
    if (muscleExercises.length === 0) {
      console.warn(`[Session Generator] WARNING: No exercises found for ${target.muscle} with equipment: [${userEquipment.join(', ')}]`)
    }

    // Calculate sets per exercise based on priority
    const baseSets = target.priority === 'primary' ? 3 : 2
    const adjustedSets = Math.round(baseSets * volumeMultiplier)

    for (const exercise of muscleExercises) {
      exercises.push({
        exercise,
        muscle: target.muscle,
        sets: Math.max(2, adjustedSets), // Minimum 2 sets
        repRangeMin: exercise.repRangeMin,
        repRangeMax: exercise.repRangeMax,
        targetRPE,
        restSeconds: exercise.category === 'compound' ? 180 : 90,
        notes: exercise.cues.join('. '),
      })
    }
  }

  console.log(`[Session Generator] Total exercises generated: ${exercises.length}`)

  // Calculate totals
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0)
  const estimatedDuration = Math.round(totalSets * 2.5) // ~2.5 min per set including rest

  return {
    template,
    exercises,
    totalSets,
    estimatedDuration,
  }
}

/**
 * Calculate volume multiplier for mesocycle week
 * Week 1 = MEV, Week 4 = MAV, Week 5 = Deload
 */
export function getVolumeMultiplierForWeek(
  weekNumber: number,
  totalWeeks: number = 5
): number {
  if (weekNumber >= totalWeeks) {
    // Deload week
    return 0.5
  }

  // Linear progression from MEV (1.0) to MAV (~1.8)
  // Week 1: 1.0, Week 2: 1.27, Week 3: 1.53, Week 4: 1.8
  const progressionWeeks = totalWeeks - 1 // Exclude deload
  const progression = (weekNumber - 1) / (progressionWeeks - 1)
  return 1.0 + progression * 0.8
}

/**
 * Get RPE target for a given week
 */
export function getRPEForWeek(weekNumber: number, totalWeeks: number = 5): number {
  if (weekNumber >= totalWeeks) {
    return 6 // Deload
  }

  // Week 1: 7, Week 2: 7.5, Week 3: 8, Week 4: 8.5
  return 6.5 + weekNumber * 0.5
}

/**
 * Get RIR (Reps in Reserve) from RPE
 */
export function rpeToRIR(rpe: number): number {
  return Math.round(10 - rpe)
}
