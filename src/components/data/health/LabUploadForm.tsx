'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, Loader2 } from 'lucide-react'
import { uploadLabPDF } from '@/lib/actions/health/lab-upload.actions'

export function LabUploadForm() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!file) return
    setUploading(true)
    setError(null)
    const fd = new FormData()
    fd.set('file', file)
    const res = await uploadLabPDF(fd)
    setUploading(false)
    if (res.ok) router.push(`/data/health/bloodwork/${res.panelId}/review`)
    else setError(res.error)
  }

  return (
    <div className="space-y-3 max-w-lg">
      <h1 className="text-xl font-space-grotesk">Upload lab report</h1>
      <label
        onDragOver={(e) => { e.preventDefault() }}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) setFile(f)
        }}
        className="block p-6 border-2 border-dashed border-neutral-800 rounded text-center cursor-pointer hover:border-amber-900 transition-colors"
      >
        <UploadCloud className="w-8 h-8 mx-auto text-neutral-500 mb-2" />
        <div className="text-sm text-neutral-300">
          {file ? file.name : 'Click to choose a PDF or photo, or drop one here'}
        </div>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>
      {error && <div className="text-xs text-amber-500">{error}</div>}
      <button
        onClick={submit}
        disabled={!file || uploading}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-amber-900/50 border border-amber-800 rounded disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {uploading ? 'Extracting...' : 'Upload and extract'}
      </button>
      <p className="text-xs text-neutral-500">
        PDFs and photos supported. Portuguese and English reports both work — values get translated on extraction.
      </p>
    </div>
  )
}
