"use client"

import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { StaleSessionsModal } from "./StaleSessionsModal"
import type { StaleCandidate } from "@/lib/analytics/stale-sessions"

/**
 * Surfaces sessions still pending in program weeks the athlete has moved past.
 *
 * Follows the dashboard banner convention (amber, above the week view) set by
 * CloseBlockNudgeBanner and OverrunSignalBanner.
 *
 * Deliberately has NO dismiss control. The backlog is a real signal, and a
 * dismissal that hides it while it persists is a lie — it would put adherence
 * right back to being quietly optimistic, which is the bug this exists to fix.
 * The banner disappears when the last stale session is dispositioned.
 */
export function StaleSessionsBanner({ sessions }: { sessions: StaleCandidate[] }) {
    const [open, setOpen] = useState(false)

    if (sessions.length === 0) return null

    const weeks = Array.from(new Set(sessions.map(s => s.weekNumber))).sort((a, b) => a - b)
    const weekLabel =
        weeks.length === 1 ? `week ${weeks[0]}` : `weeks ${weeks[0]}–${weeks[weeks.length - 1]}`

    return (
        <>
            <div className="border border-amber-500/40 bg-amber-500/5 p-4 flex items-center gap-3 flex-wrap">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-sm font-inter text-neutral-200 flex-1 min-w-[12rem]">
                    <span className="font-semibold">
                        {sessions.length} session{sessions.length === 1 ? "" : "s"}
                    </span>{" "}
                    from {weekLabel} {sessions.length === 1 ? "is" : "are"} still open.
                </p>
                <button
                    onClick={() => setOpen(true)}
                    className="h-11 px-4 text-xs font-mono tracking-widest text-amber-400
                               border border-amber-500/40 hover:bg-amber-500/10 transition-colors"
                >
                    REVIEW
                </button>
            </div>

            {open && (
                <StaleSessionsModal sessions={sessions} onClose={() => setOpen(false)} />
            )}
        </>
    )
}
