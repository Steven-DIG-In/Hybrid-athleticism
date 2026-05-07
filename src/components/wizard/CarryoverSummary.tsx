'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PendingPlannerNotes } from '@/lib/types/pending-planner-notes.types'
import { RealityCheckForm } from '@/components/reality-check/RealityCheckForm'

export interface CarryoverSummaryProps {
  notes: PendingPlannerNotes
}

export function CarryoverSummary({ notes }: CarryoverSummaryProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const a = notes.availability

  // Defaults come from current availability; if no availability data exists, fall back to common defaults.
  const defaults = {
    daysPerWeek: a?.daysPerWeek ?? 5,
    sessionMinutes: a?.sessionMinutes ?? 60,
    warmupMinutes: a?.warmupMinutes ?? 10,
    cooldownMinutes: a?.cooldownMinutes ?? 0,
  }

  const prefill = a
    ? { ...a, ...(notes.freeText ? { freeText: notes.freeText } : {}) }
    : (notes.freeText ? { freeText: notes.freeText } : undefined)

  return (
    <section className="border-b border-neutral-800 px-6 py-5">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">Your reality (from reality-check)</div>
      {a ? (
        <div className="grid grid-cols-2 gap-2 text-[11px] font-inter">
          <div className="flex justify-between"><span className="text-neutral-500">Days/week</span><span className="text-neutral-200">{a.daysPerWeek}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Session</span><span className="text-neutral-200">{a.sessionMinutes} min</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Warm-up</span><span className="text-neutral-200">{a.warmupMinutes} min</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Cool-down</span><span className="text-neutral-200">{a.cooldownMinutes} min</span></div>
        </div>
      ) : (
        <div className="text-[11px] font-inter text-neutral-500">No availability captured. Click Edit to add.</div>
      )}
      {notes.freeText && <div className="text-[11px] font-inter text-neutral-400 mt-2 italic">&quot;{notes.freeText}&quot;</div>}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[10px] font-mono text-amber-500 hover:text-amber-400 uppercase tracking-wider mt-3"
      >
        Edit →
      </button>
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div className="bg-neutral-950 border border-neutral-800 max-w-md w-full p-6">
            <RealityCheckForm
              source="block_start_wizard"
              defaults={defaults}
              prefill={prefill}
              onComplete={(action) => {
                setEditing(false)
                if (action === 'saved') router.refresh()
              }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
