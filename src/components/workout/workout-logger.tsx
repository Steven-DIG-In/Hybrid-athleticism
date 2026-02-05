'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Clock, Save, CheckCircle2, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkoutLoggerProps } from './types'
import { getExerciseById } from '@/lib/exercise-library'
import { Database } from '@/types/database'
import { SupabaseClient } from '@supabase/supabase-js'
import { RestTimer } from './rest-timer'

interface ExtendedLoggerProps extends WorkoutLoggerProps {
    history?: Record<string, { weight: number, reps: number, date: string }>
}

export function WorkoutLogger({ session, exercises, liftMaxes, userId, history }: ExtendedLoggerProps) {
    const router = useRouter()
    const [startTime] = useState<Date>(new Date())
    const [activeExerciseIndex, setActiveExerciseIndex] = useState(0)
    const [logs, setLogs] = useState<Record<string, any[]>>({}) // exerciseId -> sets[]
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())

    // Rest Timer State
    const [restTarget, setRestTarget] = useState<Date | null>(null)


    // Initialize empty logs based on planned sets
    useEffect(() => {
        const initialLogs: Record<string, any[]> = {}
        exercises.forEach(ex => {
            // Logic to determine suggested weight
            // 1. Plan-specific suggestion from planned_exercises
            // 2. 70% of training max if available
            // 3. Empty string for manual entry
            let weight: string | number = ex.suggested_weight_kg || ''

            if (!weight && liftMaxes) {
                const max = liftMaxes.find(m => m.exercise_id === ex.exercise_id)
                if (max?.training_max_kg) {
                    // Use ~70% of training max for working weight
                    weight = Math.round(max.training_max_kg * 0.7)
                } else if (max?.estimated_1rm_kg) {
                    // Fallback: ~60% of estimated 1RM
                    weight = Math.round(max.estimated_1rm_kg * 0.6)
                }
            }

            // Ensure sets is a valid number
            const numSets = typeof ex.sets === 'number' && ex.sets > 0 ? ex.sets : 3

            initialLogs[ex.id] = Array(numSets).fill(null).map(() => ({
                weight: weight,
                reps: ex.rep_range_min || '',
                rir: ex.target_rir ?? 2,
                completed: false
            }))
        })
        setLogs(initialLogs)
    }, [exercises, liftMaxes])

    const activeExercise = exercises[activeExerciseIndex]
    const exerciseDetails = activeExercise ? getExerciseById(activeExercise.exercise_id) : null
    const activeLogs = activeExercise ? (logs[activeExercise.id] || []) : []

    // Update a single set log
    const updateLog = (exerciseId: string, setIndex: number, field: string, value: any) => {
        setLogs(prev => {
            const exerciseLogs = [...(prev[exerciseId] || [])]
            exerciseLogs[setIndex] = { ...exerciseLogs[setIndex], [field]: value }
            return { ...prev, [exerciseId]: exerciseLogs }
        })
    }

    // Mark set as complete
    const completeSet = (exerciseId: string, setIndex: number) => {
        updateLog(exerciseId, setIndex, 'completed', true)

        // Check if all sets for this exercise are complete
        const currentLogs = logs[exerciseId]
        const allComplete = currentLogs.every((log, idx) => idx === setIndex ? true : log.completed)

        if (allComplete) {
            setCompletedExercises(prev => new Set(prev).add(exerciseId))
        }

        // Trigger Rest Timer
        const exercise = exercises.find(e => e.id === exerciseId)
        const restSeconds = exercise?.rest_seconds || 90
        setRestTarget(new Date(Date.now() + restSeconds * 1000))
    }

    const handleAddRestTime = (seconds: number) => {
        if (restTarget) {
            setRestTarget(new Date(restTarget.getTime() + seconds * 1000))
        }
    }

    const handleFinish = async () => {
        // Removed blocking confirm for smoother UX and testing
        // if (!confirm('Finish workout?')) return

        setIsSubmitting(true)
        const supabase = createClient() as unknown as SupabaseClient<Database>
        const endTime = new Date()
        const durationMins = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

        try {
            console.log('Inserting actual_session with:', {
                user_id: userId,
                planned_session_id: session.id,
                session_date: new Date().toISOString().split('T')[0],
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                domain: session.domain === 'cardio' ? 'running' : session.domain,
                session_name: session.session_type,
                duration_mins: durationMins,
            })

            // 1. Create actual session
            const { data: actSession, error: sessError } = await supabase
                .from('actual_sessions') // Ensure this table exists via migration!
                .insert({
                    user_id: userId,
                    planned_session_id: session.id,
                    session_date: new Date().toISOString().split('T')[0],
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    domain: session.domain === 'cardio' ? 'running' : session.domain,
                    session_name: session.session_type,
                    duration_mins: durationMins,
                    // status field does not exist on actual_sessions
                })
                .select()
                .single()

            if (sessError) {
                console.error('Supabase Session Insert Error:', sessError)
                throw sessError
            }
            console.log('Session inserted:', actSession)

            // 2. Create actual exercises (logs)
            const exerciseInserts = Object.entries(logs).map(([plannedExId, setLogs]) => {
                const plannedEx = exercises.find(e => e.id === plannedExId)
                return {
                    actual_session_id: actSession.id,
                    exercise_id: plannedEx?.exercise_id || 'unknown',
                    logs: setLogs // JSONB column
                }
            })

            console.log('Inserting exercises:', exerciseInserts)

            const { error: ExError } = await supabase
                .from('actual_session_exercises')
                .insert(exerciseInserts)

            if (ExError) {
                console.error('Supabase Exercise Insert Error:', ExError)
                throw ExError
            }

            console.log('Exercises inserted successfully')

            // 3. Update planned session status
            await supabase
                .from('planned_sessions')
                .update({ status: 'completed', actual_session_id: actSession.id })
                .eq('id', session.id)

            router.push('/today')
        } catch (error: any) {
            console.error('Error saving workout full:', error)
            alert(`Failed to save workout: ${error.message || JSON.stringify(error)}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!activeExercise) return <div>Loading...</div>

    return (
        <div className="flex flex-col h-screen bg-black pb-24">
            {/* Header */}
            <header className="p-4 border-b border-zinc-900 flex justify-between items-center bg-zinc-950">
                <button onClick={() => router.back()} className="text-zinc-400">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                    <h1 className="font-bold text-white">{session.session_type}</h1>
                    <p className="text-xs text-zinc-500">
                        {Object.keys(logs).filter(k => completedExercises.has(k)).length} / {exercises.length} Exercises
                    </p>
                </div>
                <button
                    onClick={handleFinish}
                    disabled={isSubmitting}
                    className="text-blue-500 font-medium disabled:opacity-50"
                >
                    Finish
                </button>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Exercise Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{exerciseDetails?.name || activeExercise.exercise_id}</h2>
                        <p className="text-zinc-400 text-sm">{activeExercise.target_muscle.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                        <div className="bg-zinc-900 px-3 py-1 rounded text-sm text-zinc-300">
                            Target RPE {activeExercise.target_rpe}
                        </div>
                        {history && history[activeExercise.exercise_id] && (
                            <div className="text-xs text-zinc-500 mt-1">
                                Last: {history[activeExercise.exercise_id].weight}kg x {history[activeExercise.exercise_id].reps}
                            </div>
                        )}
                    </div>
                </div>

                {/* Cues */}
                {exerciseDetails?.cues && (
                    <div className="text-xs text-zinc-500 bg-zinc-900/50 p-3 rounded">
                        {exerciseDetails.cues[0]}
                    </div>
                )}

                {/* Sets Logger */}
                <div className="space-y-3">
                    <div className="grid grid-cols-[40px_1fr_1fr_1fr_40px] gap-2 text-xs text-zinc-500 px-2 uppercase tracking-wider text-center">
                        <span>Set</span>
                        <span>kg</span>
                        <span>Reps</span>
                        <span>RIR</span>
                        <span></span>
                    </div>

                    {activeLogs.map((log, index) => (
                        <div
                            key={index}
                            className={cn(
                                "grid grid-cols-[40px_1fr_1fr_1fr_40px] gap-2 items-center bg-zinc-900 p-2 rounded-lg border transition-colors",
                                log.completed ? "border-green-500/30 bg-green-950/10" : "border-zinc-800"
                            )}
                        >
                            <div className="text-center text-zinc-400 font-medium">{index + 1}</div>

                            <input
                                type="number"
                                placeholder={activeExercise.suggested_weight_kg?.toString() || '-'}
                                className="bg-zinc-950 border border-zinc-800 rounded p-2 text-center text-white focus:border-blue-500 outline-none"
                                value={log.weight}
                                onChange={(e) => updateLog(activeExercise.id, index, 'weight', e.target.value)}
                                disabled={log.completed}
                            />

                            <input
                                type="number"
                                placeholder={`${activeExercise.rep_range_min}-${activeExercise.rep_range_max}`}
                                className="bg-zinc-950 border border-zinc-800 rounded p-2 text-center text-white focus:border-blue-500 outline-none"
                                value={log.reps}
                                onChange={(e) => updateLog(activeExercise.id, index, 'reps', e.target.value)}
                                disabled={log.completed}
                            />

                            <input
                                type="number"
                                placeholder={activeExercise.target_rir?.toString()}
                                className="bg-zinc-950 border border-zinc-800 rounded p-2 text-center text-white focus:border-blue-500 outline-none"
                                value={log.rir}
                                onChange={(e) => updateLog(activeExercise.id, index, 'rir', e.target.value)}
                                disabled={log.completed}
                            />

                            <button
                                onClick={() => completeSet(activeExercise.id, index)}
                                disabled={log.completed}
                                className={cn(
                                    "w-8 h-8 rounded flex items-center justify-center transition-colors",
                                    log.completed
                                        ? "bg-green-500 text-black"
                                        : "bg-zinc-800 text-zinc-400 hover:bg-green-500/50 hover:text-white"
                                )}
                            >
                                <Check className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 p-4">
                <div className="flex justify-between items-center gap-4">
                    <button
                        onClick={() => setActiveExerciseIndex(i => Math.max(0, i - 1))}
                        disabled={activeExerciseIndex === 0}
                        className="p-3 bg-zinc-900 rounded-lg disabled:opacity-50"
                    >
                        <ArrowLeft className="w-5 h-5 text-zinc-400" />
                    </button>

                    <div className="flex-1 overflow-x-auto flex gap-1 justify-center py-2">
                        {exercises.map((_, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "w-2 h-2 rounded-full",
                                    idx === activeExerciseIndex ? "bg-white" : "bg-zinc-800"
                                )}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => setActiveExerciseIndex(i => Math.min(exercises.length - 1, i + 1))}
                        disabled={activeExerciseIndex === exercises.length - 1}
                        className="p-3 bg-zinc-900 rounded-lg disabled:opacity-50"
                    >
                        <ChevronRight className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>
            </div>
            {/* Rest Timer Overlay */}
            {restTarget && (
                <RestTimer
                    targetDate={restTarget}
                    onDismiss={() => setRestTarget(null)}
                    onAddSeconds={handleAddRestTime}
                />
            )}
        </div>
    )
}
