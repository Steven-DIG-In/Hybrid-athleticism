import { describe, it, expect } from 'vitest'
import { endurancePrescriptionFromLiveSession } from '../from-live-session'
import type { VdotPaces } from '../from-endurance-session'
import type { EnduranceSession } from '@/lib/ai/schemas/programming'

const base: EnduranceSession = {
  name: 'Tempo Run', modality: 'CARDIO', enduranceModality: 'running',
  estimatedDurationMinutes: 40, intensityZone: 'tempo',
  targetDistanceKm: 8, targetPaceSecPerKm: 320, intervalStructure: null,
  coachNotes: 'stay controlled', ruckWeightLbs: null,
}
const vdot: VdotPaces = {
  vdot: 38.3, easyPaceSecPerKm: 402, tempoPaceSecPerKm: 341,
  thresholdPaceSecPerKm: 322, intervalPaceSecPerKm: 290,
}

describe('endurancePrescriptionFromLiveSession', () => {
  it('running + VDOT → formula pace for the zone', () => {
    const p = endurancePrescriptionFromLiveSession(base, vdot)
    expect(p.modality).toBe('running')
    expect(p.targetPaceSecPerKm).toBe(341) // tempo band, not the AI 320
    expect(p.source).toBe('formula')
    expect(p.paceSource).toContain('VDOT 38.3')
  })
  it('running without VDOT → AI pace, source ai', () => {
    const p = endurancePrescriptionFromLiveSession(base, null)
    expect(p.targetPaceSecPerKm).toBe(320)
    expect(p.source).toBe('ai')
  })
  it('non-running → zone-only (null pace)', () => {
    const p = endurancePrescriptionFromLiveSession(
      { ...base, enduranceModality: 'rowing', ruckWeightLbs: null }, vdot)
    expect(p.targetPaceSecPerKm).toBeNull()
    expect(p.source).toBe('ai')
  })
  it('rucking → ruckWeightKg normalized from lbs', () => {
    const p = endurancePrescriptionFromLiveSession(
      { ...base, enduranceModality: 'rucking', ruckWeightLbs: 45 }, null)
    expect(p.ruckWeightKg).toBeCloseTo(20.4, 1)
  })
})
