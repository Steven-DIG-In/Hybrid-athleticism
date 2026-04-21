import Link from 'next/link'
import type { HeatmapCell } from '@/lib/analytics/block-adherence'

const stateColors: Record<HeatmapCell['state'], string> = {
  on_track: 'bg-emerald-900',
  off_track: 'bg-amber-700',
  missed: 'bg-red-900',
  pending: 'bg-neutral-800',
}

export function BlockAdherenceHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const maxDay = Math.max(0, ...cells.map(c => c.training_day))
  const days = Array.from({ length: maxDay }, (_, i) => i + 1)
  const slots = [1, 2] // AM, PM
  return (
    <Link href="/data/overview/adherence" className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-amber-900">
      <h3 className="text-sm font-space-grotesk text-neutral-200 mb-3">Block Adherence</h3>
      {cells.length === 0 ? (
        <div className="text-xs text-neutral-500">Complete your first session to see adherence signal.</div>
      ) : (
        <div className="space-y-1">
          {slots.map(slot => (
            <div key={slot} className="flex gap-1">
              {days.map(day => {
                const c = cells.find(x => x.training_day === day && x.session_slot === slot)
                return (
                  <div key={`${day}-${slot}`} className={`w-3 h-3 rounded-sm ${c ? stateColors[c.state] : 'bg-transparent'}`}
                    title={c ? `Day ${day} slot ${slot}: ${c.state}` : ''} />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}
