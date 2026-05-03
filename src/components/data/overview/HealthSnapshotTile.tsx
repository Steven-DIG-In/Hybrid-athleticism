'use client'

import Link from 'next/link'
import { Activity, ArrowDown, ArrowUp, Minus, FileText } from 'lucide-react'
import type { BloodworkSnapshot } from '@/lib/analytics/health/bloodwork-snapshot'
import type { GarminTrends } from '@/lib/analytics/health/garmin-trends'

function TrendIcon({ t }: { t: 'up' | 'down' | 'flat' }) {
  if (t === 'up') return <ArrowUp className="w-3 h-3 text-emerald-500" />
  if (t === 'down') return <ArrowDown className="w-3 h-3 text-amber-500" />
  return <Minus className="w-3 h-3 text-neutral-500" />
}

export function HealthSnapshotTile(props: {
  bloodwork: BloodworkSnapshot
  garmin: GarminTrends
  activeSupplements: number
}) {
  const { bloodwork, garmin, activeSupplements } = props
  const daysSince = bloodwork.last_panel_date
    ? Math.floor(
        (Date.now() - new Date(bloodwork.last_panel_date).getTime()) / 86400000
      )
    : null

  return (
    <div className="relative rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-amber-900 transition-colors">
      <Link
        href="/data/health"
        aria-label="Open Health overview"
        className="absolute inset-0 z-0 rounded-lg"
      />
      <div className="relative z-10 flex items-center justify-between mb-3 pointer-events-none">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-space-grotesk text-neutral-200">Health</h3>
        </div>
        <Link
          href="/data/health/doctor-report"
          className="pointer-events-auto text-xs flex items-center gap-1 text-amber-600 hover:text-amber-500"
        >
          <FileText className="w-3 h-3" /> Report
        </Link>
      </div>
      <div className="relative z-10 space-y-1.5 text-xs text-neutral-400 pointer-events-none">
        <div>
          {bloodwork.last_panel_date
            ? `Last panel ${daysSince}d ago · ${bloodwork.out_of_range_count} markers out of range`
            : 'No bloodwork yet'}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            Sleep <TrendIcon t={garmin.sleep_trend} />
          </span>
          <span className="flex items-center gap-1">
            HRV <TrendIcon t={garmin.hrv_trend} />
          </span>
          <span className="flex items-center gap-1">
            RHR <TrendIcon t={garmin.rhr_trend} />
          </span>
        </div>
        <div>{activeSupplements} active supplements</div>
      </div>
    </div>
  )
}
