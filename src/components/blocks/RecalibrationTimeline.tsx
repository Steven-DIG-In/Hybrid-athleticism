import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { ArrowRight } from 'lucide-react'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

const TRIGGER_LABEL: Record<string, string> = {
  drift_lt_5: 'Drift <5%',
  drift_5_to_10: 'Drift 5-10%',
  drift_gt_10: 'Drift >10%',
  manual: 'Manual',
}

export function RecalibrationTimeline({ recalibrations }: {
  recalibrations: BlockRetrospectiveSnapshot['recalibrations']
}) {
  return (
    <section className="border border-neutral-800 bg-neutral-950/60 p-3">
      <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">
        Recalibrations ({recalibrations.length})
      </h2>
      {recalibrations.length === 0 ? (
        <p className="text-[12px] font-inter text-neutral-500">No recalibrations this block.</p>
      ) : (
        <ul className="space-y-1.5">
          {recalibrations.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-[12px] font-inter">
              <span className="text-[10px] font-mono text-neutral-500 w-20 shrink-0">
                {format(new Date(r.occurredAt), 'MMM d', { locale: enUS })}
              </span>
              <span className="text-neutral-300 w-40 truncate">{r.exerciseName}</span>
              <span className="font-mono text-neutral-400">{r.fromKg}kg</span>
              <ArrowRight className="w-3 h-3 text-neutral-600" />
              <span className="font-mono text-amber-400">{r.toKg}kg</span>
              <span className="text-[10px] font-mono text-neutral-500 ml-auto">
                {TRIGGER_LABEL[r.triggeredBy] ?? r.triggeredBy}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
