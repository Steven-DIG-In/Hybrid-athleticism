import { describe, it, expect } from 'vitest'
import { classifyNeedsReview } from '../lab-upload.helpers'
import type { LabExtraction } from '@/lib/ingestion/lab-pdf-extractor'

describe('classifyNeedsReview', () => {
  it('flags markers with low confidence OR missing unit OR missing value', () => {
    const extraction: LabExtraction = {
      document_type: 'lab_report',
      panel_date: '2026-03-15',
      lab_name: 'Synlab',
      markers: [
        {
          name_en: 'A',
          name_original: null,
          value: 12,
          unit: 'mg/dL',
          reference_range_low: 5,
          reference_range_high: 20,
          is_out_of_range: false,
          confidence: 'high',
          notes: null,
        },
        {
          name_en: 'B',
          name_original: null,
          value: null,
          unit: 'mg/dL',
          reference_range_low: 5,
          reference_range_high: 20,
          is_out_of_range: false,
          confidence: 'high',
          notes: null,
        },
        {
          name_en: 'C',
          name_original: null,
          value: 50,
          unit: null,
          reference_range_low: null,
          reference_range_high: null,
          is_out_of_range: false,
          confidence: 'high',
          notes: null,
        },
        {
          name_en: 'D',
          name_original: null,
          value: 30,
          unit: 'mg/dL',
          reference_range_low: 10,
          reference_range_high: 50,
          is_out_of_range: false,
          confidence: 'low',
          notes: null,
        },
      ],
    }
    const flagged = classifyNeedsReview(extraction.markers)
    expect(flagged.map((m) => m.name_en)).toEqual(['B', 'C', 'D'])
  })

  it('returns empty when nothing is flagged', () => {
    const markers: LabExtraction['markers'] = [
      {
        name_en: 'A',
        name_original: null,
        value: 12,
        unit: 'mg/dL',
        reference_range_low: 5,
        reference_range_high: 20,
        is_out_of_range: false,
        confidence: 'high',
        notes: null,
      },
    ]
    expect(classifyNeedsReview(markers)).toHaveLength(0)
  })
})
