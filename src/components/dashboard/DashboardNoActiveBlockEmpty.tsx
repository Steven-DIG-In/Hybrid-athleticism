import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getLatestBlockRetrospective } from '@/lib/actions/block-retrospective.actions'

export async function DashboardNoActiveBlockEmpty() {
  const result = await getLatestBlockRetrospective()
  const lastBlock = result.success ? result.data : null

  return (
    <div className="max-w-md mx-auto mt-12 space-y-3 text-center">
      <h2 className="text-lg font-space-grotesk font-bold text-white">
        No active block
      </h2>
      {lastBlock ? (
        <p className="text-[12px] font-inter text-neutral-400">
          {lastBlock.block.name} closed —{' '}
          {lastBlock.adherence.overall.completed}/{lastBlock.adherence.overall.prescribed} sessions
          ({lastBlock.adherence.overall.pct}%).
        </p>
      ) : (
        <p className="text-[12px] font-inter text-neutral-400">
          You haven&apos;t closed any blocks yet.
        </p>
      )}

      <div className="flex flex-col gap-2 mt-4">
        {lastBlock && (
          <Link
            href={`/data/blocks/${lastBlock.block.id}/retrospective`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-neutral-700 hover:border-neutral-500 text-[12px] font-mono text-neutral-300 hover:text-white uppercase tracking-wider transition-colors"
          >
            Review last block
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
        <Link
          href="/data/blocks/new"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[12px] font-mono font-bold uppercase tracking-wider"
        >
          Start next block
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
