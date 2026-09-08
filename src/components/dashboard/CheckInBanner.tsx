import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'

/**
 * Shown when the week's check-in is due and no self-report has been submitted.
 *
 * Static + server-rendered on purpose: it only links. The state transition happens on
 * submit (completeWeeklyCheckIn), never on merely viewing the dashboard.
 */
export function CheckInBanner({ weekNumber }: { weekNumber: number }) {
  return (
    <div className="border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 flex items-center gap-2 mb-3">
      <ClipboardCheck className="w-4 h-4 text-cyan-400 shrink-0" />
      <p className="text-[12px] font-inter text-neutral-200 flex-1">
        <span className="font-bold">Week {weekNumber}</span> is done. Two minutes on how it
        actually felt, and next week gets adjusted.
      </p>
      <Link
        href="/dashboard/check-in"
        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-mono uppercase tracking-wider transition-colors whitespace-nowrap"
      >
        Check in
      </Link>
    </div>
  )
}
