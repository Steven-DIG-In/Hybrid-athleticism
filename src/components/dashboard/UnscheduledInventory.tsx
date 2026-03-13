'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Calendar,
    Dumbbell,
    Footprints,
    Zap,
    Activity,
    ChevronRight,
    Clock,
    Target,
    CheckCircle2,
} from 'lucide-react'
import type { UnscheduledInventoryView, SessionInventory } from '@/lib/types/inventory.types'
import { cn } from '@/lib/utils'

interface UnscheduledInventoryProps {
    inventory: UnscheduledInventoryView
    onAllocateWeek: (weekNumber: number) => void
    onScheduleSession: (sessionId: string) => void
}

export function UnscheduledInventory({
    inventory,
    onAllocateWeek,
    onScheduleSession,
}: UnscheduledInventoryProps) {
    const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]))

    const toggleWeek = (weekNumber: number) => {
        const newExpanded = new Set(expandedWeeks)
        if (newExpanded.has(weekNumber)) {
            newExpanded.delete(weekNumber)
        } else {
            newExpanded.add(weekNumber)
        }
        setExpandedWeeks(newExpanded)
    }

    if (inventory.totalSessions === 0) {
        return (
            <div className="p-6 bg-[#0a0a0a] border border-[#222222] rounded-lg">
                <div className="text-center">
                    <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                    <h3 className="text-sm font-space-grotesk font-bold text-neutral-400 mb-1">
                        No Unscheduled Sessions
                    </h3>
                    <p className="text-xs text-neutral-600 font-inter">
                        All sessions have been allocated to your calendar.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-space-grotesk font-bold text-white">
                        Unscheduled Sessions
                    </h2>
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">
                        {inventory.totalSessions} sessions · {inventory.approvedSessions} approved
                    </p>
                </div>
            </div>

            {/* Week Groups */}
            <div className="space-y-2">
                {inventory.weekGroups.map((weekGroup) => {
                    const isExpanded = expandedWeeks.has(weekGroup.weekNumber)
                    const allApproved = weekGroup.sessions.every(s => s.is_approved)

                    return (
                        <div
                            key={weekGroup.weekNumber}
                            className="bg-[#0a0a0a] border border-[#222222] rounded-lg overflow-hidden"
                        >
                            {/* Week Header */}
                            <div className="p-4 flex items-center justify-between hover:bg-[#111] transition-colors">
                                <button
                                    onClick={() => toggleWeek(weekGroup.weekNumber)}
                                    className="flex items-center gap-3 flex-1"
                                >
                                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                        <span className="text-xs font-space-grotesk font-bold text-cyan-400">
                                            W{weekGroup.weekNumber}
                                        </span>
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-space-grotesk font-bold text-white">
                                            Week {weekGroup.weekNumber}
                                        </h3>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="text-[10px] font-mono text-neutral-500">
                                                {weekGroup.sessions.length} sessions
                                            </span>
                                            <span className="text-[10px] font-mono text-neutral-500">
                                                {weekGroup.totalDuration}min
                                            </span>
                                            {allApproved && (
                                                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Approved
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>

                                <div className="flex items-center gap-2">
                                    {!isExpanded && (
                                        <button
                                            onClick={() => onAllocateWeek(weekGroup.weekNumber)}
                                            className="px-3 py-1.5 bg-cyan-500 text-black text-xs font-space-grotesk font-bold rounded hover:bg-cyan-400 transition-colors"
                                        >
                                            Allocate Week
                                        </button>
                                    )}
                                    <button
                                        onClick={() => toggleWeek(weekGroup.weekNumber)}
                                        className="p-1"
                                    >
                                        <ChevronRight
                                            className={cn(
                                                "w-5 h-5 text-neutral-500 transition-transform",
                                                isExpanded && "rotate-90"
                                            )}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Session List */}
                            {isExpanded && (
                                <div className="border-t border-[#222222]">
                                    <div className="p-4 space-y-2">
                                        {weekGroup.sessions.map((session) => (
                                            <SessionCard
                                                key={session.id}
                                                session={session}
                                                onSchedule={() => onScheduleSession(session.id)}
                                            />
                                        ))}

                                        {/* Allocate Week Button */}
                                        <button
                                            onClick={() => onAllocateWeek(weekGroup.weekNumber)}
                                            className="w-full mt-3 px-4 py-3 bg-cyan-500 text-black text-sm font-space-grotesk font-bold rounded hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Calendar className="w-4 h-4" />
                                            Allocate All Sessions to Calendar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Session Card ────────────────────────────────────────────────────────────

interface SessionCardProps {
    session: SessionInventory
    onSchedule: () => void
}

function SessionCard({ session, onSchedule }: SessionCardProps) {
    const Icon = getModalityIcon(session.modality)
    const color = getModalityColor(session.modality)
    const priority = session.session_priority

    return (
        <div className="p-3 bg-[#111] border border-[#222] rounded-md hover:border-cyan-900/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                    <div className={cn("mt-0.5", color)}>
                        <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-space-grotesk font-bold text-white truncate">
                                {session.name}
                            </h4>
                            {priority > 1 && (
                                <span className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                                    {priority === 2 ? 'Recommended' : 'Optional'}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-3 mt-1">
                            {session.estimated_duration_minutes && (
                                <span className="flex items-center gap-1 text-[10px] font-mono text-neutral-500">
                                    <Clock className="w-3 h-3" />
                                    {session.estimated_duration_minutes}min
                                </span>
                            )}
                            {session.load_budget && (
                                <span className="flex items-center gap-1 text-[10px] font-mono text-neutral-500">
                                    <Target className="w-3 h-3" />
                                    {session.load_budget}/10
                                </span>
                            )}
                        </div>

                        {session.carry_over_notes && (
                            <p className="text-[10px] text-cyan-300 font-inter mt-2 leading-relaxed">
                                💡 {session.carry_over_notes}
                            </p>
                        )}
                    </div>
                </div>

                <button
                    onClick={onSchedule}
                    className="flex-shrink-0 px-2 py-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 border border-cyan-900/50 hover:border-cyan-500/50 rounded transition-colors uppercase tracking-wider"
                >
                    Schedule
                </button>
            </div>
        </div>
    )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getModalityIcon(modality: string) {
    switch (modality) {
        case 'LIFTING':
            return Dumbbell
        case 'CARDIO':
        case 'RUCKING':
            return Footprints
        case 'METCON':
            return Zap
        case 'MOBILITY':
            return Activity
        default:
            return Target
    }
}

function getModalityColor(modality: string): string {
    switch (modality) {
        case 'LIFTING':
            return 'text-blue-400'
        case 'CARDIO':
        case 'RUCKING':
            return 'text-emerald-400'
        case 'METCON':
            return 'text-purple-400'
        case 'MOBILITY':
            return 'text-teal-400'
        default:
            return 'text-neutral-400'
    }
}
