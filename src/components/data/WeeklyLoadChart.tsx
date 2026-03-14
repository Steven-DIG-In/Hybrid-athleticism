'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { WeeklyLoadData } from '@/lib/types/data.types'

interface WeeklyLoadChartProps {
    weeklyData: WeeklyLoadData[]
    currentWeek: number
}

const CHART_HEIGHT = 160
const BAR_PADDING = 8
const MAX_BAR_HEIGHT = CHART_HEIGHT - BAR_PADDING * 2

const MODALITY_SEGMENTS = [
    { key: 'lifting' as const, color: '#22d3ee', label: 'Lifting' },
    { key: 'cardio' as const, color: '#34d399', label: 'Cardio' },
    { key: 'rucking' as const, color: '#fbbf24', label: 'Rucking' },
    { key: 'conditioning' as const, color: '#a78bfa', label: 'Conditioning' },
    { key: 'mobility' as const, color: '#f472b6', label: 'Mobility' },
]

export function WeeklyLoadChart({ weeklyData, currentWeek }: WeeklyLoadChartProps) {
    const maxSessions = useMemo(() => {
        return Math.max(...weeklyData.map(w => w.totalSessions), 1)
    }, [weeklyData])

    if (weeklyData.length === 0) {
        return (
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Weekly Load</h3>
                <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT }}>
                    <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">No data yet</span>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
            <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Weekly Volume</h3>

            {/* Chart */}
            <div className="relative" style={{ height: CHART_HEIGHT }}>
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map(pct => (
                    <div
                        key={pct}
                        className="absolute left-0 right-0 border-t border-dashed border-[#151515]"
                        style={{ top: BAR_PADDING + MAX_BAR_HEIGHT * (1 - pct) }}
                    />
                ))}

                {/* Bars */}
                <div className="flex items-end justify-between h-full gap-1 px-1" style={{ paddingBottom: BAR_PADDING, paddingTop: BAR_PADDING }}>
                    {weeklyData.map((week) => {
                        const barHeight = (week.totalSessions / maxSessions) * MAX_BAR_HEIGHT
                        const isCurrent = week.weekNumber === currentWeek

                        // Build stacked segments
                        let yOffset = 0
                        const segments: { key: string; height: number; color: string; y: number }[] = []

                        for (const seg of MODALITY_SEGMENTS) {
                            const count = week[seg.key]
                            if (count > 0) {
                                const segHeight = (count / maxSessions) * MAX_BAR_HEIGHT
                                segments.push({
                                    key: seg.key,
                                    height: segHeight,
                                    color: seg.color,
                                    y: yOffset,
                                })
                                yOffset += segHeight
                            }
                        }

                        return (
                            <div key={week.weekNumber} className="flex-1 flex flex-col items-center">
                                {/* Stacked bar */}
                                <div className="relative w-full flex flex-col-reverse" style={{ height: MAX_BAR_HEIGHT }}>
                                    <svg viewBox={`0 0 100 ${MAX_BAR_HEIGHT}`} className="w-full" style={{ height: MAX_BAR_HEIGHT }} preserveAspectRatio="none">
                                        {segments.map((seg) => (
                                            <motion.rect
                                                key={seg.key}
                                                x={10}
                                                width={80}
                                                rx={3}
                                                ry={3}
                                                fill={seg.color}
                                                fillOpacity={week.isDeload ? 0.4 : 0.8}
                                                initial={false}
                                                animate={{
                                                    y: MAX_BAR_HEIGHT - seg.y - seg.height,
                                                    height: seg.height,
                                                }}
                                                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: week.weekNumber * 0.05 }}
                                            />
                                        ))}
                                    </svg>

                                    {/* Session count label */}
                                    {barHeight > 12 && (
                                        <div
                                            className="absolute left-0 right-0 flex justify-center pointer-events-none"
                                            style={{ bottom: Math.max(barHeight - 14, 2) }}
                                        >
                                            <span className="text-[8px] font-mono text-white/70">{week.totalSessions}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Week label */}
                                <span className={`text-[9px] font-mono mt-1.5 tracking-wide ${
                                    isCurrent ? 'text-cyan-400 font-bold' : week.isDeload ? 'text-amber-500' : 'text-neutral-600'
                                }`}>
                                    {week.weekLabel}
                                </span>

                                {/* Current week indicator */}
                                {isCurrent && (
                                    <div className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5" />
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
                {MODALITY_SEGMENTS.filter(seg =>
                    weeklyData.some(w => w[seg.key] > 0)
                ).map(seg => (
                    <div key={seg.key} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: seg.color, opacity: 0.8 }} />
                        <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest">{seg.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
