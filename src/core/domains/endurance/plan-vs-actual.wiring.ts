// Wiring layer between the raw DB shapes and the pure plan-vs-actual domain fns
// (plan-vs-actual.ts, prescription.types.ts). Kept separate from those so the
// two "physics" modules stay free of parsing/formatting concerns; this file is
// what WorkoutLogger.tsx calls to go from workout.endurance_prescription (Json)
// and local form state down to something renderable.

import type { EndurancePrescription } from './prescription.types'
import type { EnduranceDelta, PrescribedEndurance, ZoneAdherence } from './plan-vs-actual'

/**
 * Runtime-guard a workouts.endurance_prescription JSONB column into the frozen
 * prescription shape. Returns null for pre-migration rows (column is null) and
 * for anything that doesn't look like a prescription — callers render nothing
 * rather than crashing on either case.
 */
export function parseEndurancePrescription(raw: unknown): EndurancePrescription | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const p = raw as Record<string, unknown>
  if (
    typeof p.modality !== 'string' ||
    typeof p.intensityZone !== 'string' ||
    typeof p.source !== 'string'
  ) {
    return null
  }
  return p as unknown as EndurancePrescription
}

/** Narrow the frozen prescription down to the subset computeEnduranceDelta needs. */
export function toPrescribedEndurance(p: EndurancePrescription): PrescribedEndurance {
  return {
    targetDistanceKm: p.targetDistanceKm,
    targetDurationMin: p.targetDurationMin,
    targetPaceSecPerKm: p.targetPaceSecPerKm,
    intensityZone: p.intensityZone,
  }
}

export interface EnduranceDeltaSummary {
  /** Human-readable "+15s/km" style fragments, mirroring the strength readout. */
  parts: string[]
  zoneAdherence: ZoneAdherence
  /** False when nothing has been logged yet — callers should render nothing. */
  hasData: boolean
}

const ZONE_ADHERENCE_LABEL: Record<ZoneAdherence, string | null> = {
  in_zone: 'in zone',
  too_hard: 'too hard',
  too_easy: 'too easy',
  unknown: null,
}

/** Map an EnduranceDelta onto the {parts[], zoneAdherence} shape the logger
 *  renders, the endurance analog of the strength computeSetDelta readout. */
export function summarizeEnduranceDelta(delta: EnduranceDelta): EnduranceDeltaSummary {
  const parts: string[] = []
  if (delta.paceDeltaSecPerKm !== null && delta.paceDeltaSecPerKm !== 0) {
    const sign = delta.paceDeltaSecPerKm > 0 ? '+' : ''
    parts.push(`${sign}${delta.paceDeltaSecPerKm}s/km`)
  }
  if (delta.durationDeltaMin !== null && delta.durationDeltaMin !== 0) {
    const sign = delta.durationDeltaMin > 0 ? '+' : ''
    parts.push(`${sign}${delta.durationDeltaMin} min`)
  }
  return {
    parts,
    zoneAdherence: delta.zoneAdherence,
    hasData: delta.status === 'logged',
  }
}

/** zoneAdherence → display label; null for 'unknown' (nothing worth showing). */
export function zoneAdherenceLabel(zoneAdherence: ZoneAdherence): string | null {
  return ZONE_ADHERENCE_LABEL[zoneAdherence]
}
