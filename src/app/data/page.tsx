import { AlertTriangle } from "lucide-react"
import { getTrainingOverview } from "@/lib/actions/data.actions"
import { TrainingOverview } from "@/components/data/TrainingOverview"

export default async function DataPage() {
    const result = await getTrainingOverview()

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
                    <span className="text-2xl">📊</span>
                </div>
                <h2 className="text-xl font-space-grotesk text-white mb-2">No Active Training Block</h2>
                <p className="text-neutral-500 font-inter text-sm">
                    Start a mesocycle to see your training data here.
                </p>
            </div>
        )
    }

    return (
        <div className="animate-in fade-in duration-500">
            <TrainingOverview data={data} />
        </div>
    )
}
