'use client'

import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'

export interface StrategySummaryTileProps {
  strategy: MesocycleStrategyValidated
}

export function StrategySummaryTile({ strategy }: StrategySummaryTileProps) {
  const maxSessions = Math.max(...strategy.domainAllocations.map(d => d.sessionsPerWeek), 1)

  return (
    <section className="border-b border-neutral-800 px-6 py-6 space-y-5">
      <div>
        <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">Head coach strategy</div>
        <div className="text-[12px] font-inter text-neutral-400 mb-1">Per week:</div>
        <div className="space-y-1.5">
          {strategy.domainAllocations.map(d => (
            <div key={d.coach} className="flex items-center gap-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-300 w-28">{d.coach}</span>
              <div className="flex-1 h-3 bg-neutral-900 relative">
                <div
                  className="absolute left-0 top-0 h-full bg-amber-500/60"
                  style={{ width: `${(d.sessionsPerWeek / maxSessions) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-neutral-300 w-16 text-right">{d.sessionsPerWeek}/wk</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[12px] font-inter text-neutral-400 mb-2">Weekly arc:</div>
        <div className="space-y-1 text-[11px] font-mono">
          {strategy.weeklyEmphasis.map(w => (
            <div key={w.weekNumber} className="flex justify-between border-b border-neutral-900 py-1">
              <span className="text-neutral-500">Wk {w.weekNumber}</span>
              <span className="text-neutral-300 flex-1 ml-3">{w.emphasis}</span>
              <span className="text-neutral-500">
                {w.volumePercent}% vol{w.isDeload ? ' (deload)' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      <blockquote className="border-l-2 border-amber-500/50 pl-4 text-[12px] font-inter text-neutral-300 italic">
        {strategy.strategyRationale}
        <div className="text-[10px] font-mono text-neutral-500 mt-2 not-italic">— Head Coach</div>
      </blockquote>
    </section>
  )
}
