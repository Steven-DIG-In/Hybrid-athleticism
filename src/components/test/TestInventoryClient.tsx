'use client'

import { UnscheduledInventory } from '@/components/dashboard/UnscheduledInventory'
import type { UnscheduledInventoryView } from '@/lib/types/inventory.types'

interface TestInventoryClientProps {
    inventory: UnscheduledInventoryView
}

export function TestInventoryClient({ inventory }: TestInventoryClientProps) {
    const handleAllocateWeek = (week: number) => {
        console.log('Allocate week:', week)
        alert(`Allocate Week ${week} clicked! (Integration pending)`)
    }

    const handleScheduleSession = (id: string) => {
        console.log('Schedule session:', id)
        alert(`Schedule session ${id} clicked! (Integration pending)`)
    }

    return (
        <div>
            <h1 className="text-2xl font-space-grotesk font-bold text-white mb-6">
                Test: Session Inventory
            </h1>

            <UnscheduledInventory
                inventory={inventory}
                onAllocateWeek={handleAllocateWeek}
                onScheduleSession={handleScheduleSession}
            />

            <div className="mt-8 p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
                <h2 className="text-sm font-mono text-cyan-400 mb-2">DEBUG INFO:</h2>
                <pre className="text-xs text-neutral-400 overflow-auto max-h-96">
                    {JSON.stringify(inventory, null, 2)}
                </pre>
            </div>
        </div>
    )
}
