import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLatestBlockRetrospective } from '@/lib/actions/block-retrospective.actions'
import { getPendingPlannerNotes } from '@/lib/actions/pending-notes.actions'
import { findOrphanBlock } from '@/lib/engine/mesocycle/find-orphan'
import { BlockCreationWizard } from '@/components/wizard/BlockCreationWizard'

export const dynamic = 'force-dynamic'
// Block-2 wizard fans out 6 parallel AI generations (one per week) plus a
// head-coach pass. Pin to the Hobby-plan ceiling — with the loop now
// parallelized the wall time should be ~60-90s, but headroom helps.
export const maxDuration = 300

export default async function NewBlockPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [retroResult, notesResult, orphanResult] = await Promise.all([
    getLatestBlockRetrospective(),
    getPendingPlannerNotes(),
    findOrphanBlock(),
  ])

  const retrospective = retroResult.success ? retroResult.data : null
  const pendingNotes = notesResult.success ? notesResult.data : null
  const orphan = orphanResult.success ? orphanResult.data : null

  return (
    <div className="min-h-screen bg-neutral-950 py-10">
      <BlockCreationWizard
        retrospective={retrospective}
        pendingNotes={pendingNotes}
        orphan={orphan}
      />
    </div>
  )
}
