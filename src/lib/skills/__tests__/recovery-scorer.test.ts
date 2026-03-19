import { describe, it, expect } from 'vitest'
import { recoveryScorerSkill } from '../domains/recovery/recovery-scorer'

// Equal weights for all signals — convenient for testing
const EQUAL_WEIGHTS = {
  rpeDeviation: 0.1,
  rirDeviation: 0.1,
  completionRate: 0.1,
  earlyCompletion: 0.1,
  missedSessions: 0.1,
  selfReportEnergy: 0.1,
  selfReportSoreness: 0.1,
  selfReportSleep: 0.1,
  selfReportStress: 0.1,
  selfReportMotivation: 0.1,
}

const PERFECT_INPUT = {
  avgRpeDeviation: 0,
  avgRirDeviation: 0,
  completionRate: 1,
  missedSessions: 0,
  earlyCompletion: true,
  selfReport: {
    sleepQuality: 5,
    energyLevel: 5,
    stressLevel: 1,
    motivation: 5,
    avgSoreness: 1,
  },
  signalWeights: EQUAL_WEIGHTS,
}

describe('recovery-scorer skill', () => {
  it('has correct metadata', () => {
    expect(recoveryScorerSkill.name).toBe('recovery-scorer')
    expect(recoveryScorerSkill.domain).toBe('recovery')
    expect(recoveryScorerSkill.tier).toBe(1)
  })

  it('perfect data returns GREEN with score > 0.7', () => {
    const result = recoveryScorerSkill.execute(PERFECT_INPUT)
    expect(result.status).toBe('GREEN')
    expect(result.score).toBeGreaterThan(0.7)
  })

  it('moderate issues return YELLOW (score between 0.4 and 0.7)', () => {
    const result = recoveryScorerSkill.execute({
      avgRpeDeviation: 1.5,
      avgRirDeviation: -1.5,
      completionRate: 0.75,
      missedSessions: 1,
      earlyCompletion: false,
      selfReport: {
        sleepQuality: 3,
        energyLevel: 3,
        stressLevel: 3,
        motivation: 3,
        avgSoreness: 3,
      },
      signalWeights: EQUAL_WEIGHTS,
    })
    expect(result.status).toBe('YELLOW')
    expect(result.score).toBeGreaterThanOrEqual(0.4)
    expect(result.score).toBeLessThanOrEqual(0.7)
  })

  it('severe issues return RED with score < 0.4', () => {
    const result = recoveryScorerSkill.execute({
      avgRpeDeviation: 3,
      avgRirDeviation: -3,
      completionRate: 0.2,
      missedSessions: 3,
      earlyCompletion: false,
      selfReport: {
        sleepQuality: 1,
        energyLevel: 1,
        stressLevel: 5,
        motivation: 1,
        avgSoreness: 5,
      },
      signalWeights: EQUAL_WEIGHTS,
    })
    expect(result.status).toBe('RED')
    expect(result.score).toBeLessThan(0.4)
  })

  it('missed sessions penalize score heavily', () => {
    const noMissed = recoveryScorerSkill.execute({
      ...PERFECT_INPUT,
      missedSessions: 0,
    })
    const threeMissed = recoveryScorerSkill.execute({
      ...PERFECT_INPUT,
      missedSessions: 3,
    })
    expect(noMissed.score).toBeGreaterThan(threeMissed.score)
  })

  it('signal weights are respected — zero weight signal has no effect', () => {
    // Set rpeDeviation weight to 0, make RPE deviation extreme
    const withWeight = recoveryScorerSkill.execute({
      ...PERFECT_INPUT,
      avgRpeDeviation: 3, // very bad
      signalWeights: { ...EQUAL_WEIGHTS, rpeDeviation: 0.1 },
    })
    const withoutWeight = recoveryScorerSkill.execute({
      ...PERFECT_INPUT,
      avgRpeDeviation: 3, // same bad RPE
      signalWeights: { ...EQUAL_WEIGHTS, rpeDeviation: 0 },
    })
    // Score with zero rpe weight should be higher (not penalized)
    expect(withoutWeight.score).toBeGreaterThan(withWeight.score)
  })

  it('returns signals object with all expected keys', () => {
    const result = recoveryScorerSkill.execute(PERFECT_INPUT)
    expect(result.signals).toHaveProperty('rpeDeviation')
    expect(result.signals).toHaveProperty('rirDeviation')
    expect(result.signals).toHaveProperty('completionRate')
    expect(result.signals).toHaveProperty('earlyCompletion')
    expect(result.signals).toHaveProperty('missedSessions')
    expect(result.signals).toHaveProperty('selfReportSleep')
    expect(result.signals).toHaveProperty('selfReportEnergy')
    expect(result.signals).toHaveProperty('selfReportStress')
    expect(result.signals).toHaveProperty('selfReportSoreness')
    expect(result.signals).toHaveProperty('selfReportMotivation')
  })

  it('signal scores are all between 0 and 1', () => {
    const result = recoveryScorerSkill.execute(PERFECT_INPUT)
    for (const [key, value] of Object.entries(result.signals)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('earlyCompletion=true gives higher score than false', () => {
    const withEarly = recoveryScorerSkill.execute({ ...PERFECT_INPUT, earlyCompletion: true })
    const withoutEarly = recoveryScorerSkill.execute({ ...PERFECT_INPUT, earlyCompletion: false })
    expect(withEarly.score).toBeGreaterThanOrEqual(withoutEarly.score)
  })
})
