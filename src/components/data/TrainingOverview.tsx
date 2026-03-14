'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Target, Calendar, TrendingUp, Dumbbell, Timer, Footprints, Zap, Activity } from 'lucide-react'
import { format } from 'date-fns'
import type { TrainingOverviewData } from '@/lib/types/data.types'
import { WeeklyLoadChart } from './WeeklyLoadChart'
import { ModalityRing } from './ModalityRing'

interface TrainingOverviewProps {
    data: TrainingOverviewData
}

const MODALITY_ICONS: Record<string, typeof Dumbbell> = {
    LIFTING: Dumbbell,
    CARDIO: Timer,
    RUCKING: Footprints,
    METCON: Zap,
    MOBILITY: Activity,
}

const MODALITY_COLORS: Record<string, string> = {
    LIFTING: 'text-cyan-400',
    CARDIO: 'text-emerald-400',
    RUCKING: 'text-amber-400',
    METCON: 'text-violet-400',
    MOBILITY: 'text-pink-400',
}

export function TrainingOverview({ data }: TrainingOverviewProps) {
    const mesocycleProgress = data.totalWeeks > 0
        ? Math.round((data.currentWeek / data.totalWeeks) * 100)
        : 0

    return (
        <div className="flex flex-col gap-4">
            {/* Mesocycle context */}
            {data.mesocycleName && (
                <div className="mb-1">
                    <h2 className="text-lg font-space-grotesk font-bold text-white tracking-tight">
                        {data.mesocycleName}
                    </h2>
                    <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-0.5">
                        Week {data.currentWeek} of {data.totalWeeks}
                        {data.mesocycleGoal && ` \u00B7 ${data.mesocycleGoal.replace('_', ' ')}`}
                    </p>
                </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2">
                {/* Compliance */}
                <motion.div
                    className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3 flex flex-col items-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1.5" />
                    <span className="text-xl font-space-grotesk font-bold text-white">
                        {data.complianceRate}%
                    </span>
                    <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">
                        Compliance
                    </span>
                    <span className="text-[8px] font-mono text-neutral-700 mt-0.5">
                        {data.totalCompleted}/{data.totalScheduled}
                    </span>
                </motion.div>

                {/* Sessions completed */}
                <motion.div
                    className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3 flex flex-col items-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                >
                    <Target className="w-4 h-4 text-cyan-400 mb-1.5" />
                    <span className="text-xl font-space-grotesk font-bold text-white">
                        {data.totalCompleted}
                    </span>
                    <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">
                        Completed
                    </span>
                    <span className="text-[8px] font-mono text-neutral-700 mt-0.5">
                        sessions
                    </span>
                </motion.div>

                {/* Mesocycle progress */}
                <motion.div
                    className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3 flex flex-col items-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Calendar className="w-4 h-4 text-amber-400 mb-1.5" />
                    <span className="text-xl font-space-grotesk font-bold text-white">
                        {mesocycleProgress}%
                    </span>
                    <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">
                        Progress
                    </span>
                    <span className="text-[8px] font-mono text-neutral-700 mt-0.5">
                        W{data.currentWeek}/{data.totalWeeks}
                    </span>
                </motion.div>
            </div>

            {/* Weekly load chart */}
            <WeeklyLoadChart weeklyData={data.weeklyData} currentWeek={data.currentWeek} />

            {/* Modality ring */}
            <ModalityRing distribution={data.modalityDistribution} totalSessions={data.totalScheduled} />

            {/* Recent activity */}
            {data.recentSessions.length > 0 && (
                <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                    <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Recent Activity</h3>
                    <div className="flex flex-col gap-2">
                        {data.recentSessions.map((session, i) => {
                            const Icon = MODALITY_ICONS[session.modality] ?? Activity
                            const colorClass = MODALITY_COLORS[session.modality] ?? 'text-neutral-400'

                            return (
                                <motion.div
                                    key={session.id}
                                    className="flex items-center gap-3 py-1.5 border-b border-[#151515] last:border-0"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                >
                                    <Icon className={`w-4 h-4 flex-shrink-0 ${colorClass}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-inter text-neutral-200 truncate">{session.name}</p>
                                        <p className="text-[9px] font-mono text-neutral-600">
                                            {format(new Date(session.completedAt), 'MMM d')}
                                            {session.keyMetric && ` \u00B7 ${session.keyMetric}`}
                                        </p>
                                    </div>
                                    <TrendingUp className="w-3 h-3 text-neutral-700 flex-shrink-0" />
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
