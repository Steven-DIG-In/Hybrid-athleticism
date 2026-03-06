"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// A custom RIR (Reps in Reserve) slider built specifically for the tactile workout UI.
// It changes color from cool cyan (easy/RIR 3+) to deep orange/red (RIR 0/Failure).

interface RIRSliderProps {
    value: number
    onChange: (value: number) => void
    disabled?: boolean
    className?: string
}

export function RIRSlider({ value, onChange, disabled, className }: RIRSliderProps) {
    // 0 to 4 RIR scale
    const options = [0, 1, 2, 3, 4]

    const getColor = (val: number) => {
        if (val === 0) return "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] border-red-400"
        if (val === 1) return "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)] border-orange-400"
        if (val === 2) return "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)] border-yellow-400"
        if (val === 3) return "bg-emerald-500 border-emerald-400"
        return "bg-cyan-500 border-cyan-400" // RIR 4+
    }

    return (
        <div className={cn("w-full py-4", className)}>
            <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs font-mono text-red-400 uppercase tracking-widest">Failure (0)</span>
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Easy (4+)</span>
            </div>

            <div className="relative flex items-center h-12 bg-[#0c0c0c] border border-[#222222] rounded-none px-2">
                {/* Track Line */}
                <div className="absolute left-4 right-4 h-1 bg-[#1a1a1a] top-1/2 -translate-y-1/2 z-0"></div>

                {/* The nodes */}
                <div className="relative z-10 w-full flex justify-between items-center">
                    {options.map((option) => {
                        const isSelected = value === option
                        return (
                            <button
                                key={option}
                                type="button"
                                disabled={disabled}
                                onClick={() => onChange(option)}
                                className={cn(
                                    "w-8 h-8 rounded-none border transition-all duration-300 flex items-center justify-center font-mono text-sm",
                                    isSelected
                                        ? getColor(option)
                                        : "bg-[#111111] border-[#333333] text-neutral-500 hover:border-white/20",
                                    isSelected ? "text-black font-bold scale-110" : "",
                                    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"
                                )}
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
