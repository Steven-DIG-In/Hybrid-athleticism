import { z } from 'zod'
import type { Skill, CoachDomain } from '../../types'

const inputSchema = z.object({
  domain: z.enum([
    'strength',
    'endurance',
    'hypertrophy',
    'conditioning',
    'mobility',
    'recovery',
  ]),
  currentIntensity: z.number().positive(),
  currentVolumeSets: z.number().int().nonnegative(),
  customMultipliers: z
    .object({
      intensity: z.number().positive(),
      volume: z.number().positive(),
    })
    .optional(),
})

type Input = z.infer<typeof inputSchema>

interface Output {
  domain: string
  deloadIntensity: number
  deloadVolumeSets: number
  intensityMultiplier: number
  volumeMultiplier: number
}

const outputSchema = z.object({
  domain: z.string(),
  deloadIntensity: z.number(),
  deloadVolumeSets: z.number(),
  intensityMultiplier: z.number(),
  volumeMultiplier: z.number(),
})

type Multipliers = { intensity: number; volume: number }

const DEFAULT_MULTIPLIERS: Record<CoachDomain, Multipliers> = {
  strength:     { intensity: 0.6, volume: 0.5 },
  endurance:    { intensity: 0.7, volume: 0.5 },
  hypertrophy:  { intensity: 0.6, volume: 0.6 },
  conditioning: { intensity: 0.5, volume: 0.5 },
  mobility:     { intensity: 1.0, volume: 1.0 },
  recovery:     { intensity: 1.0, volume: 1.0 },
}

function execute(input: Input): Output {
  const defaults = DEFAULT_MULTIPLIERS[input.domain as CoachDomain]
  const intensityMultiplier = input.customMultipliers?.intensity ?? defaults.intensity
  const volumeMultiplier = input.customMultipliers?.volume ?? defaults.volume

  return {
    domain: input.domain,
    deloadIntensity: Math.round(input.currentIntensity * intensityMultiplier * 100) / 100,
    deloadVolumeSets: Math.round(input.currentVolumeSets * volumeMultiplier),
    intensityMultiplier,
    volumeMultiplier,
  }
}

export const deloadCalculatorSkill: Skill<Input, Output> = {
  name: 'deload-calculator',
  domain: 'shared',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
