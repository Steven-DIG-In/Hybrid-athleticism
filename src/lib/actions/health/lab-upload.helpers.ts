import type {
  LabExtraction,
  LabMarker,
} from '@/lib/ingestion/lab-pdf-extractor'

export function classifyNeedsReview(markers: LabMarker[]): LabMarker[] {
  return markers.filter(
    (m) => m.value == null || m.unit == null || m.confidence === 'low'
  )
}

export type { LabExtraction, LabMarker }
