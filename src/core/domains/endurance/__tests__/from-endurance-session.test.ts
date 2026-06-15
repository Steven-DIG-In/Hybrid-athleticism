import { describe, it, expect } from 'vitest'
import { fromEnduranceSession, vdotPacesFromCapability } from '../from-endurance-session'
import type { EnduranceProgramValidated } from '@/lib/ai/schemas/week-brief'
import type { EnduranceCapability } from '@/lib/types/athlete-state.types'

type EnduranceSession = EnduranceProgramValidated['weeks'][number]['sessions'][number]

function makeSession(overrides: Partial<EnduranceSession> = {}): EnduranceSession {
  return {
    name: 'Easy Run',
    enduranceModality: 'running',
    estimatedDurationMinutes: 40,
    loadBudget: 4,
    intensityZone: 'easy',
    targetDistanceKm: 8,
    targetPaceSecPerKm: 330,
    intervalStructure: null,
    ruckWeightLbs: null,
    coachNotes: 'Keep it conversational.',
    methodologySource: null,
    ...overrides,
  } as EnduranceSession
}

const runCap: EnduranceCapability = {
  key: 'run_5k',
  label: '5K Run',
  currentValueSeconds: 1500, // 25:00
  source: 'onboarding',
  updatedAt: '2026-01-01T00:00:00Z',
  evidence: {},
}

describe('vdotPacesFromCapability', () => {
  it('derives VDOT paces from a run_5k benchmark', () => {
    const p = vdotPacesFromCapability(runCap)
    expect(p).not.toBeNull()
    expect(p!.vdot).toBeGreaterThan(30)
    // easy is slower (higher sec/km) than interval
    expect(p!.easyPaceSecPerKm).toBeGreaterThan(p!.intervalPaceSecPerKm)
  })

  it('returns null for missing, unknown-key, or non-positive capability', () => {
    expect(vdotPacesFromCapability(undefined)).toBeNull()
    expect(vdotPacesFromCapability({ ...runCap, key: 'bench_press' })).toBeNull()
    expect(vdotPacesFromCapability({ ...runCap, currentValueSeconds: 0 })).toBeNull()
  })
})

describe('fromEnduranceSession', () => {
  it('maps scalar fields and normalizes units', () => {
    const p = fromEnduranceSession(
      makeSession({ enduranceModality: 'rowing', intensityZone: 'tempo', targetDistanceKm: 5, intervalStructure: '4x500m' }),
    )
    expect(p.modality).toBe('rowing')
    expect(p.intensityZone).toBe('tempo')
    expect(p.targetDistanceKm).toBe(5)
    expect(p.targetDurationMin).toBe(40)
    expect(p.intervalStructure).toBe('4x500m')
    expect(p.notes).toBe('Keep it conversational.')
  })

  it('running + VDOT paces → formula pace from the matching zone band', () => {
    const paces = vdotPacesFromCapability(runCap)!
    const p = fromEnduranceSession(makeSession({ intensityZone: 'threshold' }), paces)
    expect(p.source).toBe('formula')
    expect(p.targetPaceSecPerKm).toBe(paces.thresholdPaceSecPerKm)
    expect(p.paceSource).toContain('VDOT')
  })

  it('maps easy/zone_2 → easy band and vo2max/interval → interval band', () => {
    const paces = vdotPacesFromCapability(runCap)!
    expect(fromEnduranceSession(makeSession({ intensityZone: 'zone_2' }), paces).targetPaceSecPerKm)
      .toBe(paces.easyPaceSecPerKm)
    expect(fromEnduranceSession(makeSession({ intensityZone: 'vo2max' }), paces).targetPaceSecPerKm)
      .toBe(paces.intervalPaceSecPerKm)
  })

  it('running without VDOT paces falls back to the AI-emitted pace + methodologySource', () => {
    const p = fromEnduranceSession(makeSession({ targetPaceSecPerKm: 312, methodologySource: 'Daniels VDOT 45: easy 5:12/km' }))
    expect(p.targetPaceSecPerKm).toBe(312)
    expect(p.source).toBe('formula') // methodologySource present
    expect(p.paceSource).toBe('Daniels VDOT 45: easy 5:12/km')
  })

  it('non-running modality is zone-only: pace nulled, source ai', () => {
    const paces = vdotPacesFromCapability(runCap)!
    const p = fromEnduranceSession(
      makeSession({ enduranceModality: 'cycling', intensityZone: 'tempo', targetPaceSecPerKm: 200 }),
      paces,
    )
    expect(p.targetPaceSecPerKm).toBeNull()
    expect(p.source).toBe('ai')
    expect(p.paceSource ?? null).toBeNull()
  })

  it('rucking converts lbs → kg and stays zone-only', () => {
    const p = fromEnduranceSession(makeSession({ enduranceModality: 'rucking', ruckWeightLbs: 45, targetPaceSecPerKm: 480 }))
    expect(p.ruckWeightKg).toBeCloseTo(20.4, 1)
    expect(p.targetPaceSecPerKm).toBeNull()
    expect(p.source).toBe('ai')
  })
})
