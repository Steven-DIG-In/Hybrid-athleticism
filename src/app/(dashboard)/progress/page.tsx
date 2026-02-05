import { createClient } from '@/lib/supabase/server'

export default async function ProgressPage() {
  const supabase = await createClient()
  
  // Get recent exercise history
  const { data: history } = await supabase
    .from('exercise_history')
    .select(`
      *,
      exercises (name, primary_muscles)
    `)
    .order('session_date', { ascending: false })
    .limit(20)

  // Cast to expected type
  type HistoryEntry = {
    id: string
    session_date: string
    best_weight_kg: number | null
    best_reps: number | null
    estimated_1rm: number | null
    exercises: { name: string } | null
  }
  
  const typedHistory = history as HistoryEntry[] | null

  return (
    <div className="p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Progress</h1>
        <p className="text-zinc-500">Track your gains</p>
      </header>

      <div className="bg-zinc-900 rounded-lg p-6 text-center">
        <p className="text-zinc-500 mb-2">Progress tracking coming soon</p>
        <p className="text-sm text-zinc-600">
          View e1RM trends, volume progression, and more.
        </p>
      </div>

      {/* Recent PRs would go here */}
      {typedHistory && typedHistory.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Recent Workouts</h2>
          <div className="space-y-2">
            {typedHistory.slice(0, 5).map((entry) => (
              <div key={entry.id} className="bg-zinc-900 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">
                      {entry.exercises?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-zinc-500">{entry.session_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white">
                      {entry.best_weight_kg}kg × {entry.best_reps}
                    </p>
                    {entry.estimated_1rm && (
                      <p className="text-xs text-zinc-500">
                        e1RM: {Number(entry.estimated_1rm).toFixed(1)}kg
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
