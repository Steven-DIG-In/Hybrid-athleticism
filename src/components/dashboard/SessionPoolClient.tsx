'use client'

import { useState, useMemo, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Dumbbell,
    Timer,
    Zap,
    Activity,
    ChevronDown,
    ChevronRight,
    ChevronLeft,
    Play,
    CheckCircle2,
    RefreshCw,
    Loader2,
    Sparkles,
    Clock,
    Target,
    AlertTriangle,
    Plus,
    ArrowRightLeft,
    Calendar,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { regenerateCurrentWeekPool, generateNextWeekPool, allocateSessionDates, deallocateAllSessions } from '@/lib/actions/programming.actions'
import { updateWorkoutDate } from '@/lib/actions/workout.actions'
import { SessionRegenDrawer } from './SessionRegenDrawer'
import { WeekCalendar } from './WeekCalendar'
import { ConflictWarning } from './ConflictWarning'
import { computeWeekLoad } from '@/lib/scheduling/load-scoring'
import { MesocyclePlanView } from './MesocyclePlanView'
import { UnscheduledInventory } from './UnscheduledInventory'
import { AllocationModal } from './AllocationModal'
import { CurrentWeekSessions } from './CurrentWeekSessions'
import { TrainingDayList } from './TrainingDayList'
import type { DashboardData, WorkoutWithSets, DayLoadSummary } from '@/lib/types/training.types'
import type { UnscheduledInventoryView } from '@/lib/types/inventory.types'
import { getUnscheduledInventory } from '@/lib/actions/inventory.actions'

// ─── Modality Config ────────────────────────────────────────────────────────

const MODALITY_CONFIG: Record<string, { icon: typeof Dumbbell; color: string; badge: string; bgGlow: string }> = {
    LIFTING: { icon: Dumbbell, color: 'text-blue-400', badge: 'modality_lifting', bgGlow: 'rgba(59,130,246,0.08)' },
    CARDIO: { icon: Timer, color: 'text-emerald-400', badge: 'modality_cardio', bgGlow: 'rgba(52,211,153,0.08)' },
    RUCKING: { icon: Timer, color: 'text-amber-400', badge: 'modality_rucking', bgGlow: 'rgba(251,191,36,0.08)' },
    METCON: { icon: Zap, color: 'text-purple-400', badge: 'modality_metcon', bgGlow: 'rgba(168,85,247,0.08)' },
    MOBILITY: { icon: Activity, color: 'text-teal-400', badge: 'modality_cardio', bgGlow: 'rgba(20,184,166,0.08)' },
}

function getModalityConfig(modality: string, name: string) {
    if (modality === 'CARDIO' && name.toLowerCase().includes('mobility')) {
        return MODALITY_CONFIG.MOBILITY ?? MODALITY_CONFIG.CARDIO
    }
    return MODALITY_CONFIG[modality] ?? MODALITY_CONFIG.LIFTING
}

// ─── Session Card ───────────────────────────────────────────────────────────

function SessionCard({
    workout,
    index,
    onRegenerate,
    onMoveSession,
    isSelectedForMove,
}: {
    workout: WorkoutWithSets
    index: number
    onRegenerate?: () => void
    onMoveSession?: (workoutId: string) => void
    isSelectedForMove?: boolean
}) {
    const [expanded, setExpanded] = useState(false)
    const config = getModalityConfig(workout.modality, workout.name)
    const Icon = config.icon
    const isComplete = workout.is_completed

    const exerciseNames = [...new Set(workout.exercise_sets.map(s => s.exercise_name))]
    const totalSets = workout.exercise_sets.length

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3 }}
        >
            <div
                className={`border transition-all duration-200 ${isComplete
                        ? 'border-cyan-500/30 bg-[#050505]'
                        : isSelectedForMove
                        ? 'border-cyan-500/50 bg-cyan-950/10 ring-1 ring-cyan-500/30'
                        : !workout.is_allocated
                        ? 'border-[#222222] border-l-amber-500/30 bg-[#0a0a0a] hover:border-[#333333]'
                        : 'border-[#222222] bg-[#0a0a0a] hover:border-[#333333]'
                    } relative overflow-hidden`}
            >
                {/* Subtle modality-colored top edge */}
                <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: `linear-gradient(90deg, transparent, ${config.bgGlow.replace('0.08', '0.4')}, transparent)` }}
                />

                {/* Main card content */}
                <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpanded(!expanded)}
                >
                    <div className="flex items-start gap-3">
                        {/* Modality icon */}
                        <div className={`p-2 bg-[#111111] border border-[#222222] mt-0.5 ${isComplete ? 'border-cyan-500/30' : ''}`}>
                            {isComplete ? (
                                <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                            ) : (
                                <Icon className={`w-5 h-5 ${config.color}`} />
                            )}
                        </div>

                        {/* Session info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant={config.badge as any} className="text-[9px] py-0">
                                    {workout.modality}
                                </Badge>
                                {workout.is_allocated ? (
                                    <span className="text-[9px] font-mono text-cyan-500/60">
                                        {new Date(workout.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-mono text-amber-400/60">Unassigned</span>
                                )}
                                {isComplete && (
                                    <span className="text-[9px] font-mono text-cyan-400 uppercase">Complete</span>
                                )}
                                {isSelectedForMove && (
                                    <span className="text-[9px] font-mono text-cyan-400 uppercase animate-pulse">Moving...</span>
                                )}
                            </div>
                            <h3 className={`text-sm font-space-grotesk font-semibold break-words ${isComplete ? 'text-neutral-400 line-through decoration-cyan-500/30' : 'text-white'}`}>
                                {workout.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                                {totalSets > 0 && (
                                    <span className="text-[10px] font-mono text-neutral-500">
                                        {exerciseNames.length} exercises, {totalSets} sets
                                    </span>
                                )}
                                {workout.coach_notes && (
                                    <span className="text-[10px] font-mono text-cyan-500/50 truncate max-w-[140px]">
                                        {workout.coach_notes.slice(0, 50)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                            {!isComplete && onMoveSession && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMoveSession(workout.id) }}
                                    className={`p-1.5 transition-colors ${
                                        isSelectedForMove ? 'text-cyan-400' : 'text-neutral-600 hover:text-cyan-400'
                                    }`}
                                    title="Reassign to different day"
                                >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {!isComplete && onRegenerate && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRegenerate() }}
                                    className="p-1.5 text-neutral-500 hover:text-cyan-400 transition-colors"
                                    title="Change session"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {!isComplete && (
                                <Link href={`/workout/${workout.id}`} onClick={(e) => e.stopPropagation()}>
                                    <Button variant="chrome" size="sm" className="h-8 px-3 text-[10px]">
                                        <Play className="w-3 h-3 mr-1 fill-current" /> Start
                                    </Button>
                                </Link>
                            )}
                            <button className="p-1 text-neutral-500">
                                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-4 pt-0 border-t border-[#1a1a1a]">
                                {workout.modality === 'LIFTING' && exerciseNames.length > 0 ? (
                                    <div className="space-y-2 pt-3">
                                        {exerciseNames.map((name) => {
                                            const sets = workout.exercise_sets.filter(s => s.exercise_name === name)
                                            const firstSet = sets[0]
                                            return (
                                                <div key={name} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-neutral-200 font-inter font-medium">{name}</span>
                                                        <span className="text-[10px] text-neutral-600 font-mono">{firstSet.muscle_group}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-mono text-neutral-500">
                                                            {sets.length}x{firstSet.target_reps}
                                                        </span>
                                                        {firstSet.target_weight_kg && (
                                                            <span className="text-xs font-mono text-cyan-400">
                                                                {firstSet.target_weight_kg}kg
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-mono text-neutral-600">
                                                            RIR {firstSet.target_rir}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : workout.coach_notes ? (
                                    <p className="text-xs text-neutral-400 font-inter pt-3 leading-relaxed">
                                        {workout.coach_notes}
                                    </p>
                                ) : (
                                    <p className="text-xs text-neutral-500 font-inter pt-3 italic">
                                        No additional details
                                    </p>
                                )}

                                {!isComplete && (
                                    <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
                                        <Link href={`/workout/${workout.id}`}>
                                            <Button className="w-full h-12 bg-white text-black hover:bg-neutral-200 font-bold tracking-wide uppercase">
                                                <Play className="w-4 h-4 mr-2 fill-current" /> Initialize Session
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    )
}

// ─── Main Session Pool Client Component ─────────────────────────────────────

export function SessionPoolClient({ data }: { data: DashboardData }) {
    const router = useRouter()
    const [isRegenerating, startRegenerate] = useTransition()
    const [isGeneratingNext, startGenerateNext] = useTransition()
    const [isReassigning, startReassign] = useTransition()
    const [isAllocating, startAllocate] = useTransition()
    const [isDeallocating, startDeallocate] = useTransition()

    // Session regen drawer state
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [drawerMode, setDrawerMode] = useState<'regenerate' | 'add'>('add')
    const [drawerWorkoutId, setDrawerWorkoutId] = useState<string | null>(null)
    const [drawerWorkoutName, setDrawerWorkoutName] = useState<string | undefined>(undefined)

    // Calendar / assignment state
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
    const [pendingConflicts, setPendingConflicts] = useState<{ date: string; conflicts: DayLoadSummary['conflicts'] } | null>(null)

    // Error state for generation feedback
    const [generationError, setGenerationError] = useState<string | null>(null)

    // Inventory state
    const [inventory, setInventory] = useState<UnscheduledInventoryView | null>(null)
    const [loadingInventory, setLoadingInventory] = useState(false)

    // Allocation modal state
    const [allocationModal, setAllocationModal] = useState<{
        isOpen: boolean
        weekNumber: number | null
    }>({ isOpen: false, weekNumber: null })

    const { currentMesocycle, currentWeek, sessionPool, allWorkouts, completedCount, totalCount, hasUnreviewedIntervention, weekHasWorkouts, athleteName, goalArchetype, equipmentList, endurancePreferences, conditioningPreferences, previousWeekIsDeload, hasUnallocatedSessions, mesocycleStartDate, mesocycleEndDate } = data

    // Split sessions into unallocated and allocated
    const unallocatedSessions = useMemo(() => sessionPool.filter(w => !w.is_allocated), [sessionPool])
    const allocatedSessions = useMemo(() => sessionPool.filter(w => w.is_allocated), [sessionPool])

    // Compute day load summaries for calendar across entire mesocycle
    const dayLoadSummaries = useMemo(() => {
        if (!mesocycleStartDate || !mesocycleEndDate) return []
        return computeWeekLoad(allWorkouts, mesocycleStartDate, mesocycleEndDate)
    }, [allWorkouts, mesocycleStartDate, mesocycleEndDate])

    // Fetch unscheduled inventory when component mounts or mesocycle changes
    // Poll every 5 seconds if inventory is empty (generation in progress)
    useEffect(() => {
        if (!currentMesocycle?.id) return

        let isMounted = true
        let pollInterval: NodeJS.Timeout | null = null

        const fetchInventory = async () => {
            if (!isMounted) return

            setLoadingInventory(true)
            const result = await getUnscheduledInventory(currentMesocycle.id)

            if (!isMounted) return

            if (result.success && result.data) {
                setInventory(result.data)

                // Stop polling if we have inventory
                if (result.data.totalSessions > 0 && pollInterval) {
                    clearInterval(pollInterval)
                    pollInterval = null
                }
            }
            setLoadingInventory(false)
        }

        // Initial fetch
        fetchInventory()

        // Start polling after 5 seconds (give time for first fetch)
        const startPolling = setTimeout(() => {
            if (isMounted) {
                pollInterval = setInterval(fetchInventory, 5000)
            }
        }, 5000)

        return () => {
            isMounted = false
            clearTimeout(startPolling)
            if (pollInterval) clearInterval(pollInterval)
        }
    }, [currentMesocycle?.id])

    const openRegenDrawer = (workoutId: string, workoutName: string) => {
        setDrawerMode('regenerate')
        setDrawerWorkoutId(workoutId)
        setDrawerWorkoutName(workoutName)
        setDrawerOpen(true)
    }

    const openAddDrawer = () => {
        setDrawerMode('add')
        setDrawerWorkoutId(null)
        setDrawerWorkoutName(undefined)
        setDrawerOpen(true)
    }

    const handleMoveSession = (workoutId: string) => {
        if (selectedSessionId === workoutId) {
            // Deselect
            setSelectedSessionId(null)
            setPendingConflicts(null)
        } else {
            setSelectedSessionId(workoutId)
            setPendingConflicts(null)
        }
    }

    const handleDayClick = (targetDate: string) => {
        if (!selectedSessionId) return

        // Check for conflicts on the target day
        const targetDay = dayLoadSummaries.find(d => d.date === targetDate)
        if (targetDay && targetDay.conflicts.length > 0) {
            // Show conflict warning
            setPendingConflicts({ date: targetDate, conflicts: targetDay.conflicts })
            return
        }

        // No conflicts — proceed with move
        executeMove(selectedSessionId, targetDate)
    }

    const executeMove = (sessionId: string, targetDate: string) => {
        startReassign(async () => {
            const result = await updateWorkoutDate(sessionId, targetDate)
            if (result.success) {
                setSelectedSessionId(null)
                setPendingConflicts(null)
                router.refresh()
            } else {
                console.error('Move failed:', result.error)
            }
        })
    }

    const handleConfirmConflictMove = () => {
        if (!selectedSessionId || !pendingConflicts) return
        executeMove(selectedSessionId, pendingConflicts.date)
    }

    const handleAllocate = () => {
        startAllocate(async () => {
            const result = await allocateSessionDates(data.currentWeek?.id)
            if (result.success) {
                router.refresh()
            } else {
                console.error('Allocate failed:', result.error)
            }
        })
    }

    const handleDeallocate = () => {
        startDeallocate(async () => {
            const result = await deallocateAllSessions(data.currentWeek?.id)
            if (result.success) {
                setSelectedSessionId(null)
                setPendingConflicts(null)
                router.refresh()
            } else {
                console.error('Deallocate failed:', result.error)
            }
        })
    }

    // Drag-and-drop handlers
    const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null)

    const handleDropSession = (sessionId: string, targetDate: string) => {
        startReassign(async () => {
            const result = await updateWorkoutDate(sessionId, targetDate)
            if (result.success) {
                setDraggingSessionId(null)
                router.refresh()
            } else {
                console.error('Drop failed:', result.error)
            }
        })
    }

    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    const handleRegenerate = () => {
        setGenerationError(null)
        startRegenerate(async () => {
            const result = await regenerateCurrentWeekPool(data.currentWeek?.id)
            if (result.success) {
                router.refresh()
            } else {
                console.error('Regenerate failed:', result.error)
                setGenerationError(result.error ?? 'Regeneration failed. Check terminal for details.')
            }
        })
    }

    const handleGenerateNext = () => {
        setGenerationError(null)
        startGenerateNext(async () => {
            const result = await generateNextWeekPool()
            if (result.success) {
                // Navigate to the generated week
                const generatedWeek = result.data.sessionPool.weekNumber
                router.push(`/dashboard?week=${generatedWeek}`)
                router.refresh()
            } else {
                console.error('Generate next week failed:', result.error)
                setGenerationError(result.error ?? 'Generation failed. Check terminal for details.')
            }
        })
    }

    const currentWeekNumber = data.currentWeek?.week_number ?? 1

    const navigateWeek = (direction: 'prev' | 'next') => {
        const target = direction === 'prev' ? currentWeekNumber - 1 : currentWeekNumber + 1
        if (target >= 1 && target <= data.totalWeeks) {
            router.push(`/dashboard?week=${target}`)
        }
    }

    const GOAL_LABELS: Record<string, string> = {
        hybrid_fitness: 'Hybrid Fitness',
        strength_focus: 'Strength Focus',
        endurance_focus: 'Endurance Focus',
        conditioning_focus: 'Conditioning Focus',
        longevity: 'Longevity',
    }

    // Inventory handlers
    const handleAllocateWeek = (week: number) => {
        setAllocationModal({ isOpen: true, weekNumber: week })
    }

    const handleScheduleSession = (sessionId: string) => {
        console.log('Schedule session:', sessionId)
        // TODO: Open date picker for single session
        alert(`Schedule session ${sessionId} - Date picker integration coming next!`)
    }

    const handleAllocationComplete = () => {
        // Close modal
        setAllocationModal({ isOpen: false, weekNumber: null })

        // Refresh inventory
        if (currentMesocycle?.id) {
            setLoadingInventory(true)
            getUnscheduledInventory(currentMesocycle.id).then(result => {
                if (result.success && result.data) {
                    setInventory(result.data)
                }
                setLoadingInventory(false)
            })
        }

        // Refresh page data
        router.refresh()
    }

    // ─── Session Inventory Sidebar Content ───────────────────────────────────────
    // If training days are allocated, show the day-based view; otherwise fall back
    // to the legacy unscheduled inventory view.
    const hasTrainingDays = data.trainingDays && data.trainingDays.length > 0

    const poolContent = hasTrainingDays ? (
        <TrainingDayList
            trainingDays={data.trainingDays}
            sessionPool={sessionPool}
            mesocycleId={currentMesocycle?.id}
            weekNumber={currentWeek?.week_number}
        />
    ) : (
        <div className="space-y-2">
            <div className="flex justify-between items-end px-1 mb-1">
                <h2 className="text-lg font-space-grotesk font-bold tracking-tight text-white uppercase">Session Inventory</h2>
            </div>

            {/* Unscheduled Inventory Component */}
            {loadingInventory ? (
                <div className="border border-[#222222] bg-[#0a0a0a] p-8 text-center">
                    <Loader2 className="w-6 h-6 text-cyan-500 mx-auto mb-3 animate-spin" />
                    <p className="text-xs text-neutral-400">Loading inventory...</p>
                </div>
            ) : inventory && Object.keys(inventory.weekGroups).length > 0 ? (
                <UnscheduledInventory
                    inventory={inventory}
                    onAllocateWeek={handleAllocateWeek}
                    onScheduleSession={handleScheduleSession}
                />
            ) : (
                <div className="border border-[#222222] bg-[#0a0a0a] p-8 text-center">
                    <Target className="w-10 h-10 text-neutral-600 mx-auto mb-3 animate-pulse" />
                    <h3 className="text-sm font-space-grotesk text-neutral-300 mb-1">Generating Training Program...</h3>
                    <p className="text-[10px] text-neutral-500 font-inter mb-4">
                        AI coaches are building your 6-week program. This takes 30-60 seconds.
                    </p>
                    <Button
                        onClick={() => router.refresh()}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                        <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
                    </Button>
                </div>
            )}
        </div>
    )

    // ─── Calendar Content ───────────────────────────────────────────────────
    // Use current week dates for highlighting, fall back to mesocycle start/end
    const calendarWeekStart = currentWeek?.start_date ?? mesocycleStartDate
    const calendarWeekEnd = currentWeek?.end_date ?? mesocycleEndDate

    const calendarContent = calendarWeekStart && calendarWeekEnd ? (
        <div className="space-y-4">
            {/* This Week's Sessions - for reviewing and starting workouts */}
            <CurrentWeekSessions
                sessions={allWorkouts}
                weekStartDate={calendarWeekStart}
                weekEndDate={calendarWeekEnd}
            />

            {/* Link to full planner */}
            <div className="flex justify-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/planner')}
                    className="text-cyan-400 border-cyan-500/30 hover:bg-cyan-950/20 hover:border-cyan-500/50"
                >
                    <Calendar className="w-3 h-3 mr-1.5" />
                    Open Full Calendar Planner
                </Button>
            </div>
        </div>
    ) : null

    const oldCalendarContent = calendarWeekStart && calendarWeekEnd ? (
        <div className="space-y-3">
            {allocatedSessions.filter(w => !w.is_completed).length > 0 && (
                <div className="flex justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] border border-white/5 text-neutral-500 hover:text-red-400 hover:border-red-500/30"
                        onClick={handleDeallocate}
                        disabled={isDeallocating}
                    >
                        {isDeallocating ? (
                            <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Clearing...</>
                        ) : (
                            <><RefreshCw className="w-3 h-3 mr-1.5" /> Clear Calendar</>
                        )}
                    </Button>
                </div>
            )}

            <WeekCalendar
                sessions={allWorkouts}
                weekStartDate={calendarWeekStart}
                weekEndDate={calendarWeekEnd}
                dayLoadSummaries={dayLoadSummaries}
                selectedSessionId={selectedSessionId}
                onDayClick={handleDayClick}
                onSessionClick={handleMoveSession}
                onDropSession={handleDropSession}
                onDragStartSession={(id) => setDraggingSessionId(id)}
                onDragEndSession={() => setDraggingSessionId(null)}
                draggingSessionId={draggingSessionId}
            />

            {/* Conflict Warning Overlay */}
            {pendingConflicts && (
                <ConflictWarning
                    conflicts={pendingConflicts.conflicts}
                    onConfirm={handleConfirmConflictMove}
                    onCancel={() => setPendingConflicts(null)}
                    isPending={isReassigning}
                />
            )}
        </div>
    ) : (null as any)

    return (
        <div className="flex flex-col gap-5 pt-2 pb-8 relative">

            {/* ─── AI Coach Alert ─────────────────────────────── */}
            {hasUnreviewedIntervention && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                    <Link href="/coach" className="block relative overflow-hidden border border-cyan-500/30 bg-cyan-950/20 p-4 group cursor-pointer transition-colors hover:bg-cyan-950/40">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-[#050505] border border-cyan-500/50 shrink-0">
                                <Sparkles className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-space-grotesk font-bold text-cyan-50">Coach Intervention</h4>
                                <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider">New analysis requires review</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-cyan-500 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>
                </motion.div>
            )}

            {/* ─── HUD Strip ─────────────────────────────────── */}
            <div className="flex bg-[#0a0a0a] border border-[#222222] divide-x divide-[#222222]">
                <div className="px-4 py-3 flex-1 flex flex-col justify-center">
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-0.5">Phase</span>
                    <span className="text-sm font-space-grotesk text-white">
                        Week {currentWeek?.week_number ?? '—'}
                        <span className="text-neutral-500"> / {currentMesocycle?.week_count ?? '—'}</span>
                    </span>
                </div>
                <div className="px-4 py-3 flex-1 flex flex-col justify-center">
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-0.5">Focus</span>
                    <span className="text-xs font-space-grotesk text-white truncate">
                        {GOAL_LABELS[goalArchetype ?? ''] ?? currentMesocycle?.goal ?? 'Hybrid'}
                    </span>
                </div>
                <div className="px-4 py-3 flex-1 flex flex-col justify-center">
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-0.5">Progress</span>
                    <span className="text-sm font-space-grotesk text-white">
                        {completedCount}<span className="text-neutral-500">/{totalCount}</span>
                    </span>
                </div>
            </div>

            {/* ─── Training Plan (expandable) ──────────────── */}
            {currentMesocycle && (
                <MesocyclePlanView
                    mesocycle={currentMesocycle}
                    currentWeekNumber={currentWeekNumber}
                />
            )}

            {/* ─── Week Progress Bar ─────────────────────────── */}
            {totalCount > 0 && (
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Session Completion</span>
                        <span className="text-[10px] font-mono text-cyan-400">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5 bg-[#111111]" />
                </div>
            )}

            {/* ─── Deload Banner ─────────────────────────────── */}
            {currentWeek?.is_deload && (
                <div className="border border-amber-500/30 bg-amber-950/10 p-3 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                        <span className="text-xs font-space-grotesk text-amber-200 font-bold uppercase">Deload Week</span>
                        <p className="text-[10px] text-neutral-400 font-inter">Reduced volume and intensity for recovery. Trust the process.</p>
                    </div>
                </div>
            )}

            {/* ─── Pool + Calendar Side-by-Side ──────────── */}
            <div className="flex flex-row gap-6">
                {/* Pool sidebar */}
                <div className="w-[400px] shrink-0">
                    {poolContent}
                </div>

                {/* Calendar */}
                <div className="flex-1 min-w-0">
                    {calendarContent}
                </div>
            </div>

            {/* ─── Session Regen Drawer ────────────────────── */}
            <SessionRegenDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                mode={drawerMode}
                workoutId={drawerWorkoutId}
                workoutName={drawerWorkoutName}
                equipmentList={equipmentList}
                endurancePreferences={endurancePreferences}
                conditioningPreferences={conditioningPreferences}
                previousWeekIsDeload={previousWeekIsDeload}
            />

            {/* ─── Allocation Modal ─────────────────────────── */}
            <AllocationModal
                isOpen={allocationModal.isOpen}
                weekNumber={allocationModal.weekNumber}
                mesocycleId={currentMesocycle?.id}
                onClose={() => setAllocationModal({ isOpen: false, weekNumber: null })}
                onComplete={handleAllocationComplete}
            />
        </div>
    )
}
