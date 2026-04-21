'use client'
import Link from 'next/link'
import { FileText, Droplet, Pill, Stethoscope, Watch, Scale } from 'lucide-react'

type Snapshot = {
  bloodwork: { last_panel_date: string | null; out_of_range_count: number }
  garmin: {
    last_synced: string | null
    sleep_trend?: string
    hrv_trend?: string
    rhr_trend?: string
  }
  activeSupplements: number
  medicals: { last_event_date: string | null; last_event_type: string | null }
  bodyComp: { latest: { measured_on: string; weight_kg: number | null; body_fat_pct: number | null } | null }
}

function Card(props: { href: string; icon: React.ReactNode; title: string; status: string }) {
  return (
    <Link href={props.href} className="block p-4 rounded-lg border border-neutral-800 bg-neutral-950 hover:border-amber-900 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        {props.icon}
        <h3 className="text-sm font-space-grotesk text-neutral-200">{props.title}</h3>
      </div>
      <div className="text-xs text-neutral-400">{props.status}</div>
    </Link>
  )
}

export function HealthLanding(s: Snapshot) {
  const bwStatus = s.bloodwork.last_panel_date
    ? `${s.bloodwork.last_panel_date} · ${s.bloodwork.out_of_range_count} out of range`
    : 'No panels yet'
  const medStatus = s.medicals.last_event_date
    ? `${s.medicals.last_event_type} on ${s.medicals.last_event_date}`
    : 'No events logged'
  const bcStatus = s.bodyComp.latest
    ? `${s.bodyComp.latest.weight_kg ?? '—'}kg · ${s.bodyComp.latest.body_fat_pct ?? '—'}%`
    : 'No measurements yet'
  const garminStatus = s.garmin.last_synced
    ? `Last synced ${s.garmin.last_synced}`
    : 'Not connected'

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk text-neutral-100">Health</h1>
        <Link href="/data/health/doctor-report"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-900/30 border border-amber-800 text-amber-200 text-sm">
          <FileText className="w-4 h-4" /> Generate doctor report
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card href="/data/health/bloodwork" icon={<Droplet className="w-4 h-4 text-amber-600" />} title="Bloodwork" status={bwStatus} />
        <Card href="/data/health/supplements" icon={<Pill className="w-4 h-4 text-amber-600" />} title="Supplements" status={`${s.activeSupplements} active`} />
        <Card href="/data/health/medicals" icon={<Stethoscope className="w-4 h-4 text-amber-600" />} title="Medicals" status={medStatus} />
        <Card href="/data/health/garmin" icon={<Watch className="w-4 h-4 text-amber-600" />} title="Garmin" status={garminStatus} />
        <Card href="/data/health/body-comp" icon={<Scale className="w-4 h-4 text-amber-600" />} title="Body Composition" status={bcStatus} />
      </div>
    </div>
  )
}
