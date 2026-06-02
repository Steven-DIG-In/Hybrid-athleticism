import { describe, it, expect, beforeEach, vi } from 'vitest'

const { upsertsLog, selectRows } = vi.hoisted(() => ({
  upsertsLog: [] as any[],
  selectRows: [] as any[],
}))

vi.mock('@/lib/supabase/server', () => {
  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'athlete_capabilities') throw new Error(`unexpected table ${table}`)
      return {
        upsert: vi.fn((row: any) => { upsertsLog.push(row); return { error: null } }),
        select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: selectRows, error: null })) })),
      }
    }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  }
  return { createClient: vi.fn(async () => client) }
})

import { recordCapability, getCapabilities } from '../capabilities.actions'

describe('capabilities.actions', () => {
  beforeEach(() => { upsertsLog.length = 0; selectRows.length = 0; vi.clearAllMocks() })

  it('recordCapability upserts a canonical row with resolved key/family/unit', async () => {
    await recordCapability({ name: 'Squat', value: 132.5, source: 'recalibration', evidence: { driftPct: -0.05 } })
    expect(upsertsLog).toHaveLength(1)
    expect(upsertsLog[0]).toMatchObject({
      user_id: 'u1',
      capability_key: 'back_squat',
      family: 'strength',
      current_value: 132.5,
      unit: 'kg',
      source: 'recalibration',
      evidence: { driftPct: -0.05 },
    })
  })

  it('recordCapability is a no-op for unknown names (does not throw)', async () => {
    await recordCapability({ name: 'Sled Drag', value: 50, source: 'manual' })
    expect(upsertsLog).toHaveLength(0)
  })

  it('getCapabilities splits rows into strength + endurance families', async () => {
    selectRows.push(
      { capability_key: 'back_squat', family: 'strength', current_value: 120, unit: 'kg', source: 'onboarding', updated_at: 't1', evidence: {} },
      { capability_key: 'run_5k', family: 'endurance', current_value: 1500, unit: 'seconds', source: 'onboarding', updated_at: 't2', evidence: {} },
    )
    const caps = await getCapabilities('u1')
    expect(caps.strength).toHaveLength(1)
    expect(caps.strength[0]).toMatchObject({ key: 'back_squat', currentValueKg: 120, label: 'Back Squat' })
    expect(caps.endurance).toHaveLength(1)
    expect(caps.endurance[0]).toMatchObject({ key: 'run_5k', currentValueSeconds: 1500, label: 'Run 5km' })
  })
})
