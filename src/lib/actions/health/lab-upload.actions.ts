'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { extractFromBase64 } from '@/lib/ingestion/lab-pdf-extractor'

type UploadResult =
  | { ok: true; panelId: string }
  | { ok: false; error: string }

export async function uploadLabPDF(formData: FormData): Promise<UploadResult> {
  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'No file provided' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const bytes = await file.arrayBuffer()
  const filePath = `${user.id}/${Date.now()}-${file.name}`

  const { error: upErr } = await supabase.storage
    .from('lab-reports')
    .upload(filePath, bytes, { contentType: file.type })
  if (upErr) return { ok: false, error: upErr.message }

  const { data: panel, error: insErr } = await supabase
    .from('lab_panels')
    .insert({
      user_id: user.id,
      panel_date: new Date().toISOString().slice(0, 10),
      status: 'pending_extraction',
      original_file_path: filePath,
    })
    .select('id')
    .single()
  if (insErr || !panel) {
    return { ok: false, error: insErr?.message ?? 'Failed to insert panel' }
  }

  const base64 = Buffer.from(bytes).toString('base64')
  const mime: 'application/pdf' | 'image/jpeg' | 'image/png' =
    file.type === 'application/pdf'
      ? 'application/pdf'
      : file.type === 'image/jpeg'
        ? 'image/jpeg'
        : file.type === 'image/png'
          ? 'image/png'
          : 'application/pdf'

  const ext = await extractFromBase64({ base64, mimeType: mime })
  if (!ext.ok) {
    await supabase
      .from('lab_panels')
      .update({ status: 'failed', extraction_json: { error: ext.error } })
      .eq('id', panel.id)
    return { ok: false, error: ext.error }
  }

  const outOfRangeCount = ext.data.markers.filter((m) => m.is_out_of_range).length

  await supabase
    .from('lab_panels')
    .update({
      panel_date: ext.data.panel_date!,
      lab_name: ext.data.lab_name ?? null,
      status: 'needs_review',
      extraction_json: ext.data as unknown as Record<string, unknown>,
      out_of_range_count: outOfRangeCount,
    })
    .eq('id', panel.id)

  const markerRows = ext.data.markers.map((m) => ({
    panel_id: panel.id,
    user_id: user.id,
    name_en: m.name_en,
    name_original: m.name_original,
    value: m.value,
    unit: m.unit,
    reference_range_low: m.reference_range_low,
    reference_range_high: m.reference_range_high,
    is_out_of_range: m.is_out_of_range,
    confidence: m.confidence,
    status: 'needs_review' as const,
    notes: m.notes,
  }))
  if (markerRows.length > 0) {
    await supabase.from('lab_markers').insert(markerRows)
  }

  revalidatePath('/data/health/bloodwork')
  revalidatePath('/data/health')
  return { ok: true, panelId: panel.id }
}

type EditPatch = Partial<{
  value: number | null
  unit: string | null
  name_en: string
  reference_range_low: number | null
  reference_range_high: number | null
}>

export async function confirmPanel(
  panelId: string,
  action: 'all' | 'except_flagged',
  edits?: Record<string, EditPatch>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: markers } = await supabase
    .from('lab_markers')
    .select('*')
    .eq('panel_id', panelId)
  if (!markers) return { ok: false, error: 'No markers' }

  for (const m of markers) {
    const patch = edits?.[m.id]
    if (patch) {
      await supabase.from('lab_markers').update(patch).eq('id', m.id)
    }
  }

  const { data: refreshed } = await supabase
    .from('lab_markers')
    .select('*')
    .eq('panel_id', panelId)
  const all = refreshed ?? []
  const accepted = all.filter((m) => {
    if (action === 'all') return true
    return m.value != null && m.unit != null
  })

  if (accepted.length > 0) {
    await supabase
      .from('lab_markers')
      .update({ status: 'confirmed' })
      .in(
        'id',
        accepted.map((m) => m.id)
      )
  }

  const rejectedIds = all
    .filter((m) => !accepted.find((a) => a.id === m.id))
    .map((m) => m.id)
  if (rejectedIds.length > 0) {
    await supabase.from('lab_markers').delete().in('id', rejectedIds)
  }

  const oor = accepted.reduce((n, m) => n + (m.is_out_of_range ? 1 : 0), 0)
  await supabase
    .from('lab_panels')
    .update({ status: 'ready', out_of_range_count: oor })
    .eq('id', panelId)

  revalidatePath('/data/health/bloodwork')
  revalidatePath('/data/health')
  revalidatePath('/data')
  return { ok: true }
}

export async function rejectAndRetry(
  panelId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  await supabase.from('lab_markers').delete().eq('panel_id', panelId)
  await supabase
    .from('lab_panels')
    .update({ status: 'failed', extraction_json: null })
    .eq('id', panelId)
  revalidatePath('/data/health/bloodwork')
  return { ok: true }
}
