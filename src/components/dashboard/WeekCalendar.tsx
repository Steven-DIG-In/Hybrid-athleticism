'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Dumbbell, Footprints, Mountain, Timer, Waves,
    Bike, Heart, Target, AlertTriangle,
    ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react'
import type { WorkoutWithSets, DayLoadSummary } from '@/lib/types/training.types'
import { getLoadStatusColors } from '@/lib/scheduling/load-scoring'
import { LoadInterferenceGraph } from './LoadInterferenceGraph'

// ─── Props ─────────────────────────────────────────────────────────────────

interface WeekCalendarProps {
    sessions: WorkoutWithSets[]
    weekStartDate: string
    weekEndDate: string
    dayLoadSummaries: DayLoadSummary[]
    selectedSessionId: string | null
    onDayClick: (date: string) => void
    onSessionClick: (sessionId: string) => void
    // Drag-and-drop (Phase 4 — wired later)
    onDropSession?: (sessionId: string, targetDate: string) => void
    onDragStartSession?: (sessionId: string) => void
    onDragEndSession?: () => void
    draggingSessionId?: string | null
}

// ─── Modality Config ───────────────────────────────────────────────────────

function getModalityMiniConfig(modality: string, name: string) {
    const lowerName = name.toLowerCase()

    if (modality === 'CARDIO' && (lowerName.includes('mobility') || lowerName.includes('stretch') || lowerName.includes('recovery'))) {
        return { icon: Heart, color: 'text-violet-400', accentColor: 'rgba(139,92,246,0.5)' }
    }

    switch (modality) {
        case 'LIFTING': return { icon: Dumbbell, color: 'text-cyan-400', accentColor: 'rgba(34,211,238,0.5)' }
        case 'CARDIO': {
            if (lowerName.includes('run')) return { icon: Footprints, color: 'text-emerald-400', accentColor: 'rgba(52,211,153,0.5)' }
            if (lowerName.includes('row')) return { icon: Waves, color: 'text-blue-400', accentColor: 'rgba(96,165,250,0.5)' }
            if (lowerName.includes('cycle') || lowerName.includes('bike')) return { icon: Bike, color: 'text-yellow-400', accentColor: 'rgba(250,204,21,0.5)' }
            if (lowerName.includes('swim')) return { icon: Waves, color: 'text-teal-400', accentColor: 'rgba(45,212,191,0.5)' }
            if (lowerName.includes('ruck')) return { icon: Mountain, color: 'text-orange-400', accentColor: 'rgba(251,146,60,0.5)' }
            return { icon: Footprints, color: 'text-emerald-400', accentColor: 'rgba(52,211,153,0.5)' }
        }
        case 'RUCKING': return { icon: Mountain, color: 'text-orange-400', accentColor: 'rgba(251,146,60,0.5)' }
        case 'METCON': return { icon: Timer, color: 'text-rose-400', accentColor: 'rgba(251,113,133,0.5)' }
        default: return { icon: Target, color: 'text-neutral-400', accentColor: 'rgba(163,163,163,0.5)' }
    }
}

// ─── Session Name Abbreviation ─────────────────────────────────────────────

function abbreviateSessionName(name: string, modality: string): string {
    if (name.length <= 16) return name

    // Remove common parenthetical details
    let short = name.replace(/\s*\(.*?\)\s*/g, '').trim()

    // LIFTING abbreviations
    if (modality === 'LIFTING') {
        short = short
            .replace(/Upper Body\s*/i, 'Upper ')
            .replace(/Lower Body\s*/i, 'Lower ')
            .replace(/Full Body\s*/i, 'Full ')
            .replace(/\s*Session\s*/i, '')
            .replace(/\s*Workout\s*/i, '')
        return short.length <= 20 ? short : short.slice(0, 18) + '…'
    }

    // CARDIO abbreviations
    if (modality === 'CARDIO') {
        short = short
            .replace(/Zone\s*2\s*/i, 'Z2 ')
            .replace(/Zone\s*3\s*/i, 'Z3 ')
            .replace(/Zone\s*4\s*/i, 'Z4 ')
            .replace(/Easy\s*/i, '')
            .replace(/Endurance\s*/i, '')
            .replace(/Benchmark\s*/i, 'BM ')
            .replace(/\s*—\s*\d+\s*min/i, '')
            .replace(/\s*-\s*\d+\s*min/i, '')
        return short.length <= 20 ? short : short.slice(0, 18) + '…'
    }

    // METCON abbreviations
    if (modality === 'METCON') {
        short = short
            .replace(/Conditioning\s*/i, '')
            .replace(/(\d+)\s*min(utes?)?/i, '$1m')
        return short.length <= 20 ? short : short.slice(0, 18) + '…'
    }

    // General fallback
    return short.length <= 20 ? short : short.slice(0, 18) + '…'
}

// ─── Utilities ──────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Format a local Date as YYYY-MM-DD without UTC conversion (avoids DST bugs). */
function toLocalDateStr(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function getMonthDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDow = (firstDay.getDay() + 6) % 7
    const daysInMonth = lastDay.getDate()

    const dates: { key: string; date: string; inMonth: boolean }[] = []

    for (let i = startDow - 1; i >= 0; i--) {
        const d = new Date(year, month, -i)
        const dateStr = toLocalDateStr(d)
        dates.push({ key: `prev-${dateStr}`, date: dateStr, inMonth: false })
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i)
        const dateStr = toLocalDateStr(d)
        dates.push({ key: dateStr, date: dateStr, inMonth: true })
    }

    const remainder = dates.length % 7
    if (remainder > 0) {
        const trailing = 7 - remainder
        for (let i = 1; i <= trailing; i++) {
            const d = new Date(year, month + 1, i)
            const dateStr = toLocalDateStr(d)
            dates.push({ key: `next-${dateStr}`, date: dateStr, inMonth: false })
        }
    }

    return dates
}

// ─── Day Cell ──────────────────────────────────────────────────────────────

function DayCell({
    date,
    inMonth,
    sessions,
    dayLoad,
    isToday,
    isCurrentWeek,
    selectedSessionId,
    onDayClick,
    onSessionClick,
    onDropSession,
    onDragStartSession,
    onDragEndSession,
    draggingSessionId,
}: {
    date: string
    inMonth: boolean
    sessions: WorkoutWithSets[]
    dayLoad: DayLoadSummary | undefined
    isToday: boolean
    isCurrentWeek: boolean
    selectedSessionId: string | null
    onDayClick: (date: string) => void
    onSessionClick: (sessionId: string) => void
    onDropSession?: (sessionId: string, targetDate: string) => void
    onDragStartSession?: (sessionId: string) => void
    onDragEndSession?: () => void
    draggingSessionId?: string | null
}) {
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
    const [isDragOver, setIsDragOver] = useState(false)

    const dateObj = new Date(date + 'T00:00:00')
    const dateNum = dateObj.getDate()
    const isAssigning = selectedSessionId !== null
    const isDragging = draggingSessionId !== null
    const hasConflicts = dayLoad ? dayLoad.conflicts.length > 0 : false
    const loadColors = dayLoad ? getLoadStatusColors(dayLoad.status) : null

    return (
        <div
            className={`relative group min-h-[80px] border border-[#1a1a1a] rounded-lg overflow-hidden transition-all duration-150 ${
                !inMonth
                    ? 'bg-[#050505]/50'
                    : isCurrentWeek
                        ? 'bg-[#0c0c0c]'
                        : 'bg-[#080808]'
            } ${
                isAssigning && inMonth ? 'cursor-pointer hover:bg-cyan-950/15 hover:border-cyan-500/30' : ''
            } ${
                isDragOver ? 'ring-2 ring-cyan-500/50 bg-cyan-950/20' : ''
            } ${
                isDragging && inMonth && !isDragOver ? 'border-dashed border-[#333]' : ''
            }`}
            onClick={() => {
                if (isAssigning && inMonth) {
                    onDayClick(date)
                }
            }}
            // Drag-and-drop target
            onDragOver={(e) => {
                if (inMonth) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
            }}
            onDragEnter={(e) => {
                if (inMonth) { e.preventDefault(); setIsDragOver(true) }
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
                e.preventDefault()
                setIsDragOver(false)
                const sessionId = e.dataTransfer.getData('text/plain')
                if (sessionId && inMonth && onDropSession) {
                    onDropSession(sessionId, date)
                }
            }}
        >
            {/* Today highlight — left edge accent */}
            {isToday && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-500 rounded-l-lg" />
            )}

            {/* Overloaded subtle glow */}
            {dayLoad?.status === 'overloaded' && (
                <motion.div
                    animate={{ opacity: [0.05, 0.12, 0.05] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-red-500 pointer-events-none rounded-lg"
                />
            )}

            {/* Header row */}
            <div className="flex items-center justify-between px-2 pt-1.5">
                <span className={`text-[11px] font-space-grotesk font-bold ${
                    !inMonth
                        ? 'text-neutral-700'
                        : isToday
                            ? 'text-cyan-400'
                            : 'text-neutral-400'
                }`}>
                    {dateNum}
                </span>

                <div className="flex items-center gap-1">
                    {hasConflicts && (
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                    )}
                    {loadColors?.dot && inMonth && (
                        <div className={`w-2 h-2 rounded-full ${loadColors.dot}`} />
                    )}
                </div>
            </div>

            {/* Session indicators */}
            <div className="px-1.5 pb-1.5 pt-1 space-y-[3px]">
                {sessions.map((session) => {
                    const config = getModalityMiniConfig(session.modality, session.name)
                    const Icon = config.icon
                    const isSessionSelected = selectedSessionId === session.id
                    const isExpanded = expandedSessionId === session.id
                    const exerciseNames = [...new Set(session.exercise_sets.map(s => s.exercise_name))]

                    return (
                        <div key={session.id}>
                            {/* Session chip */}
                            <button
                                draggable={!session.is_completed}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', session.id)
                                    e.dataTransfer.effectAllowed = 'move'
                                    onDragStartSession?.(session.id)
                                }}
                                onDragEnd={() => {
                                    onDragEndSession?.()
                                }}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (isAssigning) {
                                        onSessionClick(session.id)
                                    } else {
                                        setExpandedSessionId(prev => prev === session.id ? null : session.id)
                                    }
                                }}
                                className={`w-full flex items-center gap-1 px-1.5 py-[3px] text-left transition-all rounded-md ${
                                    isSessionSelected
                                        ? 'bg-cyan-500/15 ring-1 ring-cyan-500/40'
                                        : 'hover:bg-white/[0.03]'
                                } ${session.is_completed ? 'opacity-40' : ''} ${
                                    !session.is_completed ? 'cursor-grab active:cursor-grabbing' : ''
                                }`}
                                style={{
                                    borderLeft: `2px solid ${isSessionSelected ? 'rgb(34,211,238)' : config.accentColor}`,
                                }}
                            >
                                <Icon className={`w-3 h-3 shrink-0 ${config.color}`} />
                                <span className={`text-[10px] font-inter truncate flex-1 ${
                                    inMonth ? 'text-neutral-300' : 'text-neutral-600'
                                }`}>
                                    {abbreviateSessionName(session.name, session.modality)}
                                </span>
                                {!isAssigning && (
                                    <ChevronDown className={`w-2.5 h-2.5 text-neutral-600 shrink-0 transition-transform ${
                                        isExpanded ? 'rotate-180' : ''
                                    }`} />
                                )}
                            </button>

                            {/* Expanded details */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pt-1 pb-1.5 px-1 space-y-0.5">
                                            {session.modality === 'LIFTING' && exerciseNames.length > 0 ? (
                                                exerciseNames.slice(0, 5).map((name) => {
                                                    const sets = session.exercise_sets.filter(s => s.exercise_name === name)
                                                    return (
                                                        <div key={name} className="flex justify-between items-center">
                                                            <span className="text-[9px] font-inter text-neutral-500 truncate max-w-[60%]">
                                                                {name}
                                                            </span>
                                                            <span className="text-[9px] font-mono text-neutral-600">
                                                                {sets.length}×{sets[0]?.target_reps ?? '?'}
                                                                {sets[0]?.target_weight_kg ? ` ${sets[0].target_weight_kg}kg` : ''}
                                                            </span>
                                                        </div>
                                                    )
                                                })
                                            ) : session.coach_notes ? (
                                                <p className="text-[9px] font-inter text-neutral-500 leading-relaxed">
                                                    {session.coach_notes.slice(0, 120)}
                                                    {(session.coach_notes.length ?? 0) > 120 ? '…' : ''}
                                                </p>
                                            ) : (
                                                <p className="text-[9px] font-inter text-neutral-600 italic">No details</p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>

            {/* Rest day — subtle indicator */}
            {sessions.length === 0 && inMonth && (
                <div className="px-2 pb-2">
                    <span className="text-[8px] font-mono text-neutral-800 uppercase">Rest</span>
                </div>
            )}
        </div>
    )
}

// ─── Main Calendar ─────────────────────────────────────────────────────────

export function WeekCalendar({
    sessions,
    weekStartDate,
    weekEndDate,
    dayLoadSummaries,
    selectedSessionId,
    onDayClick,
    onSessionClick,
    onDropSession,
    onDragStartSession,
    onDragEndSession,
    draggingSessionId,
}: WeekCalendarProps) {
    const todayStr = new Date().toISOString().split('T')[0]

    // Derive current month from week start
    const weekStartObj = new Date(weekStartDate + 'T00:00:00')
    const [viewYear, setViewYear] = useState(weekStartObj.getFullYear())
    const [viewMonth, setViewMonth] = useState(weekStartObj.getMonth())

    // Build calendar grid
    const calendarDays = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth])

    // Group sessions by date — skip unallocated
    const sessionsByDate = useMemo(() => {
        const map = new Map<string, WorkoutWithSets[]>()
        for (const session of sessions) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((session as any).is_allocated === false) continue
            const date = session.scheduled_date
            if (!map.has(date)) map.set(date, [])
            map.get(date)!.push(session)
        }
        return map
    }, [sessions])

    // Load summaries by date
    const loadByDate = useMemo(() => {
        const map = new Map<string, DayLoadSummary>()
        for (const day of dayLoadSummaries) {
            map.set(day.date, day)
        }
        return map
    }, [dayLoadSummaries])

    // Current week date set for highlighting
    const currentWeekDates = useMemo(() => {
        const set = new Set<string>()
        const start = new Date(weekStartDate + 'T00:00:00')
        const end = new Date(weekEndDate + 'T00:00:00')
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            set.add(d.toISOString().split('T')[0])
        }
        return set
    }, [weekStartDate, weekEndDate])

    // Navigation
    const goToPrev = () => {
        if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) }
        else { setViewMonth(viewMonth - 1) }
    }

    const goToNext = () => {
        if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) }
        else { setViewMonth(viewMonth + 1) }
    }

    const goToToday = () => {
        const now = new Date()
        setViewYear(now.getFullYear())
        setViewMonth(now.getMonth())
    }

    // Conflict summary
    const allConflicts = dayLoadSummaries
        .flatMap(d => d.conflicts)
        .filter((c, i, arr) => arr.findIndex(x => x.message === c.message) === i)

    return (
        <div className="flex flex-col h-full">
            {/* ─── Calendar Header ──────────────────────────── */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-space-grotesk font-bold tracking-tight text-white uppercase">
                        {MONTH_NAMES[viewMonth]}
                    </h2>
                    <span className="text-sm font-space-grotesk text-neutral-500">{viewYear}</span>
                </div>

                <div className="flex items-center gap-1.5">
                    {selectedSessionId && (
                        <motion.span
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider mr-2 animate-pulse"
                        >
                            Tap a day to assign
                        </motion.span>
                    )}

                    <button
                        onClick={goToToday}
                        className="px-2.5 py-1 text-[9px] font-mono text-neutral-400 uppercase tracking-wider border border-[#222] bg-[#0a0a0a] rounded-md hover:border-cyan-500/30 hover:text-cyan-400 transition-colors"
                    >
                        Today
                    </button>
                    <button
                        onClick={goToPrev}
                        className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded-md hover:bg-white/5"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={goToNext}
                        className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded-md hover:bg-white/5"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ─── Day Headers ───────────────────────────────── */}
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {DAY_HEADERS.map((day) => (
                    <div key={day} className="px-2 py-1.5 text-center">
                        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.15em]">
                            {day}
                        </span>
                    </div>
                ))}
            </div>

            {/* ─── Load Interference Graph ─────────────────── */}
            <LoadInterferenceGraph
                dayLoadSummaries={dayLoadSummaries}
                weekStartDate={weekStartDate}
                weekEndDate={weekEndDate}
            />

            {/* ─── Calendar Grid ─────────────────────────────── */}
            <div className="grid grid-cols-7 gap-1.5 flex-1">
                {calendarDays.map(({ key, date, inMonth }) => (
                    <DayCell
                        key={key}
                        date={date}
                        inMonth={inMonth}
                        sessions={sessionsByDate.get(date) ?? []}
                        dayLoad={loadByDate.get(date)}
                        isToday={date === todayStr}
                        isCurrentWeek={currentWeekDates.has(date)}
                        selectedSessionId={selectedSessionId}
                        onDayClick={onDayClick}
                        onSessionClick={onSessionClick}
                        onDropSession={onDropSession}
                        onDragStartSession={onDragStartSession}
                        onDragEndSession={onDragEndSession}
                        draggingSessionId={draggingSessionId}
                    />
                ))}
            </div>


            {/* ─── Conflict Summary ──────────────────────────── */}
            {allConflicts.length > 0 && (
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 p-2.5 border border-amber-500/20 bg-amber-950/5 rounded-lg"
                    >
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                {allConflicts.slice(0, 3).map((conflict, i) => (
                                    <p key={i} className={`text-[10px] font-inter ${
                                        conflict.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                                    }`}>
                                        {conflict.message}
                                    </p>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    )
}
