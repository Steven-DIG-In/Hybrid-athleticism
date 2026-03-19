import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  raceDistanceKm: z.number().positive(),
  raceTimeSeconds: z.number().positive(),
})

type Input = z.infer<typeof inputSchema>

interface Output {
  vdot: number
  easyPaceSecPerKm: number
  tempoPaceSecPerKm: number
  thresholdPaceSecPerKm: number
  intervalPaceSecPerKm: number
}

const outputSchema = z.object({
  vdot: z.number(),
  easyPaceSecPerKm: z.number(),
  tempoPaceSecPerKm: z.number(),
  thresholdPaceSecPerKm: z.number(),
  intervalPaceSecPerKm: z.number(),
})

/**
 * Compute VDOT from a race performance using Daniels' formula.
 * raceTimeMinutes = raceTimeSeconds / 60
 * velocity = raceDistanceMeters / raceTimeMinutes   (meters per minute)
 * VO2_race = -4.60 + 0.182258 * v + 0.000104 * v^2
 * fractionVO2max = 0.8 + 0.1894393 * e^(-0.012778 * t) + 0.2989558 * e^(-0.1932605 * t)
 * VDOT = VO2_race / fractionVO2max
 */
function computeVDOT(raceDistanceKm: number, raceTimeSeconds: number): number {
  const t = raceTimeSeconds / 60 // minutes
  const distanceMeters = raceDistanceKm * 1000
  const v = distanceMeters / t // meters per minute

  const vo2Race = -4.60 + 0.182258 * v + 0.000104 * v * v
  const fractionVO2max =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * t) +
    0.2989558 * Math.exp(-0.1932605 * t)

  return vo2Race / fractionVO2max
}

/**
 * Derive pace in sec/km from a target VO2 intensity.
 * Inverse of: targetVO2 = -4.60 + 0.182258 * v + 0.000104 * v^2
 * Solve quadratic: 0.000104*v^2 + 0.182258*v + (-4.60 - targetVO2) = 0
 * v = (-b + sqrt(b^2 - 4ac)) / 2a   (take positive root)
 * v is in meters/minute → convert to sec/km: (1000 / v) * 60 = 60000 / v
 */
function paceFromVO2(targetVO2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.60 - targetVO2
  const discriminant = b * b - 4 * a * c
  const v = (-b + Math.sqrt(discriminant)) / (2 * a) // meters per minute
  return 60000 / v // sec per km
}

function execute(input: Input): Output {
  const vdot = computeVDOT(input.raceDistanceKm, input.raceTimeSeconds)

  const easyVO2 = vdot * 0.65
  const tempoVO2 = vdot * 0.80
  const thresholdVO2 = vdot * 0.86
  const intervalVO2 = vdot * 0.98

  return {
    vdot: Math.round(vdot * 10) / 10,
    easyPaceSecPerKm: Math.round(paceFromVO2(easyVO2)),
    tempoPaceSecPerKm: Math.round(paceFromVO2(tempoVO2)),
    thresholdPaceSecPerKm: Math.round(paceFromVO2(thresholdVO2)),
    intervalPaceSecPerKm: Math.round(paceFromVO2(intervalVO2)),
  }
}

export const vdotPacerSkill: Skill<Input, Output> = {
  name: 'vdot-pacer',
  domain: 'endurance',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}

/**
 * Format pace in seconds/km to "M:SS" string.
 */
export function formatPace(secPerKm: number): string {
  const minutes = Math.floor(secPerKm / 60)
  const seconds = Math.round(secPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
