'use client'

import { AlertTriangle } from 'lucide-react'
import type { ConflictWarning as ConflictWarningType } from '@/lib/scheduling/load-scoring'

interface ConflictWarningProps {
    conflicts: ConflictWarningType[]
    onConfirm: () => void
    onCancel: () => void
    isPending?: boolean
}

export function ConflictWarning({ conflicts, onConfirm, onCancel, isPending }: ConflictWarningProps) {
    if (conflicts.length === 0) return null

    const hasCritical = conflicts.some(c => c.severity === 'critical')

    return (
        <div className={`p-3 border space-y-2 ${
            hasCritical
                ? 'border-red-500/30 bg-red-950/10'
                : 'border-amber-500/30 bg-amber-950/10'
        }`}>
            {conflicts.map((conflict, i) => (
                <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                        conflict.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                    }`} />
                    <p className={`text-[11px] font-inter leading-relaxed ${
                        conflict.severity === 'critical' ? 'text-red-300' : 'text-amber-300'
                    }`}>
                        {conflict.message}
                    </p>
                </div>
            ))}

            <div className="flex gap-2 pt-1">
                <button
                    onClick={onConfirm}
                    disabled={isPending}
                    className={`px-3 py-1 text-[10px] font-space-grotesk font-bold uppercase tracking-wider transition-colors ${
                        hasCritical
                            ? 'text-red-300 border border-red-500/30 hover:bg-red-500/10'
                            : 'text-amber-300 border border-amber-500/30 hover:bg-amber-500/10'
                    } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    Move anyway
                </button>
                <button
                    onClick={onCancel}
                    disabled={isPending}
                    className="px-3 py-1 text-[10px] font-space-grotesk font-bold uppercase tracking-wider text-neutral-500 border border-[#333] hover:border-[#555] transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}
