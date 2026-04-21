'use client'
import { useState } from 'react'
import { addPanelManual } from '@/lib/actions/health/bloodwork.actions'
import { type MarkerInput } from '@/lib/actions/health/bloodwork.helpers'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash, Upload } from 'lucide-react'

export function BloodworkManualForm() {
  const router = useRouter()
  const [panelDate, setPanelDate] = useState(new Date().toISOString().slice(0, 10))
  const [labName, setLabName] = useState('')
  const [markers, setMarkers] = useState<MarkerInput[]>([
    { name_en: '', value: null, unit: '', ref_low: null, ref_high: null },
  ])
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateMarker(i: number, patch: Partial<MarkerInput>) {
    setMarkers(ms => ms.map((m, idx) => idx === i ? { ...m, ...patch } : m))
  }
  function addMarker() {
    setMarkers(ms => [...ms, { name_en: '', value: null, unit: '', ref_low: null, ref_high: null }])
  }
  function removeMarker(i: number) {
    setMarkers(ms => ms.filter((_, idx) => idx !== i))
  }

  async function uploadPdf(): Promise<string | null> {
    if (!pdfFile) return null
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const ext = pdfFile.name.split('.').pop() || 'pdf'
    const path = `${user.id}/${panelDate}-${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('lab-reports')
      .upload(path, pdfFile, { contentType: pdfFile.type || 'application/pdf' })
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
    return path
  }

  async function submit() {
    setError(null)
    setSubmitting(true)
    try {
      const original_file_path = await uploadPdf()
      const res = await addPanelManual({
        panel_date: panelDate,
        lab_name: labName || null,
        markers: markers.filter(m => m.name_en.trim()),
        original_file_path,
      })
      if (res.ok) {
        router.push(`/data/health/bloodwork/${res.id}`)
      } else {
        setError(res.error ?? 'Unknown error')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-space-grotesk">Enter panel manually</h1>
      <div className="flex gap-2">
        <input type="date" value={panelDate} onChange={e => setPanelDate(e.target.value)} className="bg-neutral-900 p-2 rounded text-sm" />
        <input value={labName} onChange={e => setLabName(e.target.value)} placeholder="Lab name" className="bg-neutral-900 p-2 rounded text-sm flex-1" />
      </div>

      <label className="flex items-center gap-2 p-3 border border-dashed border-neutral-700 rounded text-xs text-neutral-400 hover:border-amber-800 cursor-pointer">
        <Upload className="w-4 h-4 text-amber-600" />
        {pdfFile ? (
          <span className="flex-1 truncate">{pdfFile.name}</span>
        ) : (
          <span className="flex-1">Attach panel PDF (optional, reference only)</span>
        )}
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
        />
        {pdfFile && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setPdfFile(null) }}
            className="text-neutral-500 hover:text-red-500"
            aria-label="Clear file"
          >
            <Trash className="w-3 h-3" />
          </button>
        )}
      </label>

      <div className="space-y-1">
        {markers.map((m, i) => (
          <div key={i} className="grid grid-cols-12 gap-1 items-center">
            <input value={m.name_en} onChange={e => updateMarker(i, { name_en: e.target.value })} placeholder="Marker" className="col-span-4 bg-neutral-900 p-2 rounded text-xs" />
            <input value={m.value ?? ''} onChange={e => updateMarker(i, { value: e.target.value ? Number(e.target.value) : null })} placeholder="Value" className="col-span-2 bg-neutral-900 p-2 rounded text-xs" />
            <input value={m.unit ?? ''} onChange={e => updateMarker(i, { unit: e.target.value })} placeholder="Unit" className="col-span-2 bg-neutral-900 p-2 rounded text-xs" />
            <input value={m.ref_low ?? ''} onChange={e => updateMarker(i, { ref_low: e.target.value ? Number(e.target.value) : null })} placeholder="Low" className="col-span-1 bg-neutral-900 p-2 rounded text-xs" />
            <input value={m.ref_high ?? ''} onChange={e => updateMarker(i, { ref_high: e.target.value ? Number(e.target.value) : null })} placeholder="High" className="col-span-1 bg-neutral-900 p-2 rounded text-xs" />
            <button onClick={() => removeMarker(i)} className="col-span-1 text-neutral-500 hover:text-red-500">
              <Trash className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addMarker} className="inline-flex items-center gap-1 text-sm text-amber-500">
        <Plus className="w-4 h-4" /> Add marker
      </button>
      {error && <div className="text-xs text-red-500">{error}</div>}
      <div>
        <button
          onClick={submit}
          disabled={submitting}
          className="px-3 py-2 text-sm bg-amber-900/50 border border-amber-800 rounded disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save panel'}
        </button>
      </div>
    </div>
  )
}
