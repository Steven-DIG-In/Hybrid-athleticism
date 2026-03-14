'use client'

import { motion } from 'framer-motion'
import { Dumbbell, Target, Gauge } from 'lucide-react'
import type { StrengthAnalyticsData } from '@/lib/types/data.types'
import { PRBoard } from './PRBoard'
import { VolumeByMuscle } from './VolumeByMuscle'
import { TonnageTrend } from './TonnageTrend'

interface StrengthDashboardProps {
    data: StrengthAnalyticsData
}

export function StrengthDashboard({ data }: StrengthDashboardProps) {
    const rirLabel = data.avgRirDeviation != null
        ? data.avgRirDeviation > 0 ? 'Too easy' : data.avgRirDeviation < 0 ? 'Pushing hard' : 'On target'
        : null

    return (
        <div className="flex flex-col gap-4">
            {/* Context */}
            {data.mesocycleName && (
                <div className="mb-1">
                    <h2 className="text-lg font-space-grotesk font-bold text-white tracking-tight">
                        Strength & PRs
                    </h2>
                    <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-0.5">
                        {data.mesocycleName} &middot; Week {data.currentWeek}/{data.totalWeeks}
                    </p>
                </div>
            )}

            {/* Stat cards row */}
            <div className="grid grid-cols-3 gap-2">
                {/* Sets logged */}
                <motion.div
                    className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3 flex flex-col items-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Dumbbell className="w-4 h-4 text-cyan-400 mb-1.5" />
                    <span className="text-xl font-space-grotesk font-bold text-white">{data.totalSetsLogged}</span>
                    <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">Sets Logged</span>
                </motion.div>

                {/* Avg RPE */}
                <motion.div
                    className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3 flex flex-col items-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                >
                    <Gauge className="w-4 h-4 text-emerald-400 mb-1.5" />
                    <span className="text-xl font-space-grotesk font-bold text-white">
                        {data.avgRpe != null ? data.avgRpe : '—'}
                    </span>
                    <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">Avg RPE</span>
                </motion.div>

                {/* RIR Deviation */}
                <motion.div
                    className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3 flex flex-col items-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Target className="w-4 h-4 text-amber-400 mb-1.5" />
                    <span className="text-xl font-space-grotesk font-bold text-white">
                        {data.avgRirDeviation != null ? `${data.avgRirDeviation > 0 ? '+' : ''}${data.avgRirDeviation}` : '—'}
                    </span>
                    <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">RIR Dev</span>
                    {rirLabel && (
                        <span className={`text-[7px] font-mono mt-0.5 ${
                            data.avgRirDeviation! > 0.5 ? 'text-amber-500' : data.avgRirDeviation! < -0.5 ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                            {rirLabel}
                        </span>
                    )}
                </motion.div>
            </div>

            {/* Tonnage trend */}
            <TonnageTrend weeklyTonnage={data.weeklyTonnage} currentWeek={data.currentWeek} />

            {/* Volume by muscle */}
            <VolumeByMuscle volumes={data.muscleGroupVolumes} />

            {/* PR Board */}
            <PRBoard
                recentPRs={data.recentPRs}
                allTimePRs={data.allTimePRs}
                totalPRsThisCycle={data.totalPRsThisCycle}
            />
        </div>
    )
}
