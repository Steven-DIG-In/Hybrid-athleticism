'use client'

import { motion } from 'framer-motion'
import type { ModalityDistribution } from '@/lib/types/data.types'

interface ModalityRingProps {
    distribution: ModalityDistribution[]
    totalSessions: number
}

const MODALITY_LABELS: Record<string, string> = {
    LIFTING: 'Lifting',
    CARDIO: 'Cardio',
    RUCKING: 'Rucking',
    METCON: 'Conditioning',
    MOBILITY: 'Mobility',
}

const SIZE = 120
const STROKE_WIDTH = 14
const RADIUS = (SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ModalityRing({ distribution, totalSessions }: ModalityRingProps) {
    if (distribution.length === 0) {
        return (
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Training Split</h3>
                <div className="flex items-center justify-center h-32">
                    <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">No data yet</span>
                </div>
            </div>
        )
    }

    // Calculate arc offsets
    let cumulativeOffset = 0
    const arcs = distribution.map(d => {
        const length = (d.percentage / 100) * CIRCUMFERENCE
        const offset = cumulativeOffset
        cumulativeOffset += length
        return { ...d, length, offset }
    })

    return (
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
            <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Training Split</h3>

            <div className="flex items-center gap-4">
                {/* Ring */}
                <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
                    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full -rotate-90">
                        {/* Background track */}
                        <circle
                            cx={SIZE / 2}
                            cy={SIZE / 2}
                            r={RADIUS}
                            fill="none"
                            stroke="#151515"
                            strokeWidth={STROKE_WIDTH}
                        />

                        {/* Segments */}
                        {arcs.map((arc, i) => (
                            <motion.circle
                                key={arc.modality}
                                cx={SIZE / 2}
                                cy={SIZE / 2}
                                r={RADIUS}
                                fill="none"
                                stroke={arc.color}
                                strokeWidth={STROKE_WIDTH}
                                strokeLinecap="round"
                                strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                                animate={{ strokeDashoffset: CIRCUMFERENCE - arc.offset }}
                                transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                            />
                        ))}
                    </svg>

                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-space-grotesk font-bold text-white">{totalSessions}</span>
                        <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest">sessions</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    {distribution.map(d => (
                        <div key={d.modality} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-[10px] font-mono text-neutral-400 truncate">
                                {MODALITY_LABELS[d.modality] ?? d.modality}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-600 ml-auto flex-shrink-0">
                                {d.percentage}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
