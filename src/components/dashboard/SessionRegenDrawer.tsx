'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, Dumbbell, Timer, Zap, Activity, Target,
    ChevronRight, Loader2, CheckCircle2, Footprints,
    Bike, Waves, Anchor,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { regenerateSingleSession } from '@/lib/actions/programming.actions'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RegenDrawerProps {
    isOpen: boolean
    onClose: () => void
    mode: 'regenerate' | 'add'
    workoutId: string | null
    workoutName?: string
    equipmentList: string[]
    endurancePreferences: string[]
    conditioningPreferences: string[]
    previousWeekIsDeload: boolean
}

// ─── Category Definitions ────────────────────────────────────────────────

interface CategoryDef {
    id: string
    label: string
    desc: string
    icon: typeof Dumbbell
    color: string
    bgColor: string
}

const BASE_CATEGORIES: CategoryDef[] = [
    { id: 'LIFTING', label: 'Lifting', desc: 'Strength or hypertrophy session', icon: Dumbbell, color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20' },
    { id: 'mobility', label: 'Mobility', desc: 'Recovery and movement quality', icon: Activity, color: 'text-teal-400', bgColor: 'bg-teal-500/10 border-teal-500/20' },
    { id: 'benchmark', label: 'Benchmark Test', desc: 'Test current capacities', icon: Target, color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20' },
]

const ENDURANCE_CATEGORIES: Record<string, CategoryDef> = {
    running: { id: 'running', label: 'Running', desc: 'Road, trail, or treadmill', icon: Footprints, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
    rucking: { id: 'rucking', label: 'Rucking', desc: 'Weighted pack endurance', icon: Target, color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20' },
    rowing: { id: 'rowing', label: 'Rowing', desc: 'Concept2 or similar', icon: Anchor, color: 'text-sky-400', bgColor: 'bg-sky-500/10 border-sky-500/20' },
    cycling: { id: 'cycling', label: 'Cycling', desc: 'Bike or spin bike', icon: Bike, color: 'text-lime-400', bgColor: 'bg-lime-500/10 border-lime-500/20' },
    swimming: { id: 'swimming', label: 'Swimming', desc: 'Lap swimming', icon: Waves, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10 border-cyan-500/20' },
}

const CONDITIONING_CATEGORY: CategoryDef = {
    id: 'metcon', label: 'Conditioning', desc: 'AMRAP, EMOM, circuits, intervals', icon: Zap, color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20',
}

// ─── Component ─────────────────────────────────────────────────────────────

export function SessionRegenDrawer({
    isOpen,
    onClose,
    mode,
    workoutId,
    workoutName,
    equipmentList,
    endurancePreferences,
    conditioningPreferences,
    previousWeekIsDeload,
}: RegenDrawerProps) {
    const router = useRouter()
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [result, setResult] = useState<{ success: boolean; rationale?: string; error?: string } | null>(null)

    // Build available categories based on profile
    const availableCategories: CategoryDef[] = [...BASE_CATEGORIES]

    // Add endurance modalities from preferences or equipment
    const enduranceIds = endurancePreferences.length > 0
        ? endurancePreferences
        : (() => {
            const ids: string[] = ['running'] // running always available
            if (equipmentList.includes('rower')) ids.push('rowing')
            if (equipmentList.includes('stationary_bike')) ids.push('cycling')
            if (equipmentList.includes('swimming_pool') || equipmentList.includes('open_water')) ids.push('swimming')
            if (equipmentList.includes('ruck')) ids.push('rucking')
            return ids
        })()

    for (const id of enduranceIds) {
        if (ENDURANCE_CATEGORIES[id]) {
            availableCategories.push(ENDURANCE_CATEGORIES[id])
        }
    }

    // Add conditioning if they have conditioning preferences or always
    if (conditioningPreferences.length > 0 || equipmentList.length > 0) {
        availableCategories.push(CONDITIONING_CATEGORY)
    }

    const handleGenerate = () => {
        if (!selectedCategory) return

        startTransition(async () => {
            const res = await regenerateSingleSession(workoutId, selectedCategory)
            if (res.success) {
                setResult({ success: true, rationale: res.data.aiResponse.rationale })
                // Auto-close after 2s
                setTimeout(() => {
                    setResult(null)
                    setSelectedCategory(null)
                    onClose()
                    router.refresh()
                }, 2000)
            } else {
                setResult({ success: false, error: res.error })
            }
        })
    }

    const handleClose = () => {
        if (isPending) return
        setResult(null)
        setSelectedCategory(null)
        onClose()
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] overflow-y-auto"
                    >
                        <div className="bg-[#0a0a0a] border-t border-white/10 pb-safe-area">
                            {/* Handle bar */}
                            <div className="flex justify-center py-3">
                                <div className="w-10 h-1 bg-white/20 rounded-full" />
                            </div>

                            <div className="px-5 pb-6">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h2 className="text-base font-space-grotesk font-bold text-white">
                                            {mode === 'regenerate'
                                                ? `Change Session`
                                                : 'Add Session'
                                            }
                                        </h2>
                                        {mode === 'regenerate' && workoutName && (
                                            <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mt-0.5">
                                                replacing: {workoutName}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleClose}
                                        className="p-2 text-neutral-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Post-deload benchmark nudge */}
                                {previousWeekIsDeload && mode === 'add' && !result && (
                                    <div className="mb-4 p-3 border border-amber-500/20 bg-amber-500/5">
                                        <p className="text-[11px] text-amber-300 font-inter">
                                            Fresh off a deload — good time to re-benchmark and test your current capacities.
                                        </p>
                                    </div>
                                )}

                                {/* Loading state */}
                                {isPending && (
                                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                                        <p className="text-sm text-neutral-400 font-inter">Generating session...</p>
                                    </div>
                                )}

                                {/* Result state */}
                                {result && !isPending && (
                                    <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                        {result.success ? (
                                            <>
                                                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                                                <p className="text-sm text-emerald-300 font-space-grotesk font-bold">Session Generated</p>
                                                {result.rationale && (
                                                    <p className="text-[11px] text-neutral-400 font-inter text-center max-w-xs leading-relaxed">
                                                        {result.rationale}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <X className="w-10 h-10 text-red-400" />
                                                <p className="text-sm text-red-300 font-space-grotesk font-bold">Generation Failed</p>
                                                <p className="text-[11px] text-neutral-400 font-inter text-center">
                                                    {result.error}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Category grid */}
                                {!isPending && !result && (
                                    <>
                                        <div className="grid grid-cols-2 gap-2 mb-5">
                                            {availableCategories.map((cat) => {
                                                const isSelected = selectedCategory === cat.id
                                                const Icon = cat.icon

                                                return (
                                                    <button
                                                        key={cat.id}
                                                        onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                                                        className={cn(
                                                            "flex flex-col items-start p-3 border transition-all text-left",
                                                            isSelected
                                                                ? "border-cyan-500 bg-cyan-950/20"
                                                                : `border-[#222] bg-[#111] hover:border-[#444]`
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Icon className={cn("w-4 h-4", isSelected ? 'text-cyan-400' : cat.color)} />
                                                            <span className="text-xs font-space-grotesk font-bold text-white">
                                                                {cat.label}
                                                            </span>
                                                        </div>
                                                        <span className="text-[9px] font-mono text-neutral-500 leading-tight">
                                                            {cat.desc}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {/* Generate button */}
                                        <button
                                            onClick={handleGenerate}
                                            disabled={!selectedCategory}
                                            className={cn(
                                                "w-full flex items-center justify-center gap-2 py-3 font-space-grotesk text-sm font-bold uppercase tracking-wider transition-all",
                                                selectedCategory
                                                    ? "bg-cyan-500 text-black hover:bg-cyan-400"
                                                    : "bg-[#222] text-neutral-600 cursor-not-allowed"
                                            )}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                            {mode === 'regenerate' ? 'Regenerate' : 'Generate'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
