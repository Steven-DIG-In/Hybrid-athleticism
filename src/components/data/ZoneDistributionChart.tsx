'use client'

import { motion } from 'framer-motion'
import type { ZoneDistribution } from '@/lib/types/data.types'

interface ZoneDistributionChartProps {
    distribution: ZoneDistribution[]
    totalSessions: number
}

const ZONE_LABELS: Record<string, string> = {
    ZONE_2: 'Zone 2',
    TEMPO: 'Tempo',
    THRESHOLD: 'Threshold',
    INTERVAL: 'Intervals',
    SPRINT: 'Sprint',
}

export function ZoneDistributionChart({ distribution, totalSessions }: ZoneDistributionChartProps) {
    if (distribution.length === 0) {
        return (
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Zone Distribution</h3>
                <div className="flex items-center justify-center h-20">
                    <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">No data yet</span>
                </div>
            </div>
        )
    }

    const maxMinutes = Math.max(...distribution.map(d => d.totalMinutes), 1)

    return (
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Zone Distribution</h3>
                <span className="text-[9px] font-mono text-neutral-600">{totalSessions} sessions</span>
            </div>

            <div className="space-y-2">
                {distribution.map((d, i) => (
                    <div key={d.zone} className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-neutral-500 w-16 truncate">
                            {ZONE_LABELS[d.zone] ?? d.zone}
                        </span>
                        <div className="flex-1 h-4 bg-[#111111] rounded-sm overflow-hidden">
                            <motion.div
                                className="h-full rounded-sm"
                                style={{ backgroundColor: d.color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${(d.totalMinutes / maxMinutes) * 100}%` }}
                                transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                            />
                        </div>
                        <span className="text-[9px] font-mono text-neutral-400 w-10 text-right">{d.totalMinutes}m</span>
                        <span className="text-[9px] font-mono text-neutral-600 w-8 text-right">{d.percentage}%</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
