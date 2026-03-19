import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  weightKg: z.number().positive(),
  reps: z.number().int().positive(),
  rpe: z.number().min(1).max(10).optional(),
})

type Input = z.infer<typeof inputSchema>

interface Output {
  estimated1RM: number
  trainingMax: number
}

const outputSchema = z.object({
  estimated1RM: z.number(),
  trainingMax: z.number(),
})

function roundTo0_5(kg: number): number {
  return Math.round(kg * 2) / 2
}

function execute(input: Input): Output {
  const effectiveReps =
    input.rpe !== undefined ? input.reps + (10 - input.rpe) : input.reps

  const estimated1RM =
    effectiveReps === 1 ? input.weightKg : input.weightKg * (1 + effectiveReps / 30)
  const trainingMax = roundTo0_5(estimated1RM * 0.9)

  return { estimated1RM, trainingMax }
}

export const trainingMaxSkill: Skill<Input, Output> = {
  name: 'training-max-estimation',
  domain: 'strength',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
