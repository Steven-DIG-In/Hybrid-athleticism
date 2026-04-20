# Metrics Dashboard — Auto-Ingestion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual entry paths for bloodwork and Garmin with automated ingestion. Upload a Portuguese (or any language) lab PDF → Claude Haiku 4.5 extracts and translates marker values → user reviews and confirms → saves to `lab_panels` + `lab_markers`. Connect Garmin via an unofficial JS client → daily cron pulls sleep / HRV / RHR / VO2 / body battery / stress into `garmin_daily` + `garmin_vo2_trend`.

**Architecture:** Two ingestion pipelines.
- **Lab PDF:** Server Action uploads to Supabase Storage bucket `lab-reports`, inserts `lab_panels` row with `status='pending_extraction'`, fires off extraction server-side using Claude Haiku 4.5. Structured JSON response (Zod-validated) writes per-marker rows with `status='needs_review'`. User reviews on `/data/health/bloodwork/[id]/review`, confirms / edits / rejects, then markers move to `status='confirmed'` and panel to `status='ready'`.
- **Garmin:** `/data/health/garmin/connect` form collects credentials → stored via Supabase Vault (`vault.secrets`). Session token cached in `garmin_credentials.session_token_encrypted`. Vercel Cron hits `/api/cron/garmin-sync` at 07:00 UTC daily, iterates users with active credentials, upserts dailies. MFA prompt handled inline during initial connect (secondary POST with TOTP). Manual "resync now" button on subpage.

**Tech Stack:** Claude Haiku 4.5 via existing `@anthropic-ai/sdk`, `garmin-connect` npm client (new), Zod for schema validation, Vercel Cron (configured in `vercel.json`).

**Spec reference:** `docs/superpowers/specs/2026-04-20-metrics-dashboard-health-extension-design.md`

**Hard dependency:** Plan 2 must be merged — requires `lab_panels`, `lab_markers`, `garmin_credentials`, `garmin_daily`, `garmin_vo2_trend` tables and storage buckets `lab-reports` from migration 016.

> ⚠️ **Next.js 16 reminder:** Read `node_modules/next/dist/docs/` before writing any server/client component or route code.

---

## File Structure

### New files

**Lab ingestion:**
- `src/lib/ingestion/lab-pdf-extractor.ts` — Claude call + Zod schema
- `src/lib/ingestion/__tests__/lab-pdf-extractor.test.ts`
- `src/lib/actions/health/lab-upload.actions.ts` — upload + extract orchestrator + review actions
- `src/app/data/health/bloodwork/upload/page.tsx` — file picker
- `src/app/data/health/bloodwork/[id]/review/page.tsx` — review/confirm screen
- `src/components/data/health/LabUploadForm.tsx`
- `src/components/data/health/LabReviewTable.tsx`

**Garmin ingestion:**
- `src/lib/ingestion/garmin-sync.ts` — client wrapper
- `src/lib/ingestion/__tests__/garmin-sync.test.ts`
- `src/lib/actions/health/garmin.actions.ts` — connect / resync / disconnect
- `src/app/data/health/garmin/connect/page.tsx` — credential form
- `src/app/api/cron/garmin-sync/route.ts` — daily cron handler
- `src/components/data/health/GarminConnectForm.tsx`
- `src/components/data/health/GarminMFAPrompt.tsx`

**Config:**
- `vercel.json` — cron entry (create if missing, else edit)

### Modified files

- `package.json` — add `garmin-connect`
- `src/components/data/health/GarminDisplay.tsx` — enable "Connect" link, "Resync now" button
- `src/app/data/health/bloodwork/page.tsx` — upload CTA becomes active

---

## Task 1: Verify Plan 2 tables + buckets present

**Files:**
- Read: `supabase/migrations/016_metrics_dashboard.sql`

- [ ] **Step 1: Check schema**

Run:
```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
grep -E "CREATE TABLE (lab_panels|lab_markers|garmin_credentials|garmin_daily|garmin_vo2_trend)" supabase/migrations/*.sql
```
Expected: five matches from migration 016. If missing, halt — ship Plan 2 first.

- [ ] **Step 2: Confirm Storage bucket exists**

Run:
```bash
grep -E "'lab-reports'" supabase/migrations/*.sql
```
Expected: INSERT to `storage.buckets`. If missing, Plan 2 wasn't shipped.

- [ ] **Step 3: No commit — inspection only**

---

## Task 2: Install `garmin-connect` + confirm `@anthropic-ai/sdk`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run:
```bash
npm install garmin-connect
```
Expected: package added.

- [ ] **Step 2: Confirm anthropic SDK present (already used)**

Run:
```bash
grep "@anthropic-ai/sdk" package.json
```
Expected: `"@anthropic-ai/sdk": "^0.78.0"` or newer.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): add garmin-connect for auto-ingestion"
```

---

## Task 3: Lab PDF extractor — Zod schema + Claude call (TDD)

**Files:**
- Create: `src/lib/ingestion/lab-pdf-extractor.ts`
- Create: `src/lib/ingestion/__tests__/lab-pdf-extractor.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ingestion/__tests__/lab-pdf-extractor.test.ts
import { describe, it, expect, vi } from 'vitest'
import { LabExtractionSchema, extractFromBase64 } from '../lab-pdf-extractor'

describe('LabExtractionSchema', () => {
  it('parses a valid extraction payload', () => {
    const parsed = LabExtractionSchema.safeParse({
      document_type: 'lab_report',
      panel_date: '2026-03-15',
      lab_name: 'Synlab',
      markers: [
        {
          name_en: 'Ferritin', name_original: 'Ferritina', value: 12,
          unit: 'ng/mL', reference_range_low: 30, reference_range_high: 400,
          is_out_of_range: true, confidence: 'high', notes: null,
        },
      ],
    })
    expect(parsed.success).toBe(true)
  })
  it('rejects missing panel_date', () => {
    const parsed = LabExtractionSchema.safeParse({
      document_type: 'lab_report', markers: []
    })
    expect(parsed.success).toBe(false)
  })
})

describe('extractFromBase64', () => {
  it('surfaces non-lab_report as error', async () => {
    // Arrange: mock the anthropic client to return non-lab-report
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            document_type: 'other', panel_date: null, markers: [],
          }) }],
        }),
      },
    }
    const res = await extractFromBase64({
      base64: 'abc', mimeType: 'application/pdf', client: fakeClient as any,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not a lab report/i)
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/ingestion/__tests__/lab-pdf-extractor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/ingestion/lab-pdf-extractor.ts
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

export const MarkerSchema = z.object({
  name_en: z.string().min(1),
  name_original: z.string().nullable(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  reference_range_low: z.number().nullable(),
  reference_range_high: z.number().nullable(),
  is_out_of_range: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().nullable(),
})

export const LabExtractionSchema = z.object({
  document_type: z.string(),
  panel_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  lab_name: z.string().nullable().optional(),
  markers: z.array(MarkerSchema),
})

export type LabExtraction = z.infer<typeof LabExtractionSchema>

const SYSTEM_PROMPT = `You extract structured blood-panel data from PDFs or images of lab reports.

Rules:
1. Translate marker names, units, and notes from any language (especially Portuguese) to English. Preserve the original text in name_original.
2. Return ONLY JSON matching this exact shape:
{
  "document_type": "lab_report" | "other",
  "panel_date": "YYYY-MM-DD" | null,
  "lab_name": "string" | null,
  "markers": [
    { "name_en": "...", "name_original": "...", "value": number | null, "unit": "...", "reference_range_low": number | null, "reference_range_high": number | null, "is_out_of_range": true/false, "confidence": "high"|"medium"|"low", "notes": "..." | null }
  ]
}
3. Set document_type = "other" if the PDF is not a lab report.
4. Use confidence = "low" when marker name is ambiguous or value is hard to read.
5. is_out_of_range = value outside the reference range. If no range, use false.
6. No commentary outside the JSON.`

export interface ExtractArgs {
  base64: string
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'
  client?: Anthropic
}

export async function extractFromBase64(
  args: ExtractArgs
): Promise<
  | { ok: true; data: LabExtraction }
  | { ok: false; error: string }
> {
  const client = args.client ?? new Anthropic()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: args.mimeType,
              data: args.base64,
            },
          } as any,
          { type: 'text', text: 'Extract the lab data per the schema.' },
        ],
      },
    ],
  })

  const text = response.content.find((b: any) => b.type === 'text')?.text ?? ''
  let parsed: unknown
  try { parsed = JSON.parse(text) }
  catch { return { ok: false, error: 'Malformed JSON from extractor' } }

  const safe = LabExtractionSchema.safeParse(parsed)
  if (!safe.success) return { ok: false, error: safe.error.message }
  if (safe.data.document_type !== 'lab_report') {
    return { ok: false, error: 'This does not look like a lab report.' }
  }
  if (!safe.data.panel_date) {
    return { ok: false, error: 'Could not extract panel date.' }
  }
  return { ok: true, data: safe.data }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/ingestion/__tests__/lab-pdf-extractor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingestion/lab-pdf-extractor.ts src/lib/ingestion/__tests__/lab-pdf-extractor.test.ts
git commit -m "feat(ingestion): lab PDF extractor (Haiku 4.5 + Zod)"
```

---

## Task 4: Lab upload actions — upload + orchestrate + review (TDD)

**Files:**
- Create: `src/lib/actions/health/lab-upload.actions.ts`
- Create: `src/lib/actions/health/__tests__/lab-upload.actions.test.ts`

- [ ] **Step 1: Write the failing test (pure helpers only)**

```ts
// src/lib/actions/health/__tests__/lab-upload.actions.test.ts
import { describe, it, expect } from 'vitest'
import { classifyNeedsReview } from '../lab-upload.actions'
import type { LabExtraction } from '@/lib/ingestion/lab-pdf-extractor'

describe('classifyNeedsReview', () => {
  it('flags markers with low confidence OR missing unit OR missing value', () => {
    const extraction: LabExtraction = {
      document_type: 'lab_report',
      panel_date: '2026-03-15',
      lab_name: 'Synlab',
      markers: [
        { name_en: 'A', name_original: null, value: 12, unit: 'mg/dL', reference_range_low: 5, reference_range_high: 20, is_out_of_range: false, confidence: 'high', notes: null },
        { name_en: 'B', name_original: null, value: null, unit: 'mg/dL', reference_range_low: 5, reference_range_high: 20, is_out_of_range: false, confidence: 'high', notes: null },
        { name_en: 'C', name_original: null, value: 50, unit: null, reference_range_low: null, reference_range_high: null, is_out_of_range: false, confidence: 'high', notes: null },
        { name_en: 'D', name_original: null, value: 30, unit: 'mg/dL', reference_range_low: 10, reference_range_high: 50, is_out_of_range: false, confidence: 'low', notes: null },
      ],
    }
    const flagged = classifyNeedsReview(extraction.markers)
    expect(flagged.map(m => m.name_en)).toEqual(['B', 'C', 'D'])
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/actions/health/__tests__/lab-upload.actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/actions/health/lab-upload.actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  extractFromBase64, type LabExtraction,
} from '@/lib/ingestion/lab-pdf-extractor'

export function classifyNeedsReview(markers: LabExtraction['markers']) {
  return markers.filter(m => m.value == null || m.unit == null || m.confidence === 'low')
}

export async function uploadLabPDF(
  formData: FormData
): Promise<{ ok: true; panelId: string } | { ok: false; error: string }> {
  const file = formData.get('file') as File
  if (!file) return { ok: false, error: 'No file provided' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  // 1. Upload to storage
  const filePath = `${user.id}/${Date.now()}-${file.name}`
  const bytes = await file.arrayBuffer()
  const { error: upErr } = await supabase.storage
    .from('lab-reports')
    .upload(filePath, bytes, { contentType: file.type })
  if (upErr) return { ok: false, error: upErr.message }

  // 2. Insert panel row with pending_extraction
  const { data: panel, error: insErr } = await supabase.from('lab_panels').insert({
    user_id: user.id,
    panel_date: new Date().toISOString().slice(0, 10), // overwritten by extraction
    status: 'pending_extraction',
    original_file_path: filePath,
  }).select('id').single()
  if (insErr) return { ok: false, error: insErr.message }

  // 3. Fire extraction synchronously (small enough for a Server Action)
  const base64 = Buffer.from(bytes).toString('base64')
  const mime = (file.type === 'application/pdf' ? 'application/pdf' : file.type.startsWith('image/') ? (file.type as any) : 'application/pdf')
  const ext = await extractFromBase64({ base64, mimeType: mime as any })

  if (!ext.ok) {
    await supabase.from('lab_panels').update({ status: 'failed', extraction_json: { error: ext.error } }).eq('id', panel.id)
    return { ok: false, error: ext.error }
  }

  // 4. Update panel and insert markers
  const flaggedNames = new Set(classifyNeedsReview(ext.data.markers).map(m => m.name_en))
  const outOfRangeCount = ext.data.markers.filter(m => m.is_out_of_range).length

  await supabase.from('lab_panels').update({
    panel_date: ext.data.panel_date!,
    lab_name: ext.data.lab_name ?? null,
    status: 'needs_review',
    extraction_json: ext.data as unknown as Record<string, unknown>,
    out_of_range_count: outOfRangeCount,
  }).eq('id', panel.id)

  const markerRows = ext.data.markers.map(m => ({
    panel_id: panel.id,
    user_id: user.id,
    name_en: m.name_en,
    name_original: m.name_original,
    value: m.value,
    unit: m.unit,
    reference_range_low: m.reference_range_low,
    reference_range_high: m.reference_range_high,
    is_out_of_range: m.is_out_of_range,
    confidence: m.confidence,
    status: 'needs_review' as const,
    notes: m.notes,
  }))
  await supabase.from('lab_markers').insert(markerRows)

  revalidatePath('/data/health/bloodwork')
  revalidatePath('/data/health')
  return { ok: true, panelId: panel.id }
}

export async function confirmPanel(
  panelId: string,
  action: 'all' | 'except_flagged',
  edits?: Record<string, Partial<{ value: number | null; unit: string; name_en: string; reference_range_low: number | null; reference_range_high: number | null }>>
) {
  const supabase = await createClient()
  const { data: markers } = await supabase.from('lab_markers').select('*').eq('panel_id', panelId)
  if (!markers) return { ok: false as const, error: 'No markers' }

  // Apply edits
  for (const m of markers) {
    const patch = edits?.[m.id]
    if (patch) {
      await supabase.from('lab_markers').update(patch).eq('id', m.id)
    }
  }

  // Re-read (post-edit) to classify
  const { data: refreshed } = await supabase.from('lab_markers').select('*').eq('panel_id', panelId)
  const accepted = (refreshed ?? []).filter(m => {
    if (action === 'all') return true
    // except_flagged: skip markers missing value/unit
    return m.value != null && m.unit != null
  })

  await supabase.from('lab_markers').update({ status: 'confirmed' }).in('id', accepted.map(m => m.id))
  // Delete any non-accepted markers to keep table clean
  const rejectedIds = (refreshed ?? []).filter(m => !accepted.find(a => a.id === m.id)).map(m => m.id)
  if (rejectedIds.length) await supabase.from('lab_markers').delete().in('id', rejectedIds)

  // Recompute out_of_range on accepted
  const oor = accepted.reduce((n, m) => n + (m.is_out_of_range ? 1 : 0), 0)
  await supabase.from('lab_panels').update({ status: 'ready', out_of_range_count: oor }).eq('id', panelId)

  revalidatePath('/data/health/bloodwork')
  revalidatePath('/data/health')
  revalidatePath('/data')
  return { ok: true as const }
}

export async function rejectAndRetry(panelId: string) {
  const supabase = await createClient()
  await supabase.from('lab_markers').delete().eq('panel_id', panelId)
  await supabase.from('lab_panels').update({ status: 'failed', extraction_json: null }).eq('id', panelId)
  revalidatePath('/data/health/bloodwork')
  return { ok: true as const }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/actions/health/__tests__/lab-upload.actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/health/lab-upload.actions.ts src/lib/actions/health/__tests__/lab-upload.actions.test.ts
git commit -m "feat(ingestion): lab upload orchestrator + review/confirm/reject"
```

---

## Task 5: Lab upload UI — picker + review screen

**Files:**
- Create: `src/app/data/health/bloodwork/upload/page.tsx`
- Create: `src/app/data/health/bloodwork/[id]/review/page.tsx`
- Create: `src/components/data/health/LabUploadForm.tsx`
- Create: `src/components/data/health/LabReviewTable.tsx`

- [ ] **Step 1: Upload page**

```tsx
// src/app/data/health/bloodwork/upload/page.tsx
import { LabUploadForm } from '@/components/data/health/LabUploadForm'
export default function Page() {
  return <div className="p-4"><LabUploadForm /></div>
}
```

- [ ] **Step 2: Upload form**

```tsx
// src/components/data/health/LabUploadForm.tsx
'use client'
import { useState } from 'react'
import { uploadLabPDF } from '@/lib/actions/health/lab-upload.actions'
import { useRouter } from 'next/navigation'
import { UploadCloud, Loader2 } from 'lucide-react'

export function LabUploadForm() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!file) return
    setUploading(true); setError(null)
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
      <div className="p-6 border-2 border-dashed border-neutral-800 rounded text-center">
        <UploadCloud className="w-8 h-8 mx-auto text-neutral-500 mb-2" />
        <input
          type="file" accept="application/pdf,image/jpeg,image/png"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        {file && <div className="text-xs text-neutral-400 mt-2">{file.name}</div>}
      </div>
      {error && <div className="text-xs text-amber-500">{error}</div>}
      <button
        onClick={submit} disabled={!file || uploading}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-amber-900/50 border border-amber-800 rounded">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {uploading ? 'Extracting...' : 'Upload and extract'}
      </button>
      <p className="text-xs text-neutral-500">
        PDFs and photos supported. Portuguese and English reports both work — values get translated on extraction.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Review page**

```tsx
// src/app/data/health/bloodwork/[id]/review/page.tsx
import { createClient } from '@/lib/supabase/server'
import { LabReviewTable } from '@/components/data/health/LabReviewTable'
import { redirect } from 'next/navigation'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: panel } = await supabase.from('lab_panels').select('*').eq('id', id).maybeSingle()
  if (!panel) redirect('/data/health/bloodwork')
  const { data: markers } = await supabase.from('lab_markers').select('*').eq('panel_id', id).order('name_en')
  return <LabReviewTable panel={panel} markers={markers ?? []} />
}
```

- [ ] **Step 4: Review table (edit + batch accept)**

```tsx
// src/components/data/health/LabReviewTable.tsx
'use client'
import { useState } from 'react'
import { confirmPanel, rejectAndRetry } from '@/lib/actions/health/lab-upload.actions'
import { useRouter } from 'next/navigation'
import { Trash } from 'lucide-react'

type Marker = {
  id: string; name_en: string; name_original: string | null;
  value: number | null; unit: string | null;
  reference_range_low: number | null; reference_range_high: number | null;
  is_out_of_range: boolean; confidence: string; status: string; notes: string | null;
}

export function LabReviewTable({ panel, markers }: { panel: any; markers: Marker[] }) {
  const router = useRouter()
  const [edits, setEdits] = useState<Record<string, Partial<Marker>>>({})
  const [submitting, setSubmitting] = useState(false)

  function editMarker(id: string, patch: Partial<Marker>) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }
  function isFlagged(m: Marker): boolean {
    return m.value == null || m.unit == null || m.confidence === 'low'
  }
  async function accept(action: 'all' | 'except_flagged') {
    setSubmitting(true)
    const res = await confirmPanel(panel.id, action, edits as any)
    setSubmitting(false)
    if (res.ok) router.push(`/data/health/bloodwork/${panel.id}`)
  }
  async function reject() {
    setSubmitting(true)
    await rejectAndRetry(panel.id)
    setSubmitting(false)
    router.push('/data/health/bloodwork/upload')
  }

  return (
    <div className="p-4 space-y-3">
      <div>
        <h1 className="text-xl font-space-grotesk">Review extracted panel</h1>
        <div className="text-sm text-neutral-400">
          {panel.panel_date} · {panel.lab_name ?? '—'} · {markers.length} markers · {markers.filter(m => m.is_out_of_range).length} out of range
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => accept('all')} disabled={submitting}
          className="px-3 py-2 text-sm bg-amber-900/50 border border-amber-800 rounded">
          Accept all
        </button>
        <button onClick={() => accept('except_flagged')} disabled={submitting}
          className="px-3 py-2 text-sm border border-neutral-800 rounded">
          Accept all except flagged
        </button>
        <button onClick={reject} disabled={submitting}
          className="px-3 py-2 text-sm border border-red-900 text-red-400 rounded">
          Reject and retry
        </button>
      </div>

      <table className="w-full text-xs">
        <thead><tr className="text-neutral-500">
          <th className="text-left">Marker</th><th>Value</th><th>Unit</th>
          <th>Low</th><th>High</th><th>OOR</th><th>Conf</th>
        </tr></thead>
        <tbody>
          {markers.map(m => {
            const e = edits[m.id] ?? {}
            const flagged = isFlagged({ ...m, ...e } as Marker)
            return (
              <tr key={m.id} className={`border-t border-neutral-900 ${flagged ? 'bg-amber-950/20' : ''}`}>
                <td className="py-1">
                  <input value={(e.name_en ?? m.name_en) as string}
                    onChange={ev => editMarker(m.id, { name_en: ev.target.value })}
                    className="bg-transparent w-full" />
                  {m.name_original && <div className="text-[10px] text-neutral-600">{m.name_original}</div>}
                </td>
                <td><input type="number" value={(e.value ?? m.value ?? '') as any}
                  onChange={ev => editMarker(m.id, { value: ev.target.value ? Number(ev.target.value) : null })}
                  className="bg-transparent w-14 text-right" /></td>
                <td><input value={(e.unit ?? m.unit ?? '') as string}
                  onChange={ev => editMarker(m.id, { unit: ev.target.value })}
                  className="bg-transparent w-14" /></td>
                <td><input type="number" value={(e.reference_range_low ?? m.reference_range_low ?? '') as any}
                  onChange={ev => editMarker(m.id, { reference_range_low: ev.target.value ? Number(ev.target.value) : null })}
                  className="bg-transparent w-12 text-right" /></td>
                <td><input type="number" value={(e.reference_range_high ?? m.reference_range_high ?? '') as any}
                  onChange={ev => editMarker(m.id, { reference_range_high: ev.target.value ? Number(ev.target.value) : null })}
                  className="bg-transparent w-12 text-right" /></td>
                <td className="text-center">{m.is_out_of_range ? '✓' : ''}</td>
                <td className="text-center text-[10px]">{m.confidence}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/data/health/bloodwork/upload/ src/app/data/health/bloodwork/\[id\]/review/ src/components/data/health/LabUploadForm.tsx src/components/data/health/LabReviewTable.tsx
git commit -m "feat(ingestion): lab upload + review UI"
```

---

## Task 6: Wire "Upload" button on bloodwork list

**Files:**
- Modify: `src/app/data/health/bloodwork/page.tsx`

- [ ] **Step 1: Add upload CTA**

In the existing page header:

```tsx
import { Upload } from 'lucide-react'
// ...in the <div className="flex items-center justify-between"> near the existing "Enter manually" link:
<Link href="/data/health/bloodwork/upload" className="inline-flex items-center gap-1 text-sm text-amber-500">
  <Upload className="w-4 h-4" /> Upload PDF
</Link>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/data/health/bloodwork/page.tsx
git commit -m "feat(ingestion): wire Upload PDF CTA on bloodwork list"
```

---

## Task 7: Garmin credential vault + sync library (TDD)

**Files:**
- Create: `src/lib/ingestion/garmin-sync.ts`
- Create: `src/lib/ingestion/__tests__/garmin-sync.test.ts`

- [ ] **Step 1: Write the failing test (focus on idempotency and VO2 change detection — not the unofficial API itself)**

```ts
// src/lib/ingestion/__tests__/garmin-sync.test.ts
import { describe, it, expect } from 'vitest'
import { diffVo2, dailyRowShape } from '../garmin-sync'

describe('diffVo2', () => {
  it('returns true when value changed', () => {
    expect(diffVo2({ previous: 56, current: 58 })).toBe(true)
  })
  it('returns false when value identical', () => {
    expect(diffVo2({ previous: 56, current: 56 })).toBe(false)
  })
  it('returns true when no previous exists', () => {
    expect(diffVo2({ previous: null, current: 56 })).toBe(true)
  })
})

describe('dailyRowShape', () => {
  it('normalizes a Garmin daily payload to the DB row shape', () => {
    const row = dailyRowShape({
      date: '2026-04-19',
      userId: 'uid',
      payload: {
        sleep: { totalSleepSeconds: 28800, deepSleepSeconds: 6000, remSleepSeconds: 6600, lightSleepSeconds: 14400, awakeSleepSeconds: 1800, overallSleepScore: { value: 82 } },
        hrv: { lastNightAvg: 52, status: 'balanced' },
        restingHeartRate: 51,
        bodyBattery: { startOfDay: 90, endOfDay: 45, min: 30, max: 98 },
        stress: { avgStressLevel: 27 },
        steps: 8800,
        activeKilocalories: 540,
      },
    })
    expect(row.user_id).toBe('uid')
    expect(row.date).toBe('2026-04-19')
    expect(row.sleep_total_min).toBe(480) // 28800/60
    expect(row.hrv_overnight_avg).toBe(52)
    expect(row.resting_hr).toBe(51)
    expect(row.stress_avg).toBe(27)
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/ingestion/__tests__/garmin-sync.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/ingestion/garmin-sync.ts
import { GarminConnect } from 'garmin-connect'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export function diffVo2(args: { previous: number | null; current: number }): boolean {
  if (args.previous == null) return true
  return args.previous !== args.current
}

export interface DailyPayload {
  sleep?: any
  hrv?: any
  restingHeartRate?: number
  bodyBattery?: any
  stress?: any
  steps?: number
  activeKilocalories?: number
}

export function dailyRowShape(args: { date: string; userId: string; payload: DailyPayload }) {
  const p = args.payload
  return {
    user_id: args.userId,
    date: args.date,
    sleep_total_min: p.sleep?.totalSleepSeconds ? Math.round(p.sleep.totalSleepSeconds / 60) : null,
    sleep_deep_min: p.sleep?.deepSleepSeconds ? Math.round(p.sleep.deepSleepSeconds / 60) : null,
    sleep_rem_min: p.sleep?.remSleepSeconds ? Math.round(p.sleep.remSleepSeconds / 60) : null,
    sleep_light_min: p.sleep?.lightSleepSeconds ? Math.round(p.sleep.lightSleepSeconds / 60) : null,
    sleep_awake_min: p.sleep?.awakeSleepSeconds ? Math.round(p.sleep.awakeSleepSeconds / 60) : null,
    sleep_score: p.sleep?.overallSleepScore?.value ?? null,
    hrv_overnight_avg: p.hrv?.lastNightAvg ?? null,
    hrv_morning_status: p.hrv?.status ?? null,
    resting_hr: p.restingHeartRate ?? null,
    body_battery_start: p.bodyBattery?.startOfDay ?? null,
    body_battery_end: p.bodyBattery?.endOfDay ?? null,
    body_battery_min: p.bodyBattery?.min ?? null,
    body_battery_max: p.bodyBattery?.max ?? null,
    stress_avg: p.stress?.avgStressLevel ?? null,
    steps: p.steps ?? null,
    active_kcal: p.activeKilocalories ?? null,
  }
}

interface GarminCredentials {
  email: string
  password: string
}

// Credentials are stored in Vault; this helper reads + decrypts via RPC.
async function readVaultCredentials(supabase: SupabaseClient, userId: string): Promise<GarminCredentials | null> {
  const { data: row } = await supabase.from('garmin_credentials').select('*').eq('user_id', userId).maybeSingle()
  if (!row || !row.vault_secret_id_email || !row.vault_secret_id_password) return null
  const { data: emailRow } = await supabase.rpc('read_secret', { secret_id: row.vault_secret_id_email })
  const { data: passRow } = await supabase.rpc('read_secret', { secret_id: row.vault_secret_id_password })
  if (!emailRow || !passRow) return null
  return { email: emailRow as string, password: passRow as string }
}

export async function syncUser(userId: string): Promise<{ ok: true; days: number } | { ok: false; error: string }> {
  const supabase = await createClient()
  const creds = await readVaultCredentials(supabase, userId)
  if (!creds) return { ok: false, error: 'no_credentials' }

  const gc = new GarminConnect({ username: creds.email, password: creds.password })
  try {
    await gc.login()
  } catch (err: any) {
    await supabase.from('garmin_credentials').update({ last_sync_status: 'auth_failed', last_sync_at: new Date().toISOString() }).eq('user_id', userId)
    return { ok: false, error: 'auth_failed' }
  }

  // Pull yesterday (cron runs 07:00 UTC so yesterday is safely complete)
  const y = new Date(Date.now() - 24 * 3600 * 1000)
  const date = y.toISOString().slice(0, 10)

  let payload: DailyPayload = {}
  try {
    payload.sleep = await (gc as any).getSleepData(date).catch(() => null)
    payload.hrv = await (gc as any).getHrvData?.(date).catch(() => null) ?? null
    payload.restingHeartRate = await (gc as any).getRestingHeartRate?.(date).catch(() => undefined)
    payload.bodyBattery = await (gc as any).getBodyBatteryData?.(date).catch(() => null)
    payload.stress = await (gc as any).getStressData?.(date).catch(() => null)
    payload.steps = await (gc as any).getSteps?.(date).catch(() => undefined)
    // VO2 Max (from running/cycling estimate endpoint)
    const vo2 = await (gc as any).getVo2Max?.().catch(() => null)
    if (vo2?.vo2MaxRunning) {
      const { data: prev } = await supabase.from('garmin_vo2_trend').select('vo2_max').eq('user_id', userId)
        .order('measured_on', { ascending: false }).limit(1).maybeSingle()
      if (diffVo2({ previous: prev?.vo2_max ?? null, current: vo2.vo2MaxRunning })) {
        await supabase.from('garmin_vo2_trend').insert({
          user_id: userId, measured_on: date, modality: 'run', vo2_max: vo2.vo2MaxRunning,
        })
      }
    }
  } catch (err: any) {
    // partial failures are acceptable; proceed with whatever payload we collected
  }

  const row = dailyRowShape({ date, userId, payload })
  await supabase.from('garmin_daily').upsert(row, { onConflict: 'user_id,date' })

  await supabase.from('garmin_credentials').update({
    last_sync_status: 'ok', last_sync_at: new Date().toISOString(),
  }).eq('user_id', userId)

  return { ok: true, days: 1 }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/ingestion/__tests__/garmin-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingestion/garmin-sync.ts src/lib/ingestion/__tests__/garmin-sync.test.ts
git commit -m "feat(ingestion): garmin-sync library (unofficial API + Vault creds)"
```

---

## Task 8: Vault helper RPCs (connect / disconnect)

**Files:**
- Create: `supabase/migrations/017_garmin_vault_rpcs.sql`

- [ ] **Step 1: Write the RPCs**

```sql
-- supabase/migrations/017_garmin_vault_rpcs.sql
-- Helpers for storing Garmin credentials in Vault. Requires Supabase Vault enabled.

CREATE OR REPLACE FUNCTION store_garmin_credentials(
  p_email text, p_password text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email_id uuid;
  v_pass_id uuid;
BEGIN
  v_email_id := vault.create_secret(p_email, 'garmin_email_' || auth.uid()::text);
  v_pass_id := vault.create_secret(p_password, 'garmin_password_' || auth.uid()::text);

  INSERT INTO garmin_credentials (user_id, vault_secret_id_email, vault_secret_id_password)
  VALUES (auth.uid(), v_email_id, v_pass_id)
  ON CONFLICT (user_id) DO UPDATE SET
    vault_secret_id_email = EXCLUDED.vault_secret_id_email,
    vault_secret_id_password = EXCLUDED.vault_secret_id_password,
    connected_at = now();
END $$;

CREATE OR REPLACE FUNCTION read_secret(secret_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_value text;
BEGIN
  -- Only caller owning the credentials can read
  IF NOT EXISTS (
    SELECT 1 FROM garmin_credentials
    WHERE user_id = auth.uid()
      AND (vault_secret_id_email = secret_id OR vault_secret_id_password = secret_id)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT decrypted_secret INTO v_value FROM vault.decrypted_secrets WHERE id = secret_id;
  RETURN v_value;
END $$;

CREATE OR REPLACE FUNCTION disconnect_garmin() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email_id uuid; v_pass_id uuid;
BEGIN
  SELECT vault_secret_id_email, vault_secret_id_password INTO v_email_id, v_pass_id
    FROM garmin_credentials WHERE user_id = auth.uid();
  IF v_email_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id IN (v_email_id, v_pass_id);
  END IF;
  DELETE FROM garmin_credentials WHERE user_id = auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION store_garmin_credentials TO authenticated;
GRANT EXECUTE ON FUNCTION read_secret TO authenticated;
GRANT EXECUTE ON FUNCTION disconnect_garmin TO authenticated;
```

- [ ] **Step 2: Apply + regenerate types**

Run:
```bash
supabase migration up
supabase gen types typescript --local > src/lib/types/database.types.ts
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/017_garmin_vault_rpcs.sql src/lib/types/database.types.ts
git commit -m "feat(migration): Garmin credentials vault RPCs"
```

---

## Task 9: Garmin connect/disconnect/resync actions

**Files:**
- Create: `src/lib/actions/health/garmin.actions.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/actions/health/garmin.actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GarminConnect } from 'garmin-connect'
import { syncUser } from '@/lib/ingestion/garmin-sync'

export async function connectGarmin(email: string, password: string)
: Promise<{ ok: true } | { ok: false; error: string; needsMfa?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  // Probe with a real login before storing, so bad credentials fail fast
  try {
    const gc = new GarminConnect({ username: email, password })
    await gc.login()
  } catch (err: any) {
    const msg = String(err?.message ?? err)
    if (/mfa|two-?factor|2fa/i.test(msg)) {
      return { ok: false, error: 'MFA required', needsMfa: true }
    }
    return { ok: false, error: `auth_failed: ${msg}` }
  }

  // Store credentials via Vault RPC
  const { error } = await supabase.rpc('store_garmin_credentials', { p_email: email, p_password: password })
  if (error) return { ok: false, error: error.message }

  // Initial sync (best-effort; doesn't block connect)
  await syncUser(user.id).catch(() => null)

  revalidatePath('/data/health/garmin')
  revalidatePath('/data/health')
  revalidatePath('/data')
  return { ok: true }
}

export async function resyncNow(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }
  const res = await syncUser(user.id)
  revalidatePath('/data/health/garmin')
  revalidatePath('/data/health')
  revalidatePath('/data')
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}

export async function disconnectGarmin(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('disconnect_garmin')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/garmin')
  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/health/garmin.actions.ts
git commit -m "feat(ingestion): garmin connect/resync/disconnect actions"
```

---

## Task 10: Garmin connect page + form + MFA prompt

**Files:**
- Create: `src/app/data/health/garmin/connect/page.tsx`
- Create: `src/components/data/health/GarminConnectForm.tsx`
- Create: `src/components/data/health/GarminMFAPrompt.tsx`

- [ ] **Step 1: Connect page**

```tsx
// src/app/data/health/garmin/connect/page.tsx
import { GarminConnectForm } from '@/components/data/health/GarminConnectForm'
export default function Page() {
  return <div className="p-4"><GarminConnectForm /></div>
}
```

- [ ] **Step 2: Connect form**

```tsx
// src/components/data/health/GarminConnectForm.tsx
'use client'
import { useState } from 'react'
import { connectGarmin } from '@/lib/actions/health/garmin.actions'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export function GarminConnectForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSubmitting(true); setError(null)
    const res = await connectGarmin(email, password)
    setSubmitting(false)
    if (res.ok) router.push('/data/health/garmin')
    else if (res.needsMfa) setError('MFA required. Complete MFA in the Garmin Connect app, then retry here — this flow does not yet handle TOTP inline.')
    else setError(res.error)
  }

  return (
    <div className="max-w-md space-y-3">
      <h1 className="text-xl font-space-grotesk">Connect Garmin</h1>
      <div className="flex items-start gap-2 p-3 border border-neutral-800 bg-neutral-950 rounded text-xs text-neutral-400">
        <AlertCircle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
        <div>
          This uses an unofficial Garmin Connect API. Not endorsed by Garmin. Your credentials are encrypted in Supabase Vault and used only for your own syncs. If Garmin changes auth and this stops working, a CSV-import fallback will appear here.
        </div>
      </div>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full bg-neutral-900 p-2 rounded text-sm" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-neutral-900 p-2 rounded text-sm" />
      {error && <div className="text-xs text-amber-500">{error}</div>}
      <button onClick={submit} disabled={submitting || !email || !password}
        className="px-3 py-2 text-sm bg-amber-900/50 border border-amber-800 rounded">
        {submitting ? 'Connecting...' : 'Connect'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: MFA prompt placeholder**

```tsx
// src/components/data/health/GarminMFAPrompt.tsx
'use client'
// MVP does not auto-handle inline TOTP with the garmin-connect npm package.
// If needed, users complete MFA in the Garmin app and retry connect.
// Keeping this stub so the route tree is consistent.
export function GarminMFAPrompt() {
  return <div className="p-4 text-sm text-neutral-400">MFA handling coming soon.</div>
}
```

- [ ] **Step 4: Enable Connect + Resync buttons on display**

Modify `src/components/data/health/GarminDisplay.tsx` — replace the "Connect (coming soon)" stub with a real link and add a "Resync now" button when connected:

```tsx
// At the top of the return, adjust:
{!creds ? (
  <a href="/data/health/garmin/connect" className="text-sm text-amber-500">Connect</a>
) : (
  <form action={async () => {
    'use server'
    const { resyncNow } = await import('@/lib/actions/health/garmin.actions')
    await resyncNow()
  }}>
    <button className="text-sm text-amber-500">Resync now</button>
  </form>
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/data/health/garmin/connect/ src/components/data/health/GarminConnectForm.tsx src/components/data/health/GarminMFAPrompt.tsx src/components/data/health/GarminDisplay.tsx
git commit -m "feat(ingestion): garmin connect form + MFA placeholder + resync button"
```

---

## Task 11: Vercel cron endpoint

**Files:**
- Create: `src/app/api/cron/garmin-sync/route.ts`
- Modify (or create): `vercel.json`

- [ ] **Step 1: Route handler**

```ts
// src/app/api/cron/garmin-sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/admin' // service-role client
import { syncUser } from '@/lib/ingestion/garmin-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Vercel Cron hits with a specific header
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createClient() // service-role for cross-user iteration
  const { data: users } = await admin.from('garmin_credentials').select('user_id').not('vault_secret_id_email', 'is', null)
  const results: Array<{ userId: string; status: string }> = []
  for (const row of users ?? []) {
    const r = await syncUser(row.user_id)
    results.push({ userId: row.user_id, status: r.ok ? 'ok' : r.error })
  }
  return NextResponse.json({ synced: results.length, results })
}
```

If `src/lib/supabase/admin.ts` doesn't exist, create it:

```ts
// src/lib/supabase/admin.ts
import { createClient as createSbClient } from '@supabase/supabase-js'
export function createClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

Note: `syncUser` above was written against the SSR client (`createClient from '@/lib/supabase/server'`). For cron use, refactor `syncUser` to accept an optional `SupabaseClient` argument, or provide a second exported variant `syncUserWithAdmin(userId, adminClient)`. Simpler fix: change `syncUser` signature:

```ts
export async function syncUser(userId: string, client?: SupabaseClient) {
  const supabase = client ?? await (await import('@/lib/supabase/server')).createClient()
  // ...rest unchanged
}
```

Then in the cron route call `syncUser(row.user_id, admin)`.

- [ ] **Step 2: Add env var**

Ensure `CRON_SECRET` is set in Vercel project env (and locally in `.env.local` for testing). `SUPABASE_SERVICE_ROLE_KEY` should already exist.

- [ ] **Step 3: `vercel.json` entry**

If `vercel.json` doesn't exist, create:

```json
{
  "crons": [
    { "path": "/api/cron/garmin-sync", "schedule": "0 7 * * *" }
  ]
}
```

If it exists, append the crons entry without overwriting other fields.

- [ ] **Step 4: Local test**

Run the dev server, then:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/garmin-sync
```
Expected: JSON response with synced count (may be 0 if no connected users).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/garmin-sync/ src/lib/supabase/admin.ts src/lib/ingestion/garmin-sync.ts vercel.json
git commit -m "feat(ingestion): Vercel cron for garmin daily sync"
```

---

## Task 12: Integration test — upload → review → confirm with mocked extraction

**Files:**
- Create: `src/lib/actions/health/__tests__/lab-upload-integration.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/lib/actions/health/__tests__/lab-upload-integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createClient } from '@/lib/supabase/test-client'

vi.mock('@/lib/ingestion/lab-pdf-extractor', () => ({
  extractFromBase64: vi.fn().mockResolvedValue({
    ok: true, data: {
      document_type: 'lab_report',
      panel_date: '2026-03-15',
      lab_name: 'TestLab',
      markers: [
        { name_en: 'Ferritin', name_original: 'Ferritina', value: 12, unit: 'ng/mL',
          reference_range_low: 30, reference_range_high: 400, is_out_of_range: true,
          confidence: 'high', notes: null },
        { name_en: 'Unknown', name_original: null, value: null, unit: null,
          reference_range_low: null, reference_range_high: null, is_out_of_range: false,
          confidence: 'low', notes: null },
      ],
    },
  }),
}))

import { uploadLabPDF, confirmPanel } from '../lab-upload.actions'

describe('lab upload integration (mocked extractor)', () => {
  const supabase = createClient()
  beforeEach(async () => {
    await supabase.from('lab_markers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('lab_panels').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  })

  it('uploads, extracts, confirms all', async () => {
    const fd = new FormData()
    fd.set('file', new File(['%PDF-1.7'], 'test.pdf', { type: 'application/pdf' }))
    const up = await uploadLabPDF(fd)
    expect(up.ok).toBe(true)
    expect(up.panelId).toBeTruthy()

    const { data: markers } = await supabase.from('lab_markers').select('*').eq('panel_id', (up as any).panelId)
    expect(markers).toHaveLength(2)
    expect(markers!.every(m => m.status === 'needs_review')).toBe(true)

    const cf = await confirmPanel((up as any).panelId, 'except_flagged')
    expect(cf.ok).toBe(true)

    const { data: kept } = await supabase.from('lab_markers').select('*').eq('panel_id', (up as any).panelId)
    expect(kept).toHaveLength(1)
    expect(kept![0].name_en).toBe('Ferritin')

    const { data: panel } = await supabase.from('lab_panels').select('*').eq('id', (up as any).panelId).single()
    expect(panel!.status).toBe('ready')
    expect(panel!.out_of_range_count).toBe(1)
  })
})
```

- [ ] **Step 2: Run — expect pass**

Run: `npx vitest run src/lib/actions/health/__tests__/lab-upload-integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/health/__tests__/lab-upload-integration.test.ts
git commit -m "test(ingestion): upload → review → confirm integration"
```

---

## Task 13: Final verification + PR

- [ ] **Step 1: Full test suite**

Run:
```bash
npx vitest run
npx tsc --noEmit
```
Expected: all green.

- [ ] **Step 2: Manual verify — lab upload**

Run `npm run dev`. Visit `/data/health/bloodwork/upload`. Upload your Portuguese panel PDF. Verify:
- Review screen loads with translated marker names.
- "Accept all except flagged" leaves only high-confidence markers with values.
- Panel appears on `/data/health/bloodwork` with correct out-of-range count.
- Doctor report (`/data/health/doctor-report`) includes the panel and its trend data (if multiple panels exist).

- [ ] **Step 3: Manual verify — Garmin**

At `/data/health/garmin/connect`, enter your Garmin credentials. After successful connect:
- `/data/health/garmin` shows yesterday's daily row.
- "Resync now" button refreshes it.
- On Vercel: the cron endpoint runs the next 07:00 UTC (check logs).

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/metrics-auto-ingest
gh pr create --title "feat: metrics auto-ingestion (lab PDF + Garmin sync)" --body "$(cat <<'EOF'
## Summary
- Lab PDF extraction via Claude Haiku 4.5 (strict JSON, Zod-validated, translation built in)
- Upload + review UI at /data/health/bloodwork/upload → [id]/review
- Garmin credential Vault via RPCs (store/read/disconnect)
- `garmin-connect` npm client + daily cron at 07:00 UTC via Vercel Cron
- Resync-now button + read-only display updated

## Test plan
- [ ] Vitest units for extractor + classifier + daily row shape + VO2 diff
- [ ] Integration: upload → review → confirm with mocked extractor
- [ ] Manual: upload a real lab PDF, confirm review table + doctor-report inclusion
- [ ] Manual: connect Garmin, resync, verify data flows to `/data/health/garmin/`
- [ ] Cron endpoint responds 200 with `CRON_SECRET` header

## Dependencies
- Plan 2 (`016_metrics_dashboard.sql`) must be merged first

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Spec coverage check (self-review)

- **Lab PDF upload + AI extraction (Haiku 4.5 + translation + strict JSON)** ✓ Tasks 3, 4, 5
- **Review screen with batch actions + per-row edits** ✓ Task 5
- **"Reject and retry"** ✓ Task 4
- **Low-confidence / missing-unit flagging** ✓ Task 4 (classifyNeedsReview)
- **Panel `status` state machine: `pending_extraction` → `needs_review` → `ready` / `failed`** ✓ Task 4
- **Garmin credentials via Supabase Vault** ✓ Task 8
- **MFA disclosure + placeholder (inline TOTP deferred)** ✓ Task 10
- **Session token caching in `garmin_credentials.session_token_encrypted`** ✗ deliberately unused (the npm client keeps its own state; if token persistence becomes needed, a follow-up can extend `syncUser` to save/load tokens)
- **Daily cron at 07:00 UTC** ✓ Task 11
- **Idempotent daily upsert on `(user_id, date)`** ✓ Task 7 (`upsert` + PK)
- **VO2 trend row only when value changes** ✓ Task 7 (`diffVo2`)
- **Resync-now manual button** ✓ Tasks 9, 10
- **Fallback CSV import** — route reserved in Plan 2; implementation deferred as spec says
- **Integration test covering upload → review → confirm** ✓ Task 12

Follow-ups after MVP: session-token persistence (reduce re-auth frequency), inline TOTP MFA, CSV fallback UI.
