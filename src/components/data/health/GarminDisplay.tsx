'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { resyncNow } from '@/lib/actions/health/garmin.actions'

type Creds = { last_sync_at: string | null; last_sync_status: string | null } | null
type Daily = {
  date: string; sleep_total_min: number | null; hrv_overnight_avg: number | null;
  resting_hr: number | null; body_battery_min: number | null; stress_avg: number | null
}
type Vo2 = { measured_on: string; modality: string; vo2_max: number }

export function GarminDisplay({ creds, dailies, vo2 }: { creds: Creds; dailies: Daily[]; vo2: Vo2[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleResync() {
    setError(null)
    startTransition(async () => {
      const res = await resyncNow()
      if (!res.ok) setError(res.error ?? 'resync failed')
      else router.refresh()
    })
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk">Garmin</h1>
        {!creds ? (
          <Link href="/data/health/garmin/connect" className="text-sm text-amber-500">
            Connect
          </Link>
        ) : (
          <button
            onClick={handleResync}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-sm text-amber-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? 'Resyncing...' : 'Resync now'}
          </button>
        )}
      </div>
      {error && <div className="text-xs text-amber-500">{error}</div>}
      {!creds && (
        <div className="p-6 border border-neutral-800 rounded text-center text-sm text-neutral-500">
          Not connected.{' '}
          <Link href="/data/health/garmin/connect" className="text-amber-500">
            Connect your Garmin account
          </Link>{' '}
          to enable daily auto-sync.
        </div>
      )}
      {creds && (
        <div className="text-xs text-neutral-500">
          Last synced: {creds.last_sync_at ?? 'never'} · Status: {creds.last_sync_status ?? '—'}
        </div>
      )}
      {dailies.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-neutral-500">
            <th className="text-left py-1">Date</th><th>Sleep</th><th>HRV</th>
            <th>RHR</th><th>Body Battery</th><th>Stress</th>
          </tr></thead>
          <tbody>
            {dailies.map(d => (
              <tr key={d.date} className="border-t border-neutral-900">
                <td className="py-1">{d.date}</td>
                <td className="text-center">{d.sleep_total_min ?? '—'}</td>
                <td className="text-center">{d.hrv_overnight_avg ?? '—'}</td>
                <td className="text-center">{d.resting_hr ?? '—'}</td>
                <td className="text-center">{d.body_battery_min ?? '—'}</td>
                <td className="text-center">{d.stress_avg ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {vo2.length > 0 && (
        <section>
          <h2 className="text-sm text-neutral-400 mb-2">VO2 Max trend</h2>
          {vo2.map(v => (
            <div key={v.measured_on} className="text-xs text-neutral-500">
              {v.measured_on} · {v.modality} · {v.vo2_max}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
