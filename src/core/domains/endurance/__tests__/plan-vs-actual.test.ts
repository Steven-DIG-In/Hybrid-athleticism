import { describe, it, expect } from 'vitest'
import { computeEnduranceDelta } from '../plan-vs-actual'

const baseActual = {
  distanceKm: 8,
  durationMinutes: 42,
  avgPaceSecPerKm: 315,
  avgHeartRateBpm: 140,
  perceivedEffortRpe: 3,
}

describe('computeEnduranceDelta', () => {
  it('computes distance/duration/pace deltas (actual - target)', () => {
    const d = computeEnduranceDelta(
      { targetDistanceKm: 8, targetDurationMin: 40, targetPaceSecPerKm: 330, intensityZone: 'easy' },
      baseActual,
    )
    expect(d.distanceDeltaKm).toBe(0)
    expect(d.durationDeltaMin).toBe(2)
    expect(d.paceDeltaSecPerKm).toBe(-15)
    expect(d.status).toBe('logged')
  })

  it('flags an easy day run too hard via RPE', () => {
    const d = computeEnduranceDelta(
      { targetDistanceKm: 8, targetDurationMin: 40, targetPaceSecPerKm: 330, intensityZone: 'easy' },
      { ...baseActual, perceivedEffortRpe: 7 },
    )
    expect(d.zoneAdherence).toBe('too_hard')
  })

  it('flags a hard session not hard enough via RPE', () => {
    const d = computeEnduranceDelta(
      { targetDistanceKm: 5, targetDurationMin: 30, targetPaceSecPerKm: 270, intensityZone: 'interval' },
      { ...baseActual, perceivedEffortRpe: 5 },
    )
    expect(d.zoneAdherence).toBe('too_easy')
  })

  it('reports in_zone when RPE sits inside the band', () => {
    const d = computeEnduranceDelta(
      { targetDistanceKm: 6, targetDurationMin: 35, targetPaceSecPerKm: 300, intensityZone: 'tempo' },
      { ...baseActual, perceivedEffortRpe: 6 },
    )
    expect(d.zoneAdherence).toBe('in_zone')
  })

  it('zoneAdherence is unknown when RPE is missing', () => {
    const d = computeEnduranceDelta(
      { targetDistanceKm: 8, targetDurationMin: 40, targetPaceSecPerKm: 330, intensityZone: 'easy' },
      { ...baseActual, perceivedEffortRpe: null },
    )
    expect(d.zoneAdherence).toBe('unknown')
  })

  it('pace delta is null for zone-only prescriptions (no target pace)', () => {
    const d = computeEnduranceDelta(
      { targetDistanceKm: 10, targetDurationMin: 50, targetPaceSecPerKm: null, intensityZone: 'zone_2' },
      baseActual,
    )
    expect(d.paceDeltaSecPerKm).toBeNull()
    expect(d.distanceDeltaKm).toBe(-2)
  })

  it('returns unlogged with null deltas when nothing was recorded', () => {
    const d = computeEnduranceDelta(
      { targetDistanceKm: 8, targetDurationMin: 40, targetPaceSecPerKm: 330, intensityZone: 'easy' },
      { distanceKm: null, durationMinutes: null, avgPaceSecPerKm: null, avgHeartRateBpm: null, perceivedEffortRpe: null },
    )
    expect(d).toEqual({
      distanceDeltaKm: null,
      durationDeltaMin: null,
      paceDeltaSecPerKm: null,
      zoneAdherence: 'unknown',
      status: 'unlogged',
    })
  })
})
