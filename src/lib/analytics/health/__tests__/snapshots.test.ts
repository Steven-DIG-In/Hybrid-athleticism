import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => {
  // A chainable query builder whose terminal methods all return empty data
  function makeChain(): any {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      is: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      // Terminal: used by bloodwork, medicals, body-comp
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      // Terminal: used by garmin (awaited after .order)
      then: (resolve: any, reject: any) =>
        Promise.resolve({ data: [], count: 0, error: null }).then(resolve, reject),
    }
    return chain
  }

  const client = {
    from: vi.fn(() => makeChain()),
  }

  return { createClient: vi.fn(async () => client) }
})

import { latestBloodworkSnapshot } from '../bloodwork-snapshot'
import { garminSevenDayTrends } from '../garmin-trends'
import { activeSupplementsSnapshot } from '../supplements-snapshot'
import { latestMedicalsSnapshot } from '../medicals-snapshot'
import { latestBodyCompSnapshot } from '../body-comp-snapshot'

const userId = 'test-user-empty'

describe('health analytics snapshots — empty-state defaults', () => {
  it('latestBloodworkSnapshot returns null panel and zero out-of-range', async () => {
    const result = await latestBloodworkSnapshot(userId)
    expect(result).toEqual({ last_panel_date: null, out_of_range_count: 0 })
  })

  it('garminSevenDayTrends returns flat trends and null last_synced', async () => {
    const result = await garminSevenDayTrends(userId)
    expect(result.last_synced).toBeNull()
    expect(result.sleep_trend).toBe('flat')
    expect(result.hrv_trend).toBe('flat')
    expect(result.rhr_trend).toBe('flat')
  })

  it('activeSupplementsSnapshot returns count of 0', async () => {
    const result = await activeSupplementsSnapshot(userId)
    expect(result.count).toBe(0)
  })

  it('latestMedicalsSnapshot returns null event fields', async () => {
    const result = await latestMedicalsSnapshot(userId)
    expect(result.last_event_date).toBeNull()
    expect(result.last_event_type).toBeNull()
    expect(result.last_event_title).toBeNull()
  })

  it('latestBodyCompSnapshot returns null latest', async () => {
    const result = await latestBodyCompSnapshot(userId)
    expect(result.latest).toBeNull()
  })
})
