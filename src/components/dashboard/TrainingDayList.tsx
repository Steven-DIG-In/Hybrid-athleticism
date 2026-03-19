'use client'

import { TrainingDayCard } from './TrainingDayCard'
import { AdhocSessionModal } from './AdhocSessionModal'
import type { SessionInventory } from '@/lib/types/inventory.types'
import type { WorkoutWithSets } from '@/lib/types/training.types'

interface TrainingDay {
    dayNumber: number
    sessions: SessionInventory[]
    isComplete: boolean
}

interface TrainingDayListProps {
    trainingDays: TrainingDay[]
    sessionPool: WorkoutWithSets[]
    mesocycleId: string | undefined
    weekNumber: number | undefined
}

export function TrainingDayList({
    trainingDays,
    sessionPool,
    mesocycleId,
    weekNumber,
}: TrainingDayListProps) {
    const allDayNumbers = trainingDays.map(d => d.dayNumber)

    if (trainingDays.length === 0) {
        return (
            <div className="border border-[#1f1f1f] bg-[#090909] p-8 text-center">
                <p className="text-xs text-neutral-600 font-inter">
                    No training days allocated yet.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end px-1">
                <h2 className="text-lg font-space-grotesk font-bold tracking-tight text-white uppercase">
                    Training Days
                </h2>
                <span className="text-[10px] font-mono text-neutral-600">
                    {trainingDays.length} day{trainingDays.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="space-y-6">
                {trainingDays
                    .slice()
                    .sort((a, b) => a.dayNumber - b.dayNumber)
                    .map((day, i) => (
                        <TrainingDayCard
                            key={day.dayNumber}
                            dayNumber={day.dayNumber}
                            sessions={day.sessions}
                            isComplete={day.isComplete}
                            sessionPool={sessionPool}
                            allDayNumbers={allDayNumbers}
                            index={i}
                        />
                    ))}
            </div>

            {/* Ad-hoc session button — shown if we have context */}
            {mesocycleId && weekNumber != null && (
                <AdhocSessionModal
                    mesocycleId={mesocycleId}
                    weekNumber={weekNumber}
                />
            )}
        </div>
    )
}
