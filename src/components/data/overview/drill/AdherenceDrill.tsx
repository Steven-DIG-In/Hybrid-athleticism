import type { HeatmapCell } from '@/lib/analytics/block-adherence'

export function AdherenceDrill({ cells }: { cells: HeatmapCell[] }) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-space-grotesk mb-4">Block adherence</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-neutral-500">
          <th className="text-left">Day</th><th>Slot</th><th>State</th><th className="text-right">Delta mag (%)</th>
        </tr></thead>
        <tbody>
          {cells.map(c => (
            <tr key={`${c.training_day}-${c.session_slot}`} className="border-t border-neutral-900">
              <td className="py-1">{c.training_day}</td>
              <td className="text-center">{c.session_slot === 1 ? 'AM' : 'PM'}</td>
              <td className="text-center">{c.state}</td>
              <td className="text-right">{c.delta_magnitude_pct?.toFixed(1) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
