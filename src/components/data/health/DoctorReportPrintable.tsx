'use client'
import type { DoctorReportSnapshot } from '@/lib/reports/types'

export function DoctorReportPrintable({ snapshot }: { snapshot: DoctorReportSnapshot }) {
  const s = snapshot
  const printStyle = 'print:bg-white print:text-black'
  return (
    <article className={`max-w-3xl mx-auto p-6 bg-neutral-950 text-neutral-100 ${printStyle} print:p-8`}>
      <header className="pb-4 border-b border-neutral-800 mb-6">
        <h1 className="text-2xl font-space-grotesk">{s.athlete_name} — Health report</h1>
        <div className="text-sm text-neutral-400">
          Window: {s.window.start} to {s.window.end} · Generated {new Date(s.generated_at).toISOString().slice(0, 10)}
        </div>
        <div className="text-sm mt-2">{s.summary_line}</div>
      </header>

      <Section title="Bloodwork">
        {s.bloodwork_panels.length === 0 ? (
          <p className="text-sm text-neutral-500">No data in selected window.</p>
        ) : s.bloodwork_panels.map(p => (
          <div key={p.id} className="mb-6">
            <h3 className="font-medium mb-2">{p.panel_date} · {p.lab_name ?? 'Manual entry'}</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-500">
                  <th className="text-left">Marker</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Unit</th>
                  <th className="text-right">Range</th>
                </tr>
              </thead>
              <tbody>
                {p.markers.map(m => (
                  <tr key={m.name_en} className={m.out_of_range ? 'text-amber-500' : ''}>
                    <td>{m.name_en}</td>
                    <td className="text-right">{m.value ?? '—'}</td>
                    <td className="text-right">{m.unit ?? ''}</td>
                    <td className="text-right">{m.ref_low ?? '—'} – {m.ref_high ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Section>

      <Section title="Garmin daily trends">
        {s.garmin.sleep_daily.length === 0 ? (
          <p className="text-sm text-neutral-500">No data in selected window.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <MiniChart title="Sleep (min)" data={s.garmin.sleep_daily} />
            <MiniChart title="HRV" data={s.garmin.hrv_daily} />
            <MiniChart title="RHR" data={s.garmin.rhr_daily} />
            <MiniChart title="VO2 Max" data={s.garmin.vo2_trend} />
          </div>
        )}
      </Section>

      <Section title="Supplements">
        {s.supplements.length === 0 ? (
          <p className="text-sm text-neutral-500">No data in selected window.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {s.supplements.map(x => (
              <li key={x.name} className="flex justify-between">
                <span>{x.name} {x.dose ? `${x.dose}${x.dose_unit}` : ''} {x.timing.join(', ')}</span>
                <span className="text-xs text-neutral-500">{x.start_date}{x.end_date ? ` → ${x.end_date}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Medicals">
        {s.medicals.length === 0 ? (
          <p className="text-sm text-neutral-500">No data in selected window.</p>
        ) : s.medicals.map((e, i) => (
          <div key={i} className="mb-2">
            <div className="flex gap-2 text-xs">
              <span className="px-1 border border-neutral-700 rounded">{e.event_type}</span>
              <span>{e.event_date}</span>
            </div>
            <div>{e.title}</div>
            {e.details && <div className="text-sm text-neutral-400">{e.details}</div>}
          </div>
        ))}
      </Section>

      <Section title="Body composition">
        {s.body_comp.length === 0 ? (
          <p className="text-sm text-neutral-500">No data in selected window.</p>
        ) : (
          <table className="w-full text-xs">
            <thead><tr className="text-neutral-500">
              <th className="text-left">Date</th><th>Method</th>
              <th className="text-right">Weight (kg)</th><th className="text-right">BF %</th>
            </tr></thead>
            <tbody>
              {s.body_comp.map((b, i) => (
                <tr key={i}>
                  <td>{b.measured_on}</td><td className="text-center">{b.method}</td>
                  <td className="text-right">{b.weight_kg ?? '—'}</td>
                  <td className="text-right">{b.body_fat_pct ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <footer className="text-xs text-neutral-500 border-t border-neutral-800 pt-4 mt-8">
        Data sourced from user-uploaded lab reports and Garmin Connect. Not a medical diagnosis. Discuss abnormal values with physician.
      </footer>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-8"><h2 className="text-lg font-space-grotesk mb-3">{title}</h2>{children}</section>
}

function MiniChart({ title, data }: { title: string; data: { date: string; value: number }[] }) {
  if (data.length === 0) return <div className="text-xs text-neutral-500">{title}: no data</div>
  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  const range = max - min || 1
  const w = 200, h = 60
  const pts = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w
    const y = h - ((d.value - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <div>
      <div className="text-xs text-neutral-400 mb-1">{title}</div>
      <svg width={w} height={h}><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1" className="text-amber-700" /></svg>
    </div>
  )
}
