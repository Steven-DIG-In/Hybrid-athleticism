import { createElement } from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getDoctorReportSnapshot, persistDoctorReport,
} from '@/lib/actions/health/doctor-report.actions'
import { DoctorReportPDF } from '@/lib/reports/doctor-report-pdf'
import { renderToBuffer } from '@react-pdf/renderer'
import type { WindowPreset } from '@/lib/reports/types'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const preset = (sp.get('preset') ?? '6mo') as WindowPreset
  const start = sp.get('start') ?? undefined
  const end = sp.get('end') ?? undefined

  const snapshot = await getDoctorReportSnapshot(
    preset === 'custom' ? { preset, start, end } : { preset }
  )

  const pdfBuffer = await renderToBuffer(createElement(DoctorReportPDF, { snapshot }))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const filePath = `${user.id}/${Date.now()}.pdf`
  const { error: upErr } = await supabase.storage
    .from('doctor-reports').upload(filePath, pdfBuffer, { contentType: 'application/pdf' })

  await persistDoctorReport({
    snapshot,
    pdfFilePath: upErr ? null : filePath,
  })

  const filename = `health-report-${snapshot.window.start}_to_${snapshot.window.end}.pdf`
  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
