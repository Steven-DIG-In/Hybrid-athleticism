'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { DayLoadSummary } from '@/lib/scheduling/load-scoring'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LoadInterferenceGraphProps {
    dayLoadSummaries: DayLoadSummary[]
    weekStartDate: string
    weekEndDate: string
}

interface DayBarData {
    date: string
    dayOfWeek: string
    strengthLoad: number
    cardioLoad: number
    totalLoad: number
    hasConflicts: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GRAPH_HEIGHT = 130
const CENTER_Y = GRAPH_HEIGHT / 2
const HALF_HEIGHT = CENTER_Y - 4 // leave padding at extremes
const BAR_RX = 3

const CARDIO_MODALITIES = new Set(['CARDIO', 'METCON', 'RUCKING'])

function toLocalDateStr(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

// ─── Single Day Column ──────────────────────────────────────────────────────

function DayColumn({ day, maxLoad }: { day: DayBarData; maxLoad: number }) {
    const strengthH = day.strengthLoad > 0
        ? Math.max((day.strengthLoad / maxLoad) * HALF_HEIGHT, 4)
        : 0
    const cardioH = day.cardioLoad > 0
        ? Math.max((day.cardioLoad / maxLoad) * HALF_HEIGHT, 4)
        : 0

    const isInterference = day.strengthLoad > 0 && day.cardioLoad > 0 && day.totalLoad > 6

    return (
        <div className="relative flex items-center justify-center" style={{ height: GRAPH_HEIGHT }}>
            <svg
                viewBox={`0 0 100 ${GRAPH_HEIGHT}`}
                className="w-full h-full"
                preserveAspectRatio="xMidYMid meet"
            >
                <defs>
                    <linearGradient id="strengthGrad" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="cardioGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.9} />
                    </linearGradient>
                </defs>

                {/* Center axis segment */}
                <line
                    x1={10} y1={CENTER_Y} x2={90} y2={CENTER_Y}
                    stroke="#2a2a2a" strokeWidth={1}
                />

                {/* 50% grid marks */}
                <line
                    x1={20} y1={CENTER_Y - HALF_HEIGHT / 2}
                    x2={80} y2={CENTER_Y - HALF_HEIGHT / 2}
                    stroke="#151515" strokeWidth={0.5} strokeDasharray="2,3"
                />
                <line
                    x1={20} y1={CENTER_Y + HALF_HEIGHT / 2}
                    x2={80} y2={CENTER_Y + HALF_HEIGHT / 2}
                    stroke="#151515" strokeWidth={0.5} strokeDasharray="2,3"
                />

                {/* Strength bar — grows UP from center */}
                {strengthH > 0 && (
                    <motion.rect
                        x={20}
                        width={60}
                        rx={BAR_RX}
                        ry={BAR_RX}
                        fill="url(#strengthGrad)"
                        initial={false}
                        animate={{
                            y: CENTER_Y - strengthH,
                            height: strengthH,
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    />
                )}

                {/* Cardio/conditioning bar — grows DOWN from center */}
                {cardioH > 0 && (
                    <motion.rect
                        x={20}
                        width={60}
                        rx={BAR_RX}
                        ry={BAR_RX}
                        fill="url(#cardioGrad)"
                        initial={false}
                        animate={{
                            y: CENTER_Y,
                            height: cardioH,
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    />
                )}

                {/* Interference glow — pulsing at center when both domains are heavy */}
                {isInterference && (
                    <motion.rect
                        x={15}
                        width={70}
                        height={6}
                        rx={3}
                        ry={3}
                        fill="white"
                        animate={{
                            y: CENTER_Y - 3,
                            opacity: [0.08, 0.2, 0.08],
                        }}
                        transition={{
                            opacity: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
                        }}
                    />
                )}

                {/* Load value labels */}
                {strengthH > 0 && (
                    <text
                        x={50}
                        y={CENTER_Y - strengthH - 3}
                        textAnchor="middle"
                        className="fill-cyan-400"
                        fontSize={9}
                        fontFamily="monospace"
                        opacity={0.7}
                    >
                        {day.strengthLoad}
                    </text>
                )}
                {cardioH > 0 && (
                    <text
                        x={50}
                        y={CENTER_Y + cardioH + 10}
                        textAnchor="middle"
                        className="fill-emerald-400"
                        fontSize={9}
                        fontFamily="monospace"
                        opacity={0.7}
                    >
                        {day.cardioLoad}
                    </text>
                )}
            </svg>
        </div>
    )
}

// ─── Main Graph ─────────────────────────────────────────────────────────────

export function LoadInterferenceGraph({
    dayLoadSummaries,
    weekStartDate,
    weekEndDate,
}: LoadInterferenceGraphProps) {
    // Derive 7-day bar data for the current week
    const weekData = useMemo(() => {
        const start = new Date(weekStartDate + 'T00:00:00')
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

        // Build a map for quick lookup
        const summaryMap = new Map<string, DayLoadSummary>()
        for (const s of dayLoadSummaries) {
            summaryMap.set(s.date, s)
        }

        const result: DayBarData[] = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(start)
            d.setDate(d.getDate() + i)
            const dateStr = toLocalDateStr(d)
            const summary = summaryMap.get(dateStr)

            if (!summary) {
                result.push({
                    date: dateStr,
                    dayOfWeek: dayNames[i],
                    strengthLoad: 0,
                    cardioLoad: 0,
                    totalLoad: 0,
                    hasConflicts: false,
                })
                continue
            }

            const strengthLoad = summary.sessions
                .filter(s => s.modality === 'LIFTING')
                .reduce((sum, s) => sum + s.totalLoad, 0)

            const cardioLoad = summary.sessions
                .filter(s => CARDIO_MODALITIES.has(s.modality))
                .reduce((sum, s) => sum + s.totalLoad, 0)

            result.push({
                date: dateStr,
                dayOfWeek: dayNames[i],
                strengthLoad,
                cardioLoad,
                totalLoad: summary.totalLoad,
                hasConflicts: summary.conflicts.length > 0,
            })
        }

        return result
    }, [dayLoadSummaries, weekStartDate, weekEndDate])

    // Dynamic max for normalization (floor of 10 so light days don't fill space)
    const maxLoad = useMemo(() => {
        const maxS = Math.max(...weekData.map(d => d.strengthLoad), 0)
        const maxC = Math.max(...weekData.map(d => d.cardioLoad), 0)
        return Math.max(maxS, maxC, 10)
    }, [weekData])

    const hasAnyLoad = weekData.some(d => d.strengthLoad > 0 || d.cardioLoad > 0)

    if (!hasAnyLoad) {
        // Empty state: just show the axis with a hint
        return (
            <div className="mb-2">
                <div className="relative" style={{ height: 60 }}>
                    <div className="absolute left-0 right-0 top-1/2 h-px bg-[#1a1a1a]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">
                            No load data
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="mb-2">
            {/* Graph area */}
            <div className="relative">
                {/* Full-width center axis line */}
                <div
                    className="absolute left-0 right-0 bg-[#2a2a2a] z-0"
                    style={{ top: CENTER_Y, height: 1 }}
                />

                {/* 7-column bar grid — matches calendar grid */}
                <div className="grid grid-cols-7 gap-1.5 relative z-10">
                    {weekData.map((day) => (
                        <DayColumn key={day.date} day={day} maxLoad={maxLoad} />
                    ))}
                </div>
            </div>

            {/* Minimal legend */}
            <div className="flex items-center justify-center gap-5 mt-1.5">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400/80" />
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">
                        Strength
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400/80" />
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">
                        Cardio & Conditioning
                    </span>
                </div>
            </div>
        </div>
    )
}
