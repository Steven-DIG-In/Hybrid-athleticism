import { AlertTriangle } from 'lucide-react'
import { getRecoveryAnalytics } from '@/lib/actions/data.actions'
import { RecoveryDashboard } from '@/components/data/RecoveryDashboard'

export default async function RecoveryPage() {
    const result = await getRecoveryAnalytics()

    if (!result.success) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                <p className="text-sm text-neutral-400 font-mono">{result.error}</p>
            </div>
        )
    }

    return <RecoveryDashboard data={result.data} />
}
