// src/components/data/overview/CoachPromptsInbox.tsx
import Link from 'next/link'
import { Inbox, AlertTriangle } from 'lucide-react'

type Intervention = {
  id: string
  coach_domain: string
  trigger_type: string
  rationale: string
  created_at: string
  needs_retry?: boolean
}

export function CoachPromptsInbox({ interventions }: { interventions: Intervention[] }) {
  const unread = interventions.length
  return (
    <Link href="/coach" className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-amber-900">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-space-grotesk text-neutral-200 flex items-center gap-2">
          <Inbox className="w-4 h-4 text-amber-600" /> Coach inbox
        </h3>
        <span className="text-xs text-neutral-500">{unread} pending</span>
      </div>
      {unread === 0 ? (
        <div className="text-xs text-neutral-500">All reviewed.</div>
      ) : (
        <ul className="space-y-1.5 text-xs text-neutral-400">
          {interventions.slice(0, 3).map(i => (
            <li key={i.id} className="flex items-start gap-1.5">
              {i.needs_retry && <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5" />}
              <span className="line-clamp-1">{i.coach_domain} · {i.rationale}</span>
            </li>
          ))}
          {unread > 3 && <li className="text-neutral-600">+ {unread - 3} more</li>}
        </ul>
      )}
      <div className="text-xs text-neutral-600 mt-3">Review in Coach tab (under repair)</div>
    </Link>
  )
}
