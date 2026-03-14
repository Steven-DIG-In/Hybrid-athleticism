import { AlertTriangle } from 'lucide-react'
import { getEnduranceAnalytics } from '@/lib/actions/data.actions'
import { EnduranceDashboard } from '@/components/data/EnduranceDashboard'

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

    return <EnduranceDashboard data={result.data} />
}
