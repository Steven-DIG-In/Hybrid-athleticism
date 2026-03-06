"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RIRSlider } from "@/components/ui/slider"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"
import { completeWorkout } from "@/lib/actions/workout.actions"
import { updateExerciseSet } from "@/lib/actions/logging.actions"
import type { WorkoutWithSets } from "@/lib/types/training.types"
import type { ExerciseSet } from "@/lib/types/database.types"

export function WorkoutLogger({ workout }: { workout: WorkoutWithSets }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Group sets by exercise name to create the pagination flow
    const exerciseNames = Array.from(new Set(workout.exercise_sets.map(s => s.exercise_name)))
    const [activeExerciseIdx, setActiveExerciseIdx] = useState(0)
    const currentExerciseName = exerciseNames[activeExerciseIdx]

    // Local state to track input values before they are saved to the DB
    const [localSets, setLocalSets] = useState<Record<string, { weight: string, reps: string, rir: number }>>(() => {
        const initial: Record<string, any> = {}
        workout.exercise_sets.forEach(s => {
            initial[s.id] = {
                weight: s.actual_weight_kg?.toString() || s.target_weight_kg?.toString() || "",
                reps: s.actual_reps?.toString() || s.target_reps?.toString() || "",
                rir: s.rir_actual ?? s.target_rir ?? 2
            }
        })
        return initial
    })

    const activeSets = workout.exercise_sets.filter(s => s.exercise_name === currentExerciseName)
    const currentExerciseData = activeSets[0] // Used for headers (muscle group, target weight, etc)

    const handleCompleteSet = async (setId: string, isAlreadyCompleted: boolean) => {
        // Optimistic UI updates could go here, but for safety in the MVP, 
        // we await the server action. 
        const values = localSets[setId]

        startTransition(async () => {
            // If it's already completed, we're un-completing it (nullifying actuals)
            if (isAlreadyCompleted) {
                await updateExerciseSet(setId, {
                    actualReps: 0,
                    actualWeightKg: 0,
                    rirActual: 0
                })
            } else {
                await updateExerciseSet(setId, {
                    actualReps: parseInt(values.reps) || 0,
                    actualWeightKg: parseFloat(values.weight) || 0,
                    rirActual: values.rir
                })
            }
            router.refresh() // Re-fetch Server Component data
        })
    }

    const handleNextOrComplete = () => {
        if (activeExerciseIdx < exerciseNames.length - 1) {
            setActiveExerciseIdx(i => i + 1)
        } else {
            // End of workout
            startTransition(async () => {
                // Approximate duration: 45 mins. In a real app we'd track start->end time.
                const res = await completeWorkout(workout.id, 45)
                if (res.success) {
                    router.push('/dashboard')
                } else {
                    console.error("Failed to complete workout:", res.error)
                }
            })
        }
    }

    return (
        <div className="min-h-screen bg-[#000000] text-white flex flex-col pt-12">

            {/* Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050505] border-b border-[#222222] p-4 flex justify-between items-center">
                <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => router.push('/dashboard')}><ArrowLeft className="w-5 h-5 text-neutral-400" /></Button>
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">{workout.modality} SESSION</span>
                <Button variant="ghost" className="text-xs text-red-400 p-0 h-8" onClick={() => router.push('/dashboard')}>ABORT</Button>
            </nav>

            {/* Active Exercise Display */}
            <div className="p-6 pb-2 pt-6">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono uppercase text-neutral-500 tracking-widest">{currentExerciseData?.muscle_group}</span>
                    <span className="text-xs font-mono text-cyan-500">Ex {activeExerciseIdx + 1}/{exerciseNames.length}</span>
                </div>

                {/* Massive typography for high-stress visibility */}
                <h1 className="text-4xl md:text-5xl font-space-grotesk font-bold tracking-tight leading-none mb-6 text-white text-shadow-glow">
                    {currentExerciseName}
                </h1>

                <div className="flex gap-4 mb-4">
                    <div className="flex-1 bg-[#0a0a0a] border border-[#222222] p-3 text-center">
                        <span className="block text-[10px] font-mono text-neutral-500 mb-1">TARGET REPS</span>
                        <span className="text-lg font-space-grotesk font-bold">{currentExerciseData?.target_reps}</span>
                    </div>
                    <div className="flex-1 bg-[#0a0a0a] border border-[#222222] p-3 text-center">
                        <span className="block text-[10px] font-mono text-neutral-500 mb-1">TARGET LOAD</span>
                        <span className="text-lg font-space-grotesk font-bold">{currentExerciseData?.target_weight_kg || "--"} kg</span>
                    </div>
                </div>
            </div>

            {/* Logging Grid - Designed for sweaty hands */}
            <div className="flex-1 overflow-y-auto px-4 pb-32">
                <div className="space-y-4">
                    {activeSets.map((set: ExerciseSet, i: number) => {
                        const isCompleted = set.actual_reps !== null
                        const lSet = localSets[set.id] || { weight: "", reps: "", rir: 2 }

                        return (
                            <div
                                key={set.id}
                                className={`border transition-all duration-300 ${isCompleted ? 'border-cyan-500/50 bg-[#050505]' : 'border-[#333333] bg-[#0c0c0c]'
                                    } p-4`}
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex-shrink-0 w-8 text-center text-sm font-mono text-neutral-500">
                                        {set.set_number}
                                    </div>

                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">KG</span>
                                            <input
                                                type="number"
                                                value={lSet.weight}
                                                onChange={(e) => setLocalSets(prev => ({ ...prev, [set.id]: { ...lSet, weight: e.target.value } }))}
                                                className="w-full bg-[#111111] border border-[#222222] h-12 text-center text-xl font-space-grotesk focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                                                disabled={isCompleted || isPending}
                                            />
                                        </div>
                                        <div className="relative">
                                            <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">REPS</span>
                                            <input
                                                type="number"
                                                value={lSet.reps}
                                                onChange={(e) => setLocalSets(prev => ({ ...prev, [set.id]: { ...lSet, reps: e.target.value } }))}
                                                className="w-full bg-[#111111] border border-[#222222] h-12 text-center text-xl font-space-grotesk focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                                                disabled={isCompleted || isPending}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleCompleteSet(set.id, isCompleted)}
                                        disabled={isPending}
                                        className={`flex-shrink-0 w-12 h-12 flex items-center justify-center border transition-colors ${isCompleted ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_15px_rgba(13,185,242,0.4)]' : 'bg-[#1a1a1a] border-[#333333] text-neutral-400 hover:border-cyan-500/50'
                                            } disabled:opacity-50`}
                                    >
                                        <CheckCircle2 className={`w-6 h-6 ${isCompleted ? 'text-black' : ''}`} />
                                    </button>
                                </div>

                                {/* RIR Tactile Slider */}
                                {!isCompleted && (
                                    <div className="pt-2 border-t border-[#222222]">
                                        <div className="flex justify-between items-center mb-2 px-1">
                                            <span className="text-[10px] font-mono text-neutral-500 tracking-widest uppercase">Target RIR: {set.target_rir}</span>
                                        </div>
                                        <RIRSlider
                                            value={lSet.rir}
                                            onChange={(val) => setLocalSets(prev => ({ ...prev, [set.id]: { ...lSet, rir: val } }))}
                                            disabled={isPending}
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Footer Nav */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent pb-safe-area">
                <Button
                    onClick={handleNextOrComplete}
                    disabled={isPending}
                    className="w-full h-16 text-lg font-space-grotesk uppercase tracking-widest shadow-[0_0_20px_rgba(13,185,242,0.2)]"
                >
                    {isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : (activeExerciseIdx < exerciseNames.length - 1 ? "Next Movement" : "Complete Protocol")}
                </Button>
            </div>

        </div>
    )
}
