'use client'

import { motion } from 'framer-motion'
import { Trophy, Medal } from 'lucide-react'
import { format } from 'date-fns'
import type { PersonalRecord } from '@/lib/types/data.types'

interface PRBoardProps {
    recentPRs: PersonalRecord[]
    allTimePRs: PersonalRecord[]
    totalPRsThisCycle: number
}

export function PRBoard({ recentPRs, allTimePRs, totalPRsThisCycle }: PRBoardProps) {
    return (
        <div className="flex flex-col gap-4">
            {/* PR count header */}
            <motion.div
                className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4 flex items-center gap-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                    <span className="text-2xl font-space-grotesk font-bold text-white">{totalPRsThisCycle}</span>
                    <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">PRs this cycle</p>
                </div>
            </motion.div>

            {/* Recent PRs */}
            {recentPRs.length > 0 && (
                <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                    <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Recent PRs</h3>
                    <div className="flex flex-col gap-2">
                        {recentPRs.map((pr, i) => (
                            <motion.div
                                key={`${pr.exerciseName}-${pr.date}`}
                                className="flex items-center gap-3 py-1.5 border-b border-[#151515] last:border-0"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                            >
                                <Medal className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-inter text-neutral-200 truncate">{pr.exerciseName}</p>
                                    <p className="text-[9px] font-mono text-neutral-600">
                                        {pr.muscleGroup && `${pr.muscleGroup} \u00B7 `}
                                        {format(new Date(pr.date), 'MMM d')}
                                    </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <span className="text-sm font-space-grotesk font-bold text-amber-400">
                                        {pr.weightKg}kg
                                    </span>
                                    <p className="text-[8px] font-mono text-neutral-600">{pr.reps} reps</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* All-time PR board */}
            {allTimePRs.length > 0 && (
                <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                    <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">All-Time Bests</h3>
                    <div className="flex flex-col gap-1.5">
                        {allTimePRs.map((pr, i) => (
                            <motion.div
                                key={pr.exerciseName}
                                className="flex items-center justify-between py-1 border-b border-[#111111] last:border-0"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.03 }}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-inter text-neutral-300 truncate">{pr.exerciseName}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-xs font-mono text-cyan-400 font-bold">{pr.weightKg}kg</span>
                                    <span className="text-[9px] font-mono text-neutral-600">x{pr.reps}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
