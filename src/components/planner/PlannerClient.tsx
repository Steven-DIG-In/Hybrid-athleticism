'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Calendar,
    ChevronLeft,
    Loader2,
    RefreshCw,
    TrendingUp,
    AlertTriangle,
} from 'lucide-react'
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns'
import { Button } from '@/components/ui/button'
import { WeekCalendar } from '@/components/dashboard/WeekCalendar'
import { LoadInterferenceGraph } from '@/components/dashboard/LoadInterferenceGraph'
import { ConflictWarning } from '@/components/dashboard/ConflictWarning'
import { computeWeekLoad } from '@/lib/scheduling/load-scoring'
import { updateWorkoutDate } from '@/lib/actions/workout.actions'
import type { WorkoutWithSets, DayLoadSummary } from '@/lib/types/training.types'

interface PlannerClientProps {
    mesocycle: any
    initialWorkouts: WorkoutWithSets[]
}

export function PlannerClient({ mesocycle, initialWorkouts }: PlannerClientProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [workouts, setWorkouts] = useState(initialWorkouts)
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
    const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null)
    const [pendingConflicts, setPendingConflicts] = useState<{
        sessionId: string
        newDate: string
        conflicts: any[]
    } | null>(null)
    const [isReassigning, setIsReassigning] = useState(false)

    // Current view date (defaults to mesocycle start)
    const [viewDate, setViewDate] = useState(() => {
        return mesocycle.start_date ? new Date(mesocycle.start_date + 'T00:00:00') : new Date()
    })

    // Compute week start/end for the current view
    const weekStart = format(startOfMonth(viewDate), 'yyyy-MM-dd')
    const weekEnd = format(endOfMonth(viewDate), 'yyyy-MM-dd')

    // Compute load summaries
    const dayLoadSummaries = useMemo(() => {
        if (!mesocycle.start_date || !mesocycle.end_date) return []
        return computeWeekLoad(workouts, mesocycle.start_date, mesocycle.end_date)
    }, [workouts, mesocycle.start_date, mesocycle.end_date])

    // Navigation
    const goToPreviousMonth = () => {
        const prev = new Date(viewDate)
        prev.setMonth(prev.getMonth() - 1)
        setViewDate(prev)
    }

    const goToNextMonth = () => {
        const next = new Date(viewDate)
        next.setMonth(next.getMonth() + 1)
        setViewDate(next)
    }

    const goToToday = () => {
        setViewDate(new Date())
    }

    // Drag and drop handlers
    const handleDropSession = async (sessionId: string, targetDate: string) => {
        const session = workouts.find(w => w.id === sessionId)
        if (!session) return

        // Check for conflicts
        const conflicts = [] // TODO: Add conflict detection logic

        if (conflicts.length > 0) {
            setPendingConflicts({ sessionId, newDate: targetDate, conflicts })
        } else {
            await performMove(sessionId, targetDate)
        }
    }

    const performMove = async (sessionId: string, newDate: string) => {
        setIsReassigning(true)
        const result = await updateWorkoutDate(sessionId, newDate)

        if (result.success) {
            // Optimistically update UI
            setWorkouts(prev => prev.map(w =>
                w.id === sessionId ? { ...w, scheduled_date: newDate } : w
            ))
            startTransition(() => {
                router.refresh()
            })
        }

        setIsReassigning(false)
        setPendingConflicts(null)
    }

    const handleConfirmConflictMove = () => {
        if (!pendingConflicts) return
        performMove(pendingConflicts.sessionId, pendingConflicts.newDate)
    }

    // Stats
    const totalSessions = workouts.length
    const completedSessions = workouts.filter(w => w.is_completed).length
    const upcomingSessions = workouts.filter(w => !w.is_completed && w.scheduled_date >= format(new Date(), 'yyyy-MM-dd')).length

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <div className="border-b border-[#1a1a1a] bg-[#0a0a0a] px-6 py-4">
                <div className="flex items-center justify-between max-w-[1800px] mx-auto">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/dashboard')}
                            className="text-neutral-400 hover:text-white"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Back to Dashboard
                        </Button>
                        <div className="h-6 w-px bg-[#222]" />
                        <div>
                            <h1 className="text-xl font-space-grotesk font-bold text-white">
                                Training Planner
                            </h1>
                            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">
                                {mesocycle.name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs font-mono">
                            <div>
                                <span className="text-neutral-500">Total:</span>
                                <span className="ml-2 text-white font-bold">{totalSessions}</span>
                            </div>
                            <div>
                                <span className="text-neutral-500">Complete:</span>
                                <span className="ml-2 text-emerald-400 font-bold">{completedSessions}</span>
                            </div>
                            <div>
                                <span className="text-neutral-500">Upcoming:</span>
                                <span className="ml-2 text-cyan-400 font-bold">{upcomingSessions}</span>
                            </div>
                        </div>

                        {/* Month Navigation */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={goToToday}
                                className="text-xs text-neutral-400 hover:text-cyan-400"
                            >
                                Today
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={goToPreviousMonth}
                                className="text-neutral-400 hover:text-white"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm font-space-grotesk font-bold min-w-[120px] text-center">
                                {format(viewDate, 'MMMM yyyy')}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={goToNextMonth}
                                className="text-neutral-400 hover:text-white"
                            >
                                <ChevronLeft className="w-4 h-4 rotate-180" />
                            </Button>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.refresh()}
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

            {/* Main Content */}
            <div className="max-w-[1800px] mx-auto px-6 py-6">
                <div className="space-y-6">
                    {/* Load Graphs Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-cyan-400" />
                            <h2 className="text-sm font-space-grotesk font-bold text-white uppercase tracking-wider">
                                Load Distribution
                            </h2>
                        </div>

                        <LoadInterferenceGraph
                            dayLoadSummaries={dayLoadSummaries}
                            weekStartDate={mesocycle.start_date ?? weekStart}
                            weekEndDate={mesocycle.end_date ?? weekEnd}
                        />

                        {/* Legend */}
                        <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
                            <div className="flex items-center gap-6 text-xs font-mono">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
                                    <span className="text-neutral-400">Optimal</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/40" />
                                    <span className="text-neutral-400">High Load</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40" />
                                    <span className="text-neutral-400">Overloaded</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                                    <span className="text-neutral-400">Conflicts Detected</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Calendar */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6"
                    >
                        <WeekCalendar
                            sessions={workouts}
                            weekStartDate={weekStart}
                            weekEndDate={weekEnd}
                            dayLoadSummaries={dayLoadSummaries}
                            selectedSessionId={selectedSessionId}
                            onDayClick={() => {}}
                            onSessionClick={(id) => router.push(`/workout/${id}`)}
                            onDropSession={handleDropSession}
                            onDragStartSession={setDraggingSessionId}
                            onDragEndSession={() => setDraggingSessionId(null)}
                            draggingSessionId={draggingSessionId}
                        />
                    </motion.div>

                    {/* Conflict Warning */}
                    {pendingConflicts && (
                        <ConflictWarning
                            conflicts={pendingConflicts.conflicts}
                            onConfirm={handleConfirmConflictMove}
                            onCancel={() => setPendingConflicts(null)}
                            isPending={isReassigning}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
