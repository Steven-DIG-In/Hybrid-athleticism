'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { regenerateBlockPlan } from '@/lib/engine/mesocycle/regenerate'

export function BlockEmptyRecoveryBanner({
  mesocycleId, blockName,
}: {
  mesocycleId: string; blockName: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleRegenerate = () => {
    setError(null)
    startTransition(async () => {
      const result = await regenerateBlockPlan(mesocycleId)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-start gap-2 mb-3">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-inter text-neutral-200">
          <span className="font-bold">{blockName}</span> has no sessions yet.
          Generation failed silently — regenerate to produce week 1.
        </p>
        {error && (
          <p className="text-[11px] font-mono text-red-400 mt-1 break-words">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={handleRegenerate}
        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 shrink-0"
      >
        {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
        {isPending ? 'Generating…' : 'Regenerate plan'}
      </button>
    </div>
  )
}
