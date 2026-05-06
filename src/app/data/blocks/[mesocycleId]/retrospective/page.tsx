import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getBlockRetrospective } from '@/lib/actions/block-retrospective.actions'
import { BlockRetrospectiveHeader } from '@/components/blocks/BlockRetrospectiveHeader'
import { BlockHeadlineTiles } from '@/components/blocks/BlockHeadlineTiles'
import { AdherenceByWeekChart } from '@/components/blocks/AdherenceByWeekChart'
import { AdherenceByDomainTable } from '@/components/blocks/AdherenceByDomainTable'
import { RecalibrationTimeline } from '@/components/blocks/RecalibrationTimeline'
import { InterventionLog } from '@/components/blocks/InterventionLog'
import { MissedSessionsList } from '@/components/blocks/MissedSessionsList'

export default async function Page({ params }: { params: Promise<{ mesocycleId: string }> }) {
  const { mesocycleId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const result = await getBlockRetrospective(mesocycleId)
  if (!result.success || !result.data) notFound()
  const snapshot = result.data

  return (
    <div className="space-y-3 p-4 max-w-4xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" /> Back to dashboard
      </Link>
      <BlockRetrospectiveHeader block={snapshot.block} />
      <BlockHeadlineTiles snapshot={snapshot} />
      <AdherenceByWeekChart byWeek={snapshot.adherence.byWeek} />
      <AdherenceByDomainTable snapshot={snapshot} />
      <RecalibrationTimeline recalibrations={snapshot.recalibrations} />
      <InterventionLog interventions={snapshot.interventions} />
      <MissedSessionsList missedSessions={snapshot.missedSessions} />
    </div>
  )
}
