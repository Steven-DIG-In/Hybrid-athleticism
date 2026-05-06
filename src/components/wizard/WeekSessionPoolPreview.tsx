'use client'

import type { Workout } from '@/lib/types/database.types'

export interface WeekSessionPoolPreviewProps {
  weekNumber: number
  emphasis: string
  workouts: Workout[]
}

export function WeekSessionPoolPreview({ weekNumber, emphasis, workouts }: WeekSessionPoolPreviewProps) {
  return (
    <section className="border-b border-neutral-800 px-6 py-6">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">
        Week {weekNumber} — {emphasis}
      </div>
      <div className="text-[11px] font-inter text-neutral-400 mb-3">{workouts.length} sessions</div>
      <div className="space-y-1">
        {workouts.map(w => (
          <div key={w.id} className="flex justify-between text-[11px] font-inter py-1.5 border-b border-neutral-900">
            <span className="text-neutral-200">{w.name}</span>
            <span className="text-neutral-500 font-mono">
              {w.actual_duration_minutes ?? '—'} min · {w.modality}
            </span>
          </div>
        ))}
      </div>
      <div className="text-[10px] font-mono text-neutral-600 italic mt-4">
        Weeks 2-N will generate as you progress. Week N+1 reads the strategy + your recovery from week N.
      </div>
    </section>
  )
}
