'use client'
import { useState } from 'react'
import { addBodyCompMeasurement } from '@/lib/actions/health/body-comp.actions'
import { useRouter } from 'next/navigation'

export function BodyCompForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [measuredOn, setMeasuredOn] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState<'scale' | 'dexa' | 'caliper' | 'tape'>('scale')
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')

  async function submit() {
    const res = await addBodyCompMeasurement({
      measured_on: measuredOn, method,
      weight_kg: weight ? Number(weight) : null,
      body_fat_pct: bodyFat ? Number(bodyFat) : null,
    })
    if (res.ok) { onDone(); router.refresh() }
  }

  return (
    <div className="p-3 border border-neutral-800 rounded space-y-2 bg-neutral-950">
      <input type="date" value={measuredOn} onChange={e => setMeasuredOn(e.target.value)} className="w-full bg-neutral-900 p-2 rounded text-sm" />
      <select value={method} onChange={e => setMethod(e.target.value as never)} className="w-full bg-neutral-900 p-2 rounded text-sm">
        <option value="scale">Scale</option><option value="dexa">DEXA</option>
        <option value="caliper">Caliper</option><option value="tape">Tape</option>
      </select>
      <div className="flex gap-2">
        <input value={weight} onChange={e => setWeight(e.target.value)} placeholder="Weight (kg)" className="w-1/2 bg-neutral-900 p-2 rounded text-sm" />
        <input value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="Body fat %" className="w-1/2 bg-neutral-900 p-2 rounded text-sm" />
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="px-3 py-1 text-sm bg-amber-900/50 border border-amber-800 rounded">Save</button>
        <button onClick={onDone} className="px-3 py-1 text-sm border border-neutral-800 rounded">Cancel</button>
      </div>
    </div>
  )
}
