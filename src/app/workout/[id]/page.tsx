import { getWorkoutById } from "@/lib/actions/workout.actions"
import { getProfile } from "@/lib/actions/onboarding.actions"
import type { WorkoutWithSets } from "@/lib/types/training.types"
import { AlertTriangle } from "lucide-react"
import { WorkoutLogger } from "@/components/workout/WorkoutLogger"
import { createClient } from "@/lib/supabase/server"

export default async function ActiveWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const result = await getWorkoutById(id)
    const profileResult = await getProfile()

    if (!result.success || !result.data) {
        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-space-grotesk font-bold text-red-500 mb-2">Protocol Unreachable</h1>
                    <p className="text-neutral-400 font-inter text-sm mb-6">{!result.success ? result.error : "Workout not found."}</p>
                    <a href="/dashboard" className="text-cyan-500 hover:text-cyan-400 font-mono text-sm underline">Return to Command Center</a>
                </div>
            </div>
        )
    }

    const displayWeightsAsPercentages = profileResult.success && profileResult.data?.display_weights_as_percentages === true

    // Fetch most recent recalibration note for this user (Phase 2: most-recent only;
    // Phase 3 will scope by target_entity / session / exercise).
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let recalibrationNote: { reasoningText: string; createdAt: string } | null = null
    if (user) {
        const { data: recentRecal } = await supabase
            .from('agent_activity')
            .select('reasoning_text, created_at')
            .eq('user_id', user.id)
            .eq('decision_type', 'recalibration')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (recentRecal) {
            recalibrationNote = {
                reasoningText: recentRecal.reasoning_text,
                createdAt: recentRecal.created_at
            }
        }
    }

    return (
        <WorkoutLogger
            workout={result.data as WorkoutWithSets}
            displayWeightsAsPercentages={displayWeightsAsPercentages}
            recalibrationNote={recalibrationNote}
        />
    )
}
