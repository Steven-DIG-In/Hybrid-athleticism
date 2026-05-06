'use client'

import { useState, useTransition } from 'react'
import { AlertCircle } from 'lucide-react'
import { dismissOverrunSignal } from '@/lib/actions/pending-notes.actions'
import { OverrunSignalModal } from './OverrunSignalModal'
import type { SignalEvidence } from '@/lib/types/pending-planner-notes.types'

export type OverrunSignalBannerProps = {
  evidence: SignalEvidence
  defaults: { daysPerWeek: number; sessionMinutes: number; warmupMinutes: number; cooldownMinutes: number }
}

export function OverrunSignalBanner({ evidence, defaults }: OverrunSignalBannerProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [pending, startTransition] = useTransition()

  if (dismissed) return null

  const handleDismiss = () => {
    startTransition(async () => {
      await dismissOverrunSignal(evidence)
      setDismissed(true)
    })
  }

  return (
    <>
      <div className="border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-[12px] font-inter text-neutral-200 flex-1">
          Your last {evidence.sessionsConsidered} sessions ran{' '}
          <span className="font-bold">+{evidence.avgOverrunMinutes} min</span> over budget on average.
          Worth a quick reality-check on your time estimates.
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={pending}
          className="px-2.5 py-1 border border-neutral-700 hover:border-neutral-500 text-[11px] font-mono text-neutral-400 uppercase tracking-wider transition-colors"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-mono uppercase tracking-wider transition-colors"
        >
          Update
        </button>
      </div>
      {modalOpen && (
        <OverrunSignalModal
          evidence={evidence}
          defaults={defaults}
          onClose={(action) => {
            setModalOpen(false)
            if (action === 'saved') setDismissed(true)
          }}
        />
      )}
    </>
  )
}
