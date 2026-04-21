import { AlertTriangle } from "lucide-react"
import { getTrainingOverview, getHealthSnapshot } from "@/lib/actions/data.actions"
import { TrainingOverview } from "@/components/data/TrainingOverview"
import { HealthSnapshotTile } from "@/components/data/overview/HealthSnapshotTile"

export default async function DataPage() {
    const [trainingRes, healthRes] = await Promise.all([
        getTrainingOverview(),
        getHealthSnapshot(),
    ])

    if (!trainingRes.success) {
        return (
            <div className="p-6 text-center mt-12">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-space-grotesk text-white mb-2">Failed to Load</h2>
                <p className="text-neutral-500 font-inter">{trainingRes.error}</p>
            </div>
        )
    }
    const { data } = trainingRes

    const healthTile = healthRes.success ? (
        <HealthSnapshotTile
            bloodwork={healthRes.data.bloodwork}
            garmin={healthRes.data.garmin}
            activeSupplements={healthRes.data.activeSupplements}
        />
    ) : null

    if (!data.mesocycleName) {
        return (
            <div className="p-6 animate-in fade-in duration-500">
                <div className="text-center mt-12 mb-12">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-neutral-900 flex items-center justify-center">
                        <span className="text-2xl">📊</span>
                    </div>
                    <h2 className="text-xl font-space-grotesk text-white mb-2">No Active Training Block</h2>
                    <p className="text-neutral-500 font-inter text-sm">
                        Start a mesocycle to see your training data here.
                    </p>
                </div>
                {healthTile}
            </div>
        )
    }

    return (
        <div className="animate-in fade-in duration-500">
            <TrainingOverview data={data} healthTile={healthTile} />
        </div>
    )
}
