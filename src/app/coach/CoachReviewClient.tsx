"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Activity, Dumbbell, Play, Loader2 } from "lucide-react"
import { respondToIntervention } from "@/lib/actions/ai-coach.actions"
import type { AICoachIntervention } from "@/lib/types/database.types"

// Quick mapping for display text
const TRIGGER_MAP = {
    'WEEKLY_REVIEW': 'End of Week Telemetry',
    'RUCK_FATIGUE': 'High CNS Fatigue (Ruck)',
    'RPE_SPIKE': 'Unplanned RPE Spike',
    'CARDIO_LOAD': 'Cardio Interference'
}

export function CoachReviewClient({ intervention }: { intervention: AICoachIntervention }) {
    const [isPending, startTransition] = useTransition()
    const [isResolved, setIsResolved] = useState(intervention.user_accepted !== null)

    const handleAction = (accepted: boolean) => {
        startTransition(async () => {
            const res = await respondToIntervention(intervention.id, accepted)
            if (res.success) {
                setIsResolved(true)
            } else {
                console.error("Failed to respond to intervention:", res.error)
            }
        })
    }

    if (isResolved) return null; // Hide from view once handled

    const hasSwaps = intervention.exercise_swaps && intervention.exercise_swaps.length > 0;
    const hasVolumeAdjustments = intervention.volume_adjustments && Object.keys(intervention.volume_adjustments).length > 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-2 block animate-pulse">
                    {TRIGGER_MAP[intervention.trigger_type] || 'System Alert'}
                </span>
                <h1 className="text-3xl md:text-5xl font-space-grotesk font-bold tracking-tight text-white mb-4">
                    Protocol Exception.<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Adjustments derived.</span>
                </h1>
            </div>

            {/* The Analyst Printout (Editorial Blockquote style) */}
            <div className="relative p-6 md:p-8 bg-[#0a0a0a] border-l-2 border-cyan-500 border-t border-r border-b border-[#222222]">
                <div className="absolute -top-3 left-4 px-2 bg-[#050505] text-[10px] font-mono text-cyan-400 tracking-widest uppercase">
                    Analyst Output // {intervention.model_used || 'Claude'}
                </div>
                <p className="font-inter text-neutral-300 leading-relaxed text-sm md:text-base">
                    "{intervention.rationale}"
                </p>
            </div>

            {/* Diff Visualizer - Only show if there are actual swaps or volume changes */}
            {(hasSwaps || hasVolumeAdjustments) && (
                <div className="space-y-4">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-500">Proposed Adjustments</h3>

                    {/* Exercise Swaps grid */}
                    {hasSwaps && (
                        <div className="grid grid-cols-1 gap-4">
                            {intervention.exercise_swaps!.map((swap, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* The Cut */}
                                    <div className="bg-red-950/20 border border-red-900/50 p-4">
                                        <div className="flex justify-between mb-3">
                                            <span className="text-red-400 text-xs font-mono">REMOVE</span>
                                            <Dumbbell className="w-4 h-4 text-red-500" />
                                        </div>
                                        <p className="font-space-grotesk font-bold text-white mb-1">{swap.from}</p>
                                    </div>

                                    {/* The Addition */}
                                    <div className="bg-emerald-950/20 border border-emerald-900/50 p-4">
                                        <div className="flex justify-between mb-3">
                                            <span className="text-emerald-400 text-xs font-mono">INSERT</span>
                                            <Activity className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <p className="font-space-grotesk font-bold text-white mb-1">{swap.to}</p>
                                        <p className="text-xs font-mono text-emerald-500/70 mt-1">{swap.reason}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Volume Adjustments */}
                    {hasVolumeAdjustments && (
                        <div className="bg-[#050505] border border-cyan-900/40 p-4 space-y-2 mt-4">
                            <h4 className="text-[10px] font-mono uppercase text-cyan-500 mb-2">Volume Modifications</h4>
                            {Object.entries(intervention.volume_adjustments!).map(([muscle, delta]) => (
                                <div key={muscle} className="flex justify-between text-sm">
                                    <span className="font-inter text-neutral-300">{muscle}</span>
                                    <span className={`font-mono ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {delta > 0 ? '+' : ''}{delta} Sets
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="pt-6 flex flex-col md:flex-row gap-4">
                <Button
                    variant="outline"
                    className="h-14 md:w-1/3 text-neutral-400"
                    onClick={() => handleAction(false)}
                    disabled={isPending}
                >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Reject Override"}
                </Button>
                <Button
                    className="h-14 flex-1 shadow-[0_0_20px_rgba(13,185,242,0.15)] group hover:shadow-[0_0_30px_rgba(13,185,242,0.3)] transition-all"
                    onClick={() => handleAction(true)}
                    disabled={isPending}
                >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>Accept & Update Pipeline <Play className="w-4 h-4 ml-2 fill-current group-hover:translate-x-1 transition-transform" /></>
                    )}
                </Button>
            </div>
        </div>
    )
}
