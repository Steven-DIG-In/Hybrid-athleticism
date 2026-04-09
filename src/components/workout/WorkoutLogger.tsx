"use client"

import { useState, useTransition, useRef, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RIRSlider } from "@/components/ui/slider"
import {
    ArrowLeft, CheckCircle2, Loader2, ChevronLeft, ChevronRight,
    SkipForward, X, AlertTriangle, RefreshCw, Check, ChevronDown, Info
} from "lucide-react"
import { completeWorkout, swapExercise, getExerciseHistory } from "@/lib/actions/workout.actions"
import type { ConditioningResultInput } from "@/lib/actions/workout.actions"
import { updateExerciseSet, updateExerciseSetTargets, logCardioSession } from "@/lib/actions/logging.actions"
import { RestTimer, suggestRestSeconds } from "@/components/workout/RestTimer"
import { ExerciseHistoryPanel } from "@/components/workout/ExerciseHistoryPanel"
import { CoachNotesBanner } from "@/components/workout/CoachNotesBanner"
import type { WorkoutWithSets } from "@/lib/types/training.types"
import type { ExerciseSet } from "@/lib/types/database.types"
import { estimate1RM } from "@/lib/training/methodology-helpers"

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Find the first exercise index that has at least one incomplete set */
function findFirstIncompleteIdx(exerciseNames: string[], sets: ExerciseSet[]): number {
    const idx = exerciseNames.findIndex(name => {
        const exerciseSets = sets.filter(s => s.exercise_name === name)
        return exerciseSets.some(s => s.actual_reps === null)
    })
    return idx >= 0 ? idx : 0
}

/** Count total completed sets across all exercises */
function countCompletedSets(sets: ExerciseSet[]): number {
    return sets.filter(s => s.actual_reps !== null).length
}

/** Extract tempo notation from exercise notes (e.g., "3-0-1-0 tempo") */
function extractTempo(notes: string | null): string | null {
    if (!notes) return null
    const match = notes.match(/(\d+-\d+-\d+-\d+)\s*tempo/i)
    return match ? match[1] : null
}

/** Check if an exercise is likely bodyweight-based */
const BW_EXERCISES = new Set([
    'pull-up', 'pull-ups', 'pullup', 'pullups', 'chin-up', 'chin-ups', 'chinup', 'chinups',
    'push-up', 'push-ups', 'pushup', 'pushups',
    'dip', 'dips', 'bar dip', 'bar dips', 'ring dip', 'ring dips',
    'muscle-up', 'muscle-ups', 'muscleup', 'muscleups',
    'inverted row', 'inverted rows', 'body row', 'body rows',
    'pistol squat', 'pistol squats',
])

function isBodyweightExercise(name: string | undefined): boolean {
    if (!name) return false
    return BW_EXERCISES.has(name.toLowerCase().trim())
}

/** Check if actual performance diverges significantly from targets */
function detectPerformanceDivergence(sets: ExerciseSet[]): {
    hasDivergence: boolean
    avgTargetWeight: number
    avgActualWeight: number
    percentDiff: number
} {
    const completedSets = sets.filter(
        s => s.actual_weight_kg != null && s.target_weight_kg != null && s.target_weight_kg > 0
    )
    if (completedSets.length < 2) return { hasDivergence: false, avgTargetWeight: 0, avgActualWeight: 0, percentDiff: 0 }

    const avgTarget = completedSets.reduce((sum, s) => sum + (s.target_weight_kg ?? 0), 0) / completedSets.length
    const avgActual = completedSets.reduce((sum, s) => sum + (s.actual_weight_kg ?? 0), 0) / completedSets.length
    const percentDiff = ((avgActual - avgTarget) / avgTarget) * 100

    return {
        hasDivergence: percentDiff < -20, // More than 20% below targets
        avgTargetWeight: Math.round(avgTarget * 10) / 10,
        avgActualWeight: Math.round(avgActual * 10) / 10,
        percentDiff: Math.round(percentDiff),
    }
}

// ─── Conditioning Format Detection ──────────────────────────────────────────

type ConditioningFormat = 'amrap' | 'emom' | 'for_time' | 'intervals' | 'circuit' | 'chipper' | 'metcon'

function detectFormat(meta: string | null): ConditioningFormat {
    if (!meta) return 'metcon'
    const firstWord = meta.split(' · ')[0]?.trim().toLowerCase() ?? ''
    const formats: Record<string, ConditioningFormat> = {
        amrap: 'amrap', emom: 'emom', for_time: 'for_time',
        'for time': 'for_time', intervals: 'intervals', interval: 'intervals',
        circuit: 'circuit', chipper: 'chipper', metcon: 'metcon',
    }
    return formats[firstWord] ?? 'metcon'
}

const FORMAT_LABELS: Record<ConditioningFormat, string> = {
    amrap: 'AMRAP', emom: 'EMOM', for_time: 'For Time',
    intervals: 'Intervals', circuit: 'Circuit', chipper: 'Chipper', metcon: 'MetCon',
}

// ─── RPE Selector ───────────────────────────────────────────────────────────

function RPESelector({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
    const options = [5, 6, 7, 8, 9, 10]

    const getColor = (val: number) => {
        if (val >= 10) return "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] border-red-400"
        if (val >= 9) return "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)] border-orange-400"
        if (val >= 8) return "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)] border-yellow-400"
        if (val >= 7) return "bg-emerald-500 border-emerald-400"
        if (val >= 6) return "bg-cyan-500 border-cyan-400"
        return "bg-blue-500 border-blue-400"
    }

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">RPE</span>
                <span className="text-sm font-space-grotesk font-bold text-white">{value}/10</span>
            </div>
            <div className="relative flex items-center h-12 bg-[#0c0c0c] border border-[#222222] px-2">
                <div className="absolute left-4 right-4 h-1 bg-[#1a1a1a] top-1/2 -translate-y-1/2 z-0" />
                <div className="relative z-10 w-full flex justify-between items-center">
                    {options.map((option) => {
                        const isSelected = value === option
                        return (
                            <button
                                key={option}
                                type="button"
                                disabled={disabled}
                                onClick={() => onChange(option)}
                                className={`w-10 h-8 border transition-all duration-300 flex items-center justify-center font-mono text-sm ${
                                    isSelected
                                        ? `${getColor(option)} text-black font-bold scale-110`
                                        : "bg-[#111111] border-[#333333] text-neutral-500 hover:border-white/20"
                                } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
                            >
                                {option}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ─── Conditioning Logger Sub-Component ──────────────────────────────────────

function ConditioningLogger({
    workout,
    parsedNotes,
    error,
    setError,
    isPending,
    startTransition,
    startTimeRef,
}: {
    workout: WorkoutWithSets
    parsedNotes: { workout: string | null; meta: string | null; coaching: string | null }
    error: string | null
    setError: (e: string | null) => void
    isPending: boolean
    startTransition: (fn: () => Promise<void>) => void
    startTimeRef: React.RefObject<number>
}) {
    const router = useRouter()

    // Detect workout format from meta line
    const format = useMemo(() => detectFormat(parsedNotes.meta), [parsedNotes.meta])
    const isMetcon = workout.modality === 'METCON'
    const isEndurance = workout.modality === 'CARDIO'
    const shouldShowStructuredWorkout = isMetcon || isEndurance

    // Result state
    const [isRx, setIsRx] = useState(true)
    const [rpe, setRpe] = useState(7)
    const [modifications, setModifications] = useState("")
    const [athleteNotes, setAthleteNotes] = useState("")

    // Format-specific result state
    const [timeMinutes, setTimeMinutes] = useState("")
    const [timeSeconds, setTimeSeconds] = useState("")
    const [rounds, setRounds] = useState("")
    const [partialReps, setPartialReps] = useState("")
    const [completed, setCompleted] = useState(true)

    // Endurance-specific result state (Issue #7)
    const [distanceKm, setDistanceKm] = useState("")
    const [avgHeartRate, setAvgHeartRate] = useState("")

    const handleComplete = useCallback(() => {
        startTransition(async () => {
            try {
                const durationMinutes = Math.round((Date.now() - startTimeRef.current) / 60000)

                // Handle endurance session logging (Issue #7)
                if (isEndurance) {
                    const dist = parseFloat(distanceKm)
                    const mins = parseInt(timeMinutes) || 0
                    const secs = parseInt(timeSeconds) || 0
                    const totalMinutes = mins + secs / 60

                    // Calculate pace if both distance and time provided
                    let avgPaceSecPerKm: number | undefined
                    if (dist > 0 && totalMinutes > 0) {
                        const paceMinPerKm = totalMinutes / dist
                        avgPaceSecPerKm = Math.round(paceMinPerKm * 60)
                    }

                    // Log cardio session
                    await logCardioSession({
                        workoutId: workout.id,
                        durationMinutes: Math.max(durationMinutes, 1),
                        distanceKm: dist > 0 ? dist : undefined,
                        avgPaceSecPerKm,
                        avgHeartRateBpm: avgHeartRate ? parseInt(avgHeartRate) : undefined,
                        perceivedEffortRpe: rpe,
                        cardioType: 'ZONE_2', // Default, could be inferred from parsedNotes.meta
                    })
                }

                // Build conditioning result (only for METCON sessions)
                let conditioningResult: ConditioningResultInput | undefined
                if (isMetcon) {
                    conditioningResult = {
                        workoutFormat: format,
                        isRx,
                        perceivedEffortRpe: rpe,
                        modifications: !isRx && modifications.trim() ? modifications.trim() : undefined,
                        athleteNotes: athleteNotes.trim() || undefined,
                    }

                    // Format-specific result data
                    if (format === 'for_time' || format === 'chipper') {
                        const mins = parseInt(timeMinutes) || 0
                        const secs = parseInt(timeSeconds) || 0
                        if (mins > 0 || secs > 0) {
                            conditioningResult.resultTimeSeconds = mins * 60 + secs
                        }
                    } else if (format === 'amrap') {
                        const r = parseInt(rounds)
                        if (!isNaN(r)) conditioningResult.resultRounds = r
                        const pr = parseInt(partialReps)
                        if (!isNaN(pr)) conditioningResult.resultPartialReps = pr
                    } else if (format === 'emom' || format === 'circuit' || format === 'intervals') {
                        conditioningResult.resultCompleted = completed
                    }
                }

                const res = await completeWorkout(
                    workout.id,
                    Math.max(durationMinutes, 1),
                    conditioningResult
                )
                if (res.success) {
                    router.push('/dashboard')
                } else {
                    setError(res.error ?? "Failed to complete workout.")
                }
            } catch (err) {
                console.error("[handleComplete]", err)
                setError("Network error completing workout. Try again.")
            }
        })
    }, [workout.id, router, startTransition, isMetcon, isEndurance, format, isRx, rpe, modifications,
        athleteNotes, timeMinutes, timeSeconds, rounds, partialReps, completed, distanceKm, avgHeartRate,
        setError, startTimeRef])

    return (
        <div className="min-h-screen bg-[#000000] text-white flex flex-col pt-12">
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050505] border-b border-[#222222] p-4 flex justify-between items-center">
                <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => router.push('/dashboard')}>
                    <ArrowLeft className="w-5 h-5 text-neutral-400" />
                </Button>
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">
                    {workout.modality} SESSION
                </span>
                <div className="w-8" />
            </nav>

            <div className="p-6 flex-1 overflow-y-auto pb-32">
                <h1 className="text-2xl font-space-grotesk font-bold mb-1">
                    {workout.name || workout.modality}
                </h1>

                {parsedNotes.meta && (
                    <p className="text-xs font-mono text-cyan-400/80 mt-1">{parsedNotes.meta}</p>
                )}

                {/* For ENDURANCE: Show coach notes FIRST (contains essential workout details) */}
                {isEndurance && parsedNotes.coaching && (
                    <div className="mt-5 p-5 bg-cyan-950/30 border border-cyan-500/30 rounded">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 mb-3">📍 Workout Details</p>
                        <p className="text-base font-inter text-white leading-relaxed whitespace-pre-wrap">{parsedNotes.coaching}</p>
                    </div>
                )}

                {/* The actual workout — movements, reps, format */}
                {parsedNotes.workout ? (
                    <div className="mt-5 p-5 bg-[#0a0a0a] border border-cyan-500/20 rounded">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 mb-3">The Workout</p>
                        <p className="text-base font-inter text-white leading-relaxed whitespace-pre-wrap">{parsedNotes.workout}</p>
                    </div>
                ) : workout.coach_notes && !isEndurance ? (
                    <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#222] rounded whitespace-pre-wrap">
                        <p className="text-sm font-inter text-neutral-300 leading-relaxed">{workout.coach_notes}</p>
                    </div>
                ) : null}

                {/* Coach tips for METCON (shown after workout description) */}
                {!isEndurance && parsedNotes.coaching && (
                    <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Coach Notes</p>
                        <p className="text-sm font-inter text-neutral-400 leading-relaxed whitespace-pre-wrap">{parsedNotes.coaching}</p>
                    </div>
                )}

                {!workout.coach_notes && (
                    <div className="mt-4 p-4 bg-amber-950/20 border border-amber-500/30 rounded">
                        <p className="text-sm font-inter text-amber-300 leading-relaxed">
                            {isEndurance
                                ? "⚠️ No workout details provided. This should include distance, duration, and target pace. Please check with your coach or log the session as performed."
                                : "No workout details available. Complete when done."
                            }
                        </p>
                    </div>
                )}

                {/* ═══ LOG YOUR RESULT ═══ (METCON only) */}
                {isMetcon && (
                    <div className="mt-8 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-[#222]" />
                            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">
                                Log Your Result
                            </span>
                            <div className="h-px flex-1 bg-[#222]" />
                        </div>

                        {/* Format-specific result input */}
                        {(format === 'for_time' || format === 'chipper') && (
                            <div className="border border-[#222] bg-[#0a0a0a] p-4">
                                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">
                                    Completion Time
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 relative">
                                        <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">MIN</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            placeholder="0"
                                            value={timeMinutes}
                                            onChange={(e) => setTimeMinutes(e.target.value)}
                                            className="w-full bg-[#111] border border-[#2a2a2a] h-14 text-center text-2xl font-space-grotesk focus:border-cyan-500 focus:outline-none"
                                            disabled={isPending}
                                        />
                                    </div>
                                    <span className="text-2xl font-space-grotesk text-neutral-500">:</span>
                                    <div className="flex-1 relative">
                                        <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">SEC</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            placeholder="00"
                                            value={timeSeconds}
                                            onChange={(e) => setTimeSeconds(e.target.value)}
                                            className="w-full bg-[#111] border border-[#2a2a2a] h-14 text-center text-2xl font-space-grotesk focus:border-cyan-500 focus:outline-none"
                                            disabled={isPending}
                                            max={59}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {format === 'amrap' && (
                            <div className="border border-[#222] bg-[#0a0a0a] p-4">
                                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">
                                    Rounds Completed
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 relative">
                                        <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">ROUNDS</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            placeholder="0"
                                            value={rounds}
                                            onChange={(e) => setRounds(e.target.value)}
                                            className="w-full bg-[#111] border border-[#2a2a2a] h-14 text-center text-2xl font-space-grotesk focus:border-cyan-500 focus:outline-none"
                                            disabled={isPending}
                                        />
                                    </div>
                                    <span className="text-lg font-space-grotesk text-neutral-500">+</span>
                                    <div className="flex-1 relative">
                                        <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">REPS</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            placeholder="0"
                                            value={partialReps}
                                            onChange={(e) => setPartialReps(e.target.value)}
                                            className="w-full bg-[#111] border border-[#2a2a2a] h-14 text-center text-2xl font-space-grotesk focus:border-cyan-500 focus:outline-none"
                                            disabled={isPending}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {(format === 'emom' || format === 'circuit' || format === 'intervals') && (
                            <div className="border border-[#222] bg-[#0a0a0a] p-4">
                                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">
                                    Completed All Work?
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setCompleted(true)}
                                        disabled={isPending}
                                        className={`flex-1 h-12 font-space-grotesk font-bold text-sm border transition-all ${
                                            completed
                                                ? 'bg-emerald-600 border-emerald-500 text-black'
                                                : 'bg-[#111] border-[#333] text-neutral-500 hover:border-neutral-400'
                                        }`}
                                    >
                                        Yes
                                    </button>
                                    <button
                                        onClick={() => setCompleted(false)}
                                        disabled={isPending}
                                        className={`flex-1 h-12 font-space-grotesk font-bold text-sm border transition-all ${
                                            !completed
                                                ? 'bg-amber-600 border-amber-500 text-black'
                                                : 'bg-[#111] border-[#333] text-neutral-500 hover:border-neutral-400'
                                        }`}
                                    >
                                        Partial
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Rx / Scaled toggle */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsRx(true)}
                                disabled={isPending}
                                className={`flex-1 h-12 font-space-grotesk font-bold text-sm border transition-all ${
                                    isRx
                                        ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_15px_rgba(13,185,242,0.3)]'
                                        : 'bg-[#111] border-[#333] text-neutral-500 hover:border-neutral-400'
                                }`}
                            >
                                Rx
                            </button>
                            <button
                                onClick={() => setIsRx(false)}
                                disabled={isPending}
                                className={`flex-1 h-12 font-space-grotesk font-bold text-sm border transition-all ${
                                    !isRx
                                        ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                        : 'bg-[#111] border-[#333] text-neutral-500 hover:border-neutral-400'
                                }`}
                            >
                                Scaled
                            </button>
                        </div>

                        {/* Modifications input (shown when Scaled) */}
                        {!isRx && (
                            <div>
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 block mb-2">
                                    What did you modify?
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., Ring rows instead of pull-ups, 30kg thrusters"
                                    value={modifications}
                                    onChange={(e) => setModifications(e.target.value)}
                                    className="w-full bg-[#111] border border-[#2a2a2a] px-3 h-11 text-sm font-inter text-white placeholder:text-neutral-600 focus:border-amber-500/50 focus:outline-none"
                                    disabled={isPending}
                                />
                            </div>
                        )}

                        {/* RPE Selector */}
                        <RPESelector value={rpe} onChange={setRpe} disabled={isPending} />

                        {/* Notes */}
                        <div>
                            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 block mb-2">
                                Notes
                            </label>
                            <input
                                type="text"
                                placeholder="How did it feel? Anything to note?"
                                value={athleteNotes}
                                onChange={(e) => setAthleteNotes(e.target.value)}
                                className="w-full bg-[#111] border border-[#2a2a2a] px-3 h-11 text-sm font-inter text-white placeholder:text-neutral-600 focus:border-cyan-500/50 focus:outline-none"
                                disabled={isPending}
                            />
                        </div>
                    </div>
                )}

                {/* ═══ LOG YOUR ENDURANCE RESULT ═══ (CARDIO only) - Issue #7 */}
                {isEndurance && (
                    <div className="mt-8 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-[#222]" />
                            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">
                                Log Your Session
                            </span>
                            <div className="h-px flex-1 bg-[#222]" />
                        </div>

                        {/* Distance & Time Input */}
                        <div className="border border-[#222] bg-[#0a0a0a] p-4 space-y-4">
                            <div>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">
                                    Distance & Time
                                </p>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className="relative">
                                        <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">KM</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.1"
                                            placeholder="0.0"
                                            value={distanceKm}
                                            onChange={(e) => setDistanceKm(e.target.value)}
                                            className="w-full bg-[#111] border border-[#2a2a2a] h-14 text-center text-2xl font-space-grotesk focus:border-cyan-500 focus:outline-none"
                                            disabled={isPending}
                                        />
                                    </div>
                                    <div className="relative">
                                        <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">AVG HR</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            placeholder="Optional"
                                            value={avgHeartRate}
                                            onChange={(e) => setAvgHeartRate(e.target.value)}
                                            className="w-full bg-[#111] border border-[#2a2a2a] h-14 text-center text-2xl font-space-grotesk focus:border-cyan-500 focus:outline-none"
                                            disabled={isPending}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 relative">
                                        <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">MIN</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            placeholder="0"
                                            value={timeMinutes}
                                            onChange={(e) => setTimeMinutes(e.target.value)}
                                            className="w-full bg-[#111] border border-[#2a2a2a] h-14 text-center text-2xl font-space-grotesk focus:border-cyan-500 focus:outline-none"
                                            disabled={isPending}
                                        />
                                    </div>
                                    <span className="text-2xl font-space-grotesk text-neutral-500">:</span>
                                    <div className="flex-1 relative">
                                        <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">SEC</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            placeholder="00"
                                            value={timeSeconds}
                                            onChange={(e) => setTimeSeconds(e.target.value)}
                                            className="w-full bg-[#111] border border-[#2a2a2a] h-14 text-center text-2xl font-space-grotesk focus:border-cyan-500 focus:outline-none"
                                            disabled={isPending}
                                            max={59}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Auto-calculated pace */}
                            {distanceKm && (timeMinutes || timeSeconds) && (() => {
                                const dist = parseFloat(distanceKm)
                                const totalMinutes = (parseInt(timeMinutes) || 0) + (parseInt(timeSeconds) || 0) / 60
                                if (dist > 0 && totalMinutes > 0) {
                                    const paceMinPerKm = totalMinutes / dist
                                    const paceMin = Math.floor(paceMinPerKm)
                                    const paceSec = Math.round((paceMinPerKm - paceMin) * 60)
                                    return (
                                        <div className="mt-3 p-3 bg-cyan-950/20 border border-cyan-900/30 rounded text-center">
                                            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block mb-1">
                                                Average Pace
                                            </span>
                                            <span className="text-xl font-space-grotesk font-bold text-cyan-300">
                                                {paceMin}:{paceSec.toString().padStart(2, '0')} /km
                                            </span>
                                        </div>
                                    )
                                }
                                return null
                            })()}
                        </div>

                        {/* RPE Selector */}
                        <RPESelector value={rpe} onChange={setRpe} disabled={isPending} />

                        {/* Notes */}
                        <div>
                            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 block mb-2">
                                Session Notes
                            </label>
                            <input
                                type="text"
                                placeholder="How did it feel? Any observations?"
                                value={athleteNotes}
                                onChange={(e) => setAthleteNotes(e.target.value)}
                                className="w-full bg-[#111] border border-[#2a2a2a] px-3 h-11 text-sm font-inter text-white placeholder:text-neutral-600 focus:border-cyan-500/50 focus:outline-none"
                                disabled={isPending}
                            />
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="fixed bottom-20 left-4 right-4 z-40">
                    <div className="bg-red-950/90 border border-red-500/50 p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-mono text-red-300 flex-1">{error}</span>
                    </div>
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent pb-safe-area">
                <Button
                    onClick={handleComplete}
                    disabled={isPending}
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-black font-space-grotesk font-bold text-lg"
                >
                    {isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isMetcon ? (
                        `Complete ${FORMAT_LABELS[format]}`
                    ) : (
                        'Complete Workout'
                    )}
                </Button>
            </div>
        </div>
    )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WorkoutLogger({
    workout,
    displayWeightsAsPercentages = false
}: {
    workout: WorkoutWithSets
    displayWeightsAsPercentages?: boolean
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Track workout start time for actual duration
    const startTimeRef = useRef(Date.now())

    // Error state
    const [error, setError] = useState<string | null>(null)

    // Pre-workout equipment check phase (Issue #27)
    // Skip equipment check if workout is already in progress (has completed sets)
    const hasCompletedSets = workout.exercise_sets.some(s => s.actual_reps !== null)
    const [phase, setPhase] = useState<'equipment-check' | 'logging'>(hasCompletedSets ? 'logging' : 'equipment-check')
    const [swapTarget, setSwapTarget] = useState<{ exerciseName: string; replacement: string } | null>(null)

    // Pre-flight: expanded exercise for target editing (#8, #18)
    const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
    const [targetEdits, setTargetEdits] = useState<Record<string, { weight: string; reps: string }>>({})
    const [workingMaxEdits, setWorkingMaxEdits] = useState<Record<string, string>>({})

    // Group sets by exercise name to create the pagination flow
    const exerciseNames = Array.from(new Set(workout.exercise_sets.map(s => s.exercise_name)))

    // Resume from first incomplete exercise (Issue #16)
    const [activeExerciseIdx, setActiveExerciseIdx] = useState(() =>
        findFirstIncompleteIdx(exerciseNames, workout.exercise_sets)
    )

    const currentExerciseName = exerciseNames[activeExerciseIdx]

    // Local state to track input values before they are saved to the DB
    const [localSets, setLocalSets] = useState<Record<string, { weight: string, reps: string, rir: number }>>(() => {
        const initial: Record<string, { weight: string, reps: string, rir: number }> = {}
        workout.exercise_sets.forEach(s => {
            initial[s.id] = {
                weight: s.actual_weight_kg?.toString() || s.target_weight_kg?.toString() || "",
                reps: s.actual_reps?.toString() || s.target_reps?.toString() || "",
                rir: s.rir_actual ?? s.target_rir ?? 2
            }
        })
        return initial
    })

    // Skipped sets tracking (local only — skipped sets are not saved)
    const [skippedSets, setSkippedSets] = useState<Set<string>>(new Set())

    // End workout confirmation
    const [showEndConfirm, setShowEndConfirm] = useState(false)

    // Performance divergence check-in (#9)
    const [divergenceNote, setDivergenceNote] = useState<string | null>(null)

    // Rest timer state (Issue #13)
    const [restTimerSeconds, setRestTimerSeconds] = useState<number | null>(null)

    // Exercise history state (Issue #4)
    const [exerciseHistory, setExerciseHistory] = useState<Record<string, any[]>>({})
    const [loadingHistory, setLoadingHistory] = useState(false)

    // Coach notes completion tracking (Issue #2)
    const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())
    const [activeCoachNote, setActiveCoachNote] = useState<string | null>(null)

    const activeSets = workout.exercise_sets.filter(s => s.exercise_name === currentExerciseName)
    const currentExerciseData = activeSets[0]
    const currentTempo = extractTempo(currentExerciseData?.notes ?? null)
    const isBW = isBodyweightExercise(currentExerciseName)

    const completedTotal = countCompletedSets(workout.exercise_sets)
    const totalSets = workout.exercise_sets.length
    const divergence = detectPerformanceDivergence(workout.exercise_sets)

    // Working max calculation for percentage display (Issue #3)
    const workingMaxData = useMemo(() => {
        if (!displayWeightsAsPercentages || isBW) return null

        const weights = activeSets
            .map(s => s.target_weight_kg)
            .filter((w): w is number => w !== null && w > 0)

        if (weights.length === 0) return null

        const workingMax = Math.max(...weights)
        // Estimate 1RM from working max (assume it's around 3-5 reps range, use 4 as middle)
        const estimated1RM = estimate1RM(workingMax, 4)

        return { workingMax, estimated1RM }
    }, [displayWeightsAsPercentages, activeSets, isBW])

    // Clear error after 5 seconds
    useEffect(() => {
        if (!error) return
        const t = setTimeout(() => setError(null), 5000)
        return () => clearTimeout(t)
    }, [error])

    // Fetch exercise history when exercise changes (Issue #4)
    useEffect(() => {
        if (!currentExerciseName || exerciseHistory[currentExerciseName]) return

        setLoadingHistory(true)
        getExerciseHistory(currentExerciseName, 3).then(result => {
            if (result.success && result.data) {
                setExerciseHistory(prev => ({
                    ...prev,
                    [currentExerciseName]: result.data
                }))
            }
            setLoadingHistory(false)
        })
    }, [currentExerciseName, exerciseHistory])

    // ─── Set Completion with Error Handling (Issue #15) ──────────────────────

    const handleCompleteSet = useCallback(async (setId: string, isAlreadyCompleted: boolean) => {
        const values = localSets[setId]
        if (!values) {
            setError("Set data not found. Try refreshing.")
            return
        }

        // Validation: require weight and reps to be filled in
        if (!isAlreadyCompleted) {
            const weight = parseFloat(values.weight)
            const reps = parseInt(values.reps)
            if (isNaN(weight) || weight < 0) {
                setError("Enter a valid weight before completing the set.")
                return
            }
            if (isNaN(reps) || reps <= 0) {
                setError("Enter valid reps before completing the set.")
                return
            }
        }

        startTransition(async () => {
            try {
                let result
                if (isAlreadyCompleted) {
                    // Uncomplete: set to null to mark as incomplete (not 0)
                    result = await updateExerciseSet(setId, {
                        actualReps: null,
                        actualWeightKg: null,
                        rirActual: null
                    })
                } else {
                    result = await updateExerciseSet(setId, {
                        actualReps: parseInt(values.reps) || 0,
                        actualWeightKg: parseFloat(values.weight) || 0,
                        rirActual: values.rir
                    })
                }

                if (!result.success) {
                    setError(result.error ?? "Failed to save set. Tap the check to retry.")
                    return
                }

                // Remove from skipped if it was skipped before
                setSkippedSets(prev => {
                    const next = new Set(prev)
                    next.delete(setId)
                    return next
                })

                // Auto-suggest & rest timer after completing (not un-completing) a set
                if (!isAlreadyCompleted) {
                    const set = workout.exercise_sets.find(s => s.id === setId)
                    if (set) {
                        // Show rest timer
                        setRestTimerSeconds(suggestRestSeconds(set.target_reps, set.target_rir))

                        // Auto-suggest next set weight based on RIR feedback (Issue #11)
                        const sameSets = workout.exercise_sets
                            .filter(s => s.exercise_name === set.exercise_name)
                            .sort((a, b) => a.set_number - b.set_number)
                        const nextSet = sameSets.find(s =>
                            s.set_number > set.set_number && s.actual_reps === null
                        )
                        if (nextSet) {
                            const actualWeight = parseFloat(values.weight) || 0
                            const actualRir = values.rir
                            const targetRir = set.target_rir ?? 2
                            const rirDiff = actualRir - targetRir

                            // Adjust weight: +2.5kg per RIR above target, -2.5kg per RIR below
                            let suggestedWeight = actualWeight
                            if (rirDiff >= 2) suggestedWeight += 5
                            else if (rirDiff >= 1) suggestedWeight += 2.5
                            else if (rirDiff <= -2) suggestedWeight -= 5
                            else if (rirDiff <= -1) suggestedWeight -= 2.5

                            suggestedWeight = Math.max(0, suggestedWeight)

                            setLocalSets(prev => ({
                                ...prev,
                                [nextSet.id]: {
                                    ...prev[nextSet.id],
                                    weight: suggestedWeight.toString(),
                                    reps: prev[nextSet.id]?.reps ?? values.reps,
                                }
                            }))
                        }

                        // Check if all sets for this exercise are now complete (Issue #2)
                        const allSetsForExercise = workout.exercise_sets.filter(s => s.exercise_name === set.exercise_name)
                        const allComplete = allSetsForExercise.every(s =>
                            s.id === setId || s.actual_reps !== null
                        )

                        if (allComplete && !completedExercises.has(set.exercise_name)) {
                            // Mark exercise as completed
                            setCompletedExercises(prev => new Set(prev).add(set.exercise_name))
                        }
                    }
                }

                router.refresh()
            } catch (err) {
                console.error("[handleCompleteSet]", err)
                setError("Network error — your set was NOT saved. Try again.")
            }
        })
    }, [localSets, router, startTransition])

    // ─── Skip Set (Issue #26) ───────────────────────────────────────────────

    const handleSkipSet = useCallback((setId: string) => {
        setSkippedSets(prev => new Set(prev).add(setId))
    }, [])

    // ─── Navigation (Issue #23 — go back, Issue #26 — skip movement) ────────

    const goToExercise = useCallback((idx: number) => {
        if (idx >= 0 && idx < exerciseNames.length) {
            setActiveExerciseIdx(idx)
            setError(null)
        }
    }, [exerciseNames.length])

    const handlePrevious = useCallback(() => {
        goToExercise(activeExerciseIdx - 1)
    }, [activeExerciseIdx, goToExercise])

    const handleNext = useCallback(() => {
        goToExercise(activeExerciseIdx + 1)
    }, [activeExerciseIdx, goToExercise])

    // ─── Equipment Swap (Issue #27) ───────────────────────────────────────────

    const handleSwapExercise = useCallback(() => {
        if (!swapTarget || !swapTarget.replacement.trim()) return
        startTransition(async () => {
            try {
                const result = await swapExercise(
                    workout.id,
                    swapTarget.exerciseName,
                    swapTarget.replacement.trim()
                )
                if (!result.success) {
                    setError(result.error ?? "Failed to swap exercise.")
                    return
                }
                setSwapTarget(null)
                router.refresh()
            } catch (err) {
                console.error("[handleSwapExercise]", err)
                setError("Network error swapping exercise. Try again.")
            }
        })
    }, [swapTarget, workout.id, router, startTransition])

    // ─── Save Adjusted Targets (#8, #18) ──────────────────────────────────────

    const handleSaveTargets = useCallback(async (exerciseName: string) => {
        const sets = workout.exercise_sets.filter(s => s.exercise_name === exerciseName)
        const edits = sets
            .filter(s => targetEdits[s.id])
            .map(s => ({ setId: s.id, ...targetEdits[s.id] }))

        if (edits.length === 0) {
            setExpandedExercise(null)
            return
        }

        startTransition(async () => {
            try {
                for (const edit of edits) {
                    const targets: { targetWeightKg?: number; targetReps?: number } = {}
                    const w = parseFloat(edit.weight)
                    const r = parseInt(edit.reps)
                    if (!isNaN(w) && w >= 0) targets.targetWeightKg = w
                    if (!isNaN(r) && r > 0) targets.targetReps = r

                    if (Object.keys(targets).length > 0) {
                        const result = await updateExerciseSetTargets(edit.setId, targets)
                        if (!result.success) {
                            setError(result.error ?? "Failed to save targets.")
                            return
                        }
                    }
                }
                setExpandedExercise(null)
                setTargetEdits({})
                router.refresh()
            } catch (err) {
                console.error("[handleSaveTargets]", err)
                setError("Network error saving targets. Try again.")
            }
        })
    }, [workout.exercise_sets, targetEdits, router, startTransition])

    // ─── End Workout (Issue #26 — end early or complete) ────────────────────

    const handleEndWorkout = useCallback(() => {
        startTransition(async () => {
            try {
                const durationMinutes = Math.round((Date.now() - startTimeRef.current) / 60000)
                const res = await completeWorkout(workout.id, Math.max(durationMinutes, 1))
                if (res.success) {
                    router.push('/dashboard')
                } else {
                    setError(res.error ?? "Failed to complete workout.")
                }
            } catch (err) {
                console.error("[handleEndWorkout]", err)
                setError("Network error completing workout. Try again.")
            }
        })
    }, [workout.id, router, startTransition])

    const handleNextOrComplete = useCallback(() => {
        if (activeExerciseIdx < exerciseNames.length - 1) {
            handleNext()
        } else {
            setShowEndConfirm(true)
        }
    }, [activeExerciseIdx, exerciseNames.length, handleNext])

    // ─── Render ─────────────────────────────────────────────────────────────

    // ─── Parse structured coach_notes for conditioning/mobility sessions ──────
    // buildCoachNotes() stores: "WORKOUT:\n{description}\n\n{meta}\n\n{coachNotes}"

    const parsedNotes = useMemo(() => {
        const notes = workout.coach_notes
        if (!notes) return { workout: null, meta: null, coaching: null }

        const sections = notes.split('\n\n')
        let workoutDesc: string | null = null
        let meta: string | null = null
        const coachingParts: string[] = []

        for (const section of sections) {
            if (section.startsWith('WORKOUT:\n') || section.startsWith('WORKOUT:')) {
                workoutDesc = section.replace(/^WORKOUT:\n?/, '')
            } else if (section.startsWith('SESSION:\n') || section.startsWith('SESSION:')) {
                workoutDesc = section.replace(/^SESSION:\n?/, '')
            } else if (section.startsWith('Focus:') || /^[A-Z_]+\s·/.test(section)) {
                meta = section
            } else if (section.trim()) {
                coachingParts.push(section.trim())
            }
        }

        return {
            workout: workoutDesc,
            meta,
            coaching: coachingParts.length > 0 ? coachingParts.join('\n\n') : null,
        }
    }, [workout.coach_notes])

    // ─── Conditioning / Cardio / Mobility Workout (no exercise_sets) ──────────

    if (workout.exercise_sets.length === 0) {
        return (
            <ConditioningLogger
                workout={workout}
                parsedNotes={parsedNotes}
                error={error}
                setError={setError}
                isPending={isPending}
                startTransition={startTransition}
                startTimeRef={startTimeRef}
            />
        )
    }

    const isFirstExercise = activeExerciseIdx === 0
    const isLastExercise = activeExerciseIdx === exerciseNames.length - 1

    // ─── Equipment Check Phase ────────────────────────────────────────────────

    if (phase === 'equipment-check') {
        return (
            <div className="min-h-screen bg-[#000000] text-white flex flex-col">
                <nav className="bg-[#050505] border-b border-[#222222] p-4 flex justify-between items-center">
                    <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="w-5 h-5 text-neutral-400" />
                    </Button>
                    <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">
                        Pre-Flight Check
                    </span>
                    <div className="w-8" />
                </nav>

                {error && (
                    <div className="mx-4 mt-4">
                        <div className="bg-red-950/90 border border-red-500/50 p-3 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <span className="text-xs font-mono text-red-300 flex-1">{error}</span>
                            <button onClick={() => setError(null)} className="text-red-400">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-6 flex-1 overflow-y-auto">
                    <h1 className="text-2xl font-space-grotesk font-bold mb-1">
                        {workout.name || workout.modality}
                    </h1>
                    <p className="text-sm text-neutral-500 font-inter mb-2">
                        Review exercises. Tap to adjust AI estimates or swap equipment.
                    </p>

                    {/* Coach notes for the workout */}
                    {workout.coach_notes && (
                        <div className="flex items-start gap-2 mb-5 p-3 bg-cyan-950/30 border border-cyan-500/20">
                            <Info className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                            <span className="text-xs font-inter text-cyan-300/80">{workout.coach_notes}</span>
                        </div>
                    )}

                    <div className="space-y-3">
                        {exerciseNames.map((name, idx) => {
                            const sets = workout.exercise_sets.filter(s => s.exercise_name === name)
                            const firstSet = sets[0]
                            const isSwapping = swapTarget?.exerciseName === name
                            const isExpanded = expandedExercise === name
                            const exerciseNotes = firstSet?.notes

                            return (
                                <div key={name} className="border border-[#222222] bg-[#0a0a0a] p-4">
                                    {/* Exercise header — tap to expand */}
                                    <button
                                        className="w-full text-left flex items-center justify-between"
                                        onClick={() => setExpandedExercise(isExpanded ? null : name)}
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-neutral-500">{idx + 1}.</span>
                                                <span className="font-space-grotesk font-semibold">{name}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-neutral-600 ml-5">
                                                {sets.length} sets × {firstSet?.target_reps ?? "?"} reps
                                                {firstSet?.target_weight_kg ? ` @ ${firstSet.target_weight_kg}kg` : ""}
                                                {firstSet?.muscle_group ? ` — ${firstSet.muscle_group}` : ""}
                                            </span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                    </button>

                                    {/* Coach notes for this exercise (#24) */}
                                    {exerciseNotes && (
                                        <div className="mt-2 ml-5 flex items-start gap-1.5">
                                            <Info className="w-3 h-3 text-neutral-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-[10px] font-inter text-neutral-500 italic">{exerciseNotes}</span>
                                        </div>
                                    )}

                                    {/* Expanded: editable targets per set (#8, #18) */}
                                    {isExpanded && (
                                        <div className="mt-3 space-y-2 border-t border-[#1a1a1a] pt-3">
                                            {/* Working Max Editor */}
                                            {(() => {
                                                const weights = sets
                                                    .map(s => s.target_weight_kg)
                                                    .filter((w): w is number => w !== null && w > 0)
                                                const currentWorkingMax = weights.length > 0 ? Math.max(...weights) : 0
                                                const workingMaxValue = workingMaxEdits[name] ?? currentWorkingMax.toString()

                                                return currentWorkingMax > 0 && !isBodyweightExercise(name) ? (
                                                    <div className="p-4 bg-cyan-950/20 border border-cyan-900/30 rounded-md mb-4">
                                                        <label className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 block mb-2">
                                                            Working Max (all sets will adjust proportionally)
                                                        </label>
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="number"
                                                                inputMode="decimal"
                                                                step="2.5"
                                                                value={workingMaxValue}
                                                                onChange={(e) => {
                                                                    const newMax = parseFloat(e.target.value) || 0
                                                                    setWorkingMaxEdits(prev => ({ ...prev, [name]: e.target.value }))

                                                                    if (newMax > 0 && currentWorkingMax > 0) {
                                                                        // Calculate ratio and update all sets
                                                                        const ratio = newMax / currentWorkingMax
                                                                        const updates: Record<string, { weight: string; reps: string }> = {}

                                                                        sets.forEach(set => {
                                                                            if (set.target_weight_kg && set.target_weight_kg > 0) {
                                                                                const newWeight = Math.round(set.target_weight_kg * ratio * 2) / 2 // Round to nearest 2.5kg
                                                                                updates[set.id] = {
                                                                                    weight: newWeight.toString(),
                                                                                    reps: set.target_reps?.toString() ?? ""
                                                                                }
                                                                            }
                                                                        })

                                                                        setTargetEdits(prev => ({ ...prev, ...updates }))
                                                                    }
                                                                }}
                                                                className="flex-1 bg-[#111] border border-cyan-900/50 h-12 px-3 text-center text-xl font-space-grotesk text-white focus:border-cyan-500 focus:outline-none"
                                                            />
                                                            <span className="text-sm font-mono text-neutral-400">kg</span>
                                                            <div className="text-right min-w-[80px]">
                                                                <span className="text-[8px] font-mono text-neutral-500 uppercase block">Est. 1RM</span>
                                                                <span className="text-sm font-space-grotesk font-semibold text-neutral-400">
                                                                    {estimate1RM(parseFloat(workingMaxValue) || currentWorkingMax, 5)}kg
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null
                                            })()}

                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[9px] font-mono text-yellow-500/70 uppercase tracking-widest">
                                                    AI Estimates — adjust if needed
                                                </span>
                                            </div>

                                            {sets.map(set => {
                                                const edit = targetEdits[set.id]
                                                const weightVal = edit?.weight ?? set.target_weight_kg?.toString() ?? ""
                                                const repsVal = edit?.reps ?? set.target_reps?.toString() ?? ""

                                                return (
                                                    <div key={set.id} className="flex items-center gap-3">
                                                        <span className="w-6 text-xs font-mono text-neutral-600 text-center">
                                                            S{set.set_number}
                                                        </span>
                                                        <div className="relative flex-1">
                                                            <span className="absolute top-0.5 left-2 text-[7px] font-mono text-neutral-600">KG</span>
                                                            <input
                                                                type="number"
                                                                inputMode="decimal"
                                                                value={weightVal}
                                                                onChange={(e) => setTargetEdits(prev => ({
                                                                    ...prev,
                                                                    [set.id]: {
                                                                        weight: e.target.value,
                                                                        reps: prev[set.id]?.reps ?? repsVal,
                                                                    }
                                                                }))}
                                                                className="w-full bg-[#111111] border border-[#2a2a2a] h-9 text-center text-sm font-space-grotesk focus:border-yellow-500/50 focus:outline-none"
                                                                disabled={isPending}
                                                            />
                                                        </div>
                                                        <div className="relative flex-1">
                                                            <span className="absolute top-0.5 left-2 text-[7px] font-mono text-neutral-600">REPS</span>
                                                            <input
                                                                type="number"
                                                                inputMode="numeric"
                                                                value={repsVal}
                                                                onChange={(e) => setTargetEdits(prev => ({
                                                                    ...prev,
                                                                    [set.id]: {
                                                                        weight: prev[set.id]?.weight ?? weightVal,
                                                                        reps: e.target.value,
                                                                    }
                                                                }))}
                                                                className="w-full bg-[#111111] border border-[#2a2a2a] h-9 text-center text-sm font-space-grotesk focus:border-yellow-500/50 focus:outline-none"
                                                                disabled={isPending}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}

                                            <div className="flex gap-2 mt-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 border-[#333333] text-neutral-400 text-xs"
                                                    onClick={() => setSwapTarget(
                                                        isSwapping ? null : { exerciseName: name, replacement: "" }
                                                    )}
                                                >
                                                    <RefreshCw className="w-3 h-3 mr-1.5" />
                                                    Swap Exercise
                                                </Button>
                                                {Object.keys(targetEdits).some(id =>
                                                    sets.some(s => s.id === id)
                                                ) && (
                                                    <Button
                                                        size="sm"
                                                        className="flex-1 text-xs"
                                                        onClick={() => handleSaveTargets(name)}
                                                        disabled={isPending}
                                                    >
                                                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Changes"}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Swap exercise input */}
                                    {isSwapping && (
                                        <div className="mt-3 flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Replacement exercise name"
                                                value={swapTarget?.replacement ?? ""}
                                                onChange={(e) => setSwapTarget(prev =>
                                                    prev ? { ...prev, replacement: e.target.value } : null
                                                )}
                                                className="flex-1 bg-[#111111] border border-[#333333] px-3 h-10 text-sm font-inter focus:border-cyan-500 focus:outline-none"
                                            />
                                            <Button
                                                onClick={handleSwapExercise}
                                                disabled={isPending || !swapTarget?.replacement.trim()}
                                                className="h-10 px-4"
                                            >
                                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="mt-auto p-6">
                    <Button
                        onClick={() => {
                            startTimeRef.current = Date.now()
                            setPhase('logging')
                        }}
                        className="w-full h-14 text-lg font-space-grotesk uppercase tracking-widest shadow-[0_0_20px_rgba(13,185,242,0.2)]"
                    >
                        Start Workout
                    </Button>
                </div>
            </div>
        )
    }

    // ─── Main Logging Phase ─────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#000000] text-white flex flex-col pt-12">

            {/* Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050505] border-b border-[#222222] p-4 flex justify-between items-center">
                <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => router.push('/dashboard')}>
                    <ArrowLeft className="w-5 h-5 text-neutral-400" />
                </Button>
                <div className="text-center">
                    <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 block">
                        {workout.modality} SESSION
                    </span>
                    <span className="text-[9px] font-mono text-neutral-600">
                        {completedTotal}/{totalSets} sets logged
                    </span>
                </div>
                <Button
                    variant="ghost"
                    className="text-xs text-red-400 p-0 h-8"
                    onClick={() => setShowEndConfirm(true)}
                >
                    END
                </Button>
            </nav>

            {/* Error Banner (Issue #15) */}
            {error && (
                <div className="fixed top-14 left-0 right-0 z-40 mx-4">
                    <div className="bg-red-950/90 border border-red-500/50 p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-mono text-red-300 flex-1">{error}</span>
                        <button onClick={() => setError(null)} className="text-red-400">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Rest Timer (Issue #13) */}
            {restTimerSeconds !== null && (
                <RestTimer
                    suggestedSeconds={restTimerSeconds}
                    onDismiss={() => setRestTimerSeconds(null)}
                />
            )}

            {/* End Workout Confirmation (Issue #26) + Performance Check-in (#9) */}
            {showEndConfirm && (
                <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6">
                    <div className="bg-[#111111] border border-[#333333] p-6 max-w-sm w-full">
                        <h2 className="text-lg font-space-grotesk font-bold mb-2">End Workout?</h2>
                        <p className="text-sm text-neutral-400 font-inter mb-1">
                            {completedTotal} of {totalSets} sets logged.
                        </p>
                        {completedTotal < totalSets && (
                            <p className="text-xs text-yellow-500/80 font-mono mb-4">
                                {totalSets - completedTotal} sets will be recorded as skipped.
                            </p>
                        )}

                        {/* Performance divergence check-in (#9) */}
                        {divergence.hasDivergence && (
                            <div className="border border-yellow-500/30 bg-yellow-950/20 p-3 mb-4">
                                <p className="text-xs font-mono text-yellow-400 mb-2">
                                    Performance was {divergence.percentDiff}% below AI estimates
                                    ({divergence.avgActualWeight}kg vs {divergence.avgTargetWeight}kg avg).
                                </p>
                                <p className="text-[10px] text-neutral-500 mb-2">
                                    Help the AI coach understand — select a reason:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {["Bad estimate", "Off day", "Minor issue", "Injury", "Time off", "New exercise"].map(reason => (
                                        <button
                                            key={reason}
                                            onClick={() => setDivergenceNote(
                                                divergenceNote === reason ? null : reason
                                            )}
                                            className={`text-[10px] font-mono px-2.5 py-1 border transition-colors ${
                                                divergenceNote === reason
                                                    ? "border-cyan-500/50 text-cyan-400 bg-cyan-950/30"
                                                    : "border-[#333333] text-neutral-500 hover:text-neutral-300"
                                            }`}
                                        >
                                            {reason}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 mt-4">
                            <Button
                                variant="outline"
                                className="flex-1 border-[#333333] text-neutral-300"
                                onClick={() => {
                                    setShowEndConfirm(false)
                                    setDivergenceNote(null)
                                }}
                            >
                                Keep Going
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleEndWorkout}
                                disabled={isPending}
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "End & Save"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Exercise Display */}
            <div className="p-6 pb-2 pt-6">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono uppercase text-neutral-500 tracking-widest">
                        {currentExerciseData?.muscle_group}
                    </span>
                    <span className="text-xs font-mono text-cyan-500">
                        Ex {activeExerciseIdx + 1}/{exerciseNames.length}
                    </span>
                </div>

                {/* Massive typography for high-stress visibility */}
                <h1 className="text-4xl md:text-5xl font-space-grotesk font-bold tracking-tight leading-none mb-3 text-white text-shadow-glow">
                    {currentExerciseName}
                </h1>

                {/* Working Max Display (when percentage mode enabled) */}
                {workingMaxData && (
                    <div className="mb-4 p-3 bg-cyan-950/20 border border-cyan-900/30 rounded-md">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Working Max</span>
                                <p className="text-2xl font-space-grotesk font-bold text-cyan-300">
                                    {workingMaxData.workingMax}kg
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Est. 1RM</span>
                                <p className="text-lg font-space-grotesk font-semibold text-neutral-400">
                                    {workingMaxData.estimated1RM}kg
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-4 mb-4">
                    <div className="flex-1 bg-[#0a0a0a] border border-[#222222] p-3 text-center">
                        <span className="block text-[10px] font-mono text-neutral-500 mb-1">TARGET REPS</span>
                        <span className="text-lg font-space-grotesk font-bold">
                            {currentExerciseData?.target_reps}
                        </span>
                    </div>
                    <div className="flex-1 bg-[#0a0a0a] border border-[#222222] p-3 text-center">
                        <span className="block text-[10px] font-mono text-neutral-500 mb-1">TARGET LOAD</span>
                        <span className="text-lg font-space-grotesk font-bold">
                            {currentExerciseData?.target_weight_kg || "--"} kg
                        </span>
                    </div>
                    {currentTempo && (
                        <div className="flex-1 bg-[#0a0a0a] border border-[#222222] p-3 text-center">
                            <span className="block text-[10px] font-mono text-neutral-500 mb-1">TEMPO</span>
                            <span className="text-lg font-space-grotesk font-bold text-yellow-400">
                                {currentTempo}
                            </span>
                        </div>
                    )}
                </div>

                {/* Exercise History Panel (Issue #4) */}
                {!isBW && (
                    <ExerciseHistoryPanel
                        exerciseName={currentExerciseName}
                        history={exerciseHistory[currentExerciseName] || []}
                        loading={loadingHistory}
                        targetReps={currentExerciseData?.target_reps}
                    />
                )}

                {/* Coach notes for this exercise (#24) — shown before sets start */}
                {currentExerciseData?.notes && !currentTempo && (
                    <div className="flex items-start gap-2 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded mt-1 mb-2">
                        <Info className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-inter text-neutral-300 leading-relaxed">{currentExerciseData.notes}</span>
                    </div>
                )}
                {currentExerciseData?.notes && currentTempo && !currentExerciseData.notes.match(/^\d+-\d+-\d+-\d+\s*tempo$/i) && (
                    <div className="flex items-start gap-2 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded mt-1 mb-2">
                        <Info className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-inter text-neutral-300 leading-relaxed">
                            {currentExerciseData.notes.replace(/\d+-\d+-\d+-\d+\s*tempo/i, '').trim()}
                        </span>
                    </div>
                )}
            </div>

            {/* Logging Grid - Designed for sweaty hands */}
            <div className="flex-1 overflow-y-auto px-4 pb-40">
                <div className="space-y-4">
                    {activeSets.map((set: ExerciseSet) => {
                        const isCompleted = set.actual_reps !== null && set.actual_reps > 0
                        const isSkipped = skippedSets.has(set.id)
                        const lSet = localSets[set.id] || { weight: "", reps: "", rir: 2 }

                        if (isSkipped) {
                            return (
                                <div
                                    key={set.id}
                                    className="border border-[#222222] bg-[#080808] p-4 opacity-50"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-mono text-neutral-500">
                                            Set {set.set_number} — Skipped
                                        </span>
                                        <button
                                            onClick={() => setSkippedSets(prev => {
                                                const next = new Set(prev)
                                                next.delete(set.id)
                                                return next
                                            })}
                                            className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest"
                                        >
                                            Undo
                                        </button>
                                    </div>
                                </div>
                            )
                        }

                        return (
                            <div
                                key={set.id}
                                className={`border transition-all duration-300 ${isCompleted
                                    ? 'border-cyan-500/50 bg-[#050505]'
                                    : 'border-[#333333] bg-[#0c0c0c]'
                                    } p-4`}
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex-shrink-0 w-14 text-center">
                                        <div className="text-sm font-mono text-neutral-500">
                                            {set.set_number}
                                        </div>
                                        {workingMaxData && set.target_weight_kg && (
                                            <div className="text-[10px] font-mono text-cyan-400">
                                                {Math.round((set.target_weight_kg / workingMaxData.workingMax) * 100)}%
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">{isBW ? "BW+" : "KG"}</span>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                value={lSet.weight}
                                                onChange={(e) => setLocalSets(prev => ({
                                                    ...prev,
                                                    [set.id]: { ...lSet, weight: e.target.value }
                                                }))}
                                                className="w-full bg-[#111111] border border-[#222222] h-12 text-center text-xl font-space-grotesk focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                                                disabled={isCompleted || isPending}
                                            />
                                        </div>
                                        <div className="relative">
                                            <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-500">REPS</span>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                value={lSet.reps}
                                                onChange={(e) => setLocalSets(prev => ({
                                                    ...prev,
                                                    [set.id]: { ...lSet, reps: e.target.value }
                                                }))}
                                                className="w-full bg-[#111111] border border-[#222222] h-12 text-center text-xl font-space-grotesk focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                                                disabled={isCompleted || isPending}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => handleCompleteSet(set.id, isCompleted)}
                                            disabled={isPending}
                                            className={`flex-shrink-0 w-12 h-12 flex items-center justify-center border transition-colors ${isCompleted
                                                ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_15px_rgba(13,185,242,0.4)]'
                                                : 'bg-[#1a1a1a] border-[#333333] text-neutral-400 hover:border-cyan-500/50'
                                                } disabled:opacity-50`}
                                        >
                                            <CheckCircle2 className={`w-6 h-6 ${isCompleted ? 'text-black' : ''}`} />
                                        </button>
                                        {!isCompleted && (
                                            <button
                                                onClick={() => handleSkipSet(set.id)}
                                                className="w-12 h-6 flex items-center justify-center text-neutral-600 hover:text-neutral-400"
                                                title="Skip set"
                                            >
                                                <SkipForward className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* RIR Tactile Slider */}
                                {!isCompleted && (
                                    <div className="pt-2 border-t border-[#222222]">
                                        <div className="flex justify-between items-center mb-2 px-1">
                                            <span className="text-[10px] font-mono text-neutral-500 tracking-widest uppercase">
                                                Target RIR: {set.target_rir}
                                            </span>
                                        </div>
                                        <RIRSlider
                                            value={lSet.rir}
                                            onChange={(val) => setLocalSets(prev => ({
                                                ...prev,
                                                [set.id]: { ...lSet, rir: val }
                                            }))}
                                            disabled={isPending}
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Footer Nav — Previous / Next / Complete (Issue #23, #26) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent pb-safe-area">
                <div className="flex gap-3">
                    {/* Previous Movement */}
                    <Button
                        variant="outline"
                        onClick={handlePrevious}
                        disabled={isPending}
                        className="h-14 px-4 border-[#333333] text-neutral-300 disabled:opacity-30"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>

                    {/* Next / Complete */}
                    <Button
                        onClick={handleNextOrComplete}
                        disabled={isPending}
                        className="flex-1 h-14 text-lg font-space-grotesk uppercase tracking-widest shadow-[0_0_20px_rgba(13,185,242,0.2)]"
                    >
                        {isPending ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : isLastExercise ? (
                            "Complete Protocol"
                        ) : (
                            "Next Movement"
                        )}
                    </Button>

                    {/* Skip to Next Movement */}
                    {!isLastExercise && (
                        <Button
                            variant="outline"
                            onClick={handleNext}
                            disabled={isPending}
                            className="h-14 px-4 border-[#333333] text-neutral-300"
                            title="Skip to next movement"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    )}
                </div>

                {/* Exercise pagination dots */}
                <div className="flex justify-center gap-1.5 mt-3">
                    {exerciseNames.map((name, idx) => {
                        const sets = workout.exercise_sets.filter(s => s.exercise_name === name)
                        const allDone = sets.every(s => s.actual_reps !== null && s.actual_reps > 0)
                        const isCurrent = idx === activeExerciseIdx

                        return (
                            <button
                                key={name}
                                onClick={() => goToExercise(idx)}
                                className={`h-1.5 rounded-full transition-all ${isCurrent
                                    ? 'w-6 bg-cyan-400'
                                    : allDone
                                        ? 'w-1.5 bg-cyan-400/50'
                                        : 'w-1.5 bg-neutral-700'
                                    }`}
                            />
                        )
                    })}
                </div>
            </div>

            {/* Coach Notes Banner (Issue #2) */}
            <CoachNotesBanner
                note={activeCoachNote}
                onDismiss={() => setActiveCoachNote(null)}
            />
        </div>
    )
}
