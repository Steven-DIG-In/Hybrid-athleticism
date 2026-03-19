import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  muscleGroup: z.string(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  weekNumber: z.number().int().positive().optional(),
  totalWeeks: z.number().int().positive().optional(),
  isDeload: z.boolean().optional(),
})

type Input = z.infer<typeof inputSchema>

interface Output {
  muscleGroup: string
  mev: number
  mav: number
  mrv: number
  weeklyTarget?: number
}

const outputSchema = z.object({
  muscleGroup: z.string(),
  mev: z.number(),
  mav: z.number(),
  mrv: z.number(),
  weeklyTarget: z.number().optional(),
})

// RP-based volume landmarks (sets per week) per muscle group per experience level
// Format: [MEV, MAV, MRV]
type VolumeRow = [number, number, number]
type ExperienceMap = Record<'beginner' | 'intermediate' | 'advanced', VolumeRow>

const VOLUME_TABLE: Record<string, ExperienceMap> = {
  chest: {
    beginner:     [6,  10, 16],
    intermediate: [8,  14, 20],
    advanced:     [10, 18, 24],
  },
  back: {
    beginner:     [8,  14, 20],
    intermediate: [10, 16, 22],
    advanced:     [12, 20, 25],
  },
  upper_back: {
    beginner:     [8,  14, 20],
    intermediate: [10, 16, 22],
    advanced:     [12, 20, 25],
  },
  lats: {
    beginner:     [6,  12, 18],
    intermediate: [8,  14, 20],
    advanced:     [10, 16, 22],
  },
  shoulders: {
    beginner:     [6,  12, 18],
    intermediate: [8,  16, 22],
    advanced:     [10, 18, 26],
  },
  biceps: {
    beginner:     [4,  10, 16],
    intermediate: [6,  14, 20],
    advanced:     [8,  18, 26],
  },
  triceps: {
    beginner:     [4,  10, 16],
    intermediate: [6,  14, 20],
    advanced:     [8,  18, 26],
  },
  forearms: {
    beginner:     [2,  6,  10],
    intermediate: [4,  8,  14],
    advanced:     [6,  10, 18],
  },
  quads: {
    beginner:     [6,  12, 18],
    intermediate: [8,  14, 20],
    advanced:     [10, 18, 24],
  },
  hamstrings: {
    beginner:     [4,  10, 16],
    intermediate: [6,  12, 18],
    advanced:     [8,  16, 22],
  },
  glutes: {
    beginner:     [4,  10, 16],
    intermediate: [6,  14, 20],
    advanced:     [8,  18, 24],
  },
  calves: {
    beginner:     [6,  12, 18],
    intermediate: [8,  14, 20],
    advanced:     [10, 16, 22],
  },
  abs: {
    beginner:     [4,  8,  16],
    intermediate: [6,  12, 20],
    advanced:     [8,  16, 25],
  },
  obliques: {
    beginner:     [2,  6,  12],
    intermediate: [4,  8,  14],
    advanced:     [6,  10, 16],
  },
  traps: {
    beginner:     [4,  8,  14],
    intermediate: [6,  12, 18],
    advanced:     [8,  14, 20],
  },
  rear_delts: {
    beginner:     [4,  10, 16],
    intermediate: [6,  14, 20],
    advanced:     [8,  18, 26],
  },
  side_delts: {
    beginner:     [6,  12, 18],
    intermediate: [8,  16, 22],
    advanced:     [10, 18, 26],
  },
  front_delts: {
    beginner:     [2,  6,  10],
    intermediate: [4,  8,  12],
    advanced:     [6,  10, 14],
  },
  neck: {
    beginner:     [2,  4,  8],
    intermediate: [2,  6,  10],
    advanced:     [4,  8,  12],
  },
}

const DEFAULT_VOLUMES: ExperienceMap = {
  beginner:     [4,  10, 16],
  intermediate: [6,  12, 18],
  advanced:     [8,  16, 22],
}

function normalizeMuscleGroup(name: string): string {
  return name.toLowerCase().replace(/[\s-]+/g, '_')
}

function execute(input: Input): Output {
  const normalized = normalizeMuscleGroup(input.muscleGroup)
  const row = VOLUME_TABLE[normalized] ?? DEFAULT_VOLUMES
  const [mev, mav, mrv] = row[input.experienceLevel]

  const output: Output = { muscleGroup: normalized, mev, mav, mrv }

  if (input.weekNumber !== undefined && input.totalWeeks !== undefined) {
    if (input.isDeload) {
      output.weeklyTarget = Math.round(mev * 0.6)
    } else {
      // Ramp from MEV+1 on week 1 to MAV on the final week
      const nonDeloadWeeks = input.totalWeeks
      const step = (mav - (mev + 1)) / Math.max(nonDeloadWeeks - 1, 1)
      const weekTarget = Math.round(mev + 1 + step * (input.weekNumber - 1))
      output.weeklyTarget = Math.min(weekTarget, mav)
    }
  }

  return output
}

export const volumeLandmarksSkill: Skill<Input, Output> = {
  name: 'volume-landmarks',
  domain: 'hypertrophy',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
