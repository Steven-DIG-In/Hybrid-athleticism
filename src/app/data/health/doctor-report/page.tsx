import { getDoctorReportSnapshot } from '@/lib/actions/health/doctor-report.actions'
import { DoctorReportPrintable } from '@/components/data/health/DoctorReportPrintable'
import Link from 'next/link'
import type { WindowPreset } from '@/lib/reports/types'

const PRESETS: WindowPreset[] = ['3mo', '6mo', '12mo']

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ preset?: string; start?: string; end?: string }> }) {
  const sp = await searchParams
  const preset = (PRESETS.includes(sp.preset as WindowPreset) ? sp.preset : '6mo') as WindowPreset
  const snapshot = await getDoctorReportSnapshot(
    preset === 'custom'
      ? { preset, start: sp.start, end: sp.end }
      : { preset }
  )

  const downloadHref = `/data/health/doctor-report/download?preset=${preset}` +
    (preset === 'custom' ? `&start=${sp.start}&end=${sp.end}` : '')

  return (
    <div className="animate-in fade-in duration-300">
      <nav className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur border-b border-neutral-800 p-3 flex items-center gap-3 print:hidden">
        <span className="text-sm text-neutral-400">Window:</span>
        {PRESETS.map(p => (
          <Link key={p} href={`?preset=${p}`}
            className={`text-sm px-2 py-1 rounded border ${p === preset ? 'border-amber-700 text-amber-500' : 'border-neutral-800 text-neutral-500'}`}>
            {p}
          </Link>
        ))}
        <div className="flex-1" />
        <a href={downloadHref}
          className="text-sm px-3 py-1 rounded bg-amber-900/50 border border-amber-800 text-amber-200">
          Download PDF
        </a>
      </nav>
      <DoctorReportPrintable snapshot={snapshot} />
    </div>
  )
}
