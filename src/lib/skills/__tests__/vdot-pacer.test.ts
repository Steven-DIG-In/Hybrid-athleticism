import { describe, it, expect } from 'vitest'
import { vdotPacerSkill, formatPace } from '../domains/endurance/vdot-pacer'

describe('vdot-pacer skill', () => {
  it('has correct metadata', () => {
    expect(vdotPacerSkill.name).toBe('vdot-pacer')
    expect(vdotPacerSkill.domain).toBe('endurance')
    expect(vdotPacerSkill.tier).toBe(1)
  })

  it('known race result (5km in 20min) gives a positive VDOT in plausible range', () => {
    // 5km in 20:00 — VDOT ~49-50 with Daniels formula
    const result = vdotPacerSkill.execute({
      raceDistanceKm: 5,
      raceTimeSeconds: 20 * 60,
    })
    expect(result.vdot).toBeGreaterThan(45)
    expect(result.vdot).toBeLessThan(60)
  })

  it('known race result (10km in 45min) gives a positive VDOT in plausible range', () => {
    // 10km in 45:00 — VDOT ~43-48 with Daniels formula
    const result = vdotPacerSkill.execute({
      raceDistanceKm: 10,
      raceTimeSeconds: 45 * 60,
    })
    expect(result.vdot).toBeGreaterThan(40)
    expect(result.vdot).toBeLessThan(52)
  })

  it('faster race pace gives higher VDOT', () => {
    const faster = vdotPacerSkill.execute({ raceDistanceKm: 5, raceTimeSeconds: 18 * 60 })
    const slower = vdotPacerSkill.execute({ raceDistanceKm: 5, raceTimeSeconds: 25 * 60 })
    expect(faster.vdot).toBeGreaterThan(slower.vdot)
  })

  it('all training paces are in sensible order (easy > tempo > threshold > interval)', () => {
    const result = vdotPacerSkill.execute({
      raceDistanceKm: 10,
      raceTimeSeconds: 40 * 60,
    })
    // Slower paces = higher sec/km
    expect(result.easyPaceSecPerKm).toBeGreaterThan(result.tempoPaceSecPerKm)
    expect(result.tempoPaceSecPerKm).toBeGreaterThan(result.thresholdPaceSecPerKm)
    expect(result.thresholdPaceSecPerKm).toBeGreaterThan(result.intervalPaceSecPerKm)
  })

  it('rejects zero distance', () => {
    expect(() =>
      vdotPacerSkill.inputSchema.parse({ raceDistanceKm: 0, raceTimeSeconds: 1200 }),
    ).toThrow()
  })

  it('rejects negative time', () => {
    expect(() =>
      vdotPacerSkill.inputSchema.parse({ raceDistanceKm: 5, raceTimeSeconds: -60 }),
    ).toThrow()
  })

  it('rejects zero time', () => {
    expect(() =>
      vdotPacerSkill.inputSchema.parse({ raceDistanceKm: 5, raceTimeSeconds: 0 }),
    ).toThrow()
  })
})

describe('formatPace helper', () => {
  it('formats 300 sec/km as "5:00"', () => {
    expect(formatPace(300)).toBe('5:00')
  })

  it('formats 270 sec/km as "4:30"', () => {
    expect(formatPace(270)).toBe('4:30')
  })

  it('pads seconds with leading zero', () => {
    expect(formatPace(365)).toBe('6:05')
  })

  it('handles integer seconds correctly', () => {
    expect(formatPace(360)).toBe('6:00')
  })
})
