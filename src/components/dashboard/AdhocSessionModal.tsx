'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { logAdhocWorkout } from '@/lib/actions/inventory.actions'

const MODALITIES = [
    { value: 'LIFTING', label: 'Lifting' },
    { value: 'CARDIO', label: 'Cardio' },
    { value: 'METCON', label: 'Metcon' },
    { value: 'RUCKING', label: 'Rucking' },
    { value: 'MOBILITY', label: 'Mobility' },
] as const

type Modality = typeof MODALITIES[number]['value']

interface AdhocSessionModalProps {
    mesocycleId: string
    weekNumber: number
}

export function AdhocSessionModal({ mesocycleId, weekNumber }: AdhocSessionModalProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const [name, setName] = useState('')
    const [modality, setModality] = useState<Modality>('LIFTING')
    const [notes, setNotes] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        setError(null)
        startTransition(async () => {
            const result = await logAdhocWorkout(mesocycleId, weekNumber, {
                name: name.trim(),
                modality,
                notes: notes.trim() || undefined,
            })

            if (result.success) {
                setOpen(false)
                setName('')
                setModality('LIFTING')
                setNotes('')
                router.refresh()
            } else {
                setError(result.error)
            }
        })
    }

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                variant="ghost"
                size="sm"
                className="w-full border border-dashed border-[#333333] text-neutral-500 hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-950/10 transition-colors text-xs font-mono uppercase tracking-wider"
                aria-label="Log ad-hoc session"
            >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Log Ad-hoc Session
            </Button>

            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/70 z-40"
                            onClick={() => setOpen(false)}
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 8 }}
                            transition={{ duration: 0.18 }}
                            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Log ad-hoc session"
                        >
                            <div className="bg-[#0a0a0a] border border-[#2a2a2a]">
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                                    <div>
                                        <h2 className="text-sm font-space-grotesk font-bold text-white uppercase tracking-wide">
                                            Ad-hoc Session
                                        </h2>
                                        <p className="text-[10px] font-mono text-neutral-600 mt-0.5">
                                            Log unplanned training
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setOpen(false)}
                                        className="p-1.5 text-neutral-500 hover:text-white transition-colors"
                                        aria-label="Close modal"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                                    {/* Name */}
                                    <div className="space-y-1.5">
                                        <label
                                            htmlFor="adhoc-name"
                                            className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest"
                                        >
                                            Session Name
                                        </label>
                                        <Input
                                            id="adhoc-name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. Extra Zone 2 Run"
                                            required
                                            autoFocus
                                            disabled={isPending}
                                        />
                                    </div>

                                    {/* Modality */}
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                                            Modality
                                        </p>
                                        <div className="grid grid-cols-5 gap-1">
                                            {MODALITIES.map(({ value, label }) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => setModality(value)}
                                                    disabled={isPending}
                                                    className={`py-2 text-[10px] font-mono uppercase tracking-wide border transition-colors ${
                                                        modality === value
                                                            ? 'border-amber-500/60 bg-amber-950/20 text-amber-400'
                                                            : 'border-[#2a2a2a] text-neutral-600 hover:border-[#444444] hover:text-neutral-400'
                                                    }`}
                                                    aria-pressed={modality === value}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div className="space-y-1.5">
                                        <label
                                            htmlFor="adhoc-notes"
                                            className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest"
                                        >
                                            Notes <span className="text-neutral-700">(optional)</span>
                                        </label>
                                        <textarea
                                            id="adhoc-notes"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="What did you do?"
                                            rows={3}
                                            disabled={isPending}
                                            className="w-full bg-[#0c0c0c] border border-[#333333] text-sm text-white font-inter placeholder:text-neutral-600 px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                                        />
                                    </div>

                                    {/* Error */}
                                    {error && (
                                        <p className="text-xs text-red-400 font-inter">{error}</p>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setOpen(false)}
                                            disabled={isPending}
                                            className="flex-1 border border-[#2a2a2a] text-neutral-500 hover:text-white"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            size="sm"
                                            disabled={isPending || !name.trim()}
                                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase tracking-wide"
                                        >
                                            {isPending ? (
                                                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Logging...</>
                                            ) : (
                                                'Log Session'
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}
