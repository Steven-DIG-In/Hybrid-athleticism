'use client'
import { useState } from 'react'
import { BodyCompForm } from './BodyCompForm'
import { Plus } from 'lucide-react'

type Row = {
  id: string; measured_on: string; method: string;
  weight_kg: number | null; body_fat_pct: number | null; lean_mass_kg: number | null;
}

export function BodyCompList({ rows }: { rows: Row[] }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk">Body Composition</h1>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-sm text-amber-500">
          <Plus className="w-4 h-4" /> Add measurement
        </button>
      </div>
      {adding && <BodyCompForm onDone={() => setAdding(false)} />}
      <table className="w-full text-sm">
        <thead><tr className="text-neutral-500 text-xs">
          <th className="text-left py-1">Date</th><th className="text-left py-1">Method</th>
          <th className="text-left py-1">Weight (kg)</th><th className="text-left py-1">Body Fat %</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t border-neutral-900">
              <td className="py-1">{r.measured_on}</td>
              <td className="py-1">{r.method}</td>
              <td className="py-1">{r.weight_kg ?? '—'}</td>
              <td className="py-1">{r.body_fat_pct ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
