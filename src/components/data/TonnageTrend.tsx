'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { WeeklyTonnage } from '@/lib/types/data.types'

interface TonnageTrendProps {
    weeklyTonnage: WeeklyTonnage[]
    currentWeek: number
}

const CHART_HEIGHT = 120
const PADDING = 8

function formatTonnage(kg: number): string {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
    return `${kg}kg`
}

export function TonnageTrend({ weeklyTonnage, currentWeek }: TonnageTrendProps) {
    const maxTonnage = useMemo(() => {
        return Math.max(...weeklyTonnage.map(w => w.tonnageKg), 1)
    }, [weeklyTonnage])

    if (weeklyTonnage.length === 0 || weeklyTonnage.every(w => w.tonnageKg === 0)) {
        return (
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Weekly Tonnage</h3>
                <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT }}>
                    <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">No data yet</span>
                </div>
            </div>
        )
    }

    const barAreaHeight = CHART_HEIGHT - PADDING * 2

    return (
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
            <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Weekly Tonnage</h3>

            <div className="relative" style={{ height: CHART_HEIGHT }}>
                {/* Grid lines */}
                {[0.5].map(pct => (
                    <div
                        key={pct}
                        className="absolute left-0 right-0 border-t border-dashed border-[#151515]"
                        style={{ top: PADDING + barAreaHeight * (1 - pct) }}
                    />
                ))}

                {/* Bars */}
                <div className="flex items-end justify-between h-full gap-1 px-1" style={{ paddingBottom: PADDING, paddingTop: PADDING }}>
                    {weeklyTonnage.map((week) => {
                        const barHeight = week.tonnageKg > 0
                            ? Math.max((week.tonnageKg / maxTonnage) * barAreaHeight, 4)
                            : 0
                        const isCurrent = week.weekNumber === currentWeek

                        return (
                            <div key={week.weekNumber} className="flex-1 flex flex-col items-center">
                                <div className="relative w-full flex flex-col justify-end items-center" style={{ height: barAreaHeight }}>
                                    {/* Tonnage label */}
                                    {barHeight > 16 && (
                                        <span className="text-[7px] font-mono text-white/60 mb-0.5">
                                            {formatTonnage(week.tonnageKg)}
                                        </span>
                                    )}

                                    {/* Bar */}
                                    <motion.div
                                        className="w-full max-w-[40px] rounded-t-sm"
                                        style={{
                                            background: isCurrent
                                                ? 'linear-gradient(to top, rgba(34, 211, 238, 0.4), rgba(34, 211, 238, 0.8))'
                                                : 'linear-gradient(to top, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.5))',
                                        }}
                                        initial={{ height: 0 }}
                                        animate={{ height: barHeight }}
                                        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: week.weekNumber * 0.05 }}
                                    />
                                </div>

                                {/* Week label */}
                                <span className={`text-[9px] font-mono mt-1 tracking-wide ${
                                    isCurrent ? 'text-cyan-400 font-bold' : 'text-neutral-600'
                                }`}>
                                    {week.weekLabel}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-center gap-4 mt-2">
                <span className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest">
                    Total: {formatTonnage(weeklyTonnage.reduce((sum, w) => sum + w.tonnageKg, 0))}
                </span>
                <span className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest">
                    {weeklyTonnage.reduce((sum, w) => sum + w.setCount, 0)} sets
                </span>
            </div>
        </div>
    )
}
