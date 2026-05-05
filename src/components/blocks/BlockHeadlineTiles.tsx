import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

function adherenceColor(pct: number): string {
  if (pct >= 75) return 'text-emerald-400'
  if (pct >= 60) return 'text-neutral-200'
  return 'text-amber-400'
}

function Tile({ label, value, sub, valueClass }: {
  label: string; value: string; sub: string; valueClass?: string
}) {
  return (
    <div className="border border-neutral-800 bg-neutral-950/60 p-3">
      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-space-grotesk font-bold mt-1 ${valueClass ?? 'text-white'}`}>{value}</p>
      <p className="text-[11px] font-inter text-neutral-500 mt-0.5">{sub}</p>
    </div>
  )
}

export function BlockHeadlineTiles({ snapshot }: { snapshot: BlockRetrospectiveSnapshot }) {
  const a = snapshot.adherence.overall

  let driftNum = 0
  let driftDen = 0
  for (const d of Object.values(snapshot.executionQuality.byCoachDomain)) {
    driftNum += d.meanDeltaPct * d.sessionsWithDeltas
    driftDen += d.sessionsWithDeltas
  }
  const meanDrift = driftDen === 0 ? null : Math.round((driftNum / driftDen) * 10) / 10

  const recals = snapshot.recalibrations.length
  const interventions = snapshot.interventions
  const reviewed = interventions.filter(i => i.userResponse !== null).length
  const acceptanceRate = interventions.length === 0
    ? null
    : Math.round((reviewed / interventions.length) * 100)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Tile
        label="Adherence"
        value={`${a.completed} / ${a.prescribed}`}
        sub={`${a.pct}% completed`}
        valueClass={adherenceColor(a.pct)}
      />
      <Tile
        label="Mean drift"
        value={meanDrift == null ? '—' : `${meanDrift > 0 ? '+' : ''}${meanDrift}%`}
        sub="weight prescribed vs lifted"
      />
      <Tile
        label="Recalibrations"
        value={String(recals)}
        sub="training-max changes"
      />
      <Tile
        label="Interventions"
        value={String(interventions.length)}
        sub={acceptanceRate == null ? 'no interventions' : `${acceptanceRate}% reviewed`}
      />
    </div>
  )
}
