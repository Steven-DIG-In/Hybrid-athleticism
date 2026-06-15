// Seam adapter: maps the existing AI-generated endurance session shape
// (EnduranceSessionSchema) onto the immutable EndurancePrescription model, and
// resolves running pace from Layer 1 capabilities (VDOT). Pure; no I/O.

import type { EnduranceProgramValidated } from '@/lib/ai/schemas/week-brief'
import type { EnduranceCapability } from '@/lib/types/athlete-state.types'
import { vdotPacerSkill, formatPace } from '@/lib/skills/domains/endurance/vdot-pacer'
import type { EndurancePrescription, EnduranceSource, IntensityZone } from './prescription.types'

// Derive the per-session type from the exported program type (no edit to week-brief.ts).
type EnduranceSession = EnduranceProgramValidated['weeks'][number]['sessions'][number]

const LBS_TO_KG = 0.45359237

export interface VdotPaces {
  vdot: number
  easyPaceSecPerKm: number
  tempoPaceSecPerKm: number
  thresholdPaceSecPerKm: number
  intervalPaceSecPerKm: number
}

// Running benchmark keys → race distance in km, for VDOT computation.
const RUN_BENCHMARK_KM: Record<string, number> = {
  run_5k: 5,
  run_10k: 10,
  run_1mile: 1.609,
}

/**
 * Compute VDOT pace bands from a running benchmark capability (e.g. run_5k).
 * Returns null when the capability is absent, non-running, or non-positive —
 * the signal that running pace is not formula-driven (fall back to AI pace).
 */
export function vdotPacesFromCapability(runCap: EnduranceCapability | undefined): VdotPaces | null {
  if (!runCap || !(runCap.currentValueSeconds > 0)) return null
  const distanceKm = RUN_BENCHMARK_KM[runCap.key]
  if (!distanceKm) return null
  return vdotPacerSkill.execute({ raceDistanceKm: distanceKm, raceTimeSeconds: runCap.currentValueSeconds })
}

// Map an intensity zone onto the matching VDOT pace band.
function vdotPaceForZone(zone: IntensityZone, p: VdotPaces): number {
  switch (zone) {
    case 'easy':
    case 'zone_2':
      return p.easyPaceSecPerKm
    case 'tempo':
      return p.tempoPaceSecPerKm
    case 'threshold':
      return p.thresholdPaceSecPerKm
    case 'vo2max':
    case 'interval':
      return p.intervalPaceSecPerKm
  }
}

/**
 * Map one generated endurance session onto an immutable EndurancePrescription.
 *
 * - Running + resolved VDOT paces → precise formula pace for the zone (source 'formula').
 * - Running without VDOT paces    → AI-emitted pace; source from methodologySource.
 * - Any other modality            → zone-only (target pace null, source 'ai').
 */
export function fromEnduranceSession(
  session: EnduranceSession,
  runVdotPaces?: VdotPaces | null,
): EndurancePrescription {
  const ruckWeightKg = session.ruckWeightLbs != null
    ? Number((session.ruckWeightLbs * LBS_TO_KG).toFixed(1))
    : null

  let targetPaceSecPerKm: number | null = session.targetPaceSecPerKm ?? null
  let source: EnduranceSource = session.methodologySource ? 'formula' : 'ai'
  let paceSource: string | null = session.methodologySource ?? null

  if (session.enduranceModality === 'running' && runVdotPaces) {
    targetPaceSecPerKm = vdotPaceForZone(session.intensityZone, runVdotPaces)
    source = 'formula'
    paceSource = `VDOT ${runVdotPaces.vdot} → ${session.intensityZone} ${formatPace(targetPaceSecPerKm)}/km`
  } else if (session.enduranceModality !== 'running') {
    // Zone-only modalities: intensity governed by HR/RPE, no precise pace this layer.
    targetPaceSecPerKm = null
    source = 'ai'
    paceSource = null
  }

  return {
    modality: session.enduranceModality,
    intensityZone: session.intensityZone,
    targetDistanceKm: session.targetDistanceKm,
    targetDurationMin: session.estimatedDurationMinutes,
    targetPaceSecPerKm,
    ruckWeightKg,
    intervalStructure: session.intervalStructure ?? null,
    source,
    ...(paceSource ? { paceSource } : {}),
    notes: session.coachNotes,
  }
}
