import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

export function AdherenceByWeekChart({ byWeek }: { byWeek: BlockRetrospectiveSnapshot['adherence']['byWeek'] }) {
  if (byWeek.length === 0) return null
  const maxPrescribed = Math.max(...byWeek.map(w => w.prescribed), 1)
  const barWidth = 32
  const gap = 16
  const chartHeight = 120
  const chartWidth = byWeek.length * (barWidth + gap)

  return (
    <section className="border border-neutral-800 bg-neutral-950/60 p-3">
      <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">
        Adherence by week
      </h2>
      <svg width={chartWidth} height={chartHeight + 30}>
        {byWeek.map((w, i) => {
          const x = i * (barWidth + gap)
          const completedH = (w.completed / maxPrescribed) * chartHeight
          const missedH = (w.missed / maxPrescribed) * chartHeight
          return (
            <g key={w.weekNumber}>
              <rect
                x={x} y={chartHeight - completedH - missedH}
                width={barWidth} height={missedH}
                className="fill-neutral-700"
              />
              <rect
                x={x} y={chartHeight - completedH}
                width={barWidth} height={completedH}
                className="fill-emerald-600"
              />
              <text
                x={x + barWidth / 2} y={chartHeight + 12}
                textAnchor="middle"
                className="fill-neutral-400 text-[10px] font-mono"
              >
                W{w.weekNumber}
              </text>
              <text
                x={x + barWidth / 2} y={chartHeight + 24}
                textAnchor="middle"
                className="fill-neutral-500 text-[9px] font-mono"
              >
                {w.pct}%
              </text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}
