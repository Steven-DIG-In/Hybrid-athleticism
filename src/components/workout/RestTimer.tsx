"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import { X, Play, Pause, RotateCcw } from "lucide-react"

// ─── Rest Period Suggestions ────────────────────────────────────────────────
// Based on exercise science:
//   - Strength (1-5 reps, low RIR): 180-300s
//   - Hypertrophy (6-12 reps, moderate RIR): 90-120s
//   - Endurance/MetCon (12+ reps, high RIR): 60-90s
//   - Compound movements get +30s vs isolation

export function suggestRestSeconds(targetReps: number | null, targetRir: number | null): number {
    const reps = targetReps ?? 10
    const rir = targetRir ?? 2

    // Low rep / low RIR = strength = long rest
    if (reps <= 5 || rir <= 1) return 180
    if (reps <= 8) return 120
    if (reps <= 12) return 90
    return 60
}

// ─── Timer Component ────────────────────────────────────────────────────────

interface RestTimerProps {
    suggestedSeconds: number
    onDismiss: () => void
}

export function RestTimer({ suggestedSeconds, onDismiss }: RestTimerProps) {
    const [remaining, setRemaining] = useState(suggestedSeconds)
    const [isRunning, setIsRunning] = useState(true)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const progress = remaining / suggestedSeconds

    // Countdown
    useEffect(() => {
        if (!isRunning || remaining <= 0) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            return
        }
        intervalRef.current = setInterval(() => {
            setRemaining(r => {
                if (r <= 1) {
                    setIsRunning(false)
                    return 0
                }
                return r - 1
            })
        }, 1000)
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [isRunning, remaining])

    const togglePause = useCallback(() => setIsRunning(r => !r), [])
    const reset = useCallback(() => {
        setRemaining(suggestedSeconds)
        setIsRunning(true)
    }, [suggestedSeconds])

    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`

    // Color shifts from cyan → yellow → red as time expires
    const timerColor = progress > 0.5
        ? "text-cyan-400"
        : progress > 0.2
            ? "text-yellow-400"
            : "text-red-400"

    const ringColor = progress > 0.5
        ? "stroke-cyan-400"
        : progress > 0.2
            ? "stroke-yellow-400"
            : "stroke-red-400"

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
        >
            {/* Dismiss */}
            <button
                onClick={onDismiss}
                className="absolute top-6 right-6 text-neutral-500 hover:text-white"
            >
                <X className="w-6 h-6" />
            </button>

            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-neutral-500 mb-6">
                Rest Period
            </span>

            {/* Circular progress ring */}
            <div className="relative w-48 h-48 mb-8">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {/* Background ring */}
                    <circle
                        cx="50" cy="50" r="44"
                        fill="none"
                        stroke="#1a1a1a"
                        strokeWidth="3"
                    />
                    {/* Progress ring */}
                    <motion.circle
                        cx="50" cy="50" r="44"
                        fill="none"
                        className={ringColor}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 44}
                        animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - progress) }}
                        transition={{ duration: 0.5, ease: "linear" }}
                    />
                </svg>

                {/* Timer display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-5xl font-space-grotesk font-bold tabular-nums ${timerColor}`}>
                        {timeStr}
                    </span>
                    {remaining === 0 && (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="text-xs font-mono text-cyan-400 mt-1 uppercase tracking-widest"
                        >
                            Go
                        </motion.span>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="flex gap-6">
                <button
                    onClick={reset}
                    className="w-12 h-12 rounded-full border border-[#333333] flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
                >
                    <RotateCcw className="w-5 h-5" />
                </button>
                <button
                    onClick={togglePause}
                    className="w-12 h-12 rounded-full border border-[#333333] flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
                >
                    {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                    onClick={onDismiss}
                    className="w-12 h-12 rounded-full border border-cyan-500/50 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Suggested time label */}
            <span className="text-[10px] font-mono text-neutral-600 mt-6">
                Suggested: {Math.floor(suggestedSeconds / 60)}:{(suggestedSeconds % 60).toString().padStart(2, "0")}
            </span>
        </motion.div>
    )
}
