'use client'

import { motion } from 'framer-motion'
import type { MuscleGroupVolume } from '@/lib/types/data.types'

interface VolumeByMuscleProps {
    volumes: MuscleGroupVolume[]
}

function formatTonnage(kg: number): string {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
    return `${kg}kg`
}

export function VolumeByMuscle({ volumes }: VolumeByMuscleProps) {
    if (volumes.length === 0) {
        return (
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Volume by Muscle</h3>
                <div className="flex items-center justify-center h-20">
                    <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">No data yet</span>
                </div>
            </div>
        )
    }

    const maxSets = Math.max(...volumes.map(v => v.totalSets), 1)

    return (
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
            <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Volume by Muscle Group</h3>

            <div className="flex flex-col gap-2.5">
                {volumes.map((v, i) => {
                    const barWidth = (v.totalSets / maxSets) * 100

                    return (
                        <motion.div
                            key={v.muscleGroup}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                        >
                            {/* Label row */}
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-inter text-neutral-300">{v.muscleGroup}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-mono text-cyan-400 font-bold">{v.totalSets} sets</span>
                                    {v.totalTonnageKg > 0 && (
                                        <span className="text-[8px] font-mono text-neutral-600">{formatTonnage(v.totalTonnageKg)}</span>
                                    )}
                                </div>
                            </div>

                            {/* Bar */}
                            <div className="relative h-2 bg-[#151515] rounded-full overflow-hidden">
                                <motion.div
                                    className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-cyan-500/60 to-cyan-400/80"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${barWidth}%` }}
                                    transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                                />
                            </div>

                            {/* RIR/RPE detail */}
                            {(v.avgRir != null || v.avgRpe != null) && (
                                <div className="flex gap-3 mt-0.5">
                                    {v.avgRir != null && (
                                        <span className="text-[8px] font-mono text-neutral-600">
                                            Avg RIR: {v.avgRir}
                                        </span>
                                    )}
                                    {v.avgRpe != null && (
                                        <span className="text-[8px] font-mono text-neutral-600">
                                            Avg RPE: {v.avgRpe}
                                        </span>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
