import Link from 'next/link'
import type { OffPlanTally as Tally } from '@/lib/analytics/off-plan-tally'

export function OffPlanTally({ tally }: { tally: Tally }) {
  return (
    <Link href="/data/overview/off-plan" className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-amber-900">
      <h3 className="text-sm font-space-grotesk text-neutral-200 mb-2">Off-plan sessions</h3>
      <div className="text-2xl font-space-grotesk text-amber-500">{tally.total}</div>
      <div className="text-xs text-neutral-500 mt-2">
        {Object.entries(tally.byModality).map(([m, v]) =>
          <div key={m}>{m}: {v.count} ({v.countTowardLoad} count toward load)</div>
        )}
      </div>
    </Link>
  )
}
