import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  weeklyEnduranceMinutes: z.number().positive(),
})

type Input = z.infer<typeof inputSchema>

interface Output {
  easyMinutes: number
  hardMinutes: number
  easyPercent: 80
  hardPercent: 20
}

const outputSchema = z.object({
  easyMinutes: z.number(),
  hardMinutes: z.number(),
  easyPercent: z.literal(80),
  hardPercent: z.literal(20),
})

function execute(input: Input): Output {
  const easyMinutes = Math.round(input.weeklyEnduranceMinutes * 0.8)
  const hardMinutes = input.weeklyEnduranceMinutes - easyMinutes

  return {
    easyMinutes,
    hardMinutes,
    easyPercent: 80,
    hardPercent: 20,
  }
}

export const zoneDistributorSkill: Skill<Input, Output> = {
  name: 'zone-distributor',
  domain: 'endurance',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
