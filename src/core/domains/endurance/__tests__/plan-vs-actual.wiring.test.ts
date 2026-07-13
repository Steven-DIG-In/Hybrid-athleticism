import { describe, it, expect } from 'vitest'
import {
  parseEndurancePrescription,
  toPrescribedEndurance,
  summarizeEnduranceDelta,
  zoneAdherenceLabel,
} from '../plan-vs-actual.wiring'
import { computeEnduranceDelta } from '../plan-vs-actual'
import type { EndurancePrescription } from '../prescription.types'

const FORMULA_PRESCRIPTION: EndurancePrescription = {
  modality: 'running',
  intensityZone: 'tempo',
  targetDistanceKm: 8,
  targetDurationMin: 45,
  targetPaceSecPerKm: 341,
  ruckWeightKg: null,
  intervalStructure: null,
  source: 'formula',
  paceSource: 'VDOT 38.3 → tempo 5:41/km',
  notes: null,
}

describe('parseEndurancePrescription', () => {
  it('returns null for a pre-migration row (column is null)', () => {
    expect(parseEndurancePrescription(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseEndurancePrescription(undefined)).toBeNull()
  })

  it('returns null for malformed JSON (not shaped like a prescription)', () => {
    expect(parseEndurancePrescription({ foo: 'bar' })).toBeNull()
    expect(parseEndurancePrescription('a string')).toBeNull()
    expect(parseEndurancePrescription(42)).toBeNull()
    expect(parseEndurancePrescription([1, 2, 3])).toBeNull()
  })

  it('parses a well-formed prescription payload', () => {
    expect(parseEndurancePrescription(FORMULA_PRESCRIPTION)).toEqual(FORMULA_PRESCRIPTION)
  })
})

describe('toPrescribedEndurance', () => {
  it('narrows the frozen prescription to the delta-fn subset', () => {
    expect(toPrescribedEndurance(FORMULA_PRESCRIPTION)).toEqual({
      targetDistanceKm: 8,
      targetDurationMin: 45,
      targetPaceSecPerKm: 341,
      intensityZone: 'tempo',
    })
  })
})

describe('summarizeEnduranceDelta', () => {
  it('formats a slower pace and longer duration as positive fragments', () => {
    const delta = computeEnduranceDelta(toPrescribedEndurance(FORMULA_PRESCRIPTION), {
      distanceKm: 8,
      durationMinutes: 48,
      avgPaceSecPerKm: 360,
      avgHeartRateBpm: 150,
      perceivedEffortRpe: 6,
    })
    const summary = summarizeEnduranceDelta(delta)
    expect(summary.hasData).toBe(true)
    expect(summary.parts).toEqual(['+19s/km', '+3 min'])
    expect(summary.zoneAdherence).toBe('in_zone')
  })

  it('omits zero-valued fragments', () => {
    const delta = computeEnduranceDelta(toPrescribedEndurance(FORMULA_PRESCRIPTION), {
      distanceKm: 8,
      durationMinutes: 45,
      avgPaceSecPerKm: 341,
      avgHeartRateBpm: 150,
      perceivedEffortRpe: 6,
    })
    const summary = summarizeEnduranceDelta(delta)
    expect(summary.parts).toEqual([])
  })

  it('reports hasData=false when nothing has been logged', () => {
    const delta = computeEnduranceDelta(toPrescribedEndurance(FORMULA_PRESCRIPTION), {
      distanceKm: null,
      durationMinutes: null,
      avgPaceSecPerKm: null,
      avgHeartRateBpm: null,
      perceivedEffortRpe: null,
    })
    const summary = summarizeEnduranceDelta(delta)
    expect(summary.hasData).toBe(false)
  })
})

describe('zoneAdherenceLabel', () => {
  it('maps known adherence values to labels', () => {
    expect(zoneAdherenceLabel('in_zone')).toBe('in zone')
    expect(zoneAdherenceLabel('too_hard')).toBe('too hard')
    expect(zoneAdherenceLabel('too_easy')).toBe('too easy')
  })

  it('maps unknown to null (nothing worth rendering)', () => {
    expect(zoneAdherenceLabel('unknown')).toBeNull()
  })
})
