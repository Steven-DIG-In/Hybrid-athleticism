import { AlertTriangle } from 'lucide-react'
import { getEnduranceAnalytics } from '@/lib/actions/data.actions'
import { EnduranceDashboard } from '@/components/data/EnduranceDashboard'
import { getRecentCoachDeltaSeries } from '@/lib/analytics/shared/coach-domain'
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
    const series = user
        ? await getRecentCoachDeltaSeries(user.id, 'endurance', { limit: 20 })
        : []
    const points = series.slice().reverse().map(d => ({
        date: d.created_at.slice(0, 10),
        delta_pct: d.delta_pct,
    }))
    const flag = detectPattern(
        series.map(d => ({ delta_pct: d.delta_pct, workout_id: d.session_inventory_id })),
    )

    return (
        <div className="animate-in fade-in duration-500 flex flex-col gap-4">
            <PatternFlagCard flag={flag} coach="endurance" />
            <PerformanceDeltaChart title="endurance performance deltas" points={points} />
            <EnduranceDashboard data={result.data} />
        </div>
    )
}
