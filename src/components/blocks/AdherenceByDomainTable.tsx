import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'
import { COACH_DOMAINS } from '@/lib/types/block-retrospective.types'

const DOMAIN_LABEL: Record<string, string> = {
  strength: 'Strength', hypertrophy: 'Hypertrophy',
  endurance: 'Endurance', conditioning: 'Conditioning',
  mobility: 'Mobility', recovery: 'Recovery',
}

export function AdherenceByDomainTable({ snapshot }: { snapshot: BlockRetrospectiveSnapshot }) {
  return (
    <section className="border border-neutral-800 bg-neutral-950/60 p-3">
      <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">
        By coach domain
      </h2>
      <table className="w-full text-[12px] font-inter">
        <thead>
          <tr className="text-neutral-500 text-[10px] font-mono uppercase tracking-wider border-b border-neutral-800">
            <th className="text-left py-1.5 pr-2">Domain</th>
            <th className="text-right py-1.5 px-2">Done / Rx</th>
            <th className="text-right py-1.5 px-2">%</th>
            <th className="text-right py-1.5 px-2">Δ%</th>
            <th className="text-right py-1.5 pl-2">Over / On / Under</th>
          </tr>
        </thead>
        <tbody>
          {COACH_DOMAINS.map(d => {
            const a = snapshot.adherence.byCoachDomain[d]
            const e = snapshot.executionQuality.byCoachDomain[d]
            const noSignal = e.sessionsWithDeltas === 0
            const drift = noSignal
              ? '—'
              : `${e.meanDeltaPct > 0 ? '+' : ''}${e.meanDeltaPct}`
            return (
              <tr key={d} className="border-b border-neutral-800/50 last:border-0">
                <td className="text-left py-1.5 pr-2 text-neutral-300">{DOMAIN_LABEL[d]}</td>
                <td className="text-right py-1.5 px-2 font-mono text-neutral-300">
                  {a.completed} / {a.prescribed}
                </td>
                <td className="text-right py-1.5 px-2 font-mono">
                  <span className={a.pct >= 75 ? 'text-emerald-400' : a.pct >= 60 ? 'text-neutral-200' : 'text-amber-400'}>
                    {a.pct}%
                  </span>
                </td>
                <td className="text-right py-1.5 px-2 font-mono text-neutral-400">{drift}</td>
                <td className="text-right py-1.5 pl-2 font-mono text-neutral-400">
                  {noSignal
                    ? '—'
                    : `${e.classificationCounts.over} / ${e.classificationCounts.on} / ${e.classificationCounts.under}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
