'use client'

import { motion } from 'framer-motion'
import type { WeeklyRecoveryStatus } from '@/lib/types/data.types'

interface RecoveryTimelineProps {
    weeklyRecovery: WeeklyRecoveryStatus[]
    currentWeek: number
}

const STATUS_COLORS: Record<string, string> = {
    GREEN: '#34d399',
    YELLOW: '#fbbf24',
    RED: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
    GREEN: 'Good',
    YELLOW: 'Watch',
    RED: 'Fatigued',
}

export function RecoveryTimeline({ weeklyRecovery, currentWeek }: RecoveryTimelineProps) {
    if (weeklyRecovery.length === 0) {
        return (
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Recovery Status</h3>
                <div className="flex items-center justify-center h-16">
                    <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">No data yet</span>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
            <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-4">Weekly Recovery Status</h3>

            <div className="flex items-center gap-1.5">
                {weeklyRecovery.map((week, i) => {
                    const isCurrent = week.weekNumber === currentWeek
                    const color = week.status ? STATUS_COLORS[week.status] ?? '#333' : '#1a1a1a'

                    return (
                        <div key={week.weekNumber} className="flex-1 flex flex-col items-center gap-1.5">
                            {/* Status dot */}
                            <motion.div
                                className="relative"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300 }}
                            >
                                <div
                                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                                    style={{
                                        borderColor: color,
                                        backgroundColor: week.status ? `${color}20` : 'transparent',
                                    }}
                                >
                                    {week.assessmentCount > 0 && (
                                        <span className="text-[7px] font-mono text-white/80">{week.assessmentCount}</span>
                                    )}
                                </div>
                                {isCurrent && (
                                    <motion.div
                                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400"
                                        animate={{ opacity: [1, 0.4, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                )}
                            </motion.div>

                            {/* Week label */}
                            <span className={`text-[8px] font-mono tracking-wide ${
                                isCurrent ? 'text-cyan-400 font-bold' : 'text-neutral-600'
                            }`}>
                                {week.weekLabel}
                            </span>

                            {/* Status label */}
                            {week.status && (
                                <span className="text-[7px] font-mono uppercase tracking-widest" style={{ color }}>
                                    {STATUS_LABELS[week.status] ?? week.status}
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
