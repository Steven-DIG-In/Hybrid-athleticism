import { LogSessionForm } from '@/components/dashboard/LogSessionForm'
import { BottomNav } from '@/components/ui/bottom-nav'

export default function LogSessionPage() {
    return (
        <div className="min-h-screen bg-[#020202] text-white pb-24">
            <div className="max-w-md mx-auto p-6">
                <h1 className="text-lg font-medium mb-1">Log off-plan session</h1>
                <p className="text-xs text-neutral-500 mb-4">
                    For activity outside your prescribed plan — extra runs, pickup games, etc.
                    Counts toward training load unless you opt out.
                </p>
                <LogSessionForm />
            </div>
            <BottomNav />
        </div>
    )
}
