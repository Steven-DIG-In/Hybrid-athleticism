import Link from 'next/link'
import type { RAG } from '@/lib/analytics/coach-bias'

const ragColor: Record<RAG, string> = {
  red: 'bg-red-900', amber: 'bg-amber-700', green: 'bg-emerald-900',
  insufficient: 'bg-neutral-800',
}

export function CoachBiasTile({ ragByCoach }: { ragByCoach: Record<string, RAG> }) {
  const coaches = ['strength', 'hypertrophy', 'endurance', 'conditioning', 'mobility', 'recovery']
  return (
    <Link href="/data/overview/coach-bias" className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-amber-900">
      <h3 className="text-sm font-space-grotesk text-neutral-200 mb-3">Coach bias</h3>
      <div className="grid grid-cols-3 gap-2">
        {coaches.map(c => (
          <div key={c} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${ragColor[ragByCoach[c] ?? 'insufficient']}`} />
            <span className="text-xs text-neutral-400 capitalize">{c}</span>
          </div>
        ))}
      </div>
    </Link>
  )
}
