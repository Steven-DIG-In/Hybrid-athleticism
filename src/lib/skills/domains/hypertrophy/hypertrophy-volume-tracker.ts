import { z } from 'zod'
import type { Skill } from '../../types'

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

const inputSchema = z.object({
  entries: z.array(
    z.object({
      muscleGroup: z.string(),
      sets: z.number().int().nonnegative(),
    }),
  ),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
})

type Input = z.infer<typeof inputSchema>

type VolumeStatus = 'below_mev' | 'in_range' | 'approaching_mrv' | 'exceeds_mrv'

interface MuscleResult {
  muscleGroup: string
  currentSets: number
  mev: number
  mav: number
  mrv: number
  status: VolumeStatus
}

interface Output {
  results: MuscleResult[]
}

const outputSchema = z.object({
  results: z.array(
    z.object({
      muscleGroup: z.string(),
      currentSets: z.number(),
      mev: z.number(),
      mrv: z.number(),
      mav: z.number(),
      status: z.enum(['below_mev', 'in_range', 'approaching_mrv', 'exceeds_mrv']),
    }),
  ),
})

function computeStatus(currentSets: number, mev: number, mav: number, mrv: number): VolumeStatus {
  if (currentSets < mev) return 'below_mev'
  if (currentSets <= mav) return 'in_range'
  if (currentSets <= mrv) return 'approaching_mrv'
  return 'exceeds_mrv'
}

function execute(input: Input): Output {
  // Aggregate sets per muscle group
  const totals = new Map<string, number>()
  for (const entry of input.entries) {
    const normalized = normalizeMuscleGroup(entry.muscleGroup)
    totals.set(normalized, (totals.get(normalized) ?? 0) + entry.sets)
  }

  const results: MuscleResult[] = []
  for (const [muscleGroup, currentSets] of totals.entries()) {
    const row = VOLUME_TABLE[muscleGroup] ?? DEFAULT_VOLUMES
    const [mev, mav, mrv] = row[input.experienceLevel]
    results.push({
      muscleGroup,
      currentSets,
      mev,
      mav,
      mrv,
      status: computeStatus(currentSets, mev, mav, mrv),
    })
  }

  return { results }
}

export const hypertrophyVolumeTrackerSkill: Skill<Input, Output> = {
  name: 'hypertrophy-volume-tracker',
  domain: 'hypertrophy',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
