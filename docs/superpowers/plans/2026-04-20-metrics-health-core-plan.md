# Metrics Dashboard — Health Core + Doctor Report Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Health domain (`/data/health/`) with manual entry for supplements/medicals/body-comp/bloodwork, Garmin display (data wiring only — no sync yet), the `HealthSnapshotTile` on `/data/`, and a working doctor-report PDF generator. After this plan, you can enter data by hand and generate a 6-month report for your doctor.

**Architecture:** New `/data/health/` domain peer to existing training domains. One migration (`016_metrics_dashboard.sql`) adds all health tables plus storage buckets and RLS. Derivation layer at `src/lib/analytics/health/` produces snapshots for the overview tile and subpage cards. Doctor report renders via one pure builder (`src/lib/reports/doctor-report-builder.ts`) that feeds both a Tailwind HTML printable view and a `@react-pdf/renderer` tree. Snapshots frozen in `doctor_reports.snapshot_json` for deterministic re-downloads.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase, Vitest 4, Tailwind 4, `@react-pdf/renderer` (new), existing `@supabase/ssr` for auth. No new ingestion deps in this plan.

**Spec reference:** `docs/superpowers/specs/2026-04-20-metrics-dashboard-health-extension-design.md`

> ⚠️ **Next.js 16 reminder:** Read `node_modules/next/dist/docs/` before writing any server/client component or route code — breaking changes from Next 15.

---

## File Structure

### New files

**Migration + types:**
- `supabase/migrations/016_metrics_dashboard.sql` — health tables + training-adherence table changes + storage buckets + RLS
- `src/lib/types/database.types.ts` — regenerated

**Analytics (health):**
- `src/lib/analytics/health/bloodwork-snapshot.ts`
- `src/lib/analytics/health/garmin-trends.ts`
- `src/lib/analytics/health/supplements-snapshot.ts`
- `src/lib/analytics/health/medicals-snapshot.ts`
- `src/lib/analytics/health/body-comp-snapshot.ts`
- `src/lib/analytics/health/__tests__/*.test.ts` (one per file above)

**Actions (health):**
- `src/lib/actions/health/supplements.actions.ts`
- `src/lib/actions/health/medicals.actions.ts`
- `src/lib/actions/health/body-comp.actions.ts`
- `src/lib/actions/health/bloodwork.actions.ts` — manual-entry variants only; upload flow comes in Plan 3
- `src/lib/actions/health/doctor-report.actions.ts`

**Reports:**
- `src/lib/reports/types.ts` — `DoctorReportSnapshot` type
- `src/lib/reports/doctor-report-builder.ts`
- `src/lib/reports/__tests__/doctor-report-builder.test.ts`
- `src/lib/reports/health-pdf/HealthPDFPage.tsx`
- `src/lib/reports/health-pdf/HealthPDFSection.tsx`
- `src/lib/reports/health-pdf/HealthPDFStatGrid.tsx`
- `src/lib/reports/health-pdf/HealthPDFMarkerTable.tsx`
- `src/lib/reports/health-pdf/HealthPDFTrendChart.tsx`
- `src/lib/reports/health-pdf/HealthPDFTimeline.tsx`
- `src/lib/reports/doctor-report-pdf.tsx` — top-level React-PDF document

**Components (health overview):**
- `src/components/data/overview/HealthSnapshotTile.tsx`

**Components (health subpages):**
- `src/components/data/health/HealthLanding.tsx`
- `src/components/data/health/BloodworkList.tsx`
- `src/components/data/health/BloodworkManualForm.tsx` — manual panel + markers entry (Plan 3 replaces with upload)
- `src/components/data/health/SupplementsList.tsx`
- `src/components/data/health/SupplementForm.tsx`
- `src/components/data/health/MedicalsList.tsx`
- `src/components/data/health/MedicalEventForm.tsx`
- `src/components/data/health/BodyCompList.tsx`
- `src/components/data/health/BodyCompForm.tsx`
- `src/components/data/health/GarminDisplay.tsx` — read-only display; connect flow is Plan 3
- `src/components/data/health/DoctorReportPrintable.tsx` — the HTML web view

**Routes:**
- `src/app/data/health/page.tsx`
- `src/app/data/health/bloodwork/page.tsx`
- `src/app/data/health/bloodwork/[id]/page.tsx` — single panel view
- `src/app/data/health/bloodwork/new/page.tsx` — manual entry (Plan 3 adds upload)
- `src/app/data/health/supplements/page.tsx`
- `src/app/data/health/medicals/page.tsx`
- `src/app/data/health/body-comp/page.tsx`
- `src/app/data/health/garmin/page.tsx` — display only this plan
- `src/app/data/health/doctor-report/page.tsx`
- `src/app/data/health/doctor-report/download/route.ts` — streams generated PDF

### Modified files

- `src/app/data/page.tsx` — add fifth tile (`HealthSnapshotTile`)
- `src/components/data/TrainingOverview.tsx` — render five-tile grid (currently renders existing layout)
- `src/lib/actions/data.actions.ts` — extend `getTrainingOverview` to include health snapshot fields OR add a sibling `getHealthSnapshot` used in parallel via `Promise.all`
- `package.json` — add `@react-pdf/renderer`

---

## Task 1: Confirm migration 016 is already applied

> **Schema audit note (2026-04-20):** Migration 016 was applied to the live database during the `feat/metrics-schema-audit` branch. See `docs/superpowers/specs/2026-04-20-metrics-schema-audit.md` for the audit record. `src/lib/types/database.types.ts` was regenerated in that commit. This plan starts from a state where all health tables (`lab_panels`, `lab_markers`, `supplements`, `medical_events`, `garmin_credentials`, `garmin_daily`, `garmin_vo2_trend`, `body_composition_measurements`, `doctor_reports`) already exist, storage buckets `lab-reports` and `doctor-reports` are provisioned, and `ai_coach_interventions` has four new columns (`coach_domain`, `pattern_signal`, `user_response`, `needs_retry`).

**Files:**
- Read: `supabase/migrations/016_metrics_dashboard.sql` (already committed)
- Read: `docs/superpowers/specs/2026-04-20-metrics-schema-audit.md`

- [ ] **Step 1: Verify the migration file exists**

Run:
```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
ls supabase/migrations/016_metrics_dashboard.sql && head -10 supabase/migrations/016_metrics_dashboard.sql
```
Expected: file present; banner comment references the schema audit.

- [ ] **Step 2: Verify types include the new tables**

Run:
```bash
grep -E "lab_panels|lab_markers|supplements:|medical_events|garmin_credentials|garmin_daily|garmin_vo2_trend|body_composition_measurements|doctor_reports" src/lib/types/database.types.ts | head -10
```
Expected: all nine tables present as entries in the `Tables` interface. If missing, regenerate types.

- [ ] **Step 3: No commit — migration and types already committed on audit branch**

## Task 2: (superseded by Task 1) — originally drafted migration content

> The original Task 2 in this plan drafted SQL that turned out to collide with the live schema (`agent_interventions` did not match the live `ai_coach_interventions`, `performance_deltas.delta_pct` did not exist). The schema audit in 2026-04-20 produced the corrected migration now shipping as `016_metrics_dashboard.sql`. No action required here.


## Task 3: `DoctorReportSnapshot` type + report helper skeleton

**Files:**
- Create: `src/lib/reports/types.ts`

- [ ] **Step 1: Write the type**

```ts
// src/lib/reports/types.ts
export type WindowPreset = '3mo' | '6mo' | '12mo' | 'custom'

export interface DoctorReportWindow {
  start: string // ISO date
  end: string
  preset: WindowPreset
}

export interface MarkerRow {
  name_en: string
  name_original: string | null
  value: number | null
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  out_of_range: boolean
  panel_date: string
}

export interface PanelSummary {
  id: string
  panel_date: string
  lab_name: string | null
  out_of_range_count: number
  markers: MarkerRow[]
}

export interface TrendPoint { date: string; value: number }

export interface GarminSection {
  sleep_daily: TrendPoint[] // total minutes
  hrv_daily: TrendPoint[]
  rhr_daily: TrendPoint[]
  vo2_trend: TrendPoint[]
}

export interface SupplementRow {
  name: string
  dose: number | null
  dose_unit: string | null
  timing: string[]
  start_date: string
  end_date: string | null
  notes: string | null
  event: 'active' | 'started_in_window' | 'ended_in_window'
}

export interface MedicalEventRow {
  event_type: string
  event_date: string
  title: string
  details: string | null
  structured_data: Record<string, unknown> | null
  has_attachment: boolean
}

export interface BodyCompRow {
  measured_on: string
  method: string
  weight_kg: number | null
  body_fat_pct: number | null
  lean_mass_kg: number | null
}

export interface DoctorReportSnapshot {
  generated_at: string
  window: DoctorReportWindow
  athlete_name: string
  summary_line: string
  bloodwork_panels: PanelSummary[]
  bloodwork_trends: Record<string, TrendPoint[]> // key = name_en
  garmin: GarminSection
  supplements: SupplementRow[]
  medicals: MedicalEventRow[]
  body_comp: BodyCompRow[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/types.ts
git commit -m "feat(reports): DoctorReportSnapshot type scaffold"
```

---

## Task 4: Supplements actions (TDD)

**Files:**
- Create: `src/lib/actions/health/supplements.actions.ts`
- Create: `src/lib/actions/health/__tests__/supplements.actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/actions/health/__tests__/supplements.actions.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/test-client'
import {
  addSupplement,
  updateSupplement,
  endSupplement,
  listSupplements,
} from '../supplements.actions'

describe('supplements actions', () => {
  const supabase = createClient()

  beforeEach(async () => {
    await supabase.from('supplements').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  })

  it('adds a supplement and lists it as active', async () => {
    const res = await addSupplement({
      name: 'Vitamin D3',
      dose: 5000,
      dose_unit: 'IU',
      timing: ['am', 'with_meal'],
      start_date: '2026-01-01',
    })
    expect(res.ok).toBe(true)
    const list = await listSupplements({ include_ended: false })
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Vitamin D3')
  })

  it('endSupplement sets end_date and filters from active list', async () => {
    const add = await addSupplement({
      name: 'Magnesium', dose: 400, dose_unit: 'mg',
      timing: ['pm'], start_date: '2026-01-01'
    })
    await endSupplement(add.id!, '2026-04-01')
    const active = await listSupplements({ include_ended: false })
    expect(active).toHaveLength(0)
    const all = await listSupplements({ include_ended: true })
    expect(all[0].end_date).toBe('2026-04-01')
  })
})
```

- [ ] **Step 2: Run the test — expect it to fail**

Run:
```bash
npx vitest run src/lib/actions/health/__tests__/supplements.actions.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the actions**

```ts
// src/lib/actions/health/supplements.actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SupplementInput {
  name: string
  dose: number | null
  dose_unit: string | null
  timing: string[]
  start_date: string
  end_date?: string | null
  notes?: string | null
}

export async function addSupplement(input: SupplementInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' as const }
  const { data, error } = await supabase
    .from('supplements')
    .insert({ ...input, user_id: user.id })
    .select('id').single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/supplements')
  revalidatePath('/data/health')
  revalidatePath('/data')
  return { ok: true, id: data.id }
}

export async function updateSupplement(id: string, patch: Partial<SupplementInput>) {
  const supabase = await createClient()
  const { error } = await supabase.from('supplements').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/supplements')
  return { ok: true }
}

export async function endSupplement(id: string, end_date: string) {
  return updateSupplement(id, { end_date })
}

export async function listSupplements(opts: { include_ended: boolean }) {
  const supabase = await createClient()
  const q = supabase.from('supplements').select('*').order('start_date', { ascending: false })
  if (!opts.include_ended) q.is('end_date', null)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run src/lib/actions/health/__tests__/supplements.actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/health/supplements.actions.ts src/lib/actions/health/__tests__/supplements.actions.test.ts
git commit -m "feat(health): supplements actions + tests"
```

---

## Task 5: Medical events actions (TDD)

**Files:**
- Create: `src/lib/actions/health/medicals.actions.ts`
- Create: `src/lib/actions/health/__tests__/medicals.actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/actions/health/__tests__/medicals.actions.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/test-client'
import { addMedicalEvent, listMedicalEvents } from '../medicals.actions'

describe('medicals actions', () => {
  const supabase = createClient()
  beforeEach(async () => {
    await supabase.from('medical_events').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  })

  it('adds a lab_test with structured VO2 data and retrieves it', async () => {
    await addMedicalEvent({
      event_type: 'lab_test',
      event_date: '2025-11-10',
      title: 'VO2 Max lab test',
      details: 'Ramp protocol, clinical setting',
      structured_data: { protocol: 'Bruce', vo2_max_ml_kg_min: 58.2, max_hr: 188 }
    })
    const list = await listMedicalEvents()
    expect(list).toHaveLength(1)
    expect(list[0].structured_data).toMatchObject({ vo2_max_ml_kg_min: 58.2 })
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/actions/health/__tests__/medicals.actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/actions/health/medicals.actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type MedicalEventType =
  | 'injury' | 'diagnosis' | 'surgery'
  | 'medication_change' | 'lab_test' | 'other'

export interface MedicalEventInput {
  event_type: MedicalEventType
  event_date: string
  title: string
  details?: string | null
  attachment_path?: string | null
  structured_data?: Record<string, unknown> | null
}

export async function addMedicalEvent(input: MedicalEventInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' as const }
  const { data, error } = await supabase
    .from('medical_events')
    .insert({ ...input, user_id: user.id })
    .select('id').single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/medicals')
  revalidatePath('/data/health')
  return { ok: true, id: data.id }
}

export async function updateMedicalEvent(id: string, patch: Partial<MedicalEventInput>) {
  const supabase = await createClient()
  const { error } = await supabase.from('medical_events').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/medicals')
  return { ok: true }
}

export async function deleteMedicalEvent(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('medical_events').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/medicals')
  return { ok: true }
}

export async function listMedicalEvents() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('medical_events').select('*').order('event_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/actions/health/__tests__/medicals.actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/health/medicals.actions.ts src/lib/actions/health/__tests__/medicals.actions.test.ts
git commit -m "feat(health): medical events actions + tests"
```

---

## Task 6: Body composition actions (TDD)

**Files:**
- Create: `src/lib/actions/health/body-comp.actions.ts`
- Create: `src/lib/actions/health/__tests__/body-comp.actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/actions/health/__tests__/body-comp.actions.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/test-client'
import { addBodyCompMeasurement, listBodyComp } from '../body-comp.actions'

describe('body-comp actions', () => {
  const supabase = createClient()
  beforeEach(async () => {
    await supabase.from('body_composition_measurements').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  })

  it('adds a scale measurement and lists it', async () => {
    await addBodyCompMeasurement({
      measured_on: '2026-04-01', method: 'scale', weight_kg: 82.4, body_fat_pct: 14.2
    })
    const list = await listBodyComp()
    expect(list).toHaveLength(1)
    expect(list[0].weight_kg).toBe(82.4)
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/actions/health/__tests__/body-comp.actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/actions/health/body-comp.actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BodyCompInput {
  measured_on: string
  method: 'scale' | 'dexa' | 'caliper' | 'tape'
  weight_kg?: number | null
  body_fat_pct?: number | null
  lean_mass_kg?: number | null
  measurements?: Record<string, number> | null
  notes?: string | null
}

export async function addBodyCompMeasurement(input: BodyCompInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' as const }
  const { data, error } = await supabase
    .from('body_composition_measurements')
    .insert({ ...input, user_id: user.id })
    .select('id').single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/body-comp')
  revalidatePath('/data/health')
  return { ok: true, id: data.id }
}

export async function listBodyComp() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('body_composition_measurements').select('*').order('measured_on', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/actions/health/__tests__/body-comp.actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/health/body-comp.actions.ts src/lib/actions/health/__tests__/body-comp.actions.test.ts
git commit -m "feat(health): body-comp actions + tests"
```

---

## Task 7: Bloodwork actions — manual entry only (TDD)

**Files:**
- Create: `src/lib/actions/health/bloodwork.actions.ts`
- Create: `src/lib/actions/health/__tests__/bloodwork.actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/actions/health/__tests__/bloodwork.actions.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/test-client'
import {
  addPanelManual, listPanels, getPanelWithMarkers
} from '../bloodwork.actions'

describe('bloodwork manual actions', () => {
  const supabase = createClient()
  beforeEach(async () => {
    await supabase.from('lab_markers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('lab_panels').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  })

  it('creates a panel with markers, computes out_of_range_count', async () => {
    const res = await addPanelManual({
      panel_date: '2026-03-15',
      lab_name: 'Lab Central',
      markers: [
        { name_en: 'Ferritin', value: 12, unit: 'ng/mL', ref_low: 30, ref_high: 400 },
        { name_en: 'Vitamin D', value: 45, unit: 'ng/mL', ref_low: 30, ref_high: 100 },
      ],
    })
    expect(res.ok).toBe(true)
    const panels = await listPanels()
    expect(panels[0].out_of_range_count).toBe(1)
    const full = await getPanelWithMarkers(panels[0].id)
    expect(full.markers).toHaveLength(2)
    const ferritin = full.markers.find(m => m.name_en === 'Ferritin')!
    expect(ferritin.is_out_of_range).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/actions/health/__tests__/bloodwork.actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/actions/health/bloodwork.actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface MarkerInput {
  name_en: string
  name_original?: string | null
  value: number | null
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  notes?: string | null
}

export interface PanelManualInput {
  panel_date: string
  lab_name?: string | null
  markers: MarkerInput[]
}

export function computeOutOfRange(m: MarkerInput): boolean {
  if (m.value == null) return false
  if (m.ref_low != null && m.value < m.ref_low) return true
  if (m.ref_high != null && m.value > m.ref_high) return true
  return false
}

export async function addPanelManual(input: PanelManualInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' as const }

  const outOfRangeCount = input.markers.reduce(
    (acc, m) => acc + (computeOutOfRange(m) ? 1 : 0), 0
  )

  const { data: panel, error: pErr } = await supabase
    .from('lab_panels')
    .insert({
      user_id: user.id,
      panel_date: input.panel_date,
      lab_name: input.lab_name ?? null,
      status: 'ready',
      out_of_range_count: outOfRangeCount,
    })
    .select('id').single()
  if (pErr) return { ok: false, error: pErr.message }

  const markersRows = input.markers.map(m => ({
    panel_id: panel.id,
    user_id: user.id,
    name_en: m.name_en,
    name_original: m.name_original ?? null,
    value: m.value,
    unit: m.unit,
    reference_range_low: m.ref_low,
    reference_range_high: m.ref_high,
    is_out_of_range: computeOutOfRange(m),
    confidence: 'high' as const,
    status: 'confirmed' as const,
    notes: m.notes ?? null,
  }))

  const { error: mErr } = await supabase.from('lab_markers').insert(markersRows)
  if (mErr) return { ok: false, error: mErr.message }

  revalidatePath('/data/health/bloodwork')
  revalidatePath('/data/health')
  revalidatePath('/data')
  return { ok: true, id: panel.id }
}

export async function listPanels() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lab_panels').select('*').order('panel_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function getPanelWithMarkers(panelId: string) {
  const supabase = await createClient()
  const [pRes, mRes] = await Promise.all([
    supabase.from('lab_panels').select('*').eq('id', panelId).single(),
    supabase.from('lab_markers').select('*').eq('panel_id', panelId).order('name_en'),
  ])
  if (pRes.error) throw new Error(pRes.error.message)
  if (mRes.error) throw new Error(mRes.error.message)
  return { panel: pRes.data, markers: mRes.data }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/actions/health/__tests__/bloodwork.actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/health/bloodwork.actions.ts src/lib/actions/health/__tests__/bloodwork.actions.test.ts
git commit -m "feat(health): bloodwork manual actions + tests"
```

---

## Task 8: Health snapshot analytics (TDD)

**Files:**
- Create: `src/lib/analytics/health/bloodwork-snapshot.ts`
- Create: `src/lib/analytics/health/garmin-trends.ts`
- Create: `src/lib/analytics/health/supplements-snapshot.ts`
- Create: `src/lib/analytics/health/medicals-snapshot.ts`
- Create: `src/lib/analytics/health/body-comp-snapshot.ts`
- Create: `src/lib/analytics/health/__tests__/snapshots.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/analytics/health/__tests__/snapshots.test.ts
import { describe, it, expect } from 'vitest'
import { latestBloodworkSnapshot } from '../bloodwork-snapshot'
import { garminSevenDayTrends } from '../garmin-trends'
import { activeSupplementsSnapshot } from '../supplements-snapshot'
import { latestMedicalsSnapshot } from '../medicals-snapshot'
import { latestBodyCompSnapshot } from '../body-comp-snapshot'

describe('health snapshots', () => {
  it('returns empty defaults when no data exists for user', async () => {
    const userId = 'test-user-empty'
    const bw = await latestBloodworkSnapshot(userId)
    expect(bw).toEqual({ last_panel_date: null, out_of_range_count: 0 })
    const g = await garminSevenDayTrends(userId)
    expect(g.sleep_trend).toBe('flat')
    const sup = await activeSupplementsSnapshot(userId)
    expect(sup.count).toBe(0)
    const med = await latestMedicalsSnapshot(userId)
    expect(med.last_event_date).toBeNull()
    const bc = await latestBodyCompSnapshot(userId)
    expect(bc.latest).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/analytics/health/__tests__/snapshots.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement bloodwork-snapshot**

```ts
// src/lib/analytics/health/bloodwork-snapshot.ts
import { createClient } from '@/lib/supabase/server'

export interface BloodworkSnapshot {
  last_panel_date: string | null
  out_of_range_count: number
}

export async function latestBloodworkSnapshot(userId: string): Promise<BloodworkSnapshot> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('lab_panels')
    .select('panel_date, out_of_range_count')
    .eq('user_id', userId)
    .order('panel_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return { last_panel_date: null, out_of_range_count: 0 }
  return { last_panel_date: data.panel_date, out_of_range_count: data.out_of_range_count ?? 0 }
}
```

- [ ] **Step 4: Implement garmin-trends**

```ts
// src/lib/analytics/health/garmin-trends.ts
import { createClient } from '@/lib/supabase/server'

export type Trend = 'up' | 'down' | 'flat'

export interface GarminTrends {
  last_synced: string | null
  sleep_trend: Trend
  hrv_trend: Trend
  rhr_trend: Trend
}

function classifyTrend(series: number[], flatThreshold = 0.05): Trend {
  if (series.length < 4) return 'flat'
  const mid = Math.floor(series.length / 2)
  const firstHalfAvg = series.slice(0, mid).reduce((a, b) => a + b, 0) / mid
  const secondHalfAvg = series.slice(mid).reduce((a, b) => a + b, 0) / (series.length - mid)
  if (firstHalfAvg === 0) return 'flat'
  const pct = (secondHalfAvg - firstHalfAvg) / firstHalfAvg
  if (pct > flatThreshold) return 'up'
  if (pct < -flatThreshold) return 'down'
  return 'flat'
}

export async function garminSevenDayTrends(userId: string): Promise<GarminTrends> {
  const supabase = await createClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('garmin_daily')
    .select('date, sleep_total_min, hrv_overnight_avg, resting_hr')
    .eq('user_id', userId).gte('date', sevenDaysAgo)
    .order('date', { ascending: true })
  if (!data || data.length === 0) {
    return { last_synced: null, sleep_trend: 'flat', hrv_trend: 'flat', rhr_trend: 'flat' }
  }
  const sleep = data.map(d => d.sleep_total_min ?? 0)
  const hrv = data.map(d => d.hrv_overnight_avg ?? 0)
  const rhr = data.map(d => d.resting_hr ?? 0)
  return {
    last_synced: data[data.length - 1].date,
    sleep_trend: classifyTrend(sleep),
    hrv_trend: classifyTrend(hrv),
    // lower RHR is good — invert so "up" arrow always means positive
    rhr_trend: invertTrend(classifyTrend(rhr)),
  }
}

function invertTrend(t: Trend): Trend {
  return t === 'up' ? 'down' : t === 'down' ? 'up' : 'flat'
}
```

- [ ] **Step 5: Implement supplements-snapshot**

```ts
// src/lib/analytics/health/supplements-snapshot.ts
import { createClient } from '@/lib/supabase/server'

export async function activeSupplementsSnapshot(userId: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('supplements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).is('end_date', null)
  return { count: count ?? 0 }
}
```

- [ ] **Step 6: Implement medicals-snapshot**

```ts
// src/lib/analytics/health/medicals-snapshot.ts
import { createClient } from '@/lib/supabase/server'

export async function latestMedicalsSnapshot(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('medical_events')
    .select('event_date, event_type, title')
    .eq('user_id', userId)
    .order('event_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return { last_event_date: null, last_event_type: null, last_event_title: null }
  return {
    last_event_date: data.event_date,
    last_event_type: data.event_type,
    last_event_title: data.title,
  }
}
```

- [ ] **Step 7: Implement body-comp-snapshot**

```ts
// src/lib/analytics/health/body-comp-snapshot.ts
import { createClient } from '@/lib/supabase/server'

export async function latestBodyCompSnapshot(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('body_composition_measurements')
    .select('measured_on, weight_kg, body_fat_pct')
    .eq('user_id', userId)
    .order('measured_on', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { latest: data ?? null }
}
```

- [ ] **Step 8: Run tests — expect pass**

Run: `npx vitest run src/lib/analytics/health/__tests__/snapshots.test.ts`
Expected: PASS (empty-state assertions).

- [ ] **Step 9: Commit**

```bash
git add src/lib/analytics/health/
git commit -m "feat(health): analytics snapshots + tests"
```

---

## Task 9: `HealthSnapshotTile` component

**Files:**
- Create: `src/components/data/overview/HealthSnapshotTile.tsx`

- [ ] **Step 1: Implement the tile**

```tsx
// src/components/data/overview/HealthSnapshotTile.tsx
import Link from 'next/link'
import { Activity, ArrowDown, ArrowUp, Minus, FileText } from 'lucide-react'
import type { BloodworkSnapshot } from '@/lib/analytics/health/bloodwork-snapshot'
import type { GarminTrends } from '@/lib/analytics/health/garmin-trends'

function TrendIcon({ t }: { t: 'up' | 'down' | 'flat' }) {
  if (t === 'up') return <ArrowUp className="w-3 h-3 text-emerald-500" />
  if (t === 'down') return <ArrowDown className="w-3 h-3 text-amber-500" />
  return <Minus className="w-3 h-3 text-neutral-500" />
}

export function HealthSnapshotTile(props: {
  bloodwork: BloodworkSnapshot
  garmin: GarminTrends
  activeSupplements: number
}) {
  const { bloodwork, garmin, activeSupplements } = props
  const daysSince = bloodwork.last_panel_date
    ? Math.floor(
        (Date.now() - new Date(bloodwork.last_panel_date).getTime()) / 86400000
      )
    : null

  return (
    <Link
      href="/data/health"
      className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-amber-900 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-space-grotesk text-neutral-200">Health</h3>
        </div>
        <Link
          href="/data/health/doctor-report"
          onClick={e => e.stopPropagation()}
          className="text-xs flex items-center gap-1 text-amber-600 hover:text-amber-500"
        >
          <FileText className="w-3 h-3" /> Report
        </Link>
      </div>
      <div className="space-y-1.5 text-xs text-neutral-400">
        <div>
          {bloodwork.last_panel_date
            ? `Last panel ${daysSince}d ago · ${bloodwork.out_of_range_count} markers out of range`
            : 'No bloodwork yet'}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            Sleep <TrendIcon t={garmin.sleep_trend} />
          </span>
          <span className="flex items-center gap-1">
            HRV <TrendIcon t={garmin.hrv_trend} />
          </span>
          <span className="flex items-center gap-1">
            RHR <TrendIcon t={garmin.rhr_trend} />
          </span>
        </div>
        <div>{activeSupplements} active supplements</div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/data/overview/HealthSnapshotTile.tsx
git commit -m "feat(health): HealthSnapshotTile component"
```

---

## Task 10: Wire `HealthSnapshotTile` into `/data/` overview

**Files:**
- Modify: `src/app/data/page.tsx`
- Modify: `src/components/data/TrainingOverview.tsx`
- Modify: `src/lib/actions/data.actions.ts` — add `getHealthSnapshot`

- [ ] **Step 1: Add `getHealthSnapshot` action**

Open `src/lib/actions/data.actions.ts`, append:

```ts
import { latestBloodworkSnapshot } from '@/lib/analytics/health/bloodwork-snapshot'
import { garminSevenDayTrends } from '@/lib/analytics/health/garmin-trends'
import { activeSupplementsSnapshot } from '@/lib/analytics/health/supplements-snapshot'

export async function getHealthSnapshot() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'unauthenticated' }
  const [bloodwork, garmin, sup] = await Promise.all([
    latestBloodworkSnapshot(user.id),
    garminSevenDayTrends(user.id),
    activeSupplementsSnapshot(user.id),
  ])
  return { success: true as const, data: {
    bloodwork, garmin, activeSupplements: sup.count,
  } }
}
```

(If `createClient` is not yet imported in this file, follow the existing import conventions at the top.)

- [ ] **Step 2: Update the page to fetch both overviews in parallel**

Replace the body of `src/app/data/page.tsx`:

```tsx
import { AlertTriangle } from "lucide-react"
import { getTrainingOverview, getHealthSnapshot } from "@/lib/actions/data.actions"
import { TrainingOverview } from "@/components/data/TrainingOverview"
import { HealthSnapshotTile } from "@/components/data/overview/HealthSnapshotTile"

export default async function DataPage() {
  const [trainingRes, healthRes] = await Promise.all([
    getTrainingOverview(),
    getHealthSnapshot(),
  ])

  if (!trainingRes.success) {
    return (
      <div className="p-6 text-center mt-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-space-grotesk text-white mb-2">Failed to Load</h2>
        <p className="text-neutral-500 font-inter">{trainingRes.error}</p>
      </div>
    )
  }
  const { data } = trainingRes

  const healthTile = healthRes.success ? (
    <HealthSnapshotTile
      bloodwork={healthRes.data.bloodwork}
      garmin={healthRes.data.garmin}
      activeSupplements={healthRes.data.activeSupplements}
    />
  ) : null

  if (!data.mesocycleName) {
    return (
      <div className="p-6 animate-in fade-in duration-500">
        <div className="text-center mt-12 mb-12">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-neutral-900 flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <h2 className="text-xl font-space-grotesk text-white mb-2">No Active Training Block</h2>
          <p className="text-neutral-500 font-inter text-sm">
            Start a mesocycle to see your training data here.
          </p>
        </div>
        {healthTile}
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-500">
      <TrainingOverview data={data} healthTile={healthTile} />
    </div>
  )
}
```

- [ ] **Step 3: Accept `healthTile` in `TrainingOverview`**

Modify `src/components/data/TrainingOverview.tsx`:
- Add `healthTile?: React.ReactNode` to its props.
- Render `{healthTile}` as an extra cell in whatever grid currently lays out the four training tiles (follow the existing pattern in that file — the tile is a `Link` with its own card styling so it slots alongside the others).

- [ ] **Step 4: Verify by running the dev server and loading `/data`**

Run:
```bash
npm run dev
```
Then open `http://localhost:3000/data` — the tile appears with "No bloodwork yet" and "0 active supplements" for a fresh account.

- [ ] **Step 5: Commit**

```bash
git add src/app/data/page.tsx src/components/data/TrainingOverview.tsx src/lib/actions/data.actions.ts
git commit -m "feat(health): wire HealthSnapshotTile into /data overview"
```

---

## Task 11: `/data/health/` landing page

**Files:**
- Create: `src/app/data/health/page.tsx`
- Create: `src/components/data/health/HealthLanding.tsx`

- [ ] **Step 1: Landing server component**

```tsx
// src/app/data/health/page.tsx
import { getHealthSnapshot } from '@/lib/actions/data.actions'
import { latestMedicalsSnapshot } from '@/lib/analytics/health/medicals-snapshot'
import { latestBodyCompSnapshot } from '@/lib/analytics/health/body-comp-snapshot'
import { createClient } from '@/lib/supabase/server'
import { HealthLanding } from '@/components/data/health/HealthLanding'
import { redirect } from 'next/navigation'

export default async function HealthDomainPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const snap = await getHealthSnapshot()
  const [medicals, bodyComp] = await Promise.all([
    latestMedicalsSnapshot(user.id),
    latestBodyCompSnapshot(user.id),
  ])

  return (
    <HealthLanding
      bloodwork={snap.success ? snap.data.bloodwork : { last_panel_date: null, out_of_range_count: 0 }}
      garmin={snap.success ? snap.data.garmin : { last_synced: null, sleep_trend: 'flat', hrv_trend: 'flat', rhr_trend: 'flat' }}
      activeSupplements={snap.success ? snap.data.activeSupplements : 0}
      medicals={medicals}
      bodyComp={bodyComp}
    />
  )
}
```

- [ ] **Step 2: Landing client component — five cards + report CTA**

```tsx
// src/components/data/health/HealthLanding.tsx
'use client'
import Link from 'next/link'
import { FileText, Droplet, Pill, Stethoscope, Watch, Scale } from 'lucide-react'

type Snapshot = {
  bloodwork: { last_panel_date: string | null; out_of_range_count: number }
  garmin: { last_synced: string | null }
  activeSupplements: number
  medicals: { last_event_date: string | null; last_event_type: string | null }
  bodyComp: { latest: { measured_on: string; weight_kg: number | null; body_fat_pct: number | null } | null }
}

function Card(props: { href: string; icon: React.ReactNode; title: string; status: string }) {
  return (
    <Link href={props.href} className="block p-4 rounded-lg border border-neutral-800 bg-neutral-950 hover:border-amber-900 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        {props.icon}
        <h3 className="text-sm font-space-grotesk text-neutral-200">{props.title}</h3>
      </div>
      <div className="text-xs text-neutral-400">{props.status}</div>
    </Link>
  )
}

export function HealthLanding(s: Snapshot) {
  const bwStatus = s.bloodwork.last_panel_date
    ? `${s.bloodwork.last_panel_date} · ${s.bloodwork.out_of_range_count} out of range`
    : 'No panels yet'
  const medStatus = s.medicals.last_event_date
    ? `${s.medicals.last_event_type} on ${s.medicals.last_event_date}`
    : 'No events logged'
  const bcStatus = s.bodyComp.latest
    ? `${s.bodyComp.latest.weight_kg ?? '—'}kg · ${s.bodyComp.latest.body_fat_pct ?? '—'}%`
    : 'No measurements yet'
  const garminStatus = s.garmin.last_synced
    ? `Last synced ${s.garmin.last_synced}`
    : 'Not connected'

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk text-neutral-100">Health</h1>
        <Link href="/data/health/doctor-report"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-900/30 border border-amber-800 text-amber-200 text-sm">
          <FileText className="w-4 h-4" /> Generate doctor report
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card href="/data/health/bloodwork" icon={<Droplet className="w-4 h-4 text-amber-600" />} title="Bloodwork" status={bwStatus} />
        <Card href="/data/health/supplements" icon={<Pill className="w-4 h-4 text-amber-600" />} title="Supplements" status={`${s.activeSupplements} active`} />
        <Card href="/data/health/medicals" icon={<Stethoscope className="w-4 h-4 text-amber-600" />} title="Medicals" status={medStatus} />
        <Card href="/data/health/garmin" icon={<Watch className="w-4 h-4 text-amber-600" />} title="Garmin" status={garminStatus} />
        <Card href="/data/health/body-comp" icon={<Scale className="w-4 h-4 text-amber-600" />} title="Body Composition" status={bcStatus} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Visual check**

Run `npm run dev`, visit `/data/health`. Expected: five cards + report CTA.

- [ ] **Step 4: Commit**

```bash
git add src/app/data/health/page.tsx src/components/data/health/HealthLanding.tsx
git commit -m "feat(health): /data/health landing with 5 subcategory cards"
```

---

## Task 12: Supplements subpage (list + form)

**Files:**
- Create: `src/app/data/health/supplements/page.tsx`
- Create: `src/components/data/health/SupplementsList.tsx`
- Create: `src/components/data/health/SupplementForm.tsx`

- [ ] **Step 1: Page server component**

```tsx
// src/app/data/health/supplements/page.tsx
import { listSupplements } from '@/lib/actions/health/supplements.actions'
import { SupplementsList } from '@/components/data/health/SupplementsList'

export default async function Page() {
  const [active, ended] = await Promise.all([
    listSupplements({ include_ended: false }),
    listSupplements({ include_ended: true }),
  ])
  const endedOnly = ended.filter(s => s.end_date)
  return <SupplementsList active={active} ended={endedOnly} />
}
```

- [ ] **Step 2: Client list**

```tsx
// src/components/data/health/SupplementsList.tsx
'use client'
import { useState } from 'react'
import { SupplementForm } from './SupplementForm'
import { endSupplement } from '@/lib/actions/health/supplements.actions'
import { Plus } from 'lucide-react'

type Supplement = {
  id: string; name: string; dose: number | null; dose_unit: string | null
  timing: string[]; start_date: string; end_date: string | null; notes: string | null
}

export function SupplementsList({ active, ended }: { active: Supplement[]; ended: Supplement[] }) {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk">Supplements</h1>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 text-sm text-amber-500">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      {showAdd && <SupplementForm onDone={() => setShowAdd(false)} />}
      <section>
        <h2 className="text-sm text-neutral-400 mb-2">Active ({active.length})</h2>
        {active.map(s => (
          <div key={s.id} className="p-3 border border-neutral-800 rounded mb-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-neutral-100">{s.name}</div>
                <div className="text-xs text-neutral-400">
                  {s.dose ?? '—'}{s.dose_unit ?? ''} · {s.timing.join(', ') || '—'} · since {s.start_date}
                </div>
              </div>
              <button
                onClick={() => endSupplement(s.id, new Date().toISOString().slice(0, 10))}
                className="text-xs text-neutral-500 hover:text-amber-500">End</button>
            </div>
          </div>
        ))}
      </section>
      <section>
        <h2 className="text-sm text-neutral-400 mb-2">Ended ({ended.length})</h2>
        {ended.map(s => (
          <div key={s.id} className="p-3 border border-neutral-900 rounded mb-2 opacity-70">
            <div className="text-neutral-300">{s.name}</div>
            <div className="text-xs text-neutral-500">
              {s.start_date} → {s.end_date}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Add form**

```tsx
// src/components/data/health/SupplementForm.tsx
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
```

- [ ] **Step 4: Visual check**

Run `npm run dev`, `/data/health/supplements`. Add a supplement, confirm it appears in Active list.

- [ ] **Step 5: Commit**

```bash
git add src/app/data/health/supplements/ src/components/data/health/SupplementsList.tsx src/components/data/health/SupplementForm.tsx
git commit -m "feat(health): supplements subpage list + form"
```

---

## Task 13: Medicals subpage (list + form)

**Files:**
- Create: `src/app/data/health/medicals/page.tsx`
- Create: `src/components/data/health/MedicalsList.tsx`
- Create: `src/components/data/health/MedicalEventForm.tsx`

- [ ] **Step 1: Page server component**

```tsx
// src/app/data/health/medicals/page.tsx
import { listMedicalEvents } from '@/lib/actions/health/medicals.actions'
import { MedicalsList } from '@/components/data/health/MedicalsList'

export default async function Page() {
  const events = await listMedicalEvents()
  return <MedicalsList events={events} />
}
```

- [ ] **Step 2: Client list**

```tsx
// src/components/data/health/MedicalsList.tsx
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
```

- [ ] **Step 3: Add form**

```tsx
// src/components/data/health/MedicalEventForm.tsx
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
```

- [ ] **Step 4: Visual check**

Run `npm run dev`, `/data/health/medicals`. Add a `lab_test` with VO2 structured_data. Verify it renders JSON.

- [ ] **Step 5: Commit**

```bash
git add src/app/data/health/medicals/ src/components/data/health/MedicalsList.tsx src/components/data/health/MedicalEventForm.tsx
git commit -m "feat(health): medicals subpage list + form"
```

---

## Task 14: Body comp subpage (list + form)

**Files:**
- Create: `src/app/data/health/body-comp/page.tsx`
- Create: `src/components/data/health/BodyCompList.tsx`
- Create: `src/components/data/health/BodyCompForm.tsx`

- [ ] **Step 1: Page + components**

```tsx
// src/app/data/health/body-comp/page.tsx
import { listBodyComp } from '@/lib/actions/health/body-comp.actions'
import { BodyCompList } from '@/components/data/health/BodyCompList'
export default async function Page() {
  const rows = await listBodyComp()
  return <BodyCompList rows={rows} />
}
```

```tsx
// src/components/data/health/BodyCompList.tsx
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
```

```tsx
// src/components/data/health/BodyCompForm.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/data/health/body-comp/ src/components/data/health/BodyCompList.tsx src/components/data/health/BodyCompForm.tsx
git commit -m "feat(health): body-comp subpage list + form"
```

---

## Task 15: Bloodwork subpage (manual form)

**Files:**
- Create: `src/app/data/health/bloodwork/page.tsx`
- Create: `src/app/data/health/bloodwork/new/page.tsx`
- Create: `src/app/data/health/bloodwork/[id]/page.tsx`
- Create: `src/components/data/health/BloodworkList.tsx`
- Create: `src/components/data/health/BloodworkManualForm.tsx`
- Create: `src/components/data/health/PanelDetail.tsx`

- [ ] **Step 1: List page**

```tsx
// src/app/data/health/bloodwork/page.tsx
import Link from 'next/link'
import { listPanels } from '@/lib/actions/health/bloodwork.actions'
import { Upload, Plus } from 'lucide-react'

export default async function Page() {
  const panels = await listPanels()
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk">Bloodwork</h1>
        <Link href="/data/health/bloodwork/new" className="inline-flex items-center gap-1 text-sm text-amber-500">
          <Plus className="w-4 h-4" /> Enter manually
        </Link>
        {/* Upload CTA appears in Plan 3 */}
      </div>
      {panels.length === 0 && (
        <div className="p-6 border border-neutral-800 rounded text-center text-sm text-neutral-500">
          No bloodwork yet. <Link href="/data/health/bloodwork/new" className="text-amber-500">Enter your first panel</Link>.
        </div>
      )}
      {panels.map(p => (
        <Link key={p.id} href={`/data/health/bloodwork/${p.id}`}
          className="block p-3 border border-neutral-800 rounded hover:border-amber-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-neutral-100">{p.panel_date}</div>
              <div className="text-xs text-neutral-500">{p.lab_name ?? 'No lab name'}</div>
            </div>
            <div className="text-xs">
              <span className={p.out_of_range_count > 0 ? 'text-amber-500' : 'text-neutral-500'}>
                {p.out_of_range_count} out of range
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: New-panel manual form route**

```tsx
// src/app/data/health/bloodwork/new/page.tsx
import { BloodworkManualForm } from '@/components/data/health/BloodworkManualForm'
export default function Page() {
  return <div className="p-4"><BloodworkManualForm /></div>
}
```

- [ ] **Step 3: Manual form**

```tsx
// src/components/data/health/BloodworkManualForm.tsx
'use client'
import { useState } from 'react'
import { addPanelManual, type MarkerInput } from '@/lib/actions/health/bloodwork.actions'
import { useRouter } from 'next/navigation'
import { Plus, Trash } from 'lucide-react'

export function BloodworkManualForm() {
  const router = useRouter()
  const [panelDate, setPanelDate] = useState(new Date().toISOString().slice(0, 10))
  const [labName, setLabName] = useState('')
  const [markers, setMarkers] = useState<MarkerInput[]>([
    { name_en: '', value: null, unit: '', ref_low: null, ref_high: null },
  ])

  function updateMarker(i: number, patch: Partial<MarkerInput>) {
    setMarkers(ms => ms.map((m, idx) => idx === i ? { ...m, ...patch } : m))
  }
  function addMarker() {
    setMarkers(ms => [...ms, { name_en: '', value: null, unit: '', ref_low: null, ref_high: null }])
  }
  function removeMarker(i: number) {
    setMarkers(ms => ms.filter((_, idx) => idx !== i))
  }

  async function submit() {
    const res = await addPanelManual({
      panel_date: panelDate,
      lab_name: labName || null,
      markers: markers.filter(m => m.name_en.trim()),
    })
    if (res.ok) router.push(`/data/health/bloodwork/${res.id}`)
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-space-grotesk">Enter panel manually</h1>
      <div className="flex gap-2">
        <input type="date" value={panelDate} onChange={e => setPanelDate(e.target.value)} className="bg-neutral-900 p-2 rounded text-sm" />
        <input value={labName} onChange={e => setLabName(e.target.value)} placeholder="Lab name" className="bg-neutral-900 p-2 rounded text-sm flex-1" />
      </div>
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
      <div>
        <button onClick={submit} className="px-3 py-2 text-sm bg-amber-900/50 border border-amber-800 rounded">
          Save panel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Panel detail page**

```tsx
// src/app/data/health/bloodwork/[id]/page.tsx
import { getPanelWithMarkers } from '@/lib/actions/health/bloodwork.actions'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { panel, markers } = await getPanelWithMarkers(id)
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-space-grotesk">{panel.panel_date}</h1>
      <div className="text-sm text-neutral-400">{panel.lab_name ?? 'Manually entered'}</div>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-neutral-500">
          <th className="text-left py-1">Marker</th><th className="text-right py-1">Value</th>
          <th className="text-right py-1">Unit</th><th className="text-right py-1">Range</th>
        </tr></thead>
        <tbody>
          {markers.map(m => (
            <tr key={m.id} className={`border-t border-neutral-900 ${m.is_out_of_range ? 'text-amber-500' : ''}`}>
              <td className="py-1">{m.name_en}</td>
              <td className="py-1 text-right">{m.value ?? '—'}</td>
              <td className="py-1 text-right text-neutral-500">{m.unit ?? ''}</td>
              <td className="py-1 text-right text-xs text-neutral-500">
                {m.reference_range_low ?? '—'} – {m.reference_range_high ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Visual check**

Run `npm run dev`. At `/data/health/bloodwork/new`, enter a panel with two markers (one in range, one out of range). Verify the panel detail shows the out-of-range one highlighted amber.

- [ ] **Step 6: Commit**

```bash
git add src/app/data/health/bloodwork/ src/components/data/health/BloodworkList.tsx src/components/data/health/BloodworkManualForm.tsx
git commit -m "feat(health): bloodwork subpage + manual entry form"
```

---

## Task 16: Garmin display subpage (read-only)

**Files:**
- Create: `src/app/data/health/garmin/page.tsx`
- Create: `src/components/data/health/GarminDisplay.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/data/health/garmin/page.tsx
import { createClient } from '@/lib/supabase/server'
import { GarminDisplay } from '@/components/data/health/GarminDisplay'
import { redirect } from 'next/navigation'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const [credsRes, dailiesRes, vo2Res] = await Promise.all([
    supabase.from('garmin_credentials').select('last_sync_at, last_sync_status').eq('user_id', user.id).maybeSingle(),
    supabase.from('garmin_daily').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(30),
    supabase.from('garmin_vo2_trend').select('*').eq('user_id', user.id).order('measured_on', { ascending: false }).limit(20),
  ])

  return (
    <GarminDisplay
      creds={credsRes.data ?? null}
      dailies={dailiesRes.data ?? []}
      vo2={vo2Res.data ?? []}
    />
  )
}
```

- [ ] **Step 2: Display component (connect CTA stubbed out — Plan 3 fills it)**

```tsx
// src/components/data/health/GarminDisplay.tsx
'use client'

type Creds = { last_sync_at: string | null; last_sync_status: string | null } | null
type Daily = {
  date: string; sleep_total_min: number | null; hrv_overnight_avg: number | null;
  resting_hr: number | null; body_battery_min: number | null; stress_avg: number | null
}
type Vo2 = { measured_on: string; modality: string; vo2_max: number }

export function GarminDisplay({ creds, dailies, vo2 }: { creds: Creds; dailies: Daily[]; vo2: Vo2[] }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk">Garmin</h1>
        {!creds && (
          <a
            href="/data/health/garmin/connect"
            className="text-sm text-amber-500 opacity-50 pointer-events-none"
            title="Available in Plan 3 (auto-ingestion)"
          >Connect (coming soon)</a>
        )}
      </div>
      {!creds && (
        <div className="p-6 border border-neutral-800 rounded text-center text-sm text-neutral-500">
          Not connected. Garmin auto-sync arrives with Plan 3.
        </div>
      )}
      {creds && (
        <div className="text-xs text-neutral-500">
          Last synced: {creds.last_sync_at ?? 'never'} · Status: {creds.last_sync_status ?? '—'}
        </div>
      )}
      {dailies.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-neutral-500">
            <th className="text-left py-1">Date</th><th>Sleep</th><th>HRV</th>
            <th>RHR</th><th>Body Battery</th><th>Stress</th>
          </tr></thead>
          <tbody>
            {dailies.map(d => (
              <tr key={d.date} className="border-t border-neutral-900">
                <td className="py-1">{d.date}</td>
                <td className="text-center">{d.sleep_total_min ?? '—'}</td>
                <td className="text-center">{d.hrv_overnight_avg ?? '—'}</td>
                <td className="text-center">{d.resting_hr ?? '—'}</td>
                <td className="text-center">{d.body_battery_min ?? '—'}</td>
                <td className="text-center">{d.stress_avg ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {vo2.length > 0 && (
        <section>
          <h2 className="text-sm text-neutral-400 mb-2">VO2 Max trend</h2>
          {vo2.map(v => (
            <div key={v.measured_on} className="text-xs text-neutral-500">
              {v.measured_on} · {v.modality} · {v.vo2_max}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/data/health/garmin/ src/components/data/health/GarminDisplay.tsx
git commit -m "feat(health): garmin display subpage (read-only, Plan 3 populates)"
```

---

## Task 17: `DoctorReportSnapshot` builder (TDD)

**Files:**
- Create: `src/lib/reports/doctor-report-builder.ts`
- Create: `src/lib/reports/__tests__/doctor-report-builder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/reports/__tests__/doctor-report-builder.test.ts
import { describe, it, expect } from 'vitest'
import { resolveWindow } from '../doctor-report-builder'

describe('resolveWindow', () => {
  it('6mo default', () => {
    const w = resolveWindow({ preset: '6mo', now: new Date('2026-04-20') })
    expect(w.start).toBe('2025-10-20')
    expect(w.end).toBe('2026-04-20')
    expect(w.preset).toBe('6mo')
  })
  it('3mo', () => {
    const w = resolveWindow({ preset: '3mo', now: new Date('2026-04-20') })
    expect(w.start).toBe('2026-01-20')
  })
  it('12mo', () => {
    const w = resolveWindow({ preset: '12mo', now: new Date('2026-04-20') })
    expect(w.start).toBe('2025-04-20')
  })
  it('custom uses provided range', () => {
    const w = resolveWindow({ preset: 'custom', start: '2025-12-01', end: '2026-03-31' })
    expect(w.start).toBe('2025-12-01')
    expect(w.end).toBe('2026-03-31')
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/reports/__tests__/doctor-report-builder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement builder + window math**

```ts
// src/lib/reports/doctor-report-builder.ts
import { createClient } from '@/lib/supabase/server'
import type { DoctorReportSnapshot, DoctorReportWindow, WindowPreset } from './types'

type ResolveArgs =
  | { preset: '3mo' | '6mo' | '12mo'; now?: Date }
  | { preset: 'custom'; start: string; end: string }

export function resolveWindow(args: ResolveArgs): DoctorReportWindow {
  if (args.preset === 'custom') {
    return { start: args.start, end: args.end, preset: 'custom' }
  }
  const now = args.now ?? new Date()
  const monthsBack = args.preset === '3mo' ? 3 : args.preset === '6mo' ? 6 : 12
  const start = new Date(now)
  start.setMonth(start.getMonth() - monthsBack)
  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
    preset: args.preset,
  }
}

export async function buildDoctorReportSnapshot(params: {
  userId: string
  window: DoctorReportWindow
}): Promise<DoctorReportSnapshot> {
  const { userId, window } = params
  const supabase = await createClient()

  // Athlete name
  const { data: profile } = await supabase
    .from('profiles').select('display_name').eq('id', userId).maybeSingle()
  const athleteName = profile?.display_name ?? 'Athlete'

  // Bloodwork panels + markers in window
  const { data: panels } = await supabase
    .from('lab_panels')
    .select('id, panel_date, lab_name, out_of_range_count')
    .eq('user_id', userId)
    .gte('panel_date', window.start).lte('panel_date', window.end)
    .order('panel_date', { ascending: false })

  const panelIds = (panels ?? []).map(p => p.id)
  const { data: markers } = panelIds.length
    ? await supabase.from('lab_markers').select('*').in('panel_id', panelIds).eq('status', 'confirmed')
    : { data: [] as any[] }

  const panelsByMarkers = (panels ?? []).map(p => ({
    id: p.id,
    panel_date: p.panel_date,
    lab_name: p.lab_name,
    out_of_range_count: p.out_of_range_count ?? 0,
    markers: (markers ?? []).filter(m => m.panel_id === p.id).map(m => ({
      name_en: m.name_en,
      name_original: m.name_original,
      value: m.value,
      unit: m.unit,
      ref_low: m.reference_range_low,
      ref_high: m.reference_range_high,
      out_of_range: !!m.is_out_of_range,
      panel_date: p.panel_date,
    })),
  }))

  // Trend series per marker name (only for markers appearing in 2+ panels)
  const trends: Record<string, { date: string; value: number }[]> = {}
  for (const m of markers ?? []) {
    if (m.value == null) continue
    const panelDate = (panels ?? []).find(p => p.id === m.panel_id)?.panel_date
    if (!panelDate) continue
    trends[m.name_en] ??= []
    trends[m.name_en].push({ date: panelDate, value: m.value })
  }
  const trendsFiltered: Record<string, { date: string; value: number }[]> = {}
  for (const [k, v] of Object.entries(trends)) {
    if (v.length >= 2) trendsFiltered[k] = v.sort((a, b) => a.date.localeCompare(b.date))
  }

  // Garmin daily series
  const { data: dailies } = await supabase
    .from('garmin_daily')
    .select('date, sleep_total_min, hrv_overnight_avg, resting_hr')
    .eq('user_id', userId)
    .gte('date', window.start).lte('date', window.end)
    .order('date', { ascending: true })

  const garmin = {
    sleep_daily: (dailies ?? []).map(d => ({ date: d.date, value: d.sleep_total_min ?? 0 })),
    hrv_daily: (dailies ?? []).map(d => ({ date: d.date, value: d.hrv_overnight_avg ?? 0 })),
    rhr_daily: (dailies ?? []).map(d => ({ date: d.date, value: d.resting_hr ?? 0 })),
    vo2_trend: [] as { date: string; value: number }[],
  }
  const { data: vo2 } = await supabase
    .from('garmin_vo2_trend').select('measured_on, vo2_max')
    .eq('user_id', userId)
    .gte('measured_on', window.start).lte('measured_on', window.end)
    .order('measured_on', { ascending: true })
  garmin.vo2_trend = (vo2 ?? []).map(r => ({ date: r.measured_on, value: r.vo2_max }))

  // Supplements: active at report-end AND started/ended in window
  const { data: supsAll } = await supabase
    .from('supplements').select('*')
    .eq('user_id', userId)
    .or(`end_date.is.null,and(end_date.gte.${window.start})`)

  const supplements = (supsAll ?? []).map(s => {
    const startedInWindow = s.start_date >= window.start && s.start_date <= window.end
    const endedInWindow = s.end_date && s.end_date >= window.start && s.end_date <= window.end
    const event: 'active' | 'started_in_window' | 'ended_in_window' =
      endedInWindow ? 'ended_in_window'
      : startedInWindow ? 'started_in_window'
      : 'active'
    return {
      name: s.name, dose: s.dose, dose_unit: s.dose_unit, timing: s.timing ?? [],
      start_date: s.start_date, end_date: s.end_date, notes: s.notes,
      event,
    }
  })

  // Medicals in window
  const { data: medicalsRows } = await supabase
    .from('medical_events').select('*')
    .eq('user_id', userId)
    .gte('event_date', window.start).lte('event_date', window.end)
    .order('event_date', { ascending: false })

  const medicals = (medicalsRows ?? []).map(e => ({
    event_type: e.event_type, event_date: e.event_date, title: e.title,
    details: e.details, structured_data: e.structured_data,
    has_attachment: !!e.attachment_path,
  }))

  // Body comp in window
  const { data: bcRows } = await supabase
    .from('body_composition_measurements').select('*')
    .eq('user_id', userId)
    .gte('measured_on', window.start).lte('measured_on', window.end)
    .order('measured_on', { ascending: true })

  const body_comp = (bcRows ?? []).map(b => ({
    measured_on: b.measured_on, method: b.method,
    weight_kg: b.weight_kg, body_fat_pct: b.body_fat_pct, lean_mass_kg: b.lean_mass_kg,
  }))

  const summary_line = buildSummaryLine({
    totalMarkers: (markers ?? []).length,
    panelCount: (panels ?? []).length,
    outOfRange: (panels ?? []).reduce((a, p) => a + (p.out_of_range_count ?? 0), 0),
    activeSupplements: supplements.filter(s => s.event === 'active').length,
    medicalCount: medicals.length,
  })

  return {
    generated_at: new Date().toISOString(),
    window,
    athlete_name: athleteName,
    summary_line,
    bloodwork_panels: panelsByMarkers,
    bloodwork_trends: trendsFiltered,
    garmin,
    supplements,
    medicals,
    body_comp,
  }
}

function buildSummaryLine(s: {
  totalMarkers: number; panelCount: number; outOfRange: number;
  activeSupplements: number; medicalCount: number;
}): string {
  return `${s.totalMarkers} bloodwork markers tracked across ${s.panelCount} panel${s.panelCount === 1 ? '' : 's'}; ${s.outOfRange} currently out of range. ${s.activeSupplements} active supplements. ${s.medicalCount} medical event${s.medicalCount === 1 ? '' : 's'} in window.`
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/reports/__tests__/doctor-report-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/doctor-report-builder.ts src/lib/reports/__tests__/doctor-report-builder.test.ts
git commit -m "feat(reports): doctor-report-builder + window math + tests"
```

---

## Task 18: Printable web view component

**Files:**
- Create: `src/components/data/health/DoctorReportPrintable.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/data/health/DoctorReportPrintable.tsx
'use client'
import type { DoctorReportSnapshot } from '@/lib/reports/types'

export function DoctorReportPrintable({ snapshot }: { snapshot: DoctorReportSnapshot }) {
  const s = snapshot
  const printStyle = 'print:bg-white print:text-black'
  return (
    <article className={`max-w-3xl mx-auto p-6 bg-neutral-950 text-neutral-100 ${printStyle} print:p-8`}>
      <header className="pb-4 border-b border-neutral-800 mb-6">
        <h1 className="text-2xl font-space-grotesk">{s.athlete_name} — Health report</h1>
        <div className="text-sm text-neutral-400">
          Window: {s.window.start} to {s.window.end} · Generated {new Date(s.generated_at).toISOString().slice(0, 10)}
        </div>
        <div className="text-sm mt-2">{s.summary_line}</div>
      </header>

      <Section title="Bloodwork">
        {s.bloodwork_panels.length === 0 ? (
          <p className="text-sm text-neutral-500">No data in selected window.</p>
        ) : s.bloodwork_panels.map(p => (
          <div key={p.id} className="mb-6">
            <h3 className="font-medium mb-2">{p.panel_date} · {p.lab_name ?? 'Manual entry'}</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-500">
                  <th className="text-left">Marker</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Unit</th>
                  <th className="text-right">Range</th>
                </tr>
              </thead>
              <tbody>
                {p.markers.map(m => (
                  <tr key={m.name_en} className={m.out_of_range ? 'text-amber-500' : ''}>
                    <td>{m.name_en}</td>
                    <td className="text-right">{m.value ?? '—'}</td>
                    <td className="text-right">{m.unit ?? ''}</td>
                    <td className="text-right">{m.ref_low ?? '—'} – {m.ref_high ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Section>

      <Section title="Garmin daily trends">
        {s.garmin.sleep_daily.length === 0 ? (
          <p className="text-sm text-neutral-500">No data in selected window.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <MiniChart title="Sleep (min)" data={s.garmin.sleep_daily} />
            <MiniChart title="HRV" data={s.garmin.hrv_daily} />
            <MiniChart title="RHR" data={s.garmin.rhr_daily} />
            <MiniChart title="VO2 Max" data={s.garmin.vo2_trend} />
          </div>
        )}
      </Section>

      <Section title="Supplements">
        {s.supplements.length === 0 ? (
          <p className="text-sm text-neutral-500">No data in selected window.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {s.supplements.map(x => (
              <li key={x.name} className="flex justify-between">
                <span>{x.name} {x.dose ? `${x.dose}${x.dose_unit}` : ''} {x.timing.join(', ')}</span>
                <span className="text-xs text-neutral-500">{x.start_date}{x.end_date ? ` → ${x.end_date}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Medicals">
        {s.medicals.length === 0 ? (
          <p className="text-sm text-neutral-500">No data in selected window.</p>
        ) : s.medicals.map((e, i) => (
          <div key={i} className="mb-2">
            <div className="flex gap-2 text-xs">
              <span className="px-1 border border-neutral-700 rounded">{e.event_type}</span>
              <span>{e.event_date}</span>
            </div>
            <div>{e.title}</div>
            {e.details && <div className="text-sm text-neutral-400">{e.details}</div>}
          </div>
        ))}
      </Section>

      <Section title="Body composition">
        {s.body_comp.length === 0 ? (
          <p className="text-sm text-neutral-500">No data in selected window.</p>
        ) : (
          <table className="w-full text-xs">
            <thead><tr className="text-neutral-500">
              <th className="text-left">Date</th><th>Method</th>
              <th className="text-right">Weight (kg)</th><th className="text-right">BF %</th>
            </tr></thead>
            <tbody>
              {s.body_comp.map((b, i) => (
                <tr key={i}>
                  <td>{b.measured_on}</td><td className="text-center">{b.method}</td>
                  <td className="text-right">{b.weight_kg ?? '—'}</td>
                  <td className="text-right">{b.body_fat_pct ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <footer className="text-xs text-neutral-500 border-t border-neutral-800 pt-4 mt-8">
        Data sourced from user-uploaded lab reports and Garmin Connect. Not a medical diagnosis. Discuss abnormal values with physician.
      </footer>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-8"><h2 className="text-lg font-space-grotesk mb-3">{title}</h2>{children}</section>
}

function MiniChart({ title, data }: { title: string; data: { date: string; value: number }[] }) {
  if (data.length === 0) return <div className="text-xs text-neutral-500">{title}: no data</div>
  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  const range = max - min || 1
  const w = 200, h = 60
  const pts = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w
    const y = h - ((d.value - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <div>
      <div className="text-xs text-neutral-400 mb-1">{title}</div>
      <svg width={w} height={h}><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1" className="text-amber-700" /></svg>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/data/health/DoctorReportPrintable.tsx
git commit -m "feat(reports): printable web view for doctor report"
```

---

## Task 19: Install `@react-pdf/renderer` and build PDF primitives

**Files:**
- Modify: `package.json`
- Create: `src/lib/reports/health-pdf/HealthPDFPage.tsx`
- Create: `src/lib/reports/health-pdf/HealthPDFSection.tsx`
- Create: `src/lib/reports/health-pdf/HealthPDFStatGrid.tsx`
- Create: `src/lib/reports/health-pdf/HealthPDFMarkerTable.tsx`
- Create: `src/lib/reports/health-pdf/HealthPDFTrendChart.tsx`
- Create: `src/lib/reports/health-pdf/HealthPDFTimeline.tsx`

- [ ] **Step 1: Install**

Run:
```bash
npm install @react-pdf/renderer
```
Expected: added to `package.json`; no compile errors.

- [ ] **Step 2: `HealthPDFPage` wrapper**

```tsx
// src/lib/reports/health-pdf/HealthPDFPage.tsx
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'

export const colors = {
  ink: '#1a1410',
  muted: '#5a4f47',
  amber: '#92400e',
  line: '#d6cfc7',
  paper: '#fbf9f6',
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper, color: colors.ink,
    paddingTop: 36, paddingBottom: 36, paddingHorizontal: 40,
    fontSize: 10, fontFamily: 'Helvetica',
  },
  footer: {
    position: 'absolute', bottom: 18, left: 40, right: 40,
    fontSize: 8, color: colors.muted,
    borderTopWidth: 0.5, borderTopColor: colors.line, paddingTop: 6,
  },
})

export function HealthPDFPage({ children, footerText }: { children: React.ReactNode; footerText?: string }) {
  return (
    <Page size="A4" style={styles.page}>
      <View>{children}</View>
      {footerText && <Text style={styles.footer} fixed>{footerText}</Text>}
    </Page>
  )
}
```

- [ ] **Step 3: Section, StatGrid, MarkerTable, TrendChart, Timeline primitives**

```tsx
// src/lib/reports/health-pdf/HealthPDFSection.tsx
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors } from './HealthPDFPage'

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  title: { fontSize: 13, color: colors.ink, marginBottom: 8, fontFamily: 'Helvetica-Bold' },
})

export function HealthPDFSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.title}>{title}</Text>{children}</View>
}
```

```tsx
// src/lib/reports/health-pdf/HealthPDFStatGrid.tsx
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors } from './HealthPDFPage'

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', marginBottom: 6 },
  label: { fontSize: 8, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 14, color: colors.ink, marginTop: 2 },
})

export function HealthPDFStatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={styles.grid}>
      {items.map(i => (
        <View key={i.label} style={styles.cell}>
          <Text style={styles.label}>{i.label}</Text>
          <Text style={styles.value}>{i.value}</Text>
        </View>
      ))}
    </View>
  )
}
```

```tsx
// src/lib/reports/health-pdf/HealthPDFMarkerTable.tsx
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors } from './HealthPDFPage'
import type { MarkerRow } from '@/lib/reports/types'

const s = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.25, borderBottomColor: colors.line },
  head: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: colors.line },
  headCell: { fontSize: 8, color: colors.muted, textTransform: 'uppercase' },
  cell: { fontSize: 9, color: colors.ink },
  oor: { color: colors.amber },
  c1: { width: '40%' }, c2: { width: '15%', textAlign: 'right' },
  c3: { width: '15%', textAlign: 'right' }, c4: { width: '30%', textAlign: 'right' },
})

export function HealthPDFMarkerTable({ markers }: { markers: MarkerRow[] }) {
  return (
    <View>
      <View style={s.head}>
        <Text style={[s.headCell, s.c1]}>Marker</Text>
        <Text style={[s.headCell, s.c2]}>Value</Text>
        <Text style={[s.headCell, s.c3]}>Unit</Text>
        <Text style={[s.headCell, s.c4]}>Range</Text>
      </View>
      {markers.map(m => (
        <View style={s.row} key={m.name_en}>
          <Text style={[s.cell, s.c1, m.out_of_range ? s.oor : {}]}>{m.name_en}</Text>
          <Text style={[s.cell, s.c2, m.out_of_range ? s.oor : {}]}>{m.value ?? '—'}</Text>
          <Text style={[s.cell, s.c3]}>{m.unit ?? ''}</Text>
          <Text style={[s.cell, s.c4]}>{m.ref_low ?? '—'} – {m.ref_high ?? '—'}</Text>
        </View>
      ))}
    </View>
  )
}
```

```tsx
// src/lib/reports/health-pdf/HealthPDFTrendChart.tsx
import { View, Text, Svg, Polyline, StyleSheet } from '@react-pdf/renderer'
import { colors } from './HealthPDFPage'

const s = StyleSheet.create({
  wrap: { marginBottom: 6 },
  label: { fontSize: 8, color: colors.muted, marginBottom: 2 },
})

export function HealthPDFTrendChart({
  title, data, width = 220, height = 60,
}: { title: string; data: { date: string; value: number }[]; width?: number; height?: number }) {
  if (data.length === 0) {
    return <View style={s.wrap}><Text style={s.label}>{title}: no data</Text></View>
  }
  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  const range = max - min || 1
  const pts = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * width
    const y = height - ((d.value - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{title}</Text>
      <Svg width={width} height={height}>
        <Polyline points={pts} stroke={colors.amber} strokeWidth={1} fill="none" />
      </Svg>
    </View>
  )
}
```

```tsx
// src/lib/reports/health-pdf/HealthPDFTimeline.tsx
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors } from './HealthPDFPage'

const s = StyleSheet.create({
  item: { marginBottom: 8 },
  head: { flexDirection: 'row', marginBottom: 2 },
  badge: {
    fontSize: 8, borderWidth: 0.5, borderColor: colors.line,
    paddingHorizontal: 4, paddingVertical: 1, marginRight: 6, color: colors.muted,
  },
  date: { fontSize: 8, color: colors.muted },
  title: { fontSize: 10, color: colors.ink },
  details: { fontSize: 9, color: colors.muted, marginTop: 2 },
})

export function HealthPDFTimeline({ items }: { items: {
  event_type: string; event_date: string; title: string; details: string | null
}[] }) {
  return (
    <View>
      {items.map((e, i) => (
        <View key={i} style={s.item}>
          <View style={s.head}>
            <Text style={s.badge}>{e.event_type}</Text>
            <Text style={s.date}>{e.event_date}</Text>
          </View>
          <Text style={s.title}>{e.title}</Text>
          {e.details && <Text style={s.details}>{e.details}</Text>}
        </View>
      ))}
    </View>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/reports/health-pdf/
git commit -m "feat(reports): health-pdf primitives in HA aesthetic"
```

---

## Task 20: Top-level `DoctorReportPDF` document

**Files:**
- Create: `src/lib/reports/doctor-report-pdf.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/lib/reports/doctor-report-pdf.tsx
import { Document, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { DoctorReportSnapshot } from './types'
import { HealthPDFPage, colors } from './health-pdf/HealthPDFPage'
import { HealthPDFSection } from './health-pdf/HealthPDFSection'
import { HealthPDFMarkerTable } from './health-pdf/HealthPDFMarkerTable'
import { HealthPDFTrendChart } from './health-pdf/HealthPDFTrendChart'
import { HealthPDFTimeline } from './health-pdf/HealthPDFTimeline'

const s = StyleSheet.create({
  coverTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: colors.ink, marginBottom: 4 },
  coverSub: { fontSize: 10, color: colors.muted, marginBottom: 14 },
  summary: { fontSize: 11, color: colors.ink, lineHeight: 1.4 },
  panelTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: colors.ink, marginTop: 8, marginBottom: 4 },
  supplementRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  supplementName: { fontSize: 10, color: colors.ink },
  supplementMeta: { fontSize: 8, color: colors.muted },
})

export function DoctorReportPDF({ snapshot }: { snapshot: DoctorReportSnapshot }) {
  const footer = 'Not a medical diagnosis. Discuss abnormal values with physician.'
  return (
    <Document>
      {/* Cover + summary */}
      <HealthPDFPage footerText={footer}>
        <Text style={s.coverTitle}>{snapshot.athlete_name} — Health report</Text>
        <Text style={s.coverSub}>
          Window: {snapshot.window.start} to {snapshot.window.end} ·
          Generated {snapshot.generated_at.slice(0, 10)}
        </Text>
        <Text style={s.summary}>{snapshot.summary_line}</Text>

        <HealthPDFSection title="Bloodwork">
          {snapshot.bloodwork_panels.length === 0 ? (
            <Text style={{ fontSize: 9, color: colors.muted }}>No data in selected window.</Text>
          ) : snapshot.bloodwork_panels.map(p => (
            <View key={p.id}>
              <Text style={s.panelTitle}>{p.panel_date} · {p.lab_name ?? 'Manual entry'}</Text>
              <HealthPDFMarkerTable markers={p.markers} />
            </View>
          ))}
        </HealthPDFSection>
      </HealthPDFPage>

      {/* Garmin trends page */}
      <HealthPDFPage footerText={footer}>
        <HealthPDFSection title="Garmin daily trends">
          {snapshot.garmin.sleep_daily.length === 0 ? (
            <Text style={{ fontSize: 9, color: colors.muted }}>No data in selected window.</Text>
          ) : (
            <>
              <HealthPDFTrendChart title="Sleep (min)" data={snapshot.garmin.sleep_daily} />
              <HealthPDFTrendChart title="HRV (overnight avg)" data={snapshot.garmin.hrv_daily} />
              <HealthPDFTrendChart title="Resting HR" data={snapshot.garmin.rhr_daily} />
              <HealthPDFTrendChart title="VO2 Max" data={snapshot.garmin.vo2_trend} />
            </>
          )}
        </HealthPDFSection>

        <HealthPDFSection title="Supplements">
          {snapshot.supplements.length === 0 ? (
            <Text style={{ fontSize: 9, color: colors.muted }}>No data in selected window.</Text>
          ) : snapshot.supplements.map(sup => (
            <View key={sup.name} style={s.supplementRow}>
              <Text style={s.supplementName}>
                {sup.name}{sup.dose ? ` ${sup.dose}${sup.dose_unit}` : ''}{sup.timing.length ? ` (${sup.timing.join(', ')})` : ''}
              </Text>
              <Text style={s.supplementMeta}>
                {sup.start_date}{sup.end_date ? ` → ${sup.end_date}` : ''}
              </Text>
            </View>
          ))}
        </HealthPDFSection>

        <HealthPDFSection title="Medicals">
          {snapshot.medicals.length === 0 ? (
            <Text style={{ fontSize: 9, color: colors.muted }}>No data in selected window.</Text>
          ) : <HealthPDFTimeline items={snapshot.medicals} />}
        </HealthPDFSection>

        <HealthPDFSection title="Body composition">
          {snapshot.body_comp.length === 0 ? (
            <Text style={{ fontSize: 9, color: colors.muted }}>No data in selected window.</Text>
          ) : (
            <HealthPDFTrendChart
              title="Weight (kg)"
              data={snapshot.body_comp
                .filter(b => b.weight_kg != null)
                .map(b => ({ date: b.measured_on, value: b.weight_kg as number }))}
            />
          )}
        </HealthPDFSection>
      </HealthPDFPage>
    </Document>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/doctor-report-pdf.tsx
git commit -m "feat(reports): DoctorReportPDF document composing primitives"
```

---

## Task 21: Doctor report actions (generate / fetch snapshot / save)

**Files:**
- Create: `src/lib/actions/health/doctor-report.actions.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/actions/health/doctor-report.actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { buildDoctorReportSnapshot, resolveWindow } from '@/lib/reports/doctor-report-builder'
import type { DoctorReportSnapshot, WindowPreset } from '@/lib/reports/types'

const FIVE_MIN_MS = 5 * 60 * 1000

export async function getDoctorReportSnapshot(
  args: { preset: WindowPreset; start?: string; end?: string }
): Promise<DoctorReportSnapshot> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthenticated')

  const window = args.preset === 'custom'
    ? resolveWindow({ preset: 'custom', start: args.start!, end: args.end! })
    : resolveWindow({ preset: args.preset })

  // Reuse recent cached report only within 5 minutes, same window
  const { data: recent } = await supabase
    .from('doctor_reports').select('generated_at, snapshot_json')
    .eq('user_id', user.id)
    .eq('window_start', window.start).eq('window_end', window.end)
    .order('generated_at', { ascending: false }).limit(1).maybeSingle()

  if (recent && Date.now() - new Date(recent.generated_at).getTime() < FIVE_MIN_MS) {
    return recent.snapshot_json as DoctorReportSnapshot
  }

  return buildDoctorReportSnapshot({ userId: user.id, window })
}

export async function persistDoctorReport(args: {
  snapshot: DoctorReportSnapshot
  pdfFilePath: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const { data, error } = await supabase.from('doctor_reports').insert({
    user_id: user.id,
    window_start: args.snapshot.window.start,
    window_end: args.snapshot.window.end,
    window_preset: args.snapshot.window.preset,
    pdf_file_path: args.pdfFilePath,
    snapshot_json: args.snapshot as unknown as Record<string, unknown>,
  }).select('id').single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data.id }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/health/doctor-report.actions.ts
git commit -m "feat(reports): doctor-report actions (get snapshot + persist)"
```

---

## Task 22: `/data/health/doctor-report` route (picker + printable view + download)

**Files:**
- Create: `src/app/data/health/doctor-report/page.tsx`
- Create: `src/app/data/health/doctor-report/download/route.ts`

- [ ] **Step 1: Picker + printable view page**

```tsx
// src/app/data/health/doctor-report/page.tsx
import { getDoctorReportSnapshot } from '@/lib/actions/health/doctor-report.actions'
import { DoctorReportPrintable } from '@/components/data/health/DoctorReportPrintable'
import Link from 'next/link'
import type { WindowPreset } from '@/lib/reports/types'

const PRESETS: WindowPreset[] = ['3mo', '6mo', '12mo']

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ preset?: string; start?: string; end?: string }> }) {
  const sp = await searchParams
  const preset = (PRESETS.includes(sp.preset as WindowPreset) ? sp.preset : '6mo') as WindowPreset
  const snapshot = await getDoctorReportSnapshot(
    preset === 'custom'
      ? { preset, start: sp.start, end: sp.end }
      : { preset }
  )

  const downloadHref = `/data/health/doctor-report/download?preset=${preset}` +
    (preset === 'custom' ? `&start=${sp.start}&end=${sp.end}` : '')

  return (
    <div className="animate-in fade-in duration-300">
      <nav className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur border-b border-neutral-800 p-3 flex items-center gap-3 print:hidden">
        <span className="text-sm text-neutral-400">Window:</span>
        {PRESETS.map(p => (
          <Link key={p} href={`?preset=${p}`}
            className={`text-sm px-2 py-1 rounded border ${p === preset ? 'border-amber-700 text-amber-500' : 'border-neutral-800 text-neutral-500'}`}>
            {p}
          </Link>
        ))}
        <div className="flex-1" />
        <a href={downloadHref}
          className="text-sm px-3 py-1 rounded bg-amber-900/50 border border-amber-800 text-amber-200">
          Download PDF
        </a>
        <button onClick={() => window.print()} className="text-sm px-3 py-1 rounded border border-neutral-800 print:hidden">
          Print
        </button>
      </nav>
      <DoctorReportPrintable snapshot={snapshot} />
    </div>
  )
}
```

(`window.print()` inside an RSC won't compile — move that button into a small client wrapper if strict mode forbids `onClick`. Simpler alternative: rely on browser Print menu / Cmd-P. Remove the Print button if your lint rules complain.)

- [ ] **Step 2: Download Route Handler (streams PDF)**

```ts
// src/app/data/health/doctor-report/download/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getDoctorReportSnapshot, persistDoctorReport,
} from '@/lib/actions/health/doctor-report.actions'
import { DoctorReportPDF } from '@/lib/reports/doctor-report-pdf'
import { renderToBuffer } from '@react-pdf/renderer'
import type { WindowPreset } from '@/lib/reports/types'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const preset = (sp.get('preset') ?? '6mo') as WindowPreset
  const start = sp.get('start') ?? undefined
  const end = sp.get('end') ?? undefined

  const snapshot = await getDoctorReportSnapshot(
    preset === 'custom' ? { preset, start, end } : { preset }
  )

  const pdfBuffer = await renderToBuffer(<DoctorReportPDF snapshot={snapshot} />)

  // Upload to doctor-reports bucket
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const filePath = `${user.id}/${Date.now()}.pdf`
  const { error: upErr } = await supabase.storage
    .from('doctor-reports').upload(filePath, pdfBuffer, { contentType: 'application/pdf' })

  await persistDoctorReport({
    snapshot,
    pdfFilePath: upErr ? null : filePath,
  })

  const filename = `health-report-${snapshot.window.start}_to_${snapshot.window.end}.pdf`
  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 3: Visual check**

Run `npm run dev`. With some seed data (supplements, a manual bloodwork panel), visit `/data/health/doctor-report`. Verify:
- Window picker switches between 3mo/6mo/12mo.
- Printable view renders all five sections (with "No data in selected window" placeholders where empty).
- Download PDF produces a valid PDF file.

- [ ] **Step 4: Commit**

```bash
git add src/app/data/health/doctor-report/
git commit -m "feat(reports): doctor-report route with picker, printable view, PDF download"
```

---

## Task 23: E2E smoke test for the full manual-entry → report flow

**Files:**
- Create: `tests/e2e/doctor-report.spec.ts` (use your existing Playwright config)

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/doctor-report.spec.ts
import { test, expect } from '@playwright/test'

test('manual entry → doctor report download', async ({ page }) => {
  await page.goto('/data/health')
  await expect(page.getByRole('heading', { name: 'Health' })).toBeVisible()

  // Supplement
  await page.goto('/data/health/supplements')
  await page.getByRole('button', { name: /Add/ }).click()
  await page.getByPlaceholder(/Name/).fill('Vitamin D3')
  await page.getByPlaceholder('Dose').fill('5000')
  await page.getByPlaceholder('Unit').fill('IU')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Vitamin D3')).toBeVisible()

  // Bloodwork
  await page.goto('/data/health/bloodwork/new')
  await page.getByPlaceholder('Marker').first().fill('Ferritin')
  await page.getByPlaceholder('Value').first().fill('12')
  await page.getByPlaceholder('Unit').first().fill('ng/mL')
  await page.getByPlaceholder('Low').first().fill('30')
  await page.getByPlaceholder('High').first().fill('400')
  await page.getByRole('button', { name: 'Save panel' }).click()
  await expect(page.getByText('Ferritin')).toBeVisible()

  // Report
  await page.goto('/data/health/doctor-report')
  await expect(page.getByText('Vitamin D3')).toBeVisible()
  await expect(page.getByText('Ferritin')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download PDF' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/health-report.*\.pdf/)
})
```

- [ ] **Step 2: Run e2e**

Run: `npx playwright test tests/e2e/doctor-report.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/doctor-report.spec.ts
git commit -m "test(e2e): manual entry → doctor report download smoke test"
```

---

## Task 24: Final verification + PR

- [ ] **Step 1: Full test suite**

Run:
```bash
npx vitest run
npx playwright test
```
Expected: all green.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Visual regression check**

Run `npm run dev`. Walk the following with seed data:
- `/data` — five tiles render; Health tile shows snapshot or empty state.
- `/data/health` — five cards + "Generate doctor report" CTA.
- Each subpage (bloodwork, supplements, medicals, garmin display, body-comp) — list renders, add form works.
- `/data/health/doctor-report` — picker + printable view + PDF download.

- [ ] **Step 4: Commit any final adjustments, push branch, open PR**

```bash
git push -u origin feat/metrics-health-core
gh pr create --title "feat: metrics dashboard health core + doctor report" --body "$(cat <<'EOF'
## Summary
- Adds `/data/health/` domain with bloodwork, supplements, medicals, body-comp, Garmin display subpages
- `HealthSnapshotTile` on `/data/` overview
- Migration 016 for health tables + storage buckets + RLS
- Doctor report builder + printable view + PDF download (React-PDF)
- Manual entry paths for bloodwork (Plan 3 replaces with upload)
- Garmin read-only (Plan 3 adds sync)

## Test plan
- [ ] Vitest unit suites pass
- [ ] Playwright e2e: manual entry → report download passes
- [ ] `/data` tile renders in all three states (no block, block, block + health data)
- [ ] Window picker on report works for 3mo/6mo/12mo

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Spec coverage check (self-review)

- **Fifth tile on /data/** ✓ Task 10
- **`/data/health/` landing** ✓ Task 11
- **All 5 subpages** ✓ Tasks 12–16
- **Migration 016 with all tables + RLS + storage buckets** ✓ Task 2
- **Health analytics snapshots** ✓ Task 8
- **DoctorReportSnapshot type + builder** ✓ Tasks 3, 17
- **Printable web view** ✓ Task 18
- **React-PDF primitives (fresh, HA aesthetic)** ✓ Task 19
- **DoctorReportPDF document** ✓ Task 20
- **6mo default + 3/6/12/custom picker** ✓ Task 22
- **5-minute snapshot reuse** ✓ Task 21 (`getDoctorReportSnapshot`)
- **Empty-state handling on all sections** ✓ Tasks 11, 18, 20
- **VO2 folded into medical_events structured_data** ✓ Tasks 2, 5, 13
- **RLS owner-only on all tables** ✓ Task 2

Intentionally deferred to Plan 3: lab PDF upload + extraction, Garmin credential form + sync library + cron. The Garmin subpage (Task 16) shows a "Connect (coming soon)" state so no UI rewrite is needed when Plan 3 lands.
