'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, AlertTriangle, Loader2, CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { suggestAllocation, applyAllocation } from '@/lib/actions/inventory.actions'
import type { ScheduleSuggestion } from '@/lib/types/inventory.types'
import { format, addDays, startOfWeek } from 'date-fns'

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
    const [suggestion, setSuggestion] = useState<ScheduleSuggestion | null>(null)
    const [startDate, setStartDate] = useState<string>('')

    // Reset state when modal opens
    useEffect(() => {
        if (!isOpen) return

        // Default to next Monday
        const today = new Date()
        const monday = startOfWeek(today, { weekStartsOn: 1 })
        const nextMonday = addDays(monday, 7)
        setStartDate(format(nextMonday, 'yyyy-MM-dd'))
        setSuggestion(null)
        setError(null)
    }, [isOpen])

    const handleGetSuggestions = async () => {
        if (!mesocycleId || !weekNumber || !startDate) return

        setLoading(true)
        setError(null)

        const result = await suggestAllocation(mesocycleId, weekNumber, startDate)

        if (result.success) {
            setSuggestion(result.data)
        } else {
            setError(result.error ?? 'Failed to generate suggestions')
        }

        setLoading(false)
    }

    const handleApply = async () => {
        if (!suggestion) return

        setApplying(true)
        setError(null)

        const result = await applyAllocation(suggestion)

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
                            Allocate Week {weekNumber}
                        </h2>
                        <p className="text-sm text-neutral-400 mt-1">
                            AI will suggest optimal dates based on your preferences
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
                    {/* Start Date Selection */}
                    {!suggestion && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-space-grotesk text-white mb-2">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#111] border border-[#222222] text-white rounded-lg focus:border-cyan-500 focus:outline-none"
                                />
                                <p className="text-xs text-neutral-500 mt-2">
                                    Choose when you want to start this training week
                                </p>
                            </div>

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
                                disabled={loading || !startDate}
                                className="w-full h-12 bg-cyan-500 text-black hover:bg-cyan-400 font-bold"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating Suggestions...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Get AI Suggestions
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {/* Suggested Schedule */}
                    {suggestion && (
                        <div className="space-y-6">
                            {/* Sessions by Date */}
                            <div className="space-y-3">
                                {suggestion.allocations.map((allocation) => {
                                    const config = MODALITY_CONFIG[allocation.session.modality] ?? MODALITY_CONFIG.LIFTING
                                    const date = new Date(allocation.suggestedDate + 'T00:00:00')

                                    return (
                                        <div
                                            key={allocation.session.id}
                                            className="bg-[#111] border border-[#222222] rounded-lg p-4"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                {/* Session Info */}
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge variant={config.badge as any} className="text-[9px] py-0">
                                                            {allocation.session.modality}
                                                        </Badge>
                                                        {allocation.session.session_priority === 2 && (
                                                            <Badge variant="outline" className="text-[9px] py-0 border-amber-500/30 text-amber-400">
                                                                Recommended
                                                            </Badge>
                                                        )}
                                                        {allocation.session.session_priority === 3 && (
                                                            <Badge variant="outline" className="text-[9px] py-0 border-neutral-500/30 text-neutral-400">
                                                                Optional
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <h3 className="text-sm font-space-grotesk font-bold text-white mb-1">
                                                        {allocation.session.name}
                                                    </h3>
                                                    {(allocation.session.estimated_duration_minutes || allocation.session.load_budget) && (
                                                        <div className="flex items-center gap-3 text-xs text-neutral-400">
                                                            {allocation.session.estimated_duration_minutes && (
                                                                <span>{allocation.session.estimated_duration_minutes} min</span>
                                                            )}
                                                            {allocation.session.load_budget && (
                                                                <span>Load: {allocation.session.load_budget}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Suggested Date */}
                                                <div className="text-right">
                                                    <div className="flex items-center gap-2 text-cyan-400 mb-1">
                                                        <Calendar className="w-4 h-4" />
                                                        <span className="text-sm font-space-grotesk font-bold">
                                                            {format(date, 'EEE, MMM d')}
                                                        </span>
                                                    </div>
                                                    {allocation.reasoning && (
                                                        <p className="text-xs text-neutral-500 max-w-xs">
                                                            {allocation.reasoning}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Warnings */}
                            {suggestion.warnings && suggestion.warnings.length > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                        <div className="space-y-2">
                                            <p className="text-sm font-space-grotesk text-amber-400 font-bold">
                                                Scheduling Warnings
                                            </p>
                                            {suggestion.warnings.map((warning, i) => (
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
                {suggestion && (
                    <div className="p-6 border-t border-[#222222] flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => setSuggestion(null)}
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
                                    Accept Schedule
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {!suggestion && (
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
