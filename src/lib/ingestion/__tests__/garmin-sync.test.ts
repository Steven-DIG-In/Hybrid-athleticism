import { describe, it, expect } from 'vitest'
import { diffVo2, dailyRowShape } from '../garmin-sync'

describe('diffVo2', () => {
  it('returns true when value changed', () => {
    expect(diffVo2({ previous: 56, current: 58 })).toBe(true)
  })
  it('returns false when value identical', () => {
    expect(diffVo2({ previous: 56, current: 56 })).toBe(false)
  })
  it('returns true when no previous exists', () => {
    expect(diffVo2({ previous: null, current: 56 })).toBe(true)
  })
})

describe('dailyRowShape', () => {
  it('normalizes a sleep payload (seconds → minutes) and maps nested HRV / resting HR', () => {
    const row = dailyRowShape({
      date: '2026-04-19',
      userId: 'uid',
      payload: {
        sleep: {
          dailySleepDTO: {
            sleepTimeSeconds: 28800,
            deepSleepSeconds: 6000,
            remSleepSeconds: 6600,
            lightSleepSeconds: 14400,
            awakeSleepSeconds: 1800,
            avgOvernightHrv: 52,
            hrvStatus: 'balanced',
            restingHeartRate: 51,
            avgSleepStress: 27,
            sleepScores: { overall: { value: 82 } },
          },
        },
        steps: 8800,
      },
    })
    expect(row.user_id).toBe('uid')
    expect(row.date).toBe('2026-04-19')
    expect(row.sleep_total_min).toBe(480) // 28800/60
    expect(row.sleep_deep_min).toBe(100)
    expect(row.sleep_rem_min).toBe(110)
    expect(row.sleep_light_min).toBe(240)
    expect(row.sleep_awake_min).toBe(30)
    expect(row.sleep_score).toBe(82)
    expect(row.hrv_overnight_avg).toBe(52)
    expect(row.hrv_morning_status).toBe('balanced')
    expect(row.resting_hr).toBe(51)
    expect(row.stress_avg).toBe(27)
    expect(row.steps).toBe(8800)
  })

  it('returns nulls when payload is empty', () => {
    const row = dailyRowShape({
      date: '2026-04-19',
      userId: 'uid',
      payload: {},
    })
    expect(row.sleep_total_min).toBeNull()
    expect(row.hrv_overnight_avg).toBeNull()
    expect(row.resting_hr).toBeNull()
    expect(row.steps).toBeNull()
  })
})
