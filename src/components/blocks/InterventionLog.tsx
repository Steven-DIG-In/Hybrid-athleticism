import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

const RESPONSE_STYLE: Record<string, string> = {
  keep: 'text-emerald-400 border-emerald-500/30',
  harder: 'text-amber-400 border-amber-500/30',
  recalibrate: 'text-cyan-400 border-cyan-500/30',
}

export function InterventionLog({ interventions }: {
  interventions: BlockRetrospectiveSnapshot['interventions']
}) {
  return (
    <section className="border border-neutral-800 bg-neutral-950/60 p-3">
      <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">
        Interventions ({interventions.length})
      </h2>
      {interventions.length === 0 ? (
        <p className="text-[12px] font-inter text-neutral-500">No interventions logged.</p>
      ) : (
        <ul className="space-y-2">
          {interventions.map(i => {
            const style = i.userResponse ? RESPONSE_STYLE[i.userResponse] ?? '' : 'text-neutral-500 border-neutral-700'
            return (
              <li key={i.id} className="border-l border-neutral-800 pl-2.5">
                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                  <span>{format(new Date(i.occurredAt), 'MMM d', { locale: enUS })}</span>
                  <span>·</span>
                  <span className="text-neutral-400">{i.coachDomain ?? '—'}</span>
                  <span>·</span>
                  <span>{i.triggerType}</span>
                  <span className={`ml-auto px-1.5 py-0.5 border rounded-sm ${style}`}>
                    {i.userResponse ?? 'unreviewed'}
                  </span>
                </div>
                <p className="text-[12px] font-inter text-neutral-300 mt-1">{i.rationale}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
