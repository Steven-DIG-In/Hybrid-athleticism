'use client'

type Creds = { last_sync_at: string | null; last_sync_status: string | null } | null
type Daily = {
  date: string; sleep_total_min: number | null; hrv_overnight_avg: number | null;
  resting_hr: number | null; body_battery_min: number | null; stress_avg: number | null
}
type Vo2 = { measured_on: string; modality: string; vo2_max: number }

export function GarminDisplay({ creds, dailies, vo2 }: { creds: Creds; dailies: Daily[]; vo2: Vo2[] }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk">Garmin</h1>
        {!creds && (
          <a
            href="/data/health/garmin/connect"
            className="text-sm text-amber-500 opacity-50 pointer-events-none"
            title="Available in Plan 3 (auto-ingestion)"
          >Connect (coming soon)</a>
        )}
      </div>
      {!creds && (
        <div className="p-6 border border-neutral-800 rounded text-center text-sm text-neutral-500">
          Not connected. Garmin auto-sync arrives with Plan 3.
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
