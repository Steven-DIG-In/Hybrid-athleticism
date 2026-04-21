'use client'
import { useState } from 'react'
import { SupplementForm } from './SupplementForm'
import { endSupplement } from '@/lib/actions/health/supplements.actions'
import { Plus } from 'lucide-react'

type Supplement = {
  id: string; name: string; dose: number | null; dose_unit: string | null
  timing: string[]; start_date: string; end_date: string | null; notes: string | null
}

export function SupplementsList({ active, ended }: { active: Supplement[]; ended: Supplement[] }) {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk">Supplements</h1>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 text-sm text-amber-500">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      {showAdd && <SupplementForm onDone={() => setShowAdd(false)} />}
      <section>
        <h2 className="text-sm text-neutral-400 mb-2">Active ({active.length})</h2>
        {active.map(s => (
          <div key={s.id} className="p-3 border border-neutral-800 rounded mb-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-neutral-100">{s.name}</div>
                <div className="text-xs text-neutral-400">
                  {s.dose ?? '—'}{s.dose_unit ?? ''} · {s.timing.join(', ') || '—'} · since {s.start_date}
                </div>
              </div>
              <button
                onClick={() => endSupplement(s.id, new Date().toISOString().slice(0, 10))}
                className="text-xs text-neutral-500 hover:text-amber-500">End</button>
            </div>
          </div>
        ))}
      </section>
      <section>
        <h2 className="text-sm text-neutral-400 mb-2">Ended ({ended.length})</h2>
        {ended.map(s => (
          <div key={s.id} className="p-3 border border-neutral-900 rounded mb-2 opacity-70">
            <div className="text-neutral-300">{s.name}</div>
            <div className="text-xs text-neutral-500">
              {s.start_date} → {s.end_date}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
