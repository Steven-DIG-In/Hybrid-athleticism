"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, TrendingUp, Trophy } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface HistorySet {
    logged_at: string
    actual_weight_kg: number | null
    actual_reps: number | null
    rir_actual: number | null
    rpe_actual: number | null
    is_pr: boolean
}

interface ExerciseHistoryPanelProps {
    exerciseName: string
    history: HistorySet[]
    loading: boolean
    targetReps?: number | null
}

export function ExerciseHistoryPanel({
    exerciseName,
    history,
    loading,
    targetReps
}: ExerciseHistoryPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    if (loading) {
        return (
            <div className="mb-4 p-3 bg-[#0a0a0a] border border-[#222222] rounded-md animate-pulse">
                <div className="h-4 bg-neutral-800 rounded w-1/2"></div>
            </div>
        )
    }

    if (!history || history.length === 0) {
        return null
    }

    // Find most recent set with similar rep range (±2 reps)
    const findSimilarSet = (targetReps: number | null | undefined): HistorySet | null => {
        if (!targetReps) return history[0]

        const similarSet = history.find(h => {
            const reps = h.actual_reps || 0
            return Math.abs(reps - targetReps) <= 2
        })

        return similarSet || history[0]
    }

    const lastSet = findSimilarSet(targetReps)
    const hasPR = history.some(h => h.is_pr)

    // Calculate weight delta vs last session
    const calculateDelta = (currentWeight: number | null): string | null => {
        if (!lastSet || !lastSet.actual_weight_kg || !currentWeight) return null

        const delta = currentWeight - lastSet.actual_weight_kg
        if (delta === 0) return null

        const sign = delta > 0 ? "+" : ""
        return `${sign}${delta.toFixed(1)}kg`
    }

    return (
        <div className="mb-4">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 bg-[#0a0a0a] border border-[#222222] rounded-md hover:border-cyan-900/50 transition-colors text-left"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                        <div>
                            <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest block">
                                Last Session
                            </span>
                            {lastSet && (
                                <span className="text-sm font-space-grotesk font-semibold text-white">
                                    {lastSet.actual_weight_kg || "--"}kg × {lastSet.actual_reps} @ RIR {lastSet.rir_actual ?? "--"}
                                    {lastSet.logged_at && (
                                        <span className="text-neutral-500 ml-2">
                                            ({formatDistanceToNow(new Date(lastSet.logged_at), { addSuffix: true })})
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>
                        {hasPR && (
                            <Trophy className="w-4 h-4 text-yellow-400" />
                        )}
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-neutral-500" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-neutral-500" />
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="mt-2 p-3 bg-[#0a0a0a] border border-[#222222] rounded-md space-y-2">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">
                        Recent Performance (Last 3 Sessions)
                    </p>
                    {history.map((set, idx) => {
                        const delta = idx === 0 && history.length > 1 && history[1].actual_weight_kg
                            ? calculateDelta(set.actual_weight_kg)
                            : null

                        return (
                            <div
                                key={idx}
                                className="flex items-center justify-between text-sm py-2 border-b border-[#1a1a1a] last:border-b-0"
                            >
                                <div className="flex items-center gap-2">
                                    {set.is_pr && (
                                        <Trophy className="w-3 h-3 text-yellow-400" />
                                    )}
                                    <span className="font-space-grotesk text-white">
                                        {set.actual_weight_kg || "--"}kg × {set.actual_reps}
                                    </span>
                                    <span className="text-neutral-500 text-xs">
                                        @ RIR {set.rir_actual ?? "--"}
                                    </span>
                                    {delta && (
                                        <span className={`text-xs font-mono ${delta.startsWith('+') ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                            {delta}
                                        </span>
                                    )}
                                </div>
                                {set.logged_at && (
                                    <span className="text-xs text-neutral-600">
                                        {formatDistanceToNow(new Date(set.logged_at), { addSuffix: true })}
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
