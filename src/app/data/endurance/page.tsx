import { AlertTriangle } from 'lucide-react'
import { getEnduranceAnalytics } from '@/lib/actions/data.actions'
import { EnduranceDashboard } from '@/components/data/EnduranceDashboard'
import { getRecentEnduranceDeltaSeries } from '@/lib/analytics/shared/endurance-series'
import { detectPattern } from '@/lib/analytics/coach-bias'
import { createClient } from '@/lib/supabase/server'
import { PerformanceDeltaChart } from '@/components/data/domain/PerformanceDeltaChart'
import { PatternFlagCard } from '@/components/data/domain/PatternFlagCard'

export default async function EndurancePage() {
    const result = await getEnduranceAnalytics()

    if (!result.success) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                <p className="text-sm text-neutral-400 font-mono">{result.error}</p>
            </div>
        )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // user is guaranteed non-null because getEnduranceAnalytics already succeeded.
    // getRecentEnduranceDeltaSeries already returns points oldest-first for the chart.
    const points = user
        ? await getRecentEnduranceDeltaSeries(user.id, { limit: 20 })
        : []
    // detectPattern wants newest-first; there's no session id on a DeltaPoint, so
    // the (unique-enough) date stands in for workout_id — detectPattern only surfaces
    // it in PatternSignal.workoutIds, which PatternFlagCard doesn't render.
    const flag = detectPattern(
        points.slice().reverse().map(d => ({ delta_pct: d.delta_pct, workout_id: d.date })),
    )

    return (
        <div className="animate-in fade-in duration-500 flex flex-col gap-4">
            <PatternFlagCard flag={flag} coach="endurance" />
            <PerformanceDeltaChart title="endurance performance deltas" points={points} />
            <EnduranceDashboard data={result.data} />
        </div>
    )
}
