'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Target, TrendingUp, Shield, Zap } from 'lucide-react'
import type { Mesocycle } from '@/lib/types/database.types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface WeekEmphasis {
    weekNumber: number
    volumePercent: number
    emphasis: string
    isDeload: boolean
}

interface DomainAllocation {
    coach: string
    sessionsPerWeek: number
    loadBudgetPerSession: number
    weeklyFatigueBudget: number
    constraints: string[]
    methodologyDirective: string
}

interface PlanData {
    blockEmphasis?: string
    blockName?: string
    deloadTiming?: string
    deloadWeek?: number
    keyProgressions?: string[]
    strategyRationale?: string
    interferenceNotes?: string
    volumeProgressionCurve?: WeekEmphasis[]
    weeklyEmphasis?: WeekEmphasis[]
    domainAllocations?: DomainAllocation[]
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface MesocyclePlanViewProps {
    mesocycle: Mesocycle
    currentWeekNumber: number
}

// ─── Coach Label Mapping ────────────────────────────────────────────────────

const COACH_LABELS: Record<string, string> = {
    strength: 'Strength',
    hypertrophy: 'Hypertrophy',
    endurance: 'Endurance',
    conditioning: 'Conditioning',
    mobility: 'Mobility',
}

const COACH_COLORS: Record<string, string> = {
    strength: 'text-cyan-400',
    hypertrophy: 'text-purple-400',
    endurance: 'text-emerald-400',
    conditioning: 'text-amber-400',
    mobility: 'text-teal-400',
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MesocyclePlanView({ mesocycle, currentWeekNumber }: MesocyclePlanViewProps) {
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()

    // Extract plan data from either source
    const aiContext = mesocycle.ai_context_json as Record<string, unknown> | null
    const multiAgentStrategy = mesocycle.mesocycle_strategy as PlanData | null

    const plan: PlanData = {
        // Multi-agent strategy takes priority, fall back to old monolithic plan
        ...(aiContext?.mesocyclePlan as PlanData | undefined),
        ...multiAgentStrategy,
    }

    // Normalize week data — multi-agent uses weeklyEmphasis, old uses volumeProgressionCurve
    const weeks: WeekEmphasis[] = plan.weeklyEmphasis ?? plan.volumeProgressionCurve ?? []
    const domainAllocations = plan.domainAllocations ?? []

    const hasData = plan.blockEmphasis || weeks.length > 0 || plan.keyProgressions?.length

    if (!hasData) return null

    return (
        <div className="border border-[#222] bg-[#0a0a0a]">
            {/* Toggle Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 hover:bg-[#111] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                        Training Plan
                    </span>
                </div>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                </motion.div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-4 space-y-4 border-t border-[#1a1a1a]">

                            {/* Block Overview */}
                            {plan.blockEmphasis && (
                                <div className="pt-3">
                                    {plan.blockName && (
                                        <p className="text-xs font-space-grotesk font-bold text-white mb-1">
                                            {plan.blockName}
                                        </p>
                                    )}
                                    <p className="text-xs font-inter text-neutral-400 leading-relaxed">
                                        {plan.blockEmphasis}
                                    </p>
                                </div>
                            )}

                            {/* Strategy Rationale (multi-agent only) */}
                            {plan.strategyRationale && (
                                <div>
                                    <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-1.5">
                                        Strategy
                                    </p>
                                    <p className="text-xs font-inter text-neutral-400 leading-relaxed">
                                        {plan.strategyRationale}
                                    </p>
                                </div>
                            )}

                            {/* Volume Progression Timeline */}
                            {weeks.length > 0 && (
                                <div>
                                    <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-2">
                                        Block Progression
                                    </p>
                                    <div className="space-y-1">
                                        {weeks.map((week) => {
                                            const isCurrent = week.weekNumber === currentWeekNumber
                                            return (
                                                <button
                                                    key={week.weekNumber}
                                                    onClick={() => router.push(`/dashboard?week=${week.weekNumber}`)}
                                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                                                        isCurrent
                                                            ? 'bg-cyan-500/10 border border-cyan-500/20'
                                                            : 'hover:bg-[#151515] cursor-pointer'
                                                    }`}
                                                >
                                                    <span className={`text-[10px] font-mono w-8 ${
                                                        isCurrent ? 'text-cyan-400 font-bold' : 'text-neutral-500'
                                                    }`}>
                                                        B{week.weekNumber}
                                                    </span>

                                                    {/* Volume bar */}
                                                    <div className="w-16 h-1.5 bg-[#151515] rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${
                                                                week.isDeload
                                                                    ? 'bg-amber-500/60'
                                                                    : isCurrent
                                                                        ? 'bg-cyan-400'
                                                                        : 'bg-neutral-600'
                                                            }`}
                                                            style={{ width: `${Math.min(week.volumePercent, 100)}%` }}
                                                        />
                                                    </div>

                                                    <span className="text-[9px] font-mono text-neutral-500 w-8">
                                                        {Math.round(week.volumePercent)}%
                                                    </span>

                                                    <span className={`text-[10px] font-inter flex-1 truncate ${
                                                        week.isDeload
                                                            ? 'text-amber-400'
                                                            : isCurrent
                                                                ? 'text-neutral-300'
                                                                : 'text-neutral-500'
                                                    }`}>
                                                        {week.emphasis}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Domain Allocations (multi-agent only) */}
                            {domainAllocations.length > 0 && (
                                <div>
                                    <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-2">
                                        Coach Allocations
                                    </p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {domainAllocations.map((alloc) => (
                                            <div key={alloc.coach} className="flex items-center gap-2 px-2 py-1.5 bg-[#0d0d0d] border border-[#1a1a1a] rounded">
                                                <span className={`text-[10px] font-space-grotesk font-bold ${
                                                    COACH_COLORS[alloc.coach] ?? 'text-neutral-400'
                                                }`}>
                                                    {COACH_LABELS[alloc.coach] ?? alloc.coach}
                                                </span>
                                                <span className="text-[9px] font-mono text-neutral-500 ml-auto">
                                                    {alloc.sessionsPerWeek}x/blk
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Key Progressions */}
                            {plan.keyProgressions && plan.keyProgressions.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                                        <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">
                                            Key Progressions
                                        </p>
                                    </div>
                                    <ul className="space-y-1">
                                        {plan.keyProgressions.map((prog, i) => (
                                            <li key={i} className="text-[11px] font-inter text-neutral-400 pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:bg-emerald-500/40 before:rounded-full">
                                                {prog}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Deload Info */}
                            {(plan.deloadTiming || plan.deloadWeek) && (
                                <div className="flex items-start gap-2">
                                    <Shield className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                                    <p className="text-[11px] font-inter text-neutral-500">
                                        {plan.deloadTiming ?? `Deload programmed for block ${plan.deloadWeek}`}
                                    </p>
                                </div>
                            )}

                            {/* Interference Notes (multi-agent only) */}
                            {plan.interferenceNotes && (
                                <div className="flex items-start gap-2">
                                    <Zap className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                                    <p className="text-[11px] font-inter text-neutral-500">
                                        {plan.interferenceNotes}
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
