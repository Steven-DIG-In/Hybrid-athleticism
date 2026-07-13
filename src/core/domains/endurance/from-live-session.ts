// Adapter: live programming.ts EnduranceSession → immutable EndurancePrescription.
// Sibling to from-endurance-session.ts (which targets the week-brief schema).
import type { EnduranceSession } from '@/lib/ai/schemas/programming'
import { formatPace } from '@/lib/skills/domains/endurance/vdot-pacer'
import type { VdotPaces } from './from-endurance-session'
import type { EndurancePrescription, EnduranceSource, IntensityZone } from './prescription.types'

const LBS_TO_KG = 0.45359237

function vdotPaceForZone(zone: IntensityZone, p: VdotPaces): number {
  switch (zone) {
    case 'easy':
    case 'zone_2': return p.easyPaceSecPerKm
    case 'tempo': return p.tempoPaceSecPerKm
    case 'threshold': return p.thresholdPaceSecPerKm
    case 'vo2max':
    case 'interval': return p.intervalPaceSecPerKm
  }
}

export function endurancePrescriptionFromLiveSession(
  session: EnduranceSession,
  runVdotPaces?: VdotPaces | null,
): EndurancePrescription {
  const ruckWeightKg = session.ruckWeightLbs != null
    ? Number((session.ruckWeightLbs * LBS_TO_KG).toFixed(1)) : null

  let targetPaceSecPerKm: number | null = session.targetPaceSecPerKm ?? null
  let source: EnduranceSource = 'ai'
  let paceSource: string | null = null

  if (session.enduranceModality === 'running' && runVdotPaces) {
    targetPaceSecPerKm = vdotPaceForZone(session.intensityZone, runVdotPaces)
    source = 'formula'
    paceSource = `VDOT ${runVdotPaces.vdot} → ${session.intensityZone} ${formatPace(targetPaceSecPerKm)}/km`
  } else if (session.enduranceModality !== 'running') {
    targetPaceSecPerKm = null
    source = 'ai'
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
