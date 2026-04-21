import { AlertTriangle } from "lucide-react"
import { getStrengthAnalytics } from "@/lib/actions/data.actions"
import { StrengthDashboard } from "@/components/data/StrengthDashboard"
import { getRecentCoachDeltaSeries } from '@/lib/analytics/shared/coach-domain'
import { detectPattern } from '@/lib/analytics/coach-bias'
import { createClient } from '@/lib/supabase/server'
import { PerformanceDeltaChart } from '@/components/data/domain/PerformanceDeltaChart'
import { PatternFlagCard } from '@/components/data/domain/PatternFlagCard'

export default async function StrengthPage() {
    const result = await getStrengthAnalytics()

    if (!result.success) {
        return (
            <div className="p-6 text-center mt-12">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-space-grotesk text-white mb-2">Failed to Load</h2>
                <p className="text-neutral-500 font-inter">{result.error}</p>
            </div>
        )
    }

    const { data } = result

    if (!data.mesocycleName) {
        return (
            <div className="p-6 text-center mt-12">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-neutral-900 flex items-center justify-center">
                    <span className="text-2xl">🏋️</span>
                </div>
                <h2 className="text-xl font-space-grotesk text-white mb-2">No Strength Data</h2>
                <p className="text-neutral-500 font-inter text-sm">
                    Complete some lifting sessions to see your strength analytics.
                </p>
            </div>
        )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // user is guaranteed non-null because getStrengthAnalytics already succeeded.
    const series = user
        ? await getRecentCoachDeltaSeries(user.id, 'strength', { limit: 20 })
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
            <PatternFlagCard flag={flag} coach="strength" />
            <PerformanceDeltaChart title="strength performance deltas" points={points} />
            <StrengthDashboard data={data} />
        </div>
    )
}
