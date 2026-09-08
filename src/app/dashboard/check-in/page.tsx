import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getDashboardData } from '@/lib/actions/workout.actions'
import { getDueCheckIn } from '@/lib/actions/check-in.actions'
import { CheckInForm } from '@/components/check-in/CheckInForm'

/** Used when the athlete has no muscle_group_config rows (the common case — the table
 *  is empty). A fixed spread beats an empty form; the scorer only ever averages these. */
const DEFAULT_MUSCLE_GROUPS = [
  'Legs', 'Back', 'Chest', 'Shoulders', 'Arms', 'Core',
]

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-4">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Dashboard
        </Link>
      </div>
      {children}
    </div>
  )
}

export default async function CheckInPage() {
  const result = await getDashboardData()

  if (!result.success || !result.data.currentMesocycle || !result.data.currentWeek) {
    return (
      <Shell>
        <div className="p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <h1 className="text-lg font-space-grotesk text-white mb-1">No active week</h1>
          <p className="text-[12px] font-inter text-neutral-500">
            A check-in belongs to a training week. Start a block first.
          </p>
        </div>
      </Shell>
    )
  }

  const mesocycleId = result.data.currentMesocycle.id
  const weekNumber = result.data.currentWeek.week_number
  const dueCheckIn = await getDueCheckIn(mesocycleId, weekNumber)

  if (dueCheckIn?.alreadyReported) {
    return (
      <Shell>
        <div className="border border-[#222] bg-[#080808] p-6 text-center">
          <h1 className="text-lg font-space-grotesk text-white mb-1">
            Week {weekNumber} already checked in
          </h1>
          <p className="text-[12px] font-inter text-neutral-500">
            Your report is in and the coaching cycle has run for this week.
          </p>
        </div>
      </Shell>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: configured } = user
    ? await supabase
        .from('muscle_group_config')
        .select('muscle_group')
        .eq('user_id', user.id)
        .order('muscle_group')
    : { data: null }

  const configuredGroups = (configured ?? []).map((r) => r.muscle_group)
  const muscleGroups = configuredGroups.length > 0 ? configuredGroups : DEFAULT_MUSCLE_GROUPS

  return (
    <Shell>
      <div>
        <h1 className="text-xl font-space-grotesk font-bold text-white tracking-tight">
          Week {weekNumber} check-in
        </h1>
        <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-1">
          {result.data.currentMesocycle.name}
        </p>
        <p className="text-[12px] font-inter text-neutral-400 mt-2">
          Two minutes. This is the half of your recovery score the app cannot measure
          from your logged sets.
        </p>
      </div>

      <CheckInForm
        mesocycleId={mesocycleId}
        weekNumber={weekNumber}
        muscleGroups={muscleGroups}
      />
    </Shell>
  )
}
