"use client"

import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { RecalibrationSummaryEntry } from "@/lib/actions/recalibrate-from-top-set.actions"

/**
 * Session-close screen.
 *
 * Until now `recalibrateFromTopSet` was fire-and-forget: it computed a new
 * estimated 1RM after every lifting session, wrote it to agent_activity, and
 * showed it to nobody. This is that output's first consumer.
 *
 * Reports only what was measured. When no main lift produced a usable top set
 * it says so — it never invents a number to fill the space.
 */
export function SessionSummary({
    entries,
    durationMinutes,
    onDone,
}: {
    entries: RecalibrationSummaryEntry[]
    durationMinutes: number
    onDone: () => void
}) {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <div className="flex-1 max-w-lg w-full mx-auto px-6 py-12">
                <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">
                    Session Complete
                </p>
                <h1 className="text-3xl font-space-grotesk font-bold mb-1">
                    Logged
                </h1>
                <p className="text-sm font-inter text-neutral-400 mb-10">
                    {durationMinutes} min under the bar.
                </p>

                {entries.length === 0 ? (
                    <div className="border border-[#222222] bg-[#0a0a0a] p-5">
                        <p className="text-sm font-inter text-neutral-400">
                            No new strength signal this session.
                        </p>
                        <p className="text-xs font-mono text-neutral-600 mt-2">
                            Training maxes update from completed main-lift sets.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">
                            Strength Signal
                        </p>
                        <div className="space-y-3">
                            {entries.map(entry => {
                                const delta =
                                    Math.round(
                                        (entry.observedTrainingMaxKg - entry.previousTrainingMaxKg) * 10
                                    ) / 10
                                const Icon =
                                    delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
                                const tone =
                                    delta > 0
                                        ? "text-amber-400"
                                        : delta < 0
                                            ? "text-neutral-500"
                                            : "text-neutral-400"

                                return (
                                    <div
                                        key={entry.exercise}
                                        className={`border p-4 ${entry.isPR
                                            ? "border-amber-500/50 bg-[#0c0a06]"
                                            : "border-[#222222] bg-[#0a0a0a]"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-space-grotesk font-bold">
                                                        {entry.exercise}
                                                    </span>
                                                    {entry.isPR && (
                                                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold
                                                                         text-amber-400 border border-amber-400/50
                                                                         bg-amber-400/10 tracking-widest">
                                                            NEW BEST
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                                                    Est. 1RM
                                                </p>
                                                <p className="text-2xl font-space-grotesk font-bold text-cyan-300">
                                                    {entry.estimated1RMKg}
                                                    <span className="text-base text-cyan-500/60"> kg</span>
                                                </p>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                                                    Training Max
                                                </p>
                                                <p className={`text-lg font-space-grotesk font-semibold ${tone}`}>
                                                    {entry.observedTrainingMaxKg} kg
                                                </p>
                                                <p className={`text-[11px] font-mono flex items-center justify-end gap-1 ${tone}`}>
                                                    <Icon className="w-3 h-3" />
                                                    {delta > 0 ? `+${delta}` : delta} kg
                                                </p>
                                            </div>
                                        </div>

                                        {!entry.applied && (
                                            <p className="text-[11px] font-mono text-neutral-600 mt-3 pt-3 border-t border-[#1a1a1a]">
                                                Logged — awaiting your confirmation before this
                                                changes your program.
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                <Button
                    onClick={onDone}
                    className="w-full mt-10 h-12 font-mono tracking-widest"
                >
                    RETURN TO COMMAND CENTER
                </Button>
            </div>
        </div>
    )
}
