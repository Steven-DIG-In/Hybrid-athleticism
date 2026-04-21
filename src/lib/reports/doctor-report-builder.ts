// src/lib/reports/doctor-report-builder.ts
import { createClient } from '@/lib/supabase/server'
import type { DoctorReportSnapshot, DoctorReportWindow, WindowPreset } from './types'

type ResolveArgs =
  | { preset: '3mo' | '6mo' | '12mo'; now?: Date }
  | { preset: 'custom'; start: string; end: string }

export function resolveWindow(args: ResolveArgs): DoctorReportWindow {
  if (args.preset === 'custom') {
    return { start: args.start, end: args.end, preset: 'custom' }
  }
  const now = args.now ?? new Date()
  const monthsBack = args.preset === '3mo' ? 3 : args.preset === '6mo' ? 6 : 12
  const start = new Date(now)
  start.setMonth(start.getMonth() - monthsBack)
  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
    preset: args.preset,
  }
}

export async function buildDoctorReportSnapshot(params: {
  userId: string
  window: DoctorReportWindow
}): Promise<DoctorReportSnapshot> {
  const { userId, window } = params
  const supabase = await createClient()

  // Athlete name
  const { data: profile } = await supabase
    .from('profiles').select('display_name').eq('id', userId).maybeSingle()
  const athleteName = profile?.display_name ?? 'Athlete'

  // Bloodwork panels + markers in window
  const { data: panels } = await supabase
    .from('lab_panels')
    .select('id, panel_date, lab_name, out_of_range_count')
    .eq('user_id', userId)
    .gte('panel_date', window.start).lte('panel_date', window.end)
    .order('panel_date', { ascending: false })

  const panelIds = (panels ?? []).map(p => p.id)
  const { data: markers } = panelIds.length
    ? await supabase.from('lab_markers').select('*').in('panel_id', panelIds).eq('status', 'confirmed')
    : { data: [] as any[] }

  const panelsByMarkers = (panels ?? []).map(p => ({
    id: p.id,
    panel_date: p.panel_date,
    lab_name: p.lab_name,
    out_of_range_count: p.out_of_range_count ?? 0,
    markers: (markers ?? []).filter(m => m.panel_id === p.id).map(m => ({
      name_en: m.name_en,
      name_original: m.name_original,
      value: m.value,
      unit: m.unit,
      ref_low: m.reference_range_low,
      ref_high: m.reference_range_high,
      out_of_range: !!m.is_out_of_range,
      panel_date: p.panel_date,
    })),
  }))

  // Trend series per marker name (only for markers appearing in 2+ panels)
  const trends: Record<string, { date: string; value: number }[]> = {}
  for (const m of markers ?? []) {
    if (m.value == null) continue
    const panelDate = (panels ?? []).find(p => p.id === m.panel_id)?.panel_date
    if (!panelDate) continue
    trends[m.name_en] ??= []
    trends[m.name_en].push({ date: panelDate, value: m.value })
  }
  const trendsFiltered: Record<string, { date: string; value: number }[]> = {}
  for (const [k, v] of Object.entries(trends)) {
    if (v.length >= 2) trendsFiltered[k] = v.sort((a, b) => a.date.localeCompare(b.date))
  }

  // Garmin daily series
  const { data: dailies } = await supabase
    .from('garmin_daily')
    .select('date, sleep_total_min, hrv_overnight_avg, resting_hr')
    .eq('user_id', userId)
    .gte('date', window.start).lte('date', window.end)
    .order('date', { ascending: true })

  const garmin = {
    sleep_daily: (dailies ?? []).map(d => ({ date: d.date, value: d.sleep_total_min ?? 0 })),
    hrv_daily: (dailies ?? []).map(d => ({ date: d.date, value: d.hrv_overnight_avg ?? 0 })),
    rhr_daily: (dailies ?? []).map(d => ({ date: d.date, value: d.resting_hr ?? 0 })),
    vo2_trend: [] as { date: string; value: number }[],
  }
  const { data: vo2 } = await supabase
    .from('garmin_vo2_trend').select('measured_on, vo2_max')
    .eq('user_id', userId)
    .gte('measured_on', window.start).lte('measured_on', window.end)
    .order('measured_on', { ascending: true })
  garmin.vo2_trend = (vo2 ?? []).map(r => ({ date: r.measured_on, value: r.vo2_max }))

  // Supplements: active at report-end AND started/ended in window
  const { data: supsAll } = await supabase
    .from('supplements').select('*')
    .eq('user_id', userId)
    .or(`end_date.is.null,and(end_date.gte.${window.start})`)

  const supplements = (supsAll ?? []).map(s => {
    const startedInWindow = s.start_date >= window.start && s.start_date <= window.end
    const endedInWindow = s.end_date && s.end_date >= window.start && s.end_date <= window.end
    const event: 'active' | 'started_in_window' | 'ended_in_window' =
      endedInWindow ? 'ended_in_window'
      : startedInWindow ? 'started_in_window'
      : 'active'
    return {
      name: s.name, dose: s.dose, dose_unit: s.dose_unit, timing: s.timing ?? [],
      start_date: s.start_date, end_date: s.end_date, notes: s.notes,
      event,
    }
  })

  // Medicals in window
  const { data: medicalsRows } = await supabase
    .from('medical_events').select('*')
    .eq('user_id', userId)
    .gte('event_date', window.start).lte('event_date', window.end)
    .order('event_date', { ascending: false })

  const medicals = (medicalsRows ?? []).map(e => ({
    event_type: e.event_type, event_date: e.event_date, title: e.title,
    details: e.details, structured_data: e.structured_data,
    has_attachment: !!e.attachment_path,
  }))

  // Body comp in window
  const { data: bcRows } = await supabase
    .from('body_composition_measurements').select('*')
    .eq('user_id', userId)
    .gte('measured_on', window.start).lte('measured_on', window.end)
    .order('measured_on', { ascending: true })

  const body_comp = (bcRows ?? []).map(b => ({
    measured_on: b.measured_on, method: b.method,
    weight_kg: b.weight_kg, body_fat_pct: b.body_fat_pct, lean_mass_kg: b.lean_mass_kg,
  }))

  const summary_line = buildSummaryLine({
    totalMarkers: (markers ?? []).length,
    panelCount: (panels ?? []).length,
    outOfRange: (panels ?? []).reduce((a, p) => a + (p.out_of_range_count ?? 0), 0),
    activeSupplements: supplements.filter(s => s.event === 'active').length,
    medicalCount: medicals.length,
  })

  return {
    generated_at: new Date().toISOString(),
    window,
    athlete_name: athleteName,
    summary_line,
    bloodwork_panels: panelsByMarkers,
    bloodwork_trends: trendsFiltered,
    garmin,
    supplements,
    medicals,
    body_comp,
  }
}

function buildSummaryLine(s: {
  totalMarkers: number; panelCount: number; outOfRange: number;
  activeSupplements: number; medicalCount: number;
}): string {
  return `${s.totalMarkers} bloodwork markers tracked across ${s.panelCount} panel${s.panelCount === 1 ? '' : 's'}; ${s.outOfRange} currently out of range. ${s.activeSupplements} active supplements. ${s.medicalCount} medical event${s.medicalCount === 1 ? '' : 's'} in window.`
}
