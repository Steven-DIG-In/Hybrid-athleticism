import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    panelInsertPayload: null as any,
    markerInsertPayload: null as any[] | null,
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'lab_panels') {
        return {
          insert: vi.fn((row: any) => {
            state.panelInsertPayload = row
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: 'panel-1' },
                  error: null,
                })),
              })),
            }
          }),
          select: vi.fn(() => ({
            order: vi.fn(async () => ({ data: [], error: null })),
          })),
          // for getPanelWithMarkers
          // select chain with .eq().single()
        }
      }
      if (table === 'lab_markers') {
        return {
          insert: vi.fn(async (rows: any[]) => {
            state.markerInsertPayload = rows
            return { error: null }
          }),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        }
      }
      return {}
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
    },
  }
  return { createClient: vi.fn(async () => client) }
})

import {
  computeOutOfRange,
  addPanelManual,
  type MarkerInput,
} from '../bloodwork.actions'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function marker(overrides: Partial<MarkerInput> = {}): MarkerInput {
  return {
    name_en: 'Glucose',
    value: 5.0,
    unit: 'mmol/L',
    ref_low: 3.9,
    ref_high: 6.1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeOutOfRange
// ---------------------------------------------------------------------------

describe('computeOutOfRange', () => {
  it('returns true when value is below ref_low', () => {
    expect(computeOutOfRange(marker({ value: 3.0, ref_low: 3.9, ref_high: 6.1 }))).toBe(true)
  })

  it('returns true when value is above ref_high', () => {
    expect(computeOutOfRange(marker({ value: 7.0, ref_low: 3.9, ref_high: 6.1 }))).toBe(true)
  })

  it('returns false when value is in range', () => {
    expect(computeOutOfRange(marker({ value: 5.0, ref_low: 3.9, ref_high: 6.1 }))).toBe(false)
  })

  it('returns false when value is null', () => {
    expect(computeOutOfRange(marker({ value: null }))).toBe(false)
  })

  it('returns false when ref_low is null and only ref_high is defined and value is above 0', () => {
    // value=2 is below ref_high=6.1, ref_low=null → only high boundary active → false
    expect(computeOutOfRange(marker({ value: 2, ref_low: null, ref_high: 6.1 }))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// addPanelManual
// ---------------------------------------------------------------------------

describe('addPanelManual', () => {
  beforeEach(() => {
    state.panelInsertPayload = null
    state.markerInsertPayload = null
    vi.clearAllMocks()
  })

  it('inserts panel with status:ready and correct out_of_range_count', async () => {
    const markers: MarkerInput[] = [
      marker({ value: 3.0, ref_low: 3.9, ref_high: 6.1 }), // out of range
      marker({ value: 5.0, ref_low: 3.9, ref_high: 6.1 }), // in range
      marker({ value: 7.5, ref_low: 3.9, ref_high: 6.1 }), // out of range
    ]
    const result = await addPanelManual({
      panel_date: '2026-04-01',
      lab_name: 'LabCorp',
      markers,
    })

    expect(result.ok).toBe(true)
    expect(state.panelInsertPayload).toMatchObject({
      user_id: 'u1',
      panel_date: '2026-04-01',
      lab_name: 'LabCorp',
      status: 'ready',
      out_of_range_count: 2,
    })
  })

  it('inserts N marker rows with correct fields', async () => {
    const markers: MarkerInput[] = [
      marker({ name_en: 'Glucose', value: 3.0, ref_low: 3.9, ref_high: 6.1, unit: 'mmol/L' }),
      marker({ name_en: 'HbA1c', value: 5.5, ref_low: null, ref_high: 6.5, unit: '%' }),
    ]
    await addPanelManual({ panel_date: '2026-04-01', markers })

    expect(state.markerInsertPayload).toHaveLength(2)
    const payload = state.markerInsertPayload!

    // First marker is out of range
    expect(payload[0]).toMatchObject({
      panel_id: 'panel-1',
      user_id: 'u1',
      name_en: 'Glucose',
      is_out_of_range: true,
      confidence: 'high',
      status: 'confirmed',
      reference_range_low: 3.9,
      reference_range_high: 6.1,
      unit: 'mmol/L',
    })

    // Second marker is in range
    expect(payload[1]).toMatchObject({
      panel_id: 'panel-1',
      user_id: 'u1',
      name_en: 'HbA1c',
      is_out_of_range: false,
      confidence: 'high',
      status: 'confirmed',
      reference_range_low: null,
      reference_range_high: 6.5,
    })
  })

  it('returns { ok:false, error:"unauthenticated" } when no user', async () => {
    const mod: any = await import('@/lib/supabase/server')
    const c = await mod.createClient()
    const orig = c.auth.getUser
    c.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
    try {
      const result = await addPanelManual({
        panel_date: '2026-04-01',
        markers: [marker()],
      })
      expect(result.ok).toBe(false)
      expect('error' in result && result.error).toBe('unauthenticated')
    } finally {
      c.auth.getUser = orig
    }
  })
})
