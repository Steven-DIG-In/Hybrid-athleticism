'use client'
import { useState } from 'react'
import { addMedicalEvent, type MedicalEventType } from '@/lib/actions/health/medicals.actions'
import { useRouter } from 'next/navigation'

const EVENT_TYPES: MedicalEventType[] = ['injury', 'diagnosis', 'surgery', 'medication_change', 'lab_test', 'other']

export function MedicalEventForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [eventType, setEventType] = useState<MedicalEventType>('injury')
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10))
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [structuredJson, setStructuredJson] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    let structured: Record<string, unknown> | null = null
    if (structuredJson.trim()) {
      try { structured = JSON.parse(structuredJson) }
      catch { setSubmitting(false); return alert('Invalid JSON in structured data') }
    }
    const res = await addMedicalEvent({
      event_type: eventType, event_date: eventDate, title,
      details: details || null, structured_data: structured,
    })
    setSubmitting(false)
    if (res.ok) { onDone(); router.refresh() }
  }

  return (
    <div className="p-3 border border-neutral-800 rounded space-y-2 bg-neutral-950">
      <select value={eventType} onChange={e => setEventType(e.target.value as MedicalEventType)} className="w-full bg-neutral-900 p-2 rounded text-sm">
        {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full bg-neutral-900 p-2 rounded text-sm" />
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full bg-neutral-900 p-2 rounded text-sm" />
      <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Details" className="w-full bg-neutral-900 p-2 rounded text-sm h-20" />
      {eventType === 'lab_test' && (
        <textarea
          value={structuredJson}
          onChange={e => setStructuredJson(e.target.value)}
          placeholder='Structured data (JSON) e.g. {"protocol":"Bruce","vo2_max_ml_kg_min":58.2}'
          className="w-full bg-neutral-900 p-2 rounded text-xs h-16 font-mono" />
      )}
      <div className="flex gap-2">
        <button onClick={submit} disabled={submitting || !title} className="px-3 py-1 text-sm bg-amber-900/50 border border-amber-800 rounded">Save</button>
        <button onClick={onDone} className="px-3 py-1 text-sm border border-neutral-800 rounded">Cancel</button>
      </div>
    </div>
  )
}
