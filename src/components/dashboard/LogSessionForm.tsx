'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logOffPlanSession } from '@/lib/actions/logging.actions'

const MODALITIES = [
    { value: 'run', label: 'Run' },
    { value: 'ride', label: 'Ride' },
    { value: 'strength', label: 'Strength' },
    { value: 'conditioning', label: 'Conditioning' },
    { value: 'mobility', label: 'Mobility' },
    { value: 'other', label: 'Other' }
] as const

const DEFAULT_COUNT: Record<string, boolean> = {
    run: true, ride: true, strength: true, hypertrophy: true,
    conditioning: true, mobility: false, other: false
}

export function LogSessionForm() {
    const [modality, setModality] = useState('run')
    const [duration, setDuration] = useState(30)
    const [rpe, setRpe] = useState<number | ''>('')
    const [notes, setNotes] = useState('')
    const [countToward, setCountToward] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    function onModalityChange(m: string) {
        setModality(m)
        setCountToward(DEFAULT_COUNT[m] ?? false)
    }

    function submit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
            const result = await logOffPlanSession({
                modality,
                durationMinutes: duration,
                rpe: typeof rpe === 'number' ? rpe : undefined,
                notes: notes || undefined,
                countTowardLoad: countToward
            })
            if (result.success) {
                router.push('/dashboard')
            } else {
                setError(result.error)
            }
        })
    }

    return (
        <form onSubmit={submit} className="space-y-4 max-w-md">
            <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-neutral-400">Modality</span>
                <select
                    value={modality}
                    onChange={e => onModalityChange(e.target.value)}
                    className="mt-1 w-full rounded border border-white/10 bg-neutral-900 p-2 text-sm"
                >
                    {MODALITIES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>
            </label>

            <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-neutral-400">Duration (min)</span>
                <input
                    type="number" min={1} value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-white/10 bg-neutral-900 p-2 text-sm"
                />
            </label>

            <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-neutral-400">RPE 1–10 (optional)</span>
                <input
                    type="number" min={1} max={10}
                    value={rpe}
                    onChange={e => setRpe(e.target.value ? Number(e.target.value) : '')}
                    className="mt-1 w-full rounded border border-white/10 bg-neutral-900 p-2 text-sm"
                />
            </label>

            <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-neutral-400">Notes (optional)</span>
                <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded border border-white/10 bg-neutral-900 p-2 text-sm"
                />
            </label>

            <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input
                    type="checkbox"
                    checked={countToward}
                    onChange={e => setCountToward(e.target.checked)}
                />
                Count toward training load
            </label>

            {error ? (
                <p className="text-xs text-red-400">{error}</p>
            ) : null}

            <button
                type="submit"
                disabled={isPending}
                className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
                {isPending ? 'Logging…' : 'Log Session'}
            </button>
        </form>
    )
}
