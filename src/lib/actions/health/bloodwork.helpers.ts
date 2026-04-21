export interface MarkerInput {
  name_en: string
  name_original?: string | null
  value: number | null
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  notes?: string | null
}

export interface PanelManualInput {
  panel_date: string
  lab_name?: string | null
  markers: MarkerInput[]
}

export function computeOutOfRange(m: MarkerInput): boolean {
  if (m.value == null) return false
  if (m.ref_low != null && m.value < m.ref_low) return true
  if (m.ref_high != null && m.value > m.ref_high) return true
  return false
}
