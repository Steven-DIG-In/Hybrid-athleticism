'use client'

import { Clock } from 'lucide-react'

/**
 * "When did you actually do this?" control for session close.
 *
 * value === null means "just now" (the default — server stamps completion at
 * the current moment). A non-null value is a `datetime-local` string of the
 * moment the athlete actually trained, for logging a session after the fact.
 */

interface CompletedWhenPickerProps {
    value: string | null
    onChange: (value: string | null) => void
    disabled?: boolean
}

/** Current local time as a datetime-local input value (minute precision). */
export function localNowString(): string {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Convert the picker's local value into completeWorkout's completedAt param.
 * The local calendar day comes straight off the input string — only the
 * client knows the athlete's timezone.
 */
export function completedAtFromLocal(
    value: string | null
): { iso: string; localDate: string } | undefined {
    if (!value) return undefined
    return {
        iso: new Date(value).toISOString(),
        localDate: value.slice(0, 10),
    }
}

export function CompletedWhenPicker({ value, onChange, disabled }: CompletedWhenPickerProps) {
    return (
        <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 block mb-2">
                Completed
            </label>
            {value === null ? (
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-inter text-neutral-300">Just now</span>
                    <button
                        type="button"
                        onClick={() => onChange(localNowString())}
                        disabled={disabled}
                        className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500 border border-[#333333] px-2.5 py-1.5 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors"
                    >
                        <Clock className="w-3 h-3" />
                        I did this earlier
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <input
                        type="datetime-local"
                        value={value}
                        max={localNowString()}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                        className="flex-1 bg-[#111] border border-[#2a2a2a] px-3 h-11 text-sm font-inter text-white focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]"
                    />
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        disabled={disabled}
                        className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 border border-[#333333] px-2.5 py-1.5 hover:text-neutral-300 transition-colors"
                    >
                        Now
                    </button>
                </div>
            )}
        </div>
    )
}
