import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  format: z.enum(['EMOM', 'AMRAP', 'TABATA', 'INTERVAL']),
  fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']),
})

type Input = z.infer<typeof inputSchema>

interface Prescription {
  format: string
  workSeconds: number
  restSeconds: number
  rounds: number
  loadPercentage: number
}

const outputSchema = z
  .object({
    format: z.string(),
    workSeconds: z.number(),
    restSeconds: z.number(),
    rounds: z.number(),
    loadPercentage: z.number(),
  })
  .nullable()

type Output = Prescription | null

type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'

const LOOKUP_TABLE: Record<string, Record<FitnessLevel, Omit<Prescription, 'format'>>> = {
  EMOM: {
    beginner:     { workSeconds: 30, restSeconds: 30, rounds: 8,  loadPercentage: 50 },
    intermediate: { workSeconds: 40, restSeconds: 20, rounds: 12, loadPercentage: 60 },
    advanced:     { workSeconds: 45, restSeconds: 15, rounds: 16, loadPercentage: 70 },
  },
  AMRAP: {
    beginner:     { workSeconds: 1200, restSeconds: 0, rounds: 1, loadPercentage: 50 },
    intermediate: { workSeconds: 900,  restSeconds: 0, rounds: 1, loadPercentage: 60 },
    advanced:     { workSeconds: 720,  restSeconds: 0, rounds: 1, loadPercentage: 70 },
  },
  TABATA: {
    beginner:     { workSeconds: 20, restSeconds: 10, rounds: 4, loadPercentage: 50 },
    intermediate: { workSeconds: 20, restSeconds: 10, rounds: 6, loadPercentage: 60 },
    advanced:     { workSeconds: 20, restSeconds: 10, rounds: 8, loadPercentage: 70 },
  },
  INTERVAL: {
    beginner:     { workSeconds: 30, restSeconds: 60, rounds: 6,  loadPercentage: 50 },
    intermediate: { workSeconds: 30, restSeconds: 30, rounds: 8,  loadPercentage: 60 },
    advanced:     { workSeconds: 30, restSeconds: 15, rounds: 10, loadPercentage: 70 },
  },
}

function execute(input: Input): Output {
  const formatEntry = LOOKUP_TABLE[input.format]
  if (!formatEntry) return null

  const prescription = formatEntry[input.fitnessLevel]
  if (!prescription) return null

  return {
    format: input.format,
    ...prescription,
  }
}

export const conditioningScalerSkill: Skill<Input, Output> = {
  name: 'conditioning-scaler',
  domain: 'conditioning',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
