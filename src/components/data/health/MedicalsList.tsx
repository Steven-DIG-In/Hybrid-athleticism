'use client'
import { useState } from 'react'
import { MedicalEventForm } from './MedicalEventForm'
import { Plus } from 'lucide-react'

type Event = {
  id: string; event_type: string; event_date: string; title: string;
  details: string | null; structured_data: Record<string, unknown> | null;
}

export function MedicalsList({ events }: { events: Event[] }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk">Medicals</h1>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-sm text-amber-500">
          <Plus className="w-4 h-4" /> Add event
        </button>
      </div>
      {adding && <MedicalEventForm onDone={() => setAdding(false)} />}
      {events.map(e => (
        <div key={e.id} className="p-3 border border-neutral-800 rounded">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">{e.event_type}</span>
            <span className="text-xs text-neutral-500">{e.event_date}</span>
          </div>
          <div className="text-neutral-100">{e.title}</div>
          {e.details && <div className="text-xs text-neutral-400 mt-1">{e.details}</div>}
          {e.structured_data && (
            <pre className="text-xs text-neutral-500 mt-1">{JSON.stringify(e.structured_data, null, 2)}</pre>
          )}
        </div>
      ))}
    </div>
  )
}
