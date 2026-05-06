'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

export function MissedSessionsList({ missedSessions }: {
  missedSessions: BlockRetrospectiveSnapshot['missedSessions']
}) {
  const [open, setOpen] = useState(false)
  const Icon = open ? ChevronDown : ChevronRight

  return (
    <section className="border border-neutral-800 bg-neutral-950/60 p-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-[10px] font-mono text-neutral-500 uppercase tracking-wider hover:text-neutral-300 transition-colors"
      >
        <Icon className="w-3 h-3" />
        Missed sessions ({missedSessions.length})
      </button>
      {open && missedSessions.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12px] font-inter">
          {missedSessions.map(m => (
            <li key={m.sessionInventoryId} className="flex items-center gap-2 text-neutral-400">
              <span className="text-[10px] font-mono text-neutral-500 w-16 shrink-0">
                W{m.weekNumber} · D{m.trainingDay}
              </span>
              <span className="w-24 text-neutral-500 text-[10px] font-mono uppercase">
                {m.coachDomain}
              </span>
              <span>{m.name}</span>
            </li>
          ))}
        </ul>
      )}
      {open && missedSessions.length === 0 && (
        <p className="text-[12px] font-inter text-neutral-500 mt-3">No missed sessions.</p>
      )}
    </section>
  )
}
