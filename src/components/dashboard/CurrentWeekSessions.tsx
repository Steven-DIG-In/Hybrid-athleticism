'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
    Dumbbell,
    Heart,
    Flame,
    Mountain,
    Activity,
    CheckCircle2,
    Circle,
    ChevronRight,
    Calendar,
} from 'lucide-react'
import { format, isToday, isPast, parseISO } from 'date-fns'
import type { WorkoutWithSets } from '@/lib/types/training.types'
import { Badge } from '@/components/ui/badge'

interface CurrentWeekSessionsProps {
    sessions: WorkoutWithSets[]
    weekStartDate: string
    weekEndDate: string
}

const MODALITY_CONFIG: Record<string, { icon: typeof Dumbbell; color: string; badge: string }> = {
    LIFTING: { icon: Dumbbell, color: 'text-amber-500', badge: 'modality_lifting' },
    CARDIO: { icon: Heart, color: 'text-emerald-500', badge: 'modality_cardio' },
    RUCKING: { icon: Mountain, color: 'text-stone-400', badge: 'modality_rucking' },
    METCON: { icon: Flame, color: 'text-orange-500', badge: 'modality_metcon' },
    MOBILITY: { icon: Activity, color: 'text-teal-500', badge: 'modality_cardio' },
}

export function CurrentWeekSessions({ sessions, weekStartDate, weekEndDate }: CurrentWeekSessionsProps) {
    // Filter to current week and sort by date
    const weekSessions = useMemo(() => {
        return sessions
            .filter(s => s.scheduled_date >= weekStartDate && s.scheduled_date <= weekEndDate)
            .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    }, [sessions, weekStartDate, weekEndDate])

    const todaySessions = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        return weekSessions.filter(s => s.scheduled_date === todayStr)
    }, [weekSessions])

    const upcomingSessions = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        return weekSessions.filter(s => s.scheduled_date > todayStr && !s.is_completed)
    }, [weekSessions])

    const completedCount = weekSessions.filter(s => s.is_completed).length

    if (weekSessions.length === 0) {
        return (
            <div className="border border-[#222222] bg-[#0a0a0a] rounded-lg p-6 text-center">
                <Calendar className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                <h3 className="text-sm font-space-grotesk font-bold text-neutral-400 mb-1">
                    No Sessions This Week
                </h3>
                <p className="text-xs text-neutral-600 font-inter">
                    Allocate sessions from your inventory to get started.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-space-grotesk font-bold text-white">
                        This Week
                    </h2>
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">
                        {format(parseISO(weekStartDate), 'MMM d')} - {format(parseISO(weekEndDate), 'MMM d')} · {completedCount}/{weekSessions.length} complete
                    </p>
                </div>
            </div>

            {/* Today's Sessions */}
            {todaySessions.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Today</h3>
                    {todaySessions.map(session => (
                        <SessionCard key={session.id} session={session} isToday={true} />
                    ))}
                </div>
            )}

            {/* Upcoming Sessions */}
            {upcomingSessions.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Upcoming</h3>
                    {upcomingSessions.map(session => (
                        <SessionCard key={session.id} session={session} isToday={false} />
                    ))}
                </div>
            )}

            {/* All sessions complete message */}
            {completedCount === weekSessions.length && (
                <div className="border border-emerald-500/20 bg-emerald-950/10 rounded-lg p-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-space-grotesk font-bold text-emerald-300">
                        Week Complete!
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                        All {weekSessions.length} sessions completed. Great work.
                    </p>
                </div>
            )}
        </div>
    )
}

// ─── Session Card ────────────────────────────────────────────────────────────

interface SessionCardProps {
    session: WorkoutWithSets
    isToday: boolean
}

function SessionCard({ session, isToday }: SessionCardProps) {
    const config = MODALITY_CONFIG[session.modality] ?? MODALITY_CONFIG.LIFTING
    const Icon = config.icon
    const sessionDate = parseISO(session.scheduled_date + 'T00:00:00')
    const isOverdue = isPast(sessionDate) && !session.is_completed && !isToday

    return (
        <Link href={`/workout/${session.id}`}>
            <motion.div
                whileHover={{ scale: 1.01 }}
                className={`p-3 rounded-lg border transition-all ${
                    session.is_completed
                        ? 'bg-[#0a0a0a] border-[#222] opacity-60'
                        : isToday
                            ? 'bg-cyan-950/10 border-cyan-500/30 hover:border-cyan-500/50'
                            : isOverdue
                                ? 'bg-amber-950/10 border-amber-500/30 hover:border-amber-500/50'
                                : 'bg-[#0a0a0a] border-[#222] hover:border-neutral-700'
                }`}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Status Icon */}
                        <div className="mt-0.5">
                            {session.is_completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <Circle className={`w-4 h-4 ${isToday ? 'text-cyan-400' : 'text-neutral-600'}`} />
                            )}
                        </div>

                        {/* Session Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Icon className={`w-3.5 h-3.5 shrink-0 ${config.color}`} />
                                <Badge variant={config.badge as any} className="text-[9px] py-0">
                                    {session.modality}
                                </Badge>
                                {isToday && (
                                    <span className="text-[8px] font-mono text-cyan-400 uppercase tracking-wider">
                                        Today
                                    </span>
                                )}
                                {isOverdue && (
                                    <span className="text-[8px] font-mono text-amber-400 uppercase tracking-wider">
                                        Overdue
                                    </span>
                                )}
                            </div>

                            <h4 className="text-sm font-space-grotesk font-bold text-white truncate">
                                {session.name}
                            </h4>

                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-mono text-neutral-500">
                                    {format(sessionDate, 'EEE, MMM d')}
                                </span>
                                {session.exercise_sets.length > 0 && (
                                    <span className="text-[10px] font-mono text-neutral-600">
                                        · {new Set(session.exercise_sets.map(s => s.exercise_name)).size} exercises
                                    </span>
                                )}
                            </div>

                            {session.coach_notes && !session.is_completed && (
                                <p className="text-[10px] text-neutral-400 font-inter mt-2 line-clamp-2">
                                    {session.coach_notes}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Action */}
                    {!session.is_completed && (
                        <ChevronRight className="w-4 h-4 text-neutral-600 shrink-0 mt-1" />
                    )}
                </div>
            </motion.div>
        </Link>
    )
}
