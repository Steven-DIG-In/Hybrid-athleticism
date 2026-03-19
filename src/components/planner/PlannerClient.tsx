'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    Loader2,
    RefreshCw,
    CheckCircle2,
    Circle,
    Dumbbell,
    Heart,
    Flame,
    Mountain,
    Activity,
    Clock,
    Layers,
    Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AllocationModal } from '@/components/dashboard/AllocationModal'
import type { SessionInventory } from '@/lib/types/inventory.types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BlockGroup {
    blockNumber: number
    sessions: SessionInventory[]
    isAllocated: boolean
    isComplete: boolean
    isCurrent: boolean
    days: DayGroup[]
    unallocatedCount: number
}

interface DayGroup {
    dayNumber: number
    sessions: SessionInventory[]
    isComplete: boolean
}

// ─── Modality config ─────────────────────────────────────────────────────────

const MODALITY_CONFIG = {
    LIFTING: {
        icon: Dumbbell,
        color: 'text-amber-500',
        borderAccent: 'border-l-amber-500/40',
        glowColor: 'rgba(217,119,6,0.10)',
        badge: 'modality_lifting' as const,
        label: 'Lifting',
    },
    CARDIO: {
        icon: Heart,
        color: 'text-emerald-500',
        borderAccent: 'border-l-emerald-600/40',
        glowColor: 'rgba(5,150,105,0.10)',
        badge: 'modality_cardio' as const,
        label: 'Cardio',
    },
    METCON: {
        icon: Flame,
        color: 'text-orange-500',
        borderAccent: 'border-l-orange-600/40',
        glowColor: 'rgba(234,88,12,0.10)',
        badge: 'modality_metcon' as const,
        label: 'Metcon',
    },
    RUCKING: {
        icon: Mountain,
        color: 'text-stone-400',
        borderAccent: 'border-l-stone-500/40',
        glowColor: 'rgba(146,64,14,0.10)',
        badge: 'modality_rucking' as const,
        label: 'Rucking',
    },
    MOBILITY: {
        icon: Activity,
        color: 'text-teal-500',
        borderAccent: 'border-l-teal-600/40',
        glowColor: 'rgba(13,148,136,0.10)',
        badge: 'modality_cardio' as const,
        label: 'Mobility',
    },
} as const

function getModalityConfig(modality: string) {
    return MODALITY_CONFIG[modality as keyof typeof MODALITY_CONFIG] ?? MODALITY_CONFIG.LIFTING
}

// ─── Session pill in day row ─────────────────────────────────────────────────

function SessionPill({ session }: { session: SessionInventory }) {
    const config = getModalityConfig(session.modality)
    const Icon = config.icon
    const isComplete = session.completed_at !== null

    return (
        <div
            className={`flex items-center gap-2.5 border border-l-2 px-3 py-2 ${
                isComplete
                    ? 'border-[#1e2e1e] border-l-emerald-700/40 bg-[#080808]'
                    : `border-[#1f1f1f] ${config.borderAccent} bg-[#090909]`
            }`}
        >
            <div className={`shrink-0 ${isComplete ? 'text-emerald-600' : config.color}`}>
                {isComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                    <Icon className="w-3.5 h-3.5" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge variant={config.badge} className="text-[8px] py-0 px-1.5">
                        {config.label}
                    </Badge>
                    {session.session_slot === 2 && (
                        <span className="text-[8px] font-mono text-neutral-600 uppercase">PM</span>
                    )}
                    {isComplete && (
                        <span className="text-[8px] font-mono text-emerald-600 uppercase">Done</span>
                    )}
                </div>
                <p className={`text-xs font-space-grotesk font-semibold truncate ${
                    isComplete ? 'text-neutral-500 line-through decoration-emerald-700/40' : 'text-neutral-100'
                }`}>
                    {session.name}
                </p>
            </div>

            {session.estimated_duration_minutes && (
                <div className="flex items-center gap-1 text-neutral-600 shrink-0">
                    <Clock className="w-3 h-3" />
                    <span className="text-[9px] font-mono">{session.estimated_duration_minutes}m</span>
                </div>
            )}
        </div>
    )
}

// ─── Allocated day row ───────────────────────────────────────────────────────

function DayRow({ day, index }: { day: DayGroup; index: number }) {
    const isComplete = day.isComplete

    return (
        <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04, duration: 0.2 }}
            className="flex gap-3"
        >
            {/* Waypoint indicator */}
            <div className="flex flex-col items-center pt-2 shrink-0">
                <div className={`w-2 h-2 rounded-full border ${
                    isComplete
                        ? 'bg-emerald-600 border-emerald-700'
                        : 'bg-transparent border-neutral-600'
                }`} />
                <div className="w-px flex-1 bg-[#1f1f1f] mt-1" />
            </div>

            {/* Day content */}
            <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest">
                        Day
                    </span>
                    <span className="text-sm font-space-grotesk font-bold text-neutral-300">
                        {day.dayNumber}
                    </span>
                    {isComplete && (
                        <span className="text-[8px] font-mono text-emerald-600 uppercase tracking-wider">
                            Complete
                        </span>
                    )}
                </div>

                <div className="space-y-1">
                    {day.sessions
                        .slice()
                        .sort((a, b) => (a.session_slot ?? 1) - (b.session_slot ?? 1))
                        .map(session => (
                            <SessionPill key={session.id} session={session} />
                        ))}
                </div>
            </div>
        </motion.div>
    )
}

// ─── Block card ──────────────────────────────────────────────────────────────

interface BlockCardProps {
    block: BlockGroup
    onAllocate: (blockNumber: number) => void
    defaultExpanded: boolean
}

function BlockCard({ block, onAllocate, defaultExpanded }: BlockCardProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)

    const statusLabel = block.isComplete
        ? 'Complete'
        : block.isCurrent
            ? 'Current'
            : block.isAllocated
                ? 'Allocated'
                : 'Unallocated'

    const statusColor = block.isComplete
        ? 'text-emerald-500'
        : block.isCurrent
            ? 'text-cyan-400'
            : block.isAllocated
                ? 'text-neutral-400'
                : 'text-amber-500/70'

    const headerBorder = block.isCurrent
        ? 'border-cyan-500/20'
        : block.isComplete
            ? 'border-emerald-900/30'
            : 'border-[#1f1f1f]'

    const headerBg = block.isCurrent
        ? 'bg-cyan-950/10'
        : 'bg-[#0a0a0a]'

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`border ${headerBorder} overflow-hidden`}
        >
            {/* Block header */}
            <button
                onClick={() => setIsExpanded(v => !v)}
                className={`w-full flex items-center justify-between px-5 py-4 ${headerBg} hover:brightness-110 transition-all duration-150`}
            >
                <div className="flex items-center gap-4">
                    {/* Block number badge */}
                    <div className={`w-9 h-9 flex items-center justify-center border font-space-grotesk font-bold text-sm ${
                        block.isCurrent
                            ? 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20'
                            : block.isComplete
                                ? 'border-emerald-800/40 text-emerald-600 bg-emerald-950/10'
                                : 'border-[#272727] text-neutral-500 bg-[#0d0d0d]'
                    }`}>
                        {block.blockNumber}
                    </div>

                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-space-grotesk font-bold text-white">
                                Block {block.blockNumber}
                            </h3>
                            {block.isCurrent && (
                                <span className="text-[8px] font-mono text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 uppercase tracking-wider">
                                    Active
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className={`text-[10px] font-mono uppercase tracking-wider ${statusColor}`}>
                                {statusLabel}
                            </span>
                            {block.isAllocated ? (
                                <span className="text-[10px] font-mono text-neutral-600">
                                    {block.sessions.length} sessions · {block.days.length} training days
                                </span>
                            ) : (
                                <span className="text-[10px] font-mono text-neutral-600">
                                    {block.unallocatedCount} sessions unallocated
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!block.isAllocated && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAllocate(block.blockNumber) }}
                            className="px-3 py-1.5 bg-amber-500/90 text-black text-[11px] font-space-grotesk font-bold hover:bg-amber-400 transition-colors"
                        >
                            Allocate Block {block.blockNumber}
                        </button>
                    )}
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronRight className="w-4 h-4 text-neutral-600" />
                    </motion.div>
                </div>
            </button>

            {/* Block body */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-[#1a1a1a] px-5 pt-4 pb-3">
                            {block.isAllocated ? (
                                /* Allocated: show training day timeline */
                                <div className="space-y-0">
                                    {block.days
                                        .slice()
                                        .sort((a, b) => a.dayNumber - b.dayNumber)
                                        .map((day, i) => (
                                            <DayRow key={day.dayNumber} day={day} index={i} />
                                        ))}
                                </div>
                            ) : (
                                /* Unallocated: summary + allocate CTA */
                                <div className="py-2 space-y-4">
                                    <div className="space-y-1.5">
                                        {block.sessions.map((session) => {
                                            const config = getModalityConfig(session.modality)
                                            const Icon = config.icon
                                            return (
                                                <div
                                                    key={session.id}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#0d0d0d] border border-[#1a1a1a]"
                                                >
                                                    <Icon className={`w-3.5 h-3.5 shrink-0 ${config.color}`} />
                                                    <span className="text-xs font-inter text-neutral-400 truncate flex-1">
                                                        {session.name}
                                                    </span>
                                                    {session.estimated_duration_minutes && (
                                                        <span className="text-[9px] font-mono text-neutral-600 shrink-0">
                                                            {session.estimated_duration_minutes}m
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <button
                                        onClick={() => onAllocate(block.blockNumber)}
                                        className="w-full px-4 py-3 bg-amber-500/90 text-black text-sm font-space-grotesk font-bold hover:bg-amber-400 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        Allocate Block {block.blockNumber}
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

// ─── Main PlannerClient ──────────────────────────────────────────────────────

interface PlannerClientProps {
    mesocycle: {
        id: string
        name: string
        week_count?: number | null
    }
    allSessions: SessionInventory[]
    totalBlocks: number
}

export function PlannerClient({ mesocycle, allSessions, totalBlocks }: PlannerClientProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [allocationModal, setAllocationModal] = useState<{ isOpen: boolean; blockNumber: number | null }>({
        isOpen: false,
        blockNumber: null,
    })

    // ─── Group sessions into blocks ───────────────────────────────────────────

    const blocks = useMemo<BlockGroup[]>(() => {
        // Group by week_number
        const byBlock = new Map<number, SessionInventory[]>()
        for (const session of allSessions) {
            const b = session.week_number
            if (!byBlock.has(b)) byBlock.set(b, [])
            byBlock.get(b)!.push(session)
        }

        // Ensure all block numbers from 1..totalBlocks are represented
        for (let n = 1; n <= totalBlocks; n++) {
            if (!byBlock.has(n)) byBlock.set(n, [])
        }

        const result: BlockGroup[] = []

        for (const [blockNumber, sessions] of Array.from(byBlock.entries()).sort((a, b) => a[0] - b[0])) {
            const allocatedSessions = sessions.filter(s => s.training_day !== null)
            const unallocatedSessions = sessions.filter(s => s.training_day === null)
            const isAllocated = allocatedSessions.length > 0

            // Group allocated sessions by training day
            const dayMap = new Map<number, SessionInventory[]>()
            for (const s of allocatedSessions) {
                const d = s.training_day!
                if (!dayMap.has(d)) dayMap.set(d, [])
                dayMap.get(d)!.push(s)
            }

            const days: DayGroup[] = Array.from(dayMap.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([dayNumber, daySessions]) => ({
                    dayNumber,
                    sessions: daySessions,
                    isComplete: daySessions.every(s => s.completed_at !== null),
                }))

            const isComplete = isAllocated && allocatedSessions.every(s => s.completed_at !== null)

            result.push({
                blockNumber,
                sessions,
                isAllocated,
                isComplete,
                // "current" = first block that is allocated but not fully complete
                isCurrent: false, // set in a second pass below
                days,
                unallocatedCount: unallocatedSessions.length,
            })
        }

        // Mark current block: first allocated + not complete; fall back to first unallocated
        let foundCurrent = false
        for (const block of result) {
            if (!foundCurrent && block.isAllocated && !block.isComplete) {
                block.isCurrent = true
                foundCurrent = true
            }
        }
        if (!foundCurrent) {
            const firstUnallocated = result.find(b => !b.isAllocated)
            if (firstUnallocated) firstUnallocated.isCurrent = true
        }

        return result
    }, [allSessions, totalBlocks])

    // Stats
    const totalSessions = allSessions.length
    const completedSessions = allSessions.filter(s => s.completed_at !== null).length
    const allocatedSessions = allSessions.filter(s => s.training_day !== null).length

    const handleAllocate = (blockNumber: number) => {
        setAllocationModal({ isOpen: true, blockNumber })
    }

    const handleAllocationComplete = () => {
        setAllocationModal({ isOpen: false, blockNumber: null })
        startTransition(() => { router.refresh() })
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <div className="border-b border-[#1a1a1a] bg-[#0a0a0a] px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between max-w-3xl mx-auto">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/dashboard')}
                            className="text-neutral-400 hover:text-white"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Dashboard
                        </Button>
                        <div className="h-5 w-px bg-[#222]" />
                        <div>
                            <h1 className="text-lg font-space-grotesk font-bold text-white leading-none">
                                Training Planner
                            </h1>
                            <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider mt-0.5">
                                {mesocycle.name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-5">
                        {/* Stats strip */}
                        <div className="flex items-center gap-4 text-[11px] font-mono">
                            <div className="flex items-center gap-1.5">
                                <Layers className="w-3 h-3 text-neutral-600" />
                                <span className="text-neutral-500">Blocks:</span>
                                <span className="text-white font-bold">{totalBlocks}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-neutral-500">Allocated:</span>
                                <span className="text-cyan-400 font-bold">{allocatedSessions}</span>
                                <span className="text-neutral-600">/ {totalSessions}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-neutral-500">Done:</span>
                                <span className="text-emerald-400 font-bold">{completedSessions}</span>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startTransition(() => router.refresh())}
                            disabled={isPending}
                            className="text-neutral-400 hover:text-white"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="max-w-3xl mx-auto px-6 py-8">
                {blocks.length === 0 ? (
                    <div className="border border-[#1f1f1f] bg-[#0a0a0a] p-12 text-center">
                        <Circle className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
                        <h3 className="text-sm font-space-grotesk text-neutral-400 mb-1">No sessions yet</h3>
                        <p className="text-xs text-neutral-600 font-inter">
                            Your training program is still being generated.
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.refresh()}
                            className="mt-4 text-xs text-cyan-400 hover:text-cyan-300"
                        >
                            <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {blocks.map(block => (
                            <BlockCard
                                key={block.blockNumber}
                                block={block}
                                onAllocate={handleAllocate}
                                defaultExpanded={block.isCurrent || block.blockNumber === 1}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Allocation modal */}
            <AllocationModal
                isOpen={allocationModal.isOpen}
                weekNumber={allocationModal.blockNumber}
                mesocycleId={mesocycle.id}
                onClose={() => setAllocationModal({ isOpen: false, blockNumber: null })}
                onComplete={handleAllocationComplete}
            />
        </div>
    )
}
