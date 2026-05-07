'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

export interface RetrospectiveSummaryTileProps {
  retrospective: BlockRetrospectiveSnapshot
}

export function RetrospectiveSummaryTile({ retrospective }: RetrospectiveSummaryTileProps) {
  const { adherence, recalibrations } = retrospective

  // byCoachDomain is a Record<CoachDomain, AdherenceCounts>; iterate via Object.entries
  const byDomainSummary = Object.entries(adherence.byCoachDomain)
    .map(([domain, counts]) => `${domain} ${counts.pct}%`)
    .join(' · ')

  return (
    <section className="border-b border-neutral-800 px-6 py-5">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-2">From {retrospective.block.name}</div>
      <div className="text-[12px] font-inter text-neutral-300">
        {adherence.overall.completed}/{adherence.overall.prescribed} sessions · {adherence.overall.pct}% adherence · {recalibrations.length} recalibrations
      </div>
      <div className="text-[11px] font-inter text-neutral-500 mt-1">{byDomainSummary}</div>
      <Link
        href={`/data/blocks/${retrospective.block.id}/retrospective`}
        className="inline-flex items-center gap-1 mt-2 text-[11px] font-mono text-amber-500 hover:text-amber-400 uppercase tracking-wider"
      >
        Review <ArrowRight className="w-3 h-3" />
      </Link>
    </section>
  )
}
