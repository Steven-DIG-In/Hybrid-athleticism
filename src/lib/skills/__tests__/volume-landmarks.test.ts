import { describe, it, expect } from 'vitest'
import { volumeLandmarksSkill } from '../domains/hypertrophy/volume-landmarks'

describe('volume-landmarks skill', () => {
  it('has correct metadata', () => {
    expect(volumeLandmarksSkill.name).toBe('volume-landmarks')
    expect(volumeLandmarksSkill.domain).toBe('hypertrophy')
    expect(volumeLandmarksSkill.tier).toBe(1)
  })

  it('returns MEV/MAV/MRV for a known muscle group and experience level', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'chest',
      experienceLevel: 'intermediate',
    })
    expect(result.mev).toBeGreaterThan(0)
    expect(result.mav).toBeGreaterThan(result.mev)
    expect(result.mrv).toBeGreaterThan(result.mav)
  })

  it('normalizes muscle group name to lowercase with underscores', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'Upper Back',
      experienceLevel: 'beginner',
    })
    expect(result.muscleGroup).toBe('upper_back')
  })

  it('normalizes hyphens to underscores', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'upper-back',
      experienceLevel: 'beginner',
    })
    expect(result.muscleGroup).toBe('upper_back')
  })

  it('returns defaults for unknown muscle group', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'mystery_muscle',
      experienceLevel: 'intermediate',
    })
    expect(result.mev).toBeGreaterThan(0)
    expect(result.mav).toBeGreaterThan(result.mev)
    expect(result.mrv).toBeGreaterThan(result.mav)
  })

  it('beginner has lower volumes than advanced', () => {
    const beginner = volumeLandmarksSkill.execute({ muscleGroup: 'chest', experienceLevel: 'beginner' })
    const advanced = volumeLandmarksSkill.execute({ muscleGroup: 'chest', experienceLevel: 'advanced' })
    expect(beginner.mav).toBeLessThan(advanced.mav)
  })

  it('returns weeklyTarget when weekNumber and totalWeeks provided', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'chest',
      experienceLevel: 'intermediate',
      weekNumber: 1,
      totalWeeks: 4,
    })
    expect(result.weeklyTarget).toBeDefined()
    expect(result.weeklyTarget).toBeGreaterThan(0)
  })

  it('weeklyTarget on week 1 starts at MEV + 1', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'chest',
      experienceLevel: 'intermediate',
      weekNumber: 1,
      totalWeeks: 4,
    })
    expect(result.weeklyTarget).toBe(result.mev + 1)
  })

  it('weeklyTarget on final non-deload week reaches MAV', () => {
    // 4 weeks, no deload → week 4 should be MAV
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'chest',
      experienceLevel: 'intermediate',
      weekNumber: 4,
      totalWeeks: 4,
    })
    expect(result.weeklyTarget).toBe(result.mav)
  })

  it('deload week sets weeklyTarget to 60% of MEV', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'chest',
      experienceLevel: 'intermediate',
      weekNumber: 3,
      totalWeeks: 4,
      isDeload: true,
    })
    expect(result.weeklyTarget).toBe(Math.round(result.mev * 0.6))
  })

  it('does not include weeklyTarget when no weekNumber provided', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'chest',
      experienceLevel: 'intermediate',
    })
    expect(result.weeklyTarget).toBeUndefined()
  })

  it('rejects invalid experience level', () => {
    expect(() =>
      volumeLandmarksSkill.inputSchema.parse({
        muscleGroup: 'chest',
        experienceLevel: 'elite',
      }),
    ).toThrow()
  })

  it('all 19 known muscle groups return valid data for intermediate', () => {
    const groups = [
      'chest', 'back', 'upper_back', 'lats', 'shoulders', 'biceps', 'triceps',
      'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques',
      'traps', 'rear_delts', 'side_delts', 'front_delts', 'neck',
    ]
    for (const group of groups) {
      const result = volumeLandmarksSkill.execute({
        muscleGroup: group,
        experienceLevel: 'intermediate',
      })
      expect(result.mev).toBeGreaterThanOrEqual(0)
      expect(result.mav).toBeGreaterThan(0)
      expect(result.mrv).toBeGreaterThan(0)
    }
  })
})
