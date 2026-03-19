import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  exerciseName: z.string(),
  prescribedWeightKg: z.number().positive(),
  prescribedReps: z.number().int().positive(),
  prescribedRpe: z.number().min(1).max(10),
  actualWeightKg: z.number().positive(),
  actualReps: z.number().int().positive(),
  actualRpe: z.number().min(1).max(10),
})

type Input = z.infer<typeof inputSchema>

type Adjustment = 'increase' | 'maintain' | 'decrease'

interface Output {
  exerciseName: string
  nextWeightKg: number
  incrementKg: number
  adjustment: Adjustment
  reason: string
}

const outputSchema = z.object({
  exerciseName: z.string(),
  nextWeightKg: z.number(),
  incrementKg: z.number(),
  adjustment: z.enum(['increase', 'maintain', 'decrease']),
  reason: z.string(),
})

const LOWER_BODY_KEYWORDS = ['squat', 'deadlift', 'lunge', 'hip thrust']

function isLowerBody(exerciseName: string): boolean {
  const name = exerciseName.toLowerCase()
  return LOWER_BODY_KEYWORDS.some((kw) => name.includes(kw))
}

function execute(input: Input): Output {
  const repsDelta = input.actualReps - input.prescribedReps
  const rpeDelta = input.actualRpe - input.prescribedRpe

  const incrementKg = isLowerBody(input.exerciseName) ? 5 : 2.5

  let adjustment: Adjustment
  let reason: string

  if (repsDelta >= 2 && rpeDelta <= -1) {
    adjustment = 'increase'
    reason = `Performed ${repsDelta} extra reps at RPE ${rpeDelta} below target — ready to progress`
  } else if (repsDelta <= -2 || (rpeDelta >= 2 && repsDelta < 0)) {
    adjustment = 'decrease'
    reason =
      repsDelta <= -2
        ? `Missed reps by ${Math.abs(repsDelta)} — reduce load to consolidate`
        : `RPE ${rpeDelta} above target with fewer reps — reduce load`
  } else {
    adjustment = 'maintain'
    reason = 'Performance within acceptable range — maintain current load'
  }

  const delta = adjustment === 'increase' ? incrementKg : adjustment === 'decrease' ? -incrementKg : 0
  const nextWeightKg = input.prescribedWeightKg + delta

  return {
    exerciseName: input.exerciseName,
    nextWeightKg,
    incrementKg: Math.abs(delta),
    adjustment,
    reason,
  }
}

export const progressionEngineSkill: Skill<Input, Output> = {
  name: 'progression-engine',
  domain: 'strength',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
