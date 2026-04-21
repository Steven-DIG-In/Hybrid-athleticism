'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  confirmPanel,
  rejectAndRetry,
} from '@/lib/actions/health/lab-upload.actions'

type Marker = {
  id: string
  name_en: string
  name_original: string | null
  value: number | null
  unit: string | null
  reference_range_low: number | null
  reference_range_high: number | null
  is_out_of_range: boolean | null
  confidence: string | null
  status: string
  notes: string | null
}

type Panel = {
  id: string
  panel_date: string
  lab_name: string | null
}

type EditPatch = Partial<{
  value: number | null
  unit: string | null
  name_en: string
  reference_range_low: number | null
  reference_range_high: number | null
}>

function isFlagged(m: Marker): boolean {
  return m.value == null || m.unit == null || m.confidence === 'low'
}

export function LabReviewTable({
  panel,
  markers,
}: {
  panel: Panel
  markers: Marker[]
}) {
  const router = useRouter()
  const [edits, setEdits] = useState<Record<string, EditPatch>>({})
  const [submitting, setSubmitting] = useState(false)

  function editMarker(id: string, patch: EditPatch) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function accept(action: 'all' | 'except_flagged') {
    setSubmitting(true)
    const res = await confirmPanel(panel.id, action, edits)
    setSubmitting(false)
    if (res.ok) router.push(`/data/health/bloodwork/${panel.id}`)
  }

  async function reject() {
    setSubmitting(true)
    await rejectAndRetry(panel.id)
    setSubmitting(false)
    router.push('/data/health/bloodwork/upload')
  }

  const oorCount = markers.filter((m) => m.is_out_of_range).length

  return (
    <div className="p-4 space-y-3">
      <div>
        <h1 className="text-xl font-space-grotesk">Review extracted panel</h1>
        <div className="text-sm text-neutral-400">
          {panel.panel_date} · {panel.lab_name ?? '—'} · {markers.length} markers · {oorCount} out of range
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => accept('all')}
          disabled={submitting}
          className="px-3 py-2 text-sm bg-amber-900/50 border border-amber-800 rounded disabled:opacity-50"
        >
          Accept all
        </button>
        <button
          onClick={() => accept('except_flagged')}
          disabled={submitting}
          className="px-3 py-2 text-sm border border-neutral-800 rounded disabled:opacity-50"
        >
          Accept all except flagged
        </button>
        <button
          onClick={reject}
          disabled={submitting}
          className="px-3 py-2 text-sm border border-red-900 text-red-400 rounded disabled:opacity-50"
        >
          Reject and retry
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-neutral-500 text-left">
              <th className="py-1">Marker</th>
              <th>Value</th>
              <th>Unit</th>
              <th>Low</th>
              <th>High</th>
              <th>OOR</th>
              <th>Conf</th>
            </tr>
          </thead>
          <tbody>
            {markers.map((m) => {
              const e = edits[m.id] ?? {}
              const merged: Marker = { ...m, ...e }
              const flagged = isFlagged(merged)
              return (
                <tr
                  key={m.id}
                  className={`border-t border-neutral-900 ${flagged ? 'bg-amber-950/20' : ''}`}
                >
                  <td className="py-1">
                    <input
                      value={e.name_en ?? m.name_en}
                      onChange={(ev) =>
                        editMarker(m.id, { name_en: ev.target.value })
                      }
                      className="bg-transparent w-full"
                    />
                    {m.name_original && (
                      <div className="text-[10px] text-neutral-600">
                        {m.name_original}
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      value={e.value ?? m.value ?? ''}
                      onChange={(ev) =>
                        editMarker(m.id, {
                          value: ev.target.value
                            ? Number(ev.target.value)
                            : null,
                        })
                      }
                      className="bg-transparent w-16 text-right"
                    />
                  </td>
                  <td>
                    <input
                      value={e.unit ?? m.unit ?? ''}
                      onChange={(ev) =>
                        editMarker(m.id, { unit: ev.target.value })
                      }
                      className="bg-transparent w-14"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={
                        e.reference_range_low ?? m.reference_range_low ?? ''
                      }
                      onChange={(ev) =>
                        editMarker(m.id, {
                          reference_range_low: ev.target.value
                            ? Number(ev.target.value)
                            : null,
                        })
                      }
                      className="bg-transparent w-14 text-right"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={
                        e.reference_range_high ?? m.reference_range_high ?? ''
                      }
                      onChange={(ev) =>
                        editMarker(m.id, {
                          reference_range_high: ev.target.value
                            ? Number(ev.target.value)
                            : null,
                        })
                      }
                      className="bg-transparent w-14 text-right"
                    />
                  </td>
                  <td className="text-center">
                    {m.is_out_of_range ? '✓' : ''}
                  </td>
                  <td className="text-center text-[10px]">{m.confidence}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
