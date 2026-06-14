import { describe, it, expect } from 'vitest'
import { buildSkillInput, buildPreComputedAddendum } from '../skill-execution'
import type { AthleteContextPacket } from '@/lib/types/coach-context'
import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'

// vdot-pacer only reads ctx.athleteState + ctx.benchmarks; strategy is unused for it.
const strategy = { domainAllocations: [] } as unknown as MesocycleStrategyValidated

function ctxWith(partial: Partial<AthleteContextPacket>): AthleteContextPacket {
  return { benchmarks: [], ...partial } as unknown as AthleteContextPacket
}

const runCap = {
  key: 'run_5k',
  label: '5K Run',
  currentValueSeconds: 1500,
  source: 'onboarding' as const,
  updatedAt: '2026-01-01T00:00:00Z',
  evidence: {},
}

describe('buildSkillInput: vdot-pacer capability wiring', () => {
  it('reads the canonical endurance capability and emits raceDistanceKm (not raceDistanceMeters)', async () => {
    const ctx = ctxWith({
      athleteState: { capabilities: { strength: [], endurance: [runCap] } } as unknown as AthleteContextPacket['athleteState'],
    })
    const input = await buildSkillInput('vdot-pacer', ctx, strategy, 'endurance')
    expect(input).toEqual({ raceDistanceKm: 5, raceTimeSeconds: 1500 })
  })

  it('falls back to legacy benchmarks when no capability is present', async () => {
    const ctx = ctxWith({
      benchmarks: [{ benchmark_name: '5k Run', value: 1500 }] as AthleteContextPacket['benchmarks'],
    })
    const input = await buildSkillInput('vdot-pacer', ctx, strategy, 'endurance')
    expect(input).toEqual({ raceDistanceKm: 5, raceTimeSeconds: 1500 })
  })

  it('returns undefined when neither capability nor benchmark is available', async () => {
    const input = await buildSkillInput('vdot-pacer', ctxWith({}), strategy, 'endurance')
    expect(input).toBeUndefined()
  })
})

describe('buildPreComputedAddendum: vdot-pacer renders the flat skill output', () => {
  it('formats VDOT paces from easyPaceSecPerKm… (not data.paces)', () => {
    const pre = new Map<string, unknown>([
      ['vdot-pacer', {
        vdot: 48,
        easyPaceSecPerKm: 330,
        tempoPaceSecPerKm: 285,
        thresholdPaceSecPerKm: 270,
        intervalPaceSecPerKm: 255,
      }],
    ])
    const text = buildPreComputedAddendum(pre)
    expect(text).toContain('VDOT: 48')
    expect(text).toContain('5:30/km') // easy 330s
    expect(text).toContain('threshold')
  })
})
