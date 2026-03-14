'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { WeeklyEnduranceVolume } from '@/lib/types/data.types'

interface WeeklyEnduranceChartProps {
    weeklyData: WeeklyEnduranceVolume[]
    currentWeek: number
}

const CHART_HEIGHT = 140
const BAR_PADDING = 8
const MAX_BAR_HEIGHT = CHART_HEIGHT - BAR_PADDING * 2

export function WeeklyEnduranceChart({ weeklyData, currentWeek }: WeeklyEnduranceChartProps) {
    const maxMinutes = useMemo(() => {
        return Math.max(...weeklyData.map(w => w.cardioMinutes + w.ruckMinutes), 1)
    }, [weeklyData])

    if (weeklyData.length === 0) {
        return (
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Weekly Volume</h3>
                <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT }}>
                    <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">No data yet</span>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
            <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Weekly Endurance Volume</h3>

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
                        const total = week.cardioMinutes + week.ruckMinutes
                        const isCurrent = week.weekNumber === currentWeek

                        const cardioHeight = (week.cardioMinutes / maxMinutes) * MAX_BAR_HEIGHT
                        const ruckHeight = (week.ruckMinutes / maxMinutes) * MAX_BAR_HEIGHT

                        return (
                            <div key={week.weekNumber} className="flex-1 flex flex-col items-center">
                                <div className="relative w-full flex flex-col-reverse" style={{ height: MAX_BAR_HEIGHT }}>
                                    <svg viewBox={`0 0 100 ${MAX_BAR_HEIGHT}`} className="w-full" style={{ height: MAX_BAR_HEIGHT }} preserveAspectRatio="none">
                                        {/* Ruck bar (bottom) */}
                                        {week.ruckMinutes > 0 && (
                                            <motion.rect
                                                x={10} width={80} rx={3} ry={3}
                                                fill="#fbbf24"
                                                fillOpacity={0.8}
                                                initial={false}
                                                animate={{
                                                    y: MAX_BAR_HEIGHT - ruckHeight,
                                                    height: ruckHeight,
                                                }}
                                                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: week.weekNumber * 0.05 }}
                                            />
                                        )}
                                        {/* Cardio bar (stacked on top) */}
                                        {week.cardioMinutes > 0 && (
                                            <motion.rect
                                                x={10} width={80} rx={3} ry={3}
                                                fill="#34d399"
                                                fillOpacity={0.8}
                                                initial={false}
                                                animate={{
                                                    y: MAX_BAR_HEIGHT - ruckHeight - cardioHeight,
                                                    height: cardioHeight,
                                                }}
                                                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: week.weekNumber * 0.05 + 0.03 }}
                                            />
                                        )}
                                    </svg>

                                    {total > 0 && (cardioHeight + ruckHeight) > 14 && (
                                        <div
                                            className="absolute left-0 right-0 flex justify-center pointer-events-none"
                                            style={{ bottom: Math.max(cardioHeight + ruckHeight - 14, 2) }}
                                        >
                                            <span className="text-[8px] font-mono text-white/70">{total}m</span>
                                        </div>
                                    )}
                                </div>

                                <span className={`text-[9px] font-mono mt-1.5 tracking-wide ${
                                    isCurrent ? 'text-cyan-400 font-bold' : 'text-neutral-600'
                                }`}>
                                    {week.weekLabel}
                                </span>
                                {isCurrent && <div className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5" />}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-emerald-400 opacity-80" />
                    <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest">Cardio</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-amber-400 opacity-80" />
                    <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest">Rucking</span>
                </div>
            </div>
        </div>
    )
}
