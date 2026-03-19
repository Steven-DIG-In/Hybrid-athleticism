import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  avgRpeDeviation: z.number(),
  avgRirDeviation: z.number(),
  completionRate: z.number().min(0).max(1),
  missedSessions: z.number().int().nonnegative(),
  earlyCompletion: z.boolean(),
  selfReport: z.object({
    sleepQuality: z.number().min(1).max(5),
    energyLevel: z.number().min(1).max(5),
    stressLevel: z.number().min(1).max(5),
    motivation: z.number().min(1).max(5),
    avgSoreness: z.number().min(1).max(5),
  }),
  signalWeights: z.object({
    rpeDeviation: z.number().min(0).max(1),
    rirDeviation: z.number().min(0).max(1),
    completionRate: z.number().min(0).max(1),
    earlyCompletion: z.number().min(0).max(1),
    missedSessions: z.number().min(0).max(1),
    selfReportEnergy: z.number().min(0).max(1),
    selfReportSoreness: z.number().min(0).max(1),
    selfReportSleep: z.number().min(0).max(1),
    selfReportStress: z.number().min(0).max(1),
    selfReportMotivation: z.number().min(0).max(1),
  }),
})

type Input = z.infer<typeof inputSchema>

interface Output {
  score: number
  status: 'GREEN' | 'YELLOW' | 'RED'
  signals: Record<string, number>
}

const outputSchema = z.object({
  score: z.number().min(0).max(1),
  status: z.enum(['GREEN', 'YELLOW', 'RED']),
  signals: z.record(z.string(), z.number()),
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function execute(input: Input): Output {
  const signals: Record<string, number> = {
    rpeDeviation: 1 - clamp(Math.abs(input.avgRpeDeviation) / 3, 0, 1),
    rirDeviation: 1 - clamp(Math.abs(input.avgRirDeviation) / 3, 0, 1),
    completionRate: input.completionRate,
    earlyCompletion: input.earlyCompletion ? 1.0 : 0.5,
    missedSessions: 1 - clamp(input.missedSessions / 3, 0, 1),
    selfReportSleep: (input.selfReport.sleepQuality - 1) / 4,
    selfReportEnergy: (input.selfReport.energyLevel - 1) / 4,
    selfReportMotivation: (input.selfReport.motivation - 1) / 4,
    selfReportStress: 1 - (input.selfReport.stressLevel - 1) / 4,
    selfReportSoreness: 1 - (input.selfReport.avgSoreness - 1) / 4,
  }

  const weights = input.signalWeights
  const weightMap: Record<string, number> = {
    rpeDeviation: weights.rpeDeviation,
    rirDeviation: weights.rirDeviation,
    completionRate: weights.completionRate,
    earlyCompletion: weights.earlyCompletion,
    missedSessions: weights.missedSessions,
    selfReportEnergy: weights.selfReportEnergy,
    selfReportSoreness: weights.selfReportSoreness,
    selfReportSleep: weights.selfReportSleep,
    selfReportStress: weights.selfReportStress,
    selfReportMotivation: weights.selfReportMotivation,
  }

  let weightedSum = 0
  let totalWeight = 0

  for (const [key, signalScore] of Object.entries(signals)) {
    const w = weightMap[key] ?? 0
    weightedSum += signalScore * w
    totalWeight += w
  }

  const score = totalWeight > 0 ? weightedSum / totalWeight : 0
  const roundedScore = Math.round(score * 1000) / 1000

  let status: 'GREEN' | 'YELLOW' | 'RED'
  if (roundedScore > 0.7) {
    status = 'GREEN'
  } else if (roundedScore >= 0.4) {
    status = 'YELLOW'
  } else {
    status = 'RED'
  }

  return { score: roundedScore, status, signals }
}

export const recoveryScorerSkill: Skill<Input, Output> = {
  name: 'recovery-scorer',
  domain: 'recovery',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
