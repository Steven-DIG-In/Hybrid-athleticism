import { getWorkoutById } from "@/lib/actions/workout.actions"
import type { WorkoutWithSets } from "@/lib/types/training.types"
import { AlertTriangle } from "lucide-react"
import { WorkoutLogger } from "@/components/workout/WorkoutLogger"

export default async function ActiveWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const result = await getWorkoutById(id)

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

    return <WorkoutLogger workout={result.data as WorkoutWithSets} />
}
