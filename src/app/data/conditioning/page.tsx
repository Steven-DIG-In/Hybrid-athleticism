// src/app/data/conditioning/page.tsx
import { createClient } from '@/lib/supabase/server'
import { PerformanceDeltaChart } from '@/components/data/domain/PerformanceDeltaChart'
import { PatternFlagCard } from '@/components/data/domain/PatternFlagCard'
import { detectPattern } from '@/lib/analytics/coach-bias'
import { getRecentCoachDeltaSeries } from '@/lib/analytics/shared/coach-domain'
import { redirect } from 'next/navigation'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const { data: logs } = await supabase
    .from('conditioning_logs').select('*')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)

  const series = await getRecentCoachDeltaSeries(user.id, 'conditioning', { limit: 20 })

  const points = series.slice().reverse().map(d => ({
    date: d.created_at.slice(0, 10),
    delta_pct: d.delta_pct,
  }))
  const flag = detectPattern(
    series.map(d => ({ delta_pct: d.delta_pct, workout_id: d.session_inventory_id })),
  )

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-space-grotesk">Conditioning</h1>
      <PatternFlagCard flag={flag} coach="conditioning" />
      <PerformanceDeltaChart title="Conditioning performance deltas" points={points} />
      <section>
        <h2 className="text-sm text-neutral-400 mb-2">Logs ({logs?.length ?? 0})</h2>
        {(logs ?? []).length === 0 ? (
          <div className="text-xs text-neutral-500">No conditioning_logs yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-neutral-500">
              <th className="text-left">Date</th><th>Format</th>
              <th>Rounds</th><th>Time</th><th>RPE</th>
            </tr></thead>
            <tbody>
              {logs!.map((l: any) => (
                <tr key={l.id} className="border-t border-neutral-900">
                  <td className="py-1">{l.created_at.slice(0, 10)}</td>
                  <td className="text-center">{l.workout_format}</td>
                  <td className="text-center">{l.result_rounds ?? '—'}</td>
                  <td className="text-center">{l.result_time_seconds ? `${l.result_time_seconds}s` : '—'}</td>
                  <td className="text-center">{l.perceived_effort_rpe ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
