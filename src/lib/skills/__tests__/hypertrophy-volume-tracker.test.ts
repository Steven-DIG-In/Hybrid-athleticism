import { describe, it, expect } from 'vitest'
import { hypertrophyVolumeTrackerSkill } from '../domains/hypertrophy/hypertrophy-volume-tracker'

describe('hypertrophy-volume-tracker skill', () => {
  it('has correct metadata', () => {
    expect(hypertrophyVolumeTrackerSkill.name).toBe('hypertrophy-volume-tracker')
    expect(hypertrophyVolumeTrackerSkill.domain).toBe('hypertrophy')
    expect(hypertrophyVolumeTrackerSkill.tier).toBe(1)
  })

  it('counts sets per muscle group across multiple entries', () => {
    const result = hypertrophyVolumeTrackerSkill.execute({
      entries: [
        { muscleGroup: 'chest', sets: 4 },
        { muscleGroup: 'chest', sets: 3 },
        { muscleGroup: 'back', sets: 5 },
      ],
      experienceLevel: 'intermediate',
    })

    const chest = result.results.find(r => r.muscleGroup === 'chest')
    const back = result.results.find(r => r.muscleGroup === 'back')
    expect(chest?.currentSets).toBe(7)
    expect(back?.currentSets).toBe(5)
  })

  it('flags status below_mev when sets are too low', () => {
    // intermediate chest MEV is 8; use 2 sets
    const result = hypertrophyVolumeTrackerSkill.execute({
      entries: [{ muscleGroup: 'chest', sets: 2 }],
      experienceLevel: 'intermediate',
    })
    const chest = result.results.find(r => r.muscleGroup === 'chest')
    expect(chest?.status).toBe('below_mev')
  })

  it('flags status in_range when sets are between MEV and MAV', () => {
    // intermediate chest MEV=8, MAV=14; use 10 sets
    const result = hypertrophyVolumeTrackerSkill.execute({
      entries: [{ muscleGroup: 'chest', sets: 10 }],
      experienceLevel: 'intermediate',
    })
    const chest = result.results.find(r => r.muscleGroup === 'chest')
    expect(chest?.status).toBe('in_range')
  })

  it('flags approaching_mrv when sets are between MAV and MRV', () => {
    // intermediate chest MAV=14, MRV=20; use 17 sets
    const result = hypertrophyVolumeTrackerSkill.execute({
      entries: [{ muscleGroup: 'chest', sets: 17 }],
      experienceLevel: 'intermediate',
    })
    const chest = result.results.find(r => r.muscleGroup === 'chest')
    expect(chest?.status).toBe('approaching_mrv')
  })

  it('flags exceeds_mrv when sets exceed MRV', () => {
    // intermediate chest MRV=20; use 25 sets
    const result = hypertrophyVolumeTrackerSkill.execute({
      entries: [{ muscleGroup: 'chest', sets: 25 }],
      experienceLevel: 'intermediate',
    })
    const chest = result.results.find(r => r.muscleGroup === 'chest')
    expect(chest?.status).toBe('exceeds_mrv')
  })

  it('handles empty entries array', () => {
    const result = hypertrophyVolumeTrackerSkill.execute({
      entries: [],
      experienceLevel: 'beginner',
    })
    expect(result.results).toHaveLength(0)
  })

  it('normalizes muscle group names', () => {
    const result = hypertrophyVolumeTrackerSkill.execute({
      entries: [
        { muscleGroup: 'Upper Back', sets: 6 },
        { muscleGroup: 'upper_back', sets: 4 },
      ],
      experienceLevel: 'intermediate',
    })
    // Both should be merged as 'upper_back'
    expect(result.results).toHaveLength(1)
    expect(result.results[0].muscleGroup).toBe('upper_back')
    expect(result.results[0].currentSets).toBe(10)
  })

  it('returns mev/mav/mrv values in results', () => {
    const result = hypertrophyVolumeTrackerSkill.execute({
      entries: [{ muscleGroup: 'chest', sets: 10 }],
      experienceLevel: 'intermediate',
    })
    const chest = result.results[0]
    expect(chest.mev).toBe(8)
    expect(chest.mav).toBe(14)
    expect(chest.mrv).toBe(20)
  })
})
