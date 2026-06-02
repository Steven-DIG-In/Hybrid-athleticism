// Seam adapter: maps the existing AI-generated StrengthExercise shape onto the
// immutable StrengthPrescription model. source is derived from methodologySource.

import type { StrengthExercise } from '@/lib/types/coach-context'
import type { StrengthPrescription } from './prescription.types'

export function fromStrengthExercise(ex: StrengthExercise): StrengthPrescription {
  return {
    exerciseName: ex.exerciseName,
    muscleGroup: ex.muscleGroup,
    sets: ex.sets,
    targetReps: ex.targetReps,
    targetWeightKg: ex.targetWeightKg,
    targetRir: ex.targetRir,
    category: ex.category,
    notes: ex.notes,
    source: ex.methodologySource ? 'formula' : 'ai',
    ...(ex.methodologySource ? { methodologySource: ex.methodologySource } : {}),
    ...(ex.isBenchmarkTest ? { isBenchmarkTest: true } : {}),
  }
}
