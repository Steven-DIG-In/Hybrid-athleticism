import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  trainingMaxKg: z.number().positive(),
  weekInCycle: z.literal(1).or(z.literal(2)).or(z.literal(3)).or(z.literal(4)),
})

type Input = z.infer<typeof inputSchema>

interface Set {
  reps: number
  percentTM: number
  weightKg: number
  isAmrap: boolean
}

interface Output {
  weekLabel: string
  sets: Set[]
}

const outputSchema = z.object({
  weekLabel: z.string(),
  sets: z.array(
    z.object({
      reps: z.number(),
      percentTM: z.number(),
      weightKg: z.number(),
      isAmrap: z.boolean(),
    }),
  ),
})

function roundTo2_5(kg: number): number {
  return Math.round(kg / 2.5) * 2.5
}

const WEEKS: Record<
  number,
  { label: string; sets: Array<{ reps: number; percentTM: number; isAmrap: boolean }> }
> = {
  1: {
    label: '5+',
    sets: [
      { reps: 5, percentTM: 0.65, isAmrap: false },
      { reps: 5, percentTM: 0.75, isAmrap: false },
      { reps: 5, percentTM: 0.85, isAmrap: true },
    ],
  },
  2: {
    label: '3+',
    sets: [
      { reps: 3, percentTM: 0.70, isAmrap: false },
      { reps: 3, percentTM: 0.80, isAmrap: false },
      { reps: 3, percentTM: 0.90, isAmrap: true },
    ],
  },
  3: {
    label: '5/3/1',
    sets: [
      { reps: 5, percentTM: 0.75, isAmrap: false },
      { reps: 3, percentTM: 0.85, isAmrap: false },
      { reps: 1, percentTM: 0.95, isAmrap: true },
    ],
  },
  4: {
    label: 'Deload',
    sets: [
      { reps: 5, percentTM: 0.40, isAmrap: false },
      { reps: 5, percentTM: 0.50, isAmrap: false },
      { reps: 5, percentTM: 0.60, isAmrap: false },
    ],
  },
}

function execute(input: Input): Output {
  const week = WEEKS[input.weekInCycle]
  return {
    weekLabel: week.label,
    sets: week.sets.map((s) => ({
      reps: s.reps,
      percentTM: s.percentTM,
      weightKg: roundTo2_5(input.trainingMaxKg * s.percentTM),
      isAmrap: s.isAmrap,
    })),
  }
}

export const fiveThreeOneSkill: Skill<Input, Output> = {
  name: '531-progression',
  domain: 'strength',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
