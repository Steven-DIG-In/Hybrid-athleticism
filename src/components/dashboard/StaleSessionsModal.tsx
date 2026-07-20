"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { markSessionsMissed } from "@/lib/actions/inventory.actions"
import type { StaleCandidate } from "@/lib/analytics/stale-sessions"

/**
 * Triage for sessions left behind in earlier program weeks.
 *
 * Marking missed is the only disposition offered. Carrying a two-week-old
 * session into an already-populated week is not something the athlete does, and
 * the cross-week move it would need does not exist — `rescheduleToToday` only
 * stamps `scheduled_date`, which is not what places a session.
 */
export function StaleSessionsModal({
    sessions,
    onClose,
}: {
    sessions: StaleCandidate[]
    onClose: () => void
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const dispatch = (ids: string[]) => {
        setError(null)
        startTransition(async () => {
            const res = await markSessionsMissed(ids)
            if (res.success) {
                router.refresh()
                // The banner recomputes from fresh data; close once nothing is left.
                if (ids.length === sessions.length) onClose()
            } else {
                setError(res.error ?? "Could not mark the session missed. Try again.")
            }
        })
    }

    const byWeek = sessions.reduce<Record<number, StaleCandidate[]>>((acc, s) => {
        ;(acc[s.weekNumber] ??= []).push(s)
        return acc
    }, {})

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stale-sessions-title"
        >
            <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto border border-[#222222] bg-[#0a0a0a]">
                <div className="flex items-start justify-between gap-4 p-5 border-b border-[#222222]">
                    <div>
                        <h2
                            id="stale-sessions-title"
                            className="text-lg font-space-grotesk font-bold"
                        >
                            Left behind
                        </h2>
                        <p className="text-xs font-inter text-neutral-400 mt-1">
                            These are still open in weeks you&apos;ve moved past. Marking them
                            missed keeps your adherence honest — you can still drag one back
                            from the week view.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-2 -m-2 text-neutral-500 hover:text-neutral-300"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-5">
                    {Object.entries(byWeek).map(([week, weekSessions]) => (
                        <div key={week}>
                            <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">
                                Week {week}
                            </p>
                            <div className="flex flex-col gap-2">
                                {weekSessions.map(s => (
                                    <div
                                        key={s.id}
                                        className="flex items-center justify-between gap-3 border border-[#222222] bg-[#111111] p-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{s.name}</p>
                                            <p className="text-[10px] font-mono text-neutral-500">
                                                {s.modality}
                                                {s.trainingDay ? ` · Day ${s.trainingDay}` : " · unallocated"}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            onClick={() => dispatch([s.id])}
                                            disabled={isPending}
                                            className="h-11 px-4 shrink-0 text-xs font-mono tracking-widest text-red-400 border border-red-500/40 hover:bg-red-500/10"
                                        >
                                            MISSED
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {error && (
                        <p className="text-xs font-mono text-red-400 border border-red-500/40 bg-red-500/10 p-3">
                            {error}
                        </p>
                    )}

                    <div className="flex flex-col gap-2 pt-1">
                        <Button
                            onClick={() => dispatch(sessions.map(s => s.id))}
                            disabled={isPending}
                            className="w-full h-12 font-mono tracking-widest"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                `MARK ALL ${sessions.length} MISSED`
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={isPending}
                            className="w-full h-11 text-neutral-400 font-mono tracking-widest text-xs"
                        >
                            LEAVE FOR NOW
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
