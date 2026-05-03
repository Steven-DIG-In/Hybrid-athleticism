import { describe, it, expect, vi } from 'vitest'
import { LabExtractionSchema, extractFromBase64 } from '../lab-pdf-extractor'

describe('LabExtractionSchema', () => {
  it('parses a valid extraction payload', () => {
    const parsed = LabExtractionSchema.safeParse({
      document_type: 'lab_report',
      panel_date: '2026-03-15',
      lab_name: 'Synlab',
      markers: [
        {
          name_en: 'Ferritin',
          name_original: 'Ferritina',
          value: 12,
          unit: 'ng/mL',
          reference_range_low: 30,
          reference_range_high: 400,
          is_out_of_range: true,
          confidence: 'high',
          notes: null,
        },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects missing panel_date shape (not YYYY-MM-DD)', () => {
    const parsed = LabExtractionSchema.safeParse({
      document_type: 'lab_report',
      panel_date: 'March 15 2026',
      markers: [],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('extractFromBase64', () => {
  it('surfaces non-lab_report as error', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                document_type: 'other',
                panel_date: null,
                markers: [],
              }),
            },
          ],
        }),
      },
    }
    const res = await extractFromBase64({
      base64: 'abc',
      mimeType: 'application/pdf',
      client: fakeClient as never,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/lab report/i)
  })

  it('surfaces missing panel_date as error', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                document_type: 'lab_report',
                panel_date: null,
                lab_name: 'Synlab',
                markers: [],
              }),
            },
          ],
        }),
      },
    }
    const res = await extractFromBase64({
      base64: 'abc',
      mimeType: 'application/pdf',
      client: fakeClient as never,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/panel date/i)
  })

  it('returns parsed data on a valid lab_report', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                document_type: 'lab_report',
                panel_date: '2026-03-15',
                lab_name: 'Synlab',
                markers: [
                  {
                    name_en: 'Ferritin',
                    name_original: 'Ferritina',
                    value: 12,
                    unit: 'ng/mL',
                    reference_range_low: 30,
                    reference_range_high: 400,
                    is_out_of_range: true,
                    confidence: 'high',
                    notes: null,
                  },
                ],
              }),
            },
          ],
        }),
      },
    }
    const res = await extractFromBase64({
      base64: 'abc',
      mimeType: 'application/pdf',
      client: fakeClient as never,
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.panel_date).toBe('2026-03-15')
      expect(res.data.markers).toHaveLength(1)
      expect(res.data.markers[0].name_en).toBe('Ferritin')
    }
  })

  it('returns error when response is malformed JSON', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'not json at all' }],
        }),
      },
    }
    const res = await extractFromBase64({
      base64: 'abc',
      mimeType: 'application/pdf',
      client: fakeClient as never,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/malformed/i)
  })
})
