'use client'

import { useState, useEffect } from 'react'
import { X, AlertTriangle, Loader2, CheckCircle2, Sparkles, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { suggestAllocation, applyAllocation } from '@/lib/actions/inventory.actions'
import type { DayAllocation } from '@/lib/types/inventory.types'

interface AllocationModalProps {
    isOpen: boolean
    weekNumber: number | null
    mesocycleId: string | undefined
    onClose: () => void
    onComplete: () => void
}

const MODALITY_CONFIG: Record<string, { color: string; badge: string }> = {
    LIFTING: { color: 'text-blue-400', badge: 'modality_lifting' },
    CARDIO: { color: 'text-emerald-400', badge: 'modality_cardio' },
    RUCKING: { color: 'text-amber-400', badge: 'modality_rucking' },
    METCON: { color: 'text-purple-400', badge: 'modality_metcon' },
    MOBILITY: { color: 'text-teal-400', badge: 'modality_cardio' },
}

export function AllocationModal({
    isOpen,
    weekNumber,
    mesocycleId,
    onClose,
    onComplete,
}: AllocationModalProps) {
    const [loading, setLoading] = useState(false)
    const [applying, setApplying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [allocation, setAllocation] = useState<DayAllocation | null>(null)

    // Reset state when modal opens
    useEffect(() => {
        if (!isOpen) return
        setAllocation(null)
        setError(null)
    }, [isOpen])

    const handleGetSuggestions = async () => {
        if (!mesocycleId || !weekNumber) return

        setLoading(true)
        setError(null)

        const result = await suggestAllocation(mesocycleId, weekNumber)

        if (result.success) {
            setAllocation(result.data)
        } else {
            setError(result.error ?? 'Failed to generate suggestions')
        }

        setLoading(false)
    }

    const handleApply = async () => {
        if (!allocation) return

        setApplying(true)
        setError(null)

        const result = await applyAllocation(allocation)

        if (result.success) {
            onComplete()
        } else {
            setError(result.error ?? 'Failed to apply allocation')
            setApplying(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden bg-[#0a0a0a] border border-[#222222] shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-[#222222] flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-space-grotesk font-bold text-white">
                            Allocate Block {weekNumber}
                        </h2>
                        <p className="text-sm text-neutral-400 mt-1">
                            Sessions are assigned to training days - do them whenever you are ready
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-500 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Generate button (no date picker needed) */}
                    {!allocation && (
                        <div className="space-y-4">
                            <p className="text-sm text-neutral-300">
                                The AI will distribute your sessions across training days based on your
                                available days and recovery needs. Each day is done at your own pace.
                            </p>

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-space-grotesk text-red-400 font-bold">
                                            Error
                                        </p>
                                        <p className="text-xs text-red-300 mt-1">{error}</p>
                                    </div>
                                </div>
                            )}

                            <Button
                                onClick={handleGetSuggestions}
                                disabled={loading}
                                className="w-full h-12 bg-cyan-500 text-black hover:bg-cyan-400 font-bold"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating Plan...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Generate Training Day Plan
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {/* Suggested Training Days */}
                    {allocation && (
                        <div className="space-y-6">
                            <p className="text-xs text-neutral-500">
                                {allocation.totalTrainingDays} training days planned
                            </p>

                            {/* Sessions grouped by day */}
                            <div className="space-y-4">
                                {allocation.days.map((day) => (
                                    <div
                                        key={day.dayNumber}
                                        className="bg-[#111] border border-[#222222] rounded-lg overflow-hidden"
                                    >
                                        {/* Day header */}
                                        <div className="px-4 py-2 bg-[#161616] border-b border-[#222222] flex items-center gap-2">
                                            <Dumbbell className="w-4 h-4 text-cyan-400" />
                                            <span className="text-sm font-space-grotesk font-bold text-white">
                                                Training Day {day.dayNumber}
                                            </span>
                                            {day.sessions.length > 1 && (
                                                <Badge variant="outline" className="text-[9px] py-0 border-cyan-500/30 text-cyan-400 ml-auto">
                                                    Two-a-day
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Sessions in this day */}
                                        <div className="divide-y divide-[#1a1a1a]">
                                            {day.sessions.map((entry) => {
                                                const config = MODALITY_CONFIG[entry.session.modality] ?? MODALITY_CONFIG.LIFTING
                                                return (
                                                    <div key={entry.session.id} className="p-4">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Badge variant={config.badge as any} className="text-[9px] py-0">
                                                                        {entry.session.modality}
                                                                    </Badge>
                                                                    {entry.slot === 2 && (
                                                                        <Badge variant="outline" className="text-[9px] py-0 border-neutral-500/30 text-neutral-400">
                                                                            PM
                                                                        </Badge>
                                                                    )}
                                                                    {entry.session.session_priority === 2 && (
                                                                        <Badge variant="outline" className="text-[9px] py-0 border-amber-500/30 text-amber-400">
                                                                            Recommended
                                                                        </Badge>
                                                                    )}
                                                                    {entry.session.session_priority === 3 && (
                                                                        <Badge variant="outline" className="text-[9px] py-0 border-neutral-500/30 text-neutral-400">
                                                                            Optional
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <h3 className="text-sm font-space-grotesk font-bold text-white mb-1">
                                                                    {entry.session.name}
                                                                </h3>
                                                                {(entry.session.estimated_duration_minutes || entry.session.load_budget) && (
                                                                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                                                                        {entry.session.estimated_duration_minutes && (
                                                                            <span>{entry.session.estimated_duration_minutes} min</span>
                                                                        )}
                                                                        {entry.session.load_budget && (
                                                                            <span>Load: {entry.session.load_budget}</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-right">
                                                                {entry.reasoning && (
                                                                    <p className="text-xs text-neutral-500 max-w-xs">
                                                                        {entry.reasoning}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Warnings */}
                            {allocation.warnings && allocation.warnings.length > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                        <div className="space-y-2">
                                            <p className="text-sm font-space-grotesk text-amber-400 font-bold">
                                                Scheduling Warnings
                                            </p>
                                            {allocation.warnings.map((warning, i) => (
                                                <p key={i} className="text-xs text-amber-300">
                                                    {warning}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-space-grotesk text-red-400 font-bold">
                                            Error
                                        </p>
                                        <p className="text-xs text-red-300 mt-1">{error}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {allocation && (
                    <div className="p-6 border-t border-[#222222] flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => setAllocation(null)}
                            disabled={applying}
                            className="text-neutral-400 hover:text-white"
                        >
                            Back
                        </Button>
                        <Button
                            onClick={handleApply}
                            disabled={applying}
                            className="bg-cyan-500 text-black hover:bg-cyan-400 font-bold px-8"
                        >
                            {applying ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Applying...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Accept Plan
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {!allocation && (
                    <div className="p-6 border-t border-[#222222] flex justify-end">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="text-neutral-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
