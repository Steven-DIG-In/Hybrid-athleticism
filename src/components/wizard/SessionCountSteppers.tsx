'use client'

import { Minus, Plus } from 'lucide-react'
import type { CoachDomain } from '@/lib/skills/types'

const COACHES: CoachDomain[] = ['hypertrophy', 'strength', 'conditioning', 'endurance', 'mobility']

export interface SessionCountSteppersProps {
  value: Record<CoachDomain, number>
  daysPerWeekBudget: number
  onChange: (next: Record<CoachDomain, number>) => void
}

export function SessionCountSteppers({ value, daysPerWeekBudget, onChange }: SessionCountSteppersProps) {
  const total = COACHES.reduce((sum, c) => sum + (value[c] ?? 0), 0)
  // Allow up to 2× days for two-a-days; anything beyond gets a warning.
  const maxRecommended = daysPerWeekBudget * 2
  const overBudget = total > maxRecommended

  return (
    <section className="border-b border-neutral-800 px-6 py-5 space-y-2">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-2">Custom session counts</div>
      {COACHES.map(c => {
        const n = value[c] ?? 0
        return (
          <div key={c} className="flex justify-between items-center py-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-300">{c}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...value, [c]: Math.max(0, n - 1) })}
                className="w-6 h-6 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-neutral-400"
                aria-label={`decrease ${c}`}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className={`min-w-[24px] text-center text-[12px] font-mono ${n > 0 ? 'text-amber-500' : 'text-neutral-500'}`}>{n}</span>
              <button
                type="button"
                onClick={() => onChange({ ...value, [c]: n + 1 })}
                className="w-6 h-6 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-neutral-400"
                aria-label={`increase ${c}`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        )
      })}
      <div className={`flex justify-between text-[11px] font-mono pt-3 mt-3 border-t border-neutral-800 ${overBudget ? 'text-red-500' : 'text-neutral-400'}`}>
        <span>TOTAL / WEEK</span>
        <span>{total} sessions {overBudget && `(exceeds 2× ${daysPerWeekBudget} days)`}</span>
      </div>
    </section>
  )
}
