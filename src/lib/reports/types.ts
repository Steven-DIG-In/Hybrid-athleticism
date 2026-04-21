// src/lib/reports/types.ts
export type WindowPreset = '3mo' | '6mo' | '12mo' | 'custom'

export interface DoctorReportWindow {
  start: string // ISO date
  end: string
  preset: WindowPreset
}

export interface MarkerRow {
  name_en: string
  name_original: string | null
  value: number | null
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  out_of_range: boolean
  panel_date: string
}

export interface PanelSummary {
  id: string
  panel_date: string
  lab_name: string | null
  out_of_range_count: number
  markers: MarkerRow[]
}

export interface TrendPoint { date: string; value: number }

export interface GarminSection {
  sleep_daily: TrendPoint[] // total minutes
  hrv_daily: TrendPoint[]
  rhr_daily: TrendPoint[]
  vo2_trend: TrendPoint[]
}

export interface SupplementRow {
  name: string
  dose: number | null
  dose_unit: string | null
  timing: string[]
  start_date: string
  end_date: string | null
  notes: string | null
  event: 'active' | 'started_in_window' | 'ended_in_window'
}

export interface MedicalEventRow {
  event_type: string
  event_date: string
  title: string
  details: string | null
  structured_data: Record<string, unknown> | null
  has_attachment: boolean
}

export interface BodyCompRow {
  measured_on: string
  method: string
  weight_kg: number | null
  body_fat_pct: number | null
  lean_mass_kg: number | null
}

export interface DoctorReportSnapshot {
  generated_at: string
  window: DoctorReportWindow
  athlete_name: string
  summary_line: string
  bloodwork_panels: PanelSummary[]
  bloodwork_trends: Record<string, TrendPoint[]> // key = name_en
  garmin: GarminSection
  supplements: SupplementRow[]
  medicals: MedicalEventRow[]
  body_comp: BodyCompRow[]
}
