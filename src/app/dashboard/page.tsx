import { AlertTriangle } from "lucide-react"
import { getDashboardData } from "@/lib/actions/workout.actions"
import { SessionPoolClient } from "@/components/dashboard/SessionPoolClient"

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
                {data.currentMesocycle && (
                    <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-1">
                        {data.currentMesocycle.name}
                    </p>
                )}
            </div>

            {/* Session Pool — all interactivity lives in the client component */}
            <SessionPoolClient data={data} />
        </div>
    )
}
