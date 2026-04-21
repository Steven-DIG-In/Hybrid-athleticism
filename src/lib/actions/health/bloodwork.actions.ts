'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { computeOutOfRange, type MarkerInput, type PanelManualInput } from './bloodwork.helpers'

export async function addPanelManual(
  input: PanelManualInput & { original_file_path?: string | null }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' as const }

  const outOfRangeCount = input.markers.reduce(
    (acc, m) => acc + (computeOutOfRange(m) ? 1 : 0), 0
  )

  const { data: panel, error: pErr } = await supabase
    .from('lab_panels')
    .insert({
      user_id: user.id,
      panel_date: input.panel_date,
      lab_name: input.lab_name ?? null,
      status: 'ready',
      out_of_range_count: outOfRangeCount,
      original_file_path: input.original_file_path ?? null,
    })
    .select('id').single()
  if (pErr) return { ok: false, error: pErr.message }

  const markersRows = input.markers.map(m => ({
    panel_id: panel.id,
    user_id: user.id,
    name_en: m.name_en,
    name_original: m.name_original ?? null,
    value: m.value,
    unit: m.unit,
    reference_range_low: m.ref_low,
    reference_range_high: m.ref_high,
    is_out_of_range: computeOutOfRange(m),
    confidence: 'high' as const,
    status: 'confirmed' as const,
    notes: m.notes ?? null,
  }))

  const { error: mErr } = await supabase.from('lab_markers').insert(markersRows)
  if (mErr) return { ok: false, error: mErr.message }

  revalidatePath('/data/health/bloodwork')
  revalidatePath('/data/health')
  revalidatePath('/data')
  return { ok: true, id: panel.id }
}

export async function listPanels() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lab_panels').select('*').order('panel_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function getPanelWithMarkers(panelId: string) {
  const supabase = await createClient()
  const [pRes, mRes] = await Promise.all([
    supabase.from('lab_panels').select('*').eq('id', panelId).single(),
    supabase.from('lab_markers').select('*').eq('panel_id', panelId).order('name_en'),
  ])
  if (pRes.error) throw new Error(pRes.error.message)
  if (mRes.error) throw new Error(mRes.error.message)
  return { panel: pRes.data, markers: mRes.data }
}
