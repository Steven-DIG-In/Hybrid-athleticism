import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getBlockRetrospective } from '@/lib/actions/block-retrospective.actions'
import { getPendingPlannerNotes } from '@/lib/actions/pending-notes.actions'
import { RealityCheckPageClient } from './RealityCheckPageClient'

export default async function Page({ params }: { params: Promise<{ mesocycleId: string }> }) {
  const { mesocycleId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const [retroResult, profileQuery, notesResult] = await Promise.all([
    getBlockRetrospective(mesocycleId),
    supabase
      .from('profiles')
      .select('available_days, session_duration_minutes')
      .eq('id', user.id)
      .maybeSingle(),
    getPendingPlannerNotes(),
  ])

  if (!retroResult.success || !retroResult.data) notFound()
  const snapshot = retroResult.data

  const profile = profileQuery.data
  const defaults = {
    daysPerWeek: profile?.available_days ?? 5,
    sessionMinutes: profile?.session_duration_minutes ?? 60,
    warmupMinutes: 0,   // not yet captured at profile level
    cooldownMinutes: 0,
  }
  const prefill = notesResult.success && notesResult.data?.availability
    ? { ...notesResult.data.availability, freeText: notesResult.data.freeText }
    : undefined

  return (
    <div className="space-y-3 p-4 max-w-md mx-auto">
      <Link
        href={`/data/blocks/${mesocycleId}/retrospective`}
        className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" /> Skip to retrospective
      </Link>

      <header className="border-b border-neutral-800 pb-3 mb-2">
        <h1 className="text-lg font-space-grotesk font-bold text-white tracking-tight">
          Quick reality check
        </h1>
        <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-1">
          {snapshot.block.name}
        </p>
      </header>

      <div className="border border-neutral-800 bg-neutral-950/60 p-3 mb-3">
        <p className="text-[12px] font-inter text-neutral-300">
          Last block: {snapshot.adherence.overall.completed}/{snapshot.adherence.overall.prescribed} sessions
          ({snapshot.adherence.overall.pct}%). Setting was {defaults.daysPerWeek} days/week × {defaults.sessionMinutes} min.
          What was real?
        </p>
      </div>

      <RealityCheckPageClient
        mesocycleId={mesocycleId}
        defaults={defaults}
        prefill={prefill}
      />
    </div>
  )
}
