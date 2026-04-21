'use client'
import { useState } from 'react'
import { addSupplement } from '@/lib/actions/health/supplements.actions'
import { useRouter } from 'next/navigation'

export function SupplementForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [doseUnit, setDoseUnit] = useState('mg')
  const [timingAM, setTimingAM] = useState(false)
  const [timingPM, setTimingPM] = useState(false)
  const [timingMeal, setTimingMeal] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    const timing = [
      timingAM && 'am', timingPM && 'pm', timingMeal && 'with_meal'
    ].filter(Boolean) as string[]
    const res = await addSupplement({
      name, dose: dose ? Number(dose) : null, dose_unit: doseUnit,
      timing, start_date: startDate,
    })
    setSubmitting(false)
    if (res.ok) { onDone(); router.refresh() }
  }

  return (
    <div className="p-3 border border-neutral-800 rounded space-y-2 bg-neutral-950">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g., Vitamin D3)" className="w-full bg-neutral-900 p-2 rounded text-sm" />
      <div className="flex gap-2">
        <input value={dose} onChange={e => setDose(e.target.value)} placeholder="Dose" className="w-1/2 bg-neutral-900 p-2 rounded text-sm" />
        <input value={doseUnit} onChange={e => setDoseUnit(e.target.value)} placeholder="Unit" className="w-1/2 bg-neutral-900 p-2 rounded text-sm" />
      </div>
      <div className="flex gap-4 text-sm">
        <label><input type="checkbox" checked={timingAM} onChange={e => setTimingAM(e.target.checked)} /> AM</label>
        <label><input type="checkbox" checked={timingPM} onChange={e => setTimingPM(e.target.checked)} /> PM</label>
        <label><input type="checkbox" checked={timingMeal} onChange={e => setTimingMeal(e.target.checked)} /> With meal</label>
      </div>
      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-neutral-900 p-2 rounded text-sm" />
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={submitting || !name}
          className="px-3 py-1 text-sm bg-amber-900/50 border border-amber-800 rounded">Save</button>
        <button onClick={onDone} className="px-3 py-1 text-sm border border-neutral-800 rounded">Cancel</button>
      </div>
    </div>
  )
}
