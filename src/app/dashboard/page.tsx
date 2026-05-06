import { AlertTriangle } from "lucide-react"
import { getDashboardData } from "@/lib/actions/workout.actions"
import { SessionPoolClient } from "@/components/dashboard/SessionPoolClient"
import { DashboardNoActiveBlockEmpty } from "@/components/dashboard/DashboardNoActiveBlockEmpty"
import { CloseBlockCta } from "@/components/dashboard/CloseBlockCta"
import { CloseBlockNudgeBanner } from "@/components/dashboard/CloseBlockNudgeBanner"
import { createClient } from "@/lib/supabase/server"
import { evaluateOverrunSignal } from "@/lib/analytics/overrun-signal"
import { OverrunSignalBanner } from "@/components/reality-check/OverrunSignalBanner"

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ week?: string }>
}) {
    const params = await searchParams
    const weekNumber = params.week ? parseInt(params.week, 10) : undefined
    const result = await getDashboardData(weekNumber && !isNaN(weekNumber) ? weekNumber : undefined)

    if (!result.success) {
        return (
            <div className="p-6 text-center mt-12">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-space-grotesk text-white mb-2">Failed to Sync</h2>
                <p className="text-neutral-500 font-inter">{result.error}</p>
            </div>
        )
    }

    const { data } = result

    // No active block — empty state with link to last retrospective
    if (!data.currentMesocycle) {
        return <DashboardNoActiveBlockEmpty />
    }

    // Compute nudge condition (end_date passed OR all sessions resolved)
    const today = new Date()
    const endPassed = data.currentMesocycle.end_date != null
        && new Date(data.currentMesocycle.end_date) < today
    const allResolved = data.allSessionsResolved === true
    const showNudge = endPassed || allResolved
    const hasAnyCompleted = (data.completedSessionCount ?? 0) > 0

    // Evaluate overrun signal for the mid-block reality-check banner.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const overrunSignal = user
        ? await evaluateOverrunSignal(user.id)
        : { shouldFire: false as const, evidence: null }

    // Profile defaults for the modal that opens from the banner.
    // available_days + session_duration_minutes live on profiles, not mesocycles.
    const profileResult = user
        ? await supabase
            .from('profiles')
            .select('available_days, session_duration_minutes')
            .eq('id', user.id)
            .maybeSingle()
        : { data: null }
    const profileForDefaults = profileResult.data as
        | { available_days: number | null; session_duration_minutes: number | null }
        | null
    const overrunDefaults = {
        daysPerWeek: profileForDefaults?.available_days ?? 5,
        sessionMinutes: profileForDefaults?.session_duration_minutes ?? 60,
        warmupMinutes: 0,
        cooldownMinutes: 0,
    }

    // Greeting based on time of day
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    const firstName = data.athleteName?.split(' ')[0] ?? null

    return (
        <div className="animate-in fade-in duration-500">
            {/* Personalized greeting */}
            <div className="mb-2">
                <h1 className="text-xl font-space-grotesk font-bold text-white tracking-tight">
                    {greeting}{firstName ? `, ${firstName}` : ''}
                </h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
                        {data.currentMesocycle.name}
                    </p>
                    {hasAnyCompleted && (
                        <CloseBlockCta mesocycleId={data.currentMesocycle.id} />
                    )}
                </div>
            </div>

            {overrunSignal.shouldFire && overrunSignal.evidence && (
                <OverrunSignalBanner
                    evidence={overrunSignal.evidence}
                    defaults={overrunDefaults}
                />
            )}

            {showNudge && data.currentMesocycle.end_date && (
                <CloseBlockNudgeBanner
                    mesocycleId={data.currentMesocycle.id}
                    blockName={data.currentMesocycle.name}
                    endDate={data.currentMesocycle.end_date}
                />
            )}

            {/* Session Pool — all interactivity lives in the client component */}
            <SessionPoolClient data={data} />
        </div>
    )
}
