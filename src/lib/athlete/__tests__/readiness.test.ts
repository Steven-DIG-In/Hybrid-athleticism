import { describe, it, expect, beforeEach, vi } from 'vitest'

const { selfReportRows, errorValue } = vi.hoisted(() => ({ selfReportRows: [] as any[], errorValue: { current: null as any } }))

vi.mock('@/lib/supabase/server', () => {
  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'athlete_self_reports') throw new Error(`unexpected table ${table}`)
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: selfReportRows, error: errorValue.current })),
            })),
          })),
        })),
      }
    }),
  }
  return { createClient: vi.fn(async () => client) }
})

import { getReadiness } from '../readiness'

describe('getReadiness', () => {
  beforeEach(() => { selfReportRows.length = 0; errorValue.current = null; vi.clearAllMocks() })

  it('returns UNKNOWN when there is no self-report data', async () => {
    const r = await getReadiness('u1')
    expect(r).toEqual({ status: 'UNKNOWN' })
  })

  it('returns a concrete status when a self-report exists', async () => {
    selfReportRows.push({ sleep_quality: 4, energy_level: 4, stress_level: 2, motivation: 4, soreness: {} })
    const r = await getReadiness('u1')
    expect(['GREEN', 'YELLOW', 'RED']).toContain((r as any).status)
    expect((r as any).score).toBeGreaterThanOrEqual(0)
    expect((r as any).score).toBeLessThanOrEqual(1)
  })

  it('degrades to UNKNOWN when the self-report query errors', async () => {
    errorValue.current = { message: 'db down' }
    const r = await getReadiness('u1')
    expect(r).toEqual({ status: 'UNKNOWN' })
  })
})
