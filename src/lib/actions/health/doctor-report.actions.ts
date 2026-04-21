'use server'

import { createClient } from '@/lib/supabase/server'
import { buildDoctorReportSnapshot, resolveWindow } from '@/lib/reports/doctor-report-builder'
import type { DoctorReportSnapshot, WindowPreset } from '@/lib/reports/types'

const FIVE_MIN_MS = 5 * 60 * 1000

export async function getDoctorReportSnapshot(
  args: { preset: WindowPreset; start?: string; end?: string }
): Promise<DoctorReportSnapshot> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthenticated')

  const window = args.preset === 'custom'
    ? resolveWindow({ preset: 'custom', start: args.start!, end: args.end! })
    : resolveWindow({ preset: args.preset })

  // Reuse recent cached report only within 5 minutes, same window
  const { data: recent } = await supabase
    .from('doctor_reports').select('generated_at, snapshot_json')
    .eq('user_id', user.id)
    .eq('window_start', window.start).eq('window_end', window.end)
    .order('generated_at', { ascending: false }).limit(1).maybeSingle()

  if (recent && Date.now() - new Date(recent.generated_at).getTime() < FIVE_MIN_MS) {
    return recent.snapshot_json as DoctorReportSnapshot
  }

  return buildDoctorReportSnapshot({ userId: user.id, window })
}

export async function persistDoctorReport(args: {
  snapshot: DoctorReportSnapshot
  pdfFilePath: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const { data, error } = await supabase.from('doctor_reports').insert({
    user_id: user.id,
    window_start: args.snapshot.window.start,
    window_end: args.snapshot.window.end,
    window_preset: args.snapshot.window.preset,
    pdf_file_path: args.pdfFilePath,
    snapshot_json: args.snapshot as unknown as Record<string, unknown>,
  }).select('id').single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data.id }
}
