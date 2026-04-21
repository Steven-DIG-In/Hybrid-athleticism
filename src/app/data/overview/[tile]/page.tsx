import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { currentBlockHeatmap } from '@/lib/analytics/block-adherence'
import { allCoachesRAG } from '@/lib/analytics/coach-bias'
import { currentBlockTally } from '@/lib/analytics/off-plan-tally'
import { AdherenceDrill } from '@/components/data/overview/drill/AdherenceDrill'
import { CoachBiasDrill } from '@/components/data/overview/drill/CoachBiasDrill'
import { OffPlanDrill } from '@/components/data/overview/drill/OffPlanDrill'

function DrillShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <Link
        href="/data"
        className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" /> Back to overview
      </Link>
      {children}
    </div>
  )
}

export default async function Page({ params }: { params: Promise<{ tile: string }> }) {
  const { tile } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  if (tile === 'adherence') {
    // currentBlockHeatmap needs (mesocycleId, weekNumber). Derive from block_pointer
    // for the active mesocycle; fall back to empty heatmap if no active block exists.
    const { data: activeMesocycle } = await supabase
      .from('mesocycles').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!activeMesocycle) return <DrillShell><AdherenceDrill cells={[]} /></DrillShell>
    const { data: pointer } = await supabase
      .from('block_pointer')
      .select('week_number')
      .eq('user_id', user.id)
      .eq('mesocycle_id', activeMesocycle.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const weekNumber = pointer?.week_number ?? 1
    const cells = await currentBlockHeatmap(user.id, activeMesocycle.id, weekNumber)
    return <DrillShell><AdherenceDrill cells={cells} /></DrillShell>
  }
  if (tile === 'coach-bias') {
    const rag = await allCoachesRAG(user.id)
    return <DrillShell><CoachBiasDrill ragByCoach={rag} /></DrillShell>
  }
  if (tile === 'off-plan') {
    const { data: activeMesocycle } = await supabase
      .from('mesocycles').select('start_date').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    const tally = activeMesocycle
      ? await currentBlockTally(user.id, activeMesocycle.start_date)
      : { total: 0, byModality: {} }
    const { data: rows } = await supabase
      .from('off_plan_sessions').select('*')
      .eq('user_id', user.id).order('logged_at', { ascending: false }).limit(50)
    return <DrillShell><OffPlanDrill rows={rows ?? []} /></DrillShell>
  }
  // coach-prompts handled by /coach; redirect
  if (tile === 'coach-prompts') redirect('/coach')
  notFound()
}
