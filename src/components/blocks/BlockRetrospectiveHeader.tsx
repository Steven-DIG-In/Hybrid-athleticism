import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

export function BlockRetrospectiveHeader({ block }: { block: BlockRetrospectiveSnapshot['block'] }) {
  const fmt = (d: string) => format(new Date(d), 'MMM d, yyyy', { locale: enUS })
  return (
    <header className="border-b border-neutral-800 pb-3 mb-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-space-grotesk font-bold text-white tracking-tight">
          {block.name}
        </h1>
        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/70 px-2 py-0.5 border border-amber-500/30 rounded-sm">
          {block.goal}
        </span>
      </div>
      <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-1">
        {fmt(block.startDate)} → {fmt(block.endDate)} · {block.weekCount} weeks · closed {fmt(block.closedAt)}
      </p>
    </header>
  )
}
