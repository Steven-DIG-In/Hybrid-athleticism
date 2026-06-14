// Pure plan-vs-actual delta for one endurance session. Derives actual - prescribed
// from the immutable prescription and the cardio_logs actual; no storage.
// zoneAdherence (RPE vs the prescribed zone band) is the endurance analog of strength's
// RIR delta — it answers "did the easy day stay easy?".

import type { IntensityZone } from './prescription.types'

export interface PrescribedEndurance {
  targetDistanceKm: number | null
  targetDurationMin: number | null
  targetPaceSecPerKm: number | null
  intensityZone: IntensityZone
}

export interface ActualEndurance {
  distanceKm: number | null
  durationMinutes: number | null
  avgPaceSecPerKm: number | null
  avgHeartRateBpm: number | null
  perceivedEffortRpe: number | null
}

export type ZoneAdherence = 'in_zone' | 'too_hard' | 'too_easy' | 'unknown'

export interface EnduranceDelta {
  distanceDeltaKm: number | null
  durationDeltaMin: number | null
  paceDeltaSecPerKm: number | null
  zoneAdherence: ZoneAdherence
  status: 'logged' | 'unlogged'
}

// Expected RPE band [low, high] per prescribed intensity zone.
const ZONE_RPE_BAND: Record<IntensityZone, [number, number]> = {
  easy: [2, 4],
  zone_2: [3, 4],
  tempo: [5, 7],
  threshold: [7, 8],
  vo2max: [8, 10],
  interval: [8, 10],
}

function zoneAdherenceFromRpe(zone: IntensityZone, rpe: number | null): ZoneAdherence {
  if (rpe === null) return 'unknown'
  const [low, high] = ZONE_RPE_BAND[zone]
  if (rpe < low) return 'too_easy'
  if (rpe > high) return 'too_hard'
  return 'in_zone'
}

function diff(actual: number | null, target: number | null, dp = 2): number | null {
  if (actual === null || target === null) return null
  return Number((actual - target).toFixed(dp))
}

export function computeEnduranceDelta(
  prescribed: PrescribedEndurance,
  actual: ActualEndurance,
): EnduranceDelta {
  const logged =
    actual.distanceKm !== null ||
    actual.durationMinutes !== null ||
    actual.avgPaceSecPerKm !== null ||
    actual.avgHeartRateBpm !== null ||
    actual.perceivedEffortRpe !== null

  return {
    distanceDeltaKm: diff(actual.distanceKm, prescribed.targetDistanceKm),
    durationDeltaMin: diff(actual.durationMinutes, prescribed.targetDurationMin),
    paceDeltaSecPerKm: diff(actual.avgPaceSecPerKm, prescribed.targetPaceSecPerKm, 0),
    zoneAdherence: zoneAdherenceFromRpe(prescribed.intensityZone, actual.perceivedEffortRpe),
    status: logged ? 'logged' : 'unlogged',
  }
}
