'use client'

import { useState } from 'react'
import type { AthleteInjury } from '@/lib/types/database.types'
import { resolveInjury } from '@/lib/actions/injuries.actions'

export interface ActiveInjuriesCheckProps {
  injuries: AthleteInjury[]
}

// The head coach reads every active injury as current. Asking here, before
// planning, is the only point where an old one gets cleared.
export function ActiveInjuriesCheck({ injuries }: ActiveInjuriesCheckProps) {
  const [remaining, setRemaining] = useState(injuries)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (remaining.length === 0) return null

  async function handleResolve(id: string) {
    setPendingId(id)
    setError(null)
    const r = await resolveInjury(id)
    setPendingId(null)
    if (!r.success) {
      setError(r.error)
      return
    }
    setRemaining(prev => prev.filter(i => i.id !== id))
  }

  return (
    <section className="border-b border-neutral-800 px-6 py-5">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-2">Still current? The coaches will plan around these</div>
      <ul className="space-y-3">
        {remaining.map(inj => (
          <li key={inj.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-inter text-neutral-200">
                {inj.body_area} · {inj.severity}
                <span className="text-neutral-500"> · since {inj.created_at.slice(0, 10)}</span>
              </div>
              {inj.description && <div className="text-[11px] font-inter text-neutral-500 mt-0.5">{inj.description}</div>}
            </div>
            <button
              type="button"
              onClick={() => handleResolve(inj.id)}
              disabled={pendingId !== null}
              className="shrink-0 px-3 py-1.5 border border-neutral-700 hover:border-neutral-500 text-neutral-300 text-[10px] font-mono uppercase tracking-wider disabled:opacity-50"
            >
              {pendingId === inj.id ? 'Saving…' : 'Resolved'}
            </button>
          </li>
        ))}
      </ul>
      {error && <div className="text-red-500 text-[11px] mt-2">{error}</div>}
    </section>
  )
}
