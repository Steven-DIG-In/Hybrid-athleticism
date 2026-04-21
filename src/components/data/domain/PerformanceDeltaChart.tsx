// src/components/data/domain/PerformanceDeltaChart.tsx
'use client'
type Point = { date: string; delta_pct: number }
export function PerformanceDeltaChart({ points, title }: { points: Point[]; title: string }) {
  const w = 320, h = 100
  if (points.length === 0) {
    return <div className="p-4 border border-neutral-800 rounded text-xs text-neutral-500">{title}: no deltas yet</div>
  }
  const max = Math.max(20, ...points.map(p => Math.abs(p.delta_pct)))
  const mid = h / 2
  const dx = w / Math.max(1, points.length - 1)
  return (
    <div className="p-4 border border-neutral-800 rounded">
      <h3 className="text-sm font-space-grotesk mb-2">{title}</h3>
      <svg width={w} height={h}>
        <line x1={0} y1={mid} x2={w} y2={mid} stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
        {points.map((p, i) => {
          const x = i * dx
          const y = mid - (p.delta_pct / max) * (mid - 4)
          return <circle key={i} cx={x} cy={y} r={2.5} fill={p.delta_pct > 0 ? '#059669' : '#dc2626'} />
        })}
      </svg>
    </div>
  )
}
