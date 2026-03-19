import { describe, it, expect } from 'vitest'
import { zoneDistributorSkill } from '../domains/endurance/zone-distributor'

describe('zone-distributor skill', () => {
  it('has correct metadata', () => {
    expect(zoneDistributorSkill.name).toBe('zone-distributor')
    expect(zoneDistributorSkill.domain).toBe('endurance')
    expect(zoneDistributorSkill.tier).toBe(1)
  })

  it('splits 300 minutes into 240 easy and 60 hard', () => {
    const result = zoneDistributorSkill.execute({ weeklyEnduranceMinutes: 300 })
    expect(result.easyMinutes).toBe(240)
    expect(result.hardMinutes).toBe(60)
  })

  it('percentages are always 80 easy and 20 hard', () => {
    const result = zoneDistributorSkill.execute({ weeklyEnduranceMinutes: 150 })
    expect(result.easyPercent).toBe(80)
    expect(result.hardPercent).toBe(20)
  })

  it('easyMinutes + hardMinutes equals total input minutes (300)', () => {
    const result = zoneDistributorSkill.execute({ weeklyEnduranceMinutes: 300 })
    expect(result.easyMinutes + result.hardMinutes).toBe(300)
  })

  it('handles 10 minutes correctly', () => {
    const result = zoneDistributorSkill.execute({ weeklyEnduranceMinutes: 10 })
    expect(result.easyMinutes).toBe(8)
    expect(result.hardMinutes).toBe(2)
    expect(result.easyMinutes + result.hardMinutes).toBe(10)
  })

  it('handles odd numbers — total always preserved', () => {
    const result = zoneDistributorSkill.execute({ weeklyEnduranceMinutes: 75 })
    expect(result.easyMinutes + result.hardMinutes).toBe(75)
  })

  it('rejects zero minutes', () => {
    expect(() =>
      zoneDistributorSkill.inputSchema.parse({ weeklyEnduranceMinutes: 0 }),
    ).toThrow()
  })

  it('rejects negative minutes', () => {
    expect(() =>
      zoneDistributorSkill.inputSchema.parse({ weeklyEnduranceMinutes: -30 }),
    ).toThrow()
  })
})
