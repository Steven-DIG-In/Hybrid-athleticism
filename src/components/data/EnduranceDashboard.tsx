'use client'

import { motion } from 'framer-motion'
import { Timer, MapPin, Heart, Mountain, AlertTriangle } from 'lucide-react'
import type { EnduranceAnalyticsData } from '@/lib/types/data.types'
import { ZoneDistributionChart } from './ZoneDistributionChart'
import { WeeklyEnduranceChart } from './WeeklyEnduranceChart'

interface EnduranceDashboardProps {
    data: EnduranceAnalyticsData
}

function formatPace(secPerKm: number): string {
    const min = Math.floor(secPerKm / 60)
    const sec = Math.round(secPerKm % 60)
    return `${min}:${sec.toString().padStart(2, '0')}/km`
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

export function EnduranceDashboard({ data }: EnduranceDashboardProps) {
    const hasData = data.totalCardioSessions > 0 || data.totalRuckSessions > 0

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
                    <Timer className="w-8 h-8 text-neutral-700" />
                    <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">No endurance data yet</p>
                </motion.div>
            ) : (
                <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 gap-2">
                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Timer className="w-3 h-3 text-emerald-400" />
                                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Cardio Time</span>
                            </div>
                            <span className="text-lg font-space-grotesk font-bold text-white">
                                {data.totalCardioMinutes}
                                <span className="text-[10px] font-mono text-neutral-500 ml-1">min</span>
                            </span>
                        </motion.div>

                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <MapPin className="w-3 h-3 text-emerald-400" />
                                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Distance</span>
                            </div>
                            <span className="text-lg font-space-grotesk font-bold text-white">
                                {data.totalCardioDistanceKm}
                                <span className="text-[10px] font-mono text-neutral-500 ml-1">km</span>
                            </span>
                        </motion.div>

                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Heart className="w-3 h-3 text-red-400" />
                                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Avg HR</span>
                            </div>
                            <span className="text-lg font-space-grotesk font-bold text-white">
                                {data.avgHeartRateBpm ?? '—'}
                                {data.avgHeartRateBpm && <span className="text-[10px] font-mono text-neutral-500 ml-1">bpm</span>}
                            </span>
                        </motion.div>

                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <MapPin className="w-3 h-3 text-cyan-400" />
                                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Avg Pace</span>
                            </div>
                            <span className="text-lg font-space-grotesk font-bold text-white">
                                {data.avgPaceSecPerKm ? formatPace(data.avgPaceSecPerKm) : '—'}
                            </span>
                        </motion.div>
                    </div>

                    {/* Zone distribution */}
                    <motion.div variants={item}>
                        <ZoneDistributionChart distribution={data.zoneDistribution} totalSessions={data.totalCardioSessions} />
                    </motion.div>

                    {/* Weekly volume */}
                    <motion.div variants={item}>
                        <WeeklyEnduranceChart weeklyData={data.weeklyVolume} currentWeek={data.currentWeek} />
                    </motion.div>

                    {/* Rucking summary */}
                    {data.totalRuckSessions > 0 && (
                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                            <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Rucking Summary</h3>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <div>
                                    <span className="text-lg font-space-grotesk font-bold text-amber-400">{data.totalRuckSessions}</span>
                                    <p className="text-[8px] font-mono text-neutral-600 uppercase">Sessions</p>
                                </div>
                                <div>
                                    <span className="text-lg font-space-grotesk font-bold text-white">{data.totalRuckDistanceKm}</span>
                                    <p className="text-[8px] font-mono text-neutral-600 uppercase">km total</p>
                                </div>
                                <div>
                                    <span className="text-lg font-space-grotesk font-bold text-white">{data.totalLoadIndex}</span>
                                    <p className="text-[8px] font-mono text-neutral-600 uppercase">Load Index</p>
                                </div>
                            </div>

                            {data.fatigueFlags > 0 && (
                                <div className="flex items-center gap-1.5 text-amber-500">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span className="text-[9px] font-mono">{data.fatigueFlags} fatigue flag{data.fatigueFlags !== 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Recent cardio sessions */}
                    {data.recentCardio.length > 0 && (
                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                            <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Recent Cardio</h3>
                            <div className="space-y-2">
                                {data.recentCardio.map(c => (
                                    <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[#151515] last:border-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                            <span className="text-[10px] font-mono text-neutral-300 truncate">{c.cardioType.replace('_', ' ')}</span>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="text-[10px] font-mono text-neutral-500">{c.durationMinutes}m</span>
                                            {c.distanceKm && (
                                                <span className="text-[10px] font-mono text-neutral-500">{c.distanceKm}km</span>
                                            )}
                                            <span className="text-[9px] font-mono text-neutral-600">{formatDate(c.date)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Recent rucks */}
                    {data.recentRucks.length > 0 && (
                        <motion.div variants={item} className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                            <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Recent Rucks</h3>
                            <div className="space-y-2">
                                {data.recentRucks.map(r => (
                                    <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-[#151515] last:border-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Mountain className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                            <span className="text-[10px] font-mono text-neutral-300">{r.distanceKm}km · {r.packWeightLbs}lbs</span>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="text-[10px] font-mono text-neutral-500">{r.durationMinutes}m</span>
                                            {r.fatigueFlag && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                                            <span className="text-[9px] font-mono text-neutral-600">{formatDate(r.date)}</span>
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
