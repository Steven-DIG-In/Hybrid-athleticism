import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LabExtraction } from '@/lib/ingestion/lab-pdf-extractor'

/**
 * Integration test covering the full upload → review → confirm flow.
 *
 * Uses an in-memory Supabase mock (vi.hoisted) rather than the live DB —
 * Steven's single-user production rows must not be touched by test cleanup.
 * The mock extractor returns a fixed 2-marker payload: one high-confidence
 * out-of-range marker (Ferritin), one low-confidence marker with missing
 * value + unit (Unknown).
 */

const { store } = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id?: string }
  const tables: Record<string, Row[]> = {
    lab_panels: [],
    lab_markers: [],
  }
  let seq = 0
  return {
    store: {
      tables,
      reset() {
        tables.lab_panels = []
        tables.lab_markers = []
        seq = 0
      },
      nextId() {
        seq += 1
        return `id-${seq}`
      },
    },
  }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
  function query(table: string) {
    let rows = store.tables[table] ?? []
    let filtered: typeof rows = [...rows]

    const api = {
      select: (_cols?: string) => api,
      insert: (row: unknown) => {
        const toInsert = Array.isArray(row) ? row : [row]
        const inserted = toInsert.map((r) => ({
          id: store.nextId(),
          ...(r as Record<string, unknown>),
        }))
        store.tables[table] = [...(store.tables[table] ?? []), ...inserted]
        rows = store.tables[table]
        filtered = inserted
        return {
          select: (_c?: string) => ({
            single: async () => ({
              data: filtered[0] ?? null,
              error: filtered[0] ? null : { message: 'no insert' },
            }),
          }),
          then: (resolve: (v: { data: unknown; error: null }) => void) =>
            resolve({ data: inserted, error: null }),
        }
      },
      update: (patch: Record<string, unknown>) => {
        return {
          eq: async (col: string, val: unknown) => {
            const list = store.tables[table] ?? []
            for (const r of list) {
              if (r[col] === val) Object.assign(r, patch)
            }
            return { data: null, error: null }
          },
          in: async (col: string, vals: unknown[]) => {
            const list = store.tables[table] ?? []
            for (const r of list) {
              if (vals.includes(r[col])) Object.assign(r, patch)
            }
            return { data: null, error: null }
          },
        }
      },
      delete: () => ({
        eq: async (col: string, val: unknown) => {
          store.tables[table] = (store.tables[table] ?? []).filter(
            (r) => r[col] !== val
          )
          return { data: null, error: null }
        },
        in: async (col: string, vals: unknown[]) => {
          store.tables[table] = (store.tables[table] ?? []).filter(
            (r) => !vals.includes(r[col])
          )
          return { data: null, error: null }
        },
      }),
      eq: (col: string, val: unknown) => {
        filtered = filtered.filter((r) => r[col] === val)
        const chain = {
          maybeSingle: async () => ({
            data: filtered[0] ?? null,
            error: null,
          }),
          single: async () => ({
            data: filtered[0] ?? null,
            error: filtered[0] ? null : { message: 'not found' },
          }),
          order: (_col: string, _opts?: unknown) => chain,
          then: (
            resolve: (v: { data: unknown[]; error: null }) => void
          ) => resolve({ data: filtered, error: null }),
        }
        return chain
      },
    }
    return api
  }

  const client = {
    from: vi.fn((t: string) => query(t)),
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: 'x' }, error: null }),
      }),
    },
  }
  return { createClient: vi.fn(async () => client) }
})

const { MOCK_EXTRACTION } = vi.hoisted(() => ({
  MOCK_EXTRACTION: {
    document_type: 'lab_report',
    panel_date: '2026-03-15',
    lab_name: 'TestLab',
    markers: [
      {
        name_en: 'Ferritin',
        name_original: 'Ferritina',
        value: 12,
        unit: 'ng/mL',
        reference_range_low: 30,
        reference_range_high: 400,
        is_out_of_range: true,
        confidence: 'high' as const,
        notes: null,
      },
      {
        name_en: 'Unknown',
        name_original: null,
        value: null,
        unit: null,
        reference_range_low: null,
        reference_range_high: null,
        is_out_of_range: false,
        confidence: 'low' as const,
        notes: null,
      },
    ],
  } satisfies LabExtraction,
}))

vi.mock('@/lib/ingestion/lab-pdf-extractor', () => ({
  extractFromBase64: vi
    .fn()
    .mockResolvedValue({ ok: true, data: MOCK_EXTRACTION }),
}))

import { uploadLabPDF, confirmPanel } from '../lab-upload.actions'

describe('lab upload integration (mocked)', () => {
  beforeEach(() => {
    store.reset()
    vi.clearAllMocks()
  })

  it('uploads → seeds needs_review markers → confirm except_flagged keeps only the valid high-confidence marker', async () => {
    const fd = new FormData()
    fd.set(
      'file',
      new File(['%PDF-1.7'], 'test.pdf', { type: 'application/pdf' })
    )

    const up = await uploadLabPDF(fd)
    expect(up.ok).toBe(true)
    if (!up.ok) return

    expect(store.tables.lab_panels).toHaveLength(1)
    expect(store.tables.lab_markers).toHaveLength(2)
    expect(
      store.tables.lab_markers.every((m) => m.status === 'needs_review')
    ).toBe(true)
    expect(store.tables.lab_panels[0].status).toBe('needs_review')
    expect(store.tables.lab_panels[0].out_of_range_count).toBe(1)
    expect(store.tables.lab_panels[0].panel_date).toBe('2026-03-15')

    const cf = await confirmPanel(up.panelId, 'except_flagged')
    expect(cf.ok).toBe(true)

    // Unknown (null value/unit) should have been deleted; Ferritin kept + confirmed.
    expect(store.tables.lab_markers).toHaveLength(1)
    expect(store.tables.lab_markers[0].name_en).toBe('Ferritin')
    expect(store.tables.lab_markers[0].status).toBe('confirmed')

    const panel = store.tables.lab_panels[0]
    expect(panel.status).toBe('ready')
    expect(panel.out_of_range_count).toBe(1)
  })

  it('accept-all keeps both markers and marks panel ready', async () => {
    const fd = new FormData()
    fd.set(
      'file',
      new File(['%PDF-1.7'], 'test.pdf', { type: 'application/pdf' })
    )
    const up = await uploadLabPDF(fd)
    expect(up.ok).toBe(true)
    if (!up.ok) return

    const cf = await confirmPanel(up.panelId, 'all')
    expect(cf.ok).toBe(true)
    expect(store.tables.lab_markers).toHaveLength(2)
    expect(
      store.tables.lab_markers.every((m) => m.status === 'confirmed')
    ).toBe(true)
    expect(store.tables.lab_panels[0].status).toBe('ready')
  })
})
