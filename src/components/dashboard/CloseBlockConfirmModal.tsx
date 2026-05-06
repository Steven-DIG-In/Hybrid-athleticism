'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { closeMesocycle, previewRetrospective } from '@/lib/actions/block-retrospective.actions'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

export function CloseBlockConfirmModal({
  mesocycleId, onClose,
}: {
  mesocycleId: string; onClose: () => void
}) {
  const [snap, setSnap] = useState<BlockRetrospectiveSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    previewRetrospective(mesocycleId).then(r => {
      if (cancelled) return
      if (r.success) setSnap(r.data)
      else setError(r.error)
    })
    return () => { cancelled = true }
  }, [mesocycleId])

  const handleConfirm = () => {
    startTransition(async () => {
      const r = await closeMesocycle(mesocycleId)
      if (!r.success) {
        setError(r.error)
        return
      }
      onClose()
      router.push(`/data/blocks/${mesocycleId}/reality-check`)
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog">
      <div className="bg-neutral-950 border border-neutral-800 max-w-md w-full p-4 m-4">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-base font-space-grotesk font-bold text-white">
            Close {snap?.block.name ?? 'block'}
          </h2>
          <button
            type="button" onClick={onClose}
            className="text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <p className="text-[12px] font-inter text-amber-400 mb-3 border border-amber-500/30 bg-amber-500/5 p-2">
            {error}
          </p>
        )}

        {!snap && !error && (
          <div className="flex items-center gap-2 text-neutral-500 text-[12px] font-inter">
            <Loader2 className="w-3 h-3 animate-spin" /> Building preview…
          </div>
        )}

        {snap && (
          <>
            <dl className="text-[12px] font-inter text-neutral-300 space-y-1.5 mb-3 border border-neutral-800 p-2">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Prescribed</dt>
                <dd className="font-mono">{snap.adherence.overall.prescribed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Completed</dt>
                <dd className="font-mono">
                  {snap.adherence.overall.completed} ({snap.adherence.overall.pct}%)
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Pending → missed</dt>
                <dd className="font-mono text-amber-400">
                  {snap.adherence.overall.missed}
                </dd>
              </div>
              <div className="flex justify-between border-t border-neutral-800 pt-1.5">
                <dt className="text-neutral-500">Recalibrations</dt>
                <dd className="font-mono">{snap.recalibrations.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Interventions</dt>
                <dd className="font-mono">{snap.interventions.length}</dd>
              </div>
            </dl>
            <p className="text-[11px] font-inter text-neutral-500 mb-3">
              Pending sessions will be marked missed and cannot be resumed.
            </p>
          </>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button" onClick={onClose}
            disabled={pending}
            className="px-3 py-1.5 border border-neutral-700 hover:border-neutral-500 text-[11px] font-mono text-neutral-400 uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            type="button" onClick={handleConfirm}
            disabled={pending || !snap || !!error}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-[11px] font-mono uppercase tracking-wider transition-colors"
          >
            {pending && <Loader2 className="w-3 h-3 animate-spin" />}
            Close & generate retrospective
          </button>
        </div>
      </div>
    </div>
  )
}
