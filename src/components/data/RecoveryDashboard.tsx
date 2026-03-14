'use client'

import { motion } from 'framer-motion'
import { Activity, Brain, ShieldCheck, ShieldAlert, AlertTriangle, Check, X } from 'lucide-react'
import type { RecoveryAnalyticsData } from '@/lib/types/data.types'
import { RecoveryTimeline } from './RecoveryTimeline'

interface RecoveryDashboardProps {
    data: RecoveryAnalyticsData
}

const ENERGY_LABELS: Record<string, string> = {
    '4': 'High',
    '3': 'Normal',
    '2': 'Low',
    '1': 'Very Low',
}

const FEELING_LABELS: Record<string, string> = {
    '4': 'Great',
    '3': 'As Expected',
    '2': 'Struggled',
    '1': 'Skipped',
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
} as const
const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
}

export function RecoveryDashboard({ data }: RecoveryDashboardProps) {
    const hasData = data.weeklyRecovery.some(w => w.assessmentCount > 0) || data.totalInterventions > 0

    const energyLabel = data.avgEnergyLevel != null
        ? ENERGY_LABELS[Math.round(data.avgEnergyLevel).toString()] ?? `${data.avgEnergyLevel}`
        : null

    const feelingLabel = data.avgOverallFeeling != null
        ? FEELING_LABELS[Math.round(data.avgOverallFeeling).toString()] ?? `${data.avgOverallFeeling}`
        : null

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
            {/* Context header */}
            {data.mesocycleName && (
                <motion.div variants={item} className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                    {data.mesocycleName} · Week {data.currentWeek}/{data.totalWeeks}
                </motion.div>
            )}

            {!hasData ? (
                <motion.div variants={item} className="flex flex-col items-center justify-center py-16 gap-3">
                    <Activity className="w-8 h-8 text-neutral-700" />
                    <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">No recovery data yet</p>
                </motion.div>
            ) : (
                <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 gap-2">
                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Activity className="w-3 h-3 text-cyan-400" />
                                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Avg Energy</span>
                            </div>
                            <span className="text-base font-space-grotesk font-bold text-white">
                                {energyLabel ?? '—'}
                            </span>
                        </motion.div>

                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Brain className="w-3 h-3 text-violet-400" />
                                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Avg Feeling</span>
                            </div>
                            <span className="text-base font-space-grotesk font-bold text-white">
                                {feelingLabel ?? '—'}
                            </span>
                        </motion.div>

                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Pain Reports</span>
                            </div>
                            <span className="text-lg font-space-grotesk font-bold text-white">{data.painReports}</span>
                        </motion.div>

                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Interventions</span>
                            </div>
                            <span className="text-lg font-space-grotesk font-bold text-white">
                                {data.acceptedInterventions}
                                <span className="text-[10px] font-mono text-neutral-500 ml-1">/ {data.totalInterventions}</span>
                            </span>
                        </motion.div>
                    </div>

                    {/* Recovery timeline */}
                    <motion.div variants={item}>
                        <RecoveryTimeline weeklyRecovery={data.weeklyRecovery} currentWeek={data.currentWeek} />
                    </motion.div>

                    {/* AI Interventions */}
                    {data.recentInterventions.length > 0 && (
                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                            <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">AI Coach Interventions</h3>
                            <div className="space-y-2">
                                {data.recentInterventions.map(i => (
                                    <div key={i.id} className="flex items-start gap-2 py-1.5 border-b border-[#151515] last:border-0">
                                        <div className="mt-0.5 flex-shrink-0">
                                            {i.accepted === true ? (
                                                <Check className="w-3 h-3 text-emerald-400" />
                                            ) : i.accepted === false ? (
                                                <X className="w-3 h-3 text-red-400" />
                                            ) : (
                                                <ShieldAlert className="w-3 h-3 text-neutral-600" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono text-neutral-300 truncate">
                                                    {i.triggerType.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-[9px] font-mono text-neutral-600 flex-shrink-0">
                                                    {formatDate(i.date)}
                                                </span>
                                            </div>
                                            <p className="text-[9px] font-mono text-neutral-500 mt-0.5 line-clamp-2">{i.rationale}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </>
            )}
        </motion.div>
    )
}
