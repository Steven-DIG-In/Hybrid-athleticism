'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { SessionInventory } from '@/lib/types/inventory.types'
import type { WorkoutWithSets } from '@/lib/types/training.types'

interface SessionPreviewProps {
    session: SessionInventory
    workout: WorkoutWithSets | null
    isExpanded: boolean
}

export function SessionPreview({ session, workout, isExpanded }: SessionPreviewProps) {
    const exerciseNames = workout
        ? [...new Set(workout.exercise_sets.map(s => s.exercise_name))]
        : []

    return (
        <AnimatePresence initial={false}>
            {isExpanded && (
                <motion.div
                    key="preview"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                    <div className="px-4 pb-4 pt-0 border-t border-[#1a1a1a] space-y-3">
                        {/* Duration row */}
                        {session.estimated_duration_minutes && (
                            <p className="text-[10px] font-mono text-amber-400/70 pt-3">
                                {session.estimated_duration_minutes} min estimated
                            </p>
                        )}

                        {/* Exercise sets for lifting */}
                        {workout && session.modality === 'LIFTING' && exerciseNames.length > 0 ? (
                            <div className="space-y-1.5">
                                {exerciseNames.map((name) => {
                                    const sets = workout.exercise_sets.filter(s => s.exercise_name === name)
                                    const first = sets[0]
                                    return (
                                        <div
                                            key={name}
                                            className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-xs text-neutral-200 font-inter font-medium">
                                                    {name}
                                                </span>
                                                {first.muscle_group && (
                                                    <span className="text-[10px] text-neutral-600 font-mono">
                                                        {first.muscle_group}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-mono text-neutral-500">
                                                    {sets.length}x{first.target_reps ?? '?'}
                                                </span>
                                                {first.target_weight_kg && (
                                                    <span className="text-xs font-mono text-amber-400">
                                                        {first.target_weight_kg}kg
                                                    </span>
                                                )}
                                                {first.target_rir != null && (
                                                    <span className="text-[10px] font-mono text-neutral-600">
                                                        RIR {first.target_rir}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : session.coach_notes ? (
                            <p className="text-xs text-neutral-400 font-inter leading-relaxed">
                                {session.coach_notes}
                            </p>
                        ) : (
                            <p className="text-xs text-neutral-600 font-inter italic">
                                No additional details
                            </p>
                        )}

                        {/* Coach notes as supplement when exercises shown */}
                        {workout && exerciseNames.length > 0 && session.coach_notes && (
                            <p className="text-[10px] text-neutral-500 font-inter leading-relaxed border-l-2 border-amber-500/30 pl-2">
                                {session.coach_notes}
                            </p>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
