'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
    Dumbbell,
    Heart,
    Flame,
    Mountain,
    Activity,
    Clock,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    Play,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SessionPreview } from './SessionPreview'
import { MoveSessionMenu } from './MoveSessionMenu'
import type { SessionInventory } from '@/lib/types/inventory.types'
import type { WorkoutWithSets } from '@/lib/types/training.types'

// ─── Modality config: earth-tone palette ────────────────────────────────────

const MODALITY_CONFIG = {
    LIFTING: {
        icon: Dumbbell,
        color: 'text-amber-500',
        borderAccent: 'border-l-amber-500/50',
        glowColor: 'rgba(217,119,6,0.12)',
        badge: 'modality_lifting' as const,
        label: 'Lifting',
    },
    CARDIO: {
        icon: Heart,
        color: 'text-emerald-500',
        borderAccent: 'border-l-emerald-600/50',
        glowColor: 'rgba(5,150,105,0.12)',
        badge: 'modality_cardio' as const,
        label: 'Cardio',
    },
    METCON: {
        icon: Flame,
        color: 'text-orange-500',
        borderAccent: 'border-l-orange-600/50',
        glowColor: 'rgba(234,88,12,0.12)',
        badge: 'modality_metcon' as const,
        label: 'Metcon',
    },
    RUCKING: {
        icon: Mountain,
        color: 'text-stone-400',
        borderAccent: 'border-l-stone-500/50',
        glowColor: 'rgba(146,64,14,0.12)',
        badge: 'modality_rucking' as const,
        label: 'Rucking',
    },
    MOBILITY: {
        icon: Activity,
        color: 'text-teal-500',
        borderAccent: 'border-l-teal-600/50',
        glowColor: 'rgba(13,148,136,0.12)',
        badge: 'modality_cardio' as const,
        label: 'Mobility',
    },
} as const

function getConfig(modality: string) {
    return MODALITY_CONFIG[modality as keyof typeof MODALITY_CONFIG] ?? MODALITY_CONFIG.LIFTING
}

// ─── Single session row ──────────────────────────────────────────────────────

interface SessionRowProps {
    session: SessionInventory
    workout: WorkoutWithSets | null
    index: number
    allDayNumbers: number[]
}

function SessionRow({ session, workout, index, allDayNumbers }: SessionRowProps) {
    const [expanded, setExpanded] = useState(false)
    const config = getConfig(session.modality)
    const Icon = config.icon
    const isComplete = session.completed_at !== null

    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.25 }}
        >
            <div
                className={`border border-l-2 transition-all duration-200 ${
                    isComplete
                        ? 'border-[#1e2e1e] border-l-emerald-700/40 bg-[#080808]'
                        : `border-[#1f1f1f] ${config.borderAccent} bg-[#090909] hover:border-[#2a2a2a]`
                } relative overflow-hidden`}
            >
                {/* Subtle top-edge glow */}
                <div
                    className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
                    style={{ background: `linear-gradient(90deg, transparent, ${config.glowColor.replace('0.12', '0.5')}, transparent)` }}
                />

                {/* Main row */}
                <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpanded(v => !v)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(v => !v) }}
                >
                    {/* Icon */}
                    <div className={`shrink-0 ${isComplete ? 'text-emerald-600' : config.color}`}>
                        {isComplete ? (
                            <CheckCircle2 className="w-4 h-4" />
                        ) : (
                            <Icon className="w-4 h-4" />
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
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
                        <h4 className={`text-sm font-space-grotesk font-semibold truncate ${
                            isComplete ? 'text-neutral-500 line-through decoration-emerald-700/40' : 'text-neutral-100'
                        }`}>
                            {session.name}
                        </h4>
                    </div>

                    {/* Duration + actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        {session.estimated_duration_minutes && (
                            <div className="flex items-center gap-1 text-neutral-600">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px] font-mono">{session.estimated_duration_minutes}m</span>
                            </div>
                        )}

                        {!isComplete && (
                            <MoveSessionMenu
                                sessionId={session.id}
                                currentDay={session.training_day ?? 0}
                                allDayNumbers={allDayNumbers}
                            />
                        )}

                        {!isComplete && workout && (
                            <Link href={`/workout/${workout.id}`} onClick={(e) => e.stopPropagation()}>
                                <Button variant="chrome" size="sm" className="h-7 px-2.5 text-[9px]">
                                    <Play className="w-2.5 h-2.5 mr-1 fill-current" /> Start
                                </Button>
                            </Link>
                        )}

                        <span className="text-neutral-600">
                            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                    </div>
                </div>

                {/* Expandable preview */}
                <SessionPreview
                    session={session}
                    workout={workout}
                    isExpanded={expanded}
                />
            </div>
        </motion.div>
    )
}

// ─── Training Day Card ───────────────────────────────────────────────────────

interface TrainingDayCardProps {
    dayNumber: number
    sessions: SessionInventory[]
    isComplete: boolean
    sessionPool: WorkoutWithSets[]
    allDayNumbers: number[]
    index: number
}

export function TrainingDayCard({
    dayNumber,
    sessions,
    isComplete,
    sessionPool,
    allDayNumbers,
    index,
}: TrainingDayCardProps) {
    const totalMinutes = sessions.reduce(
        (sum, s) => sum + (s.estimated_duration_minutes ?? 0), 0
    )

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
            className="space-y-1"
        >
            {/* Day header */}
            <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                        Training Day
                    </span>
                    <span className="text-sm font-space-grotesk font-bold text-white">
                        {dayNumber}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {totalMinutes > 0 && (
                        <span className="text-[10px] font-mono text-neutral-600">
                            ~{totalMinutes}m total
                        </span>
                    )}
                    {isComplete && (
                        <div className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-mono uppercase">Complete</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Sessions */}
            <div className="space-y-1 pl-3 border-l border-[#1a1a1a]">
                {sessions
                    .slice()
                    .sort((a, b) => (a.session_slot ?? 1) - (b.session_slot ?? 1))
                    .map((session, i) => {
                        const workout = sessionPool.find(
                            w => w.session_inventory_id === session.id
                        ) ?? null
                        return (
                            <SessionRow
                                key={session.id}
                                session={session}
                                workout={workout}
                                index={i}
                                allDayNumbers={allDayNumbers}
                            />
                        )
                    })}
            </div>
        </motion.div>
    )
}
