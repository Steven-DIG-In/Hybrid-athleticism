'use client'

import { X } from 'lucide-react'
import { RealityCheckForm } from './RealityCheckForm'
import type { SignalEvidence, AvailabilityAnswers } from '@/lib/types/pending-planner-notes.types'

export type OverrunSignalModalProps = {
  evidence: SignalEvidence
  defaults: AvailabilityAnswers
  onClose: (action: 'saved' | 'skipped') => void
}

export function OverrunSignalModal({ evidence, defaults, onClose }: OverrunSignalModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog">
      <div className="bg-neutral-950 border border-neutral-800 max-w-md w-full p-4 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-base font-space-grotesk font-bold text-white">
            Reality check
          </h2>
          <button
            type="button" onClick={() => onClose('skipped')}
            className="text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="border border-amber-500/30 bg-amber-500/5 p-2 mb-4">
          <p className="text-[10px] font-mono text-amber-400 uppercase tracking-wider mb-1">
            Last {evidence.sessionsConsidered} sessions
          </p>
          <ul className="space-y-0.5">
            {evidence.overrunSessions.map((s) => (
              <li key={s.workoutId} className="text-[12px] font-mono text-neutral-300 flex justify-between">
                <span>est {s.estimatedMinutes} min</span>
                <span className="text-amber-400">
                  +{s.actualMinutes - s.estimatedMinutes} min over
                </span>
              </li>
            ))}
          </ul>
        </div>

        <RealityCheckForm
          source="mid_block_signal"
          defaults={defaults}
          signalEvidence={evidence}
          onComplete={onClose}
        />
      </div>
    </div>
  )
}
