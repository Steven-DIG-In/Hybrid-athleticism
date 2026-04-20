# Metrics Dashboard — Combined Training Adherence + Health Extension

**Date:** 2026-04-20
**Status:** Approved design, implementation pending
**Supersedes:** `2026-04-17-phase-1-metrics-dashboard-design.md` (training-adherence-only scope)
**Implementation order:** Second of three phases (Phase 2 → **this** → Phase 3)
**Depends on:** Phase 2's `recalibration.actions.ts`, `block_pointer`, `agent_activity` write points.

> ⚠️ **Next.js 16 reminder:** Read `node_modules/next/dist/docs/` before writing code — breaking changes from prior versions.

---

## Purpose

Two-in-one metrics surface serving two feedback loops:

**Training adherence loop** (carried forward from original Phase 1 spec):
- **Athlete:** spot coach prescription bias, duration overruns, personal adherence patterns; decide whether to apply harder or recalibrate.
- **Coaches:** structured adherence signal that feeds next-block programming and intervention prompts.

**Health / clinical loop** (new in this extension):
- **Athlete:** at-a-glance snapshot of physiological state (last panel, out-of-range markers, Garmin trends, active supplements).
- **Doctor:** 6-month clinical report PDF generated on demand, covering bloodwork, Garmin dailies, supplements, medicals, and body composition.

Both are data-rich but not overbearing — overview surface shows signal, domain pages hold the depth.

**Explicit non-goal:** biomarkers do NOT feed the AI coaches in this phase. Health data stays informational; coach coupling is revisited only once the training loop is trusted in production.

---

## Architecture

`/data/` overview carries **five** tiles in a calm grid:

1. `BlockAdherenceHeatmap` — training-adherence drill-down
2. `CoachPromptsInbox` — unreviewed interventions (Phase 1)
3. `CoachBiasTile` — per-coach RAG grid
4. `OffPlanTally` — current-block off-plan summary
5. `HealthSnapshotTile` — **new**; drills into `/data/health/`

Each tile is drill-downable to a dedicated subpage (shareable URLs, Next 16 dynamic routes, proper back-button UX). Coach dialogue piggybacks on the existing `ai-coach.actions.ts` interventions pipeline (block-end + rolling mid-block pattern flags).

Training-adherence domain pages (`strength`, `endurance`, `recovery`, `conditioning`) are enhanced inline with delta widgets + pattern flags; `conditioning` gets a brand-new page (existing `conditioning_logs` data has no UI today).

The new Health domain lives at `/data/health/` as a peer, with five subpages plus one special `doctor-report` route.

### Known parallel tech debt (not in scope, flagged)

- `/log-session` returns 404 (Phase 2 rebuild may need verification).
- `/history` route is unwired.
- `/coach/` currently shows "all systems nominal" — effectively dead.

The training-adherence half of this spec surfaces `CoachPromptsInbox` which routes intervention review to `/coach/`. That tile ships but won't be fully usable until `/coach/` is restored. The **Health half of this spec is fully independent of `/coach/`** and can ship regardless.

---

## Components

### New derivation layer — training adherence (`src/lib/analytics/`)

- `block-adherence.ts` — rolls up `performance_deltas` + session completion state into a per-block heatmap (session × day-slot × status).
- `coach-bias.ts` — per-coach aggregate: mean delta over last N sessions, RAG classification, pattern-flag detection (e.g., "5/6 metcon sessions under-performed intensity target by >10%"), cooldown enforcement.
- `duration-variance.ts` — `session_inventory.estimated_duration_minutes` vs `workouts.actual_duration_minutes`, aggregated by coach and domain.
- `off-plan-tally.ts` — counts logged off-plan sessions (Phase 2's `/log-session`) in current block, grouped by modality; flags those with `count_toward_load=true`.

### New derivation layer — health (`src/lib/analytics/health/`)

- `bloodwork-snapshot.ts` — latest panel, out-of-range counts, trend deltas for key recurring markers.
- `garmin-trends.ts` — rolling windows for sleep, HRV, RHR, VO2 Max; 7-day averages and direction arrows.
- `supplements-snapshot.ts` — current active stack, recent changes.
- `medicals-snapshot.ts` — most recent events by type.
- `body-comp-snapshot.ts` — latest weight + body-fat %, 3-month and 6-month deltas.

### Ingestion layer (`src/lib/ingestion/`)

- `lab-pdf-extractor.ts` — Claude Haiku 4.5 call: strict-JSON output, Portuguese→English translation + marker parsing in one pass. Zod-validated response. Writes `lab_panels.extraction_json` and per-marker rows with `status='needs_review'`.
- `garmin-sync.ts` — wraps `garmin-connect` npm client. Credential read from Supabase Vault, session token cached and auto-refreshed, daily metrics upsert into `garmin_daily`. Handles MFA prompt (requires user TOTP input). Also writes `garmin_vo2_trend` row only when Garmin's estimate changes.

### Reporting layer (`src/lib/reports/`)

- `doctor-report-builder.ts` — takes `{ userId, windowStart, windowEnd }`, returns a typed `DoctorReportSnapshot` with all sections' data already resolved. Pure function over DB reads. Both the printable web view and the React-PDF tree consume this output.
- `health-pdf/` — fresh React-PDF primitives built in HA aesthetic (earth tones, "quiet confidence"):
  - `HealthPDFPage`, `HealthPDFSection`, `HealthPDFStatGrid`,
  - `HealthPDFMarkerTable`, `HealthPDFTrendChart`, `HealthPDFTimeline`.
- `doctor-report-pdf.tsx` — top-level React-PDF document composing primitives from a `DoctorReportSnapshot`.

**Fresh implementation.** Zero cross-imports from DIG-IN's PDF stack. Same library (`@react-pdf/renderer` — Vercel-friendly, no headless browser) but every component, style, color, and type choice is built fresh in HA.

### Overview page

- `src/app/data/page.tsx` — replaces current landing. Five tiles in a calm grid.
- `src/components/data/overview/`:
  - `BlockAdherenceHeatmap.tsx`
  - `CoachPromptsInbox.tsx` — links to `/coach/` (evolved to `/coach/activity?tab=inbox` in Phase 3).
  - `CoachBiasTile.tsx`
  - `OffPlanTally.tsx`
  - `HealthSnapshotTile.tsx` — shows last panel date + out-of-range count, Garmin 7-day sleep/HRV trend arrow, active supplement count, inline "Generate doctor report" pill.
- `src/app/data/overview/[tile]/page.tsx` — dynamic subpages for the **four Phase 1 tile drill-downs** (block-adherence, coach-prompts, coach-bias, off-plan). The Health tile does NOT use this route — it navigates to the named `/data/health/` domain landing instead.

### Training-adherence domain pages (evolved)

- `src/app/data/strength/page.tsx`, `data/endurance/page.tsx`, `data/recovery/page.tsx` — each adds:
  - `PerformanceDeltaChart` (SVG, matching existing aesthetic; no charting library).
  - `PatternFlagCard` (shows active flags for that domain if `coach-bias.ts` has any).
- `src/app/data/conditioning/page.tsx` — **new** page. Same structure as strength/endurance. Surfaces `conditioning_logs` data.

### Health domain pages (new)

- `src/app/data/health/page.tsx` — landing. Five cards, one per subcategory, each with 1-line status. Prominent "Generate doctor report" CTA top-right.
- `src/app/data/health/bloodwork/page.tsx` — timeline of panels, drill-down to full marker table. Upload CTA → extraction flow.
- `src/app/data/health/bloodwork/upload/page.tsx` — upload + extraction review flow.
- `src/app/data/health/supplements/page.tsx` — active + ended lists, add/edit form.
- `src/app/data/health/medicals/page.tsx` — event timeline, add/edit form. Unified across event types.
- `src/app/data/health/garmin/page.tsx` — daily table + SVG trend lines. Last-synced indicator, "resync now" button.
- `src/app/data/health/garmin/connect/page.tsx` — credential form + MFA handling.
- `src/app/data/health/body-comp/page.tsx` — weight + body-fat trends, manual entry form.
- `src/app/data/health/doctor-report/page.tsx` — window picker, printable web view, PDF download button.

### Coach dialogue (carried from Phase 1)

Reuses existing `ai-coach.actions.ts` interventions pipeline.

- **Block-end trigger:** block completion hook fan-outs to each coach with non-trivial deltas. Coach authors intervention with three responses: `Keep prescription` / `Apply harder` / `Recalibrate down`.
- **Rolling mid-block trigger:** `coach-bias.ts` detects 3+ consecutive same-direction deltas >10% → fires intervention. Cap: 1 per coach per week mid-block. Cooldown enforced in `coach-bias.ts`.
- Inbox on `CoachPromptsInbox` tile; review + response happens at `/coach/`.

---

## Data model

**One migration: `supabase/migrations/016_metrics_dashboard.sql`** — subsumes what was drafted as `013_metrics_dashboard.sql` in the superseded spec (that number collided with the already-applied `013_training_day.sql`).

### Training-adherence tables

- **`agent_interventions`** — verify schema against existing `ai-coach.actions.ts` usage; add fields if missing:
  - `coach_domain text`
  - `trigger_type` enum (`block_end | rolling_pattern | recalibration_prompt`)
  - `pattern_signal jsonb` — evidence (deltas referenced, threshold crossed, session IDs).
  - `user_response` enum (`keep | harder | recalibrate`, nullable until responded).
- **`off_plan_sessions`** — populated by Phase 2's `/log-session`:
  - `id uuid, user_id uuid, logged_at timestamptz, modality text, duration_minutes int, rpe int (nullable), notes text (nullable), count_toward_load boolean, linked_domain text (nullable)`.
- **`performance_deltas`** — add `delta_magnitude_pct` generated column.

### Health tables (new)

**`lab_panels`**

```
id uuid pk, user_id uuid fk, panel_date date, lab_name text,
status text check ('pending_extraction'|'needs_review'|'ready'|'failed'),
original_file_path text, extraction_json jsonb,
out_of_range_count int, created_at, updated_at
```

**`lab_markers`**

```
id uuid pk, panel_id uuid fk, user_id uuid fk,
name_en text, name_original text, value numeric, unit text,
reference_range_low numeric, reference_range_high numeric,
is_out_of_range boolean, confidence text ('high'|'medium'|'low'),
status text ('needs_review'|'confirmed'), notes text
```

Index on `(user_id, name_en, panel_id)` for cross-panel trend queries.

**`supplements`**

```
id uuid pk, user_id uuid fk, name text, dose numeric, dose_unit text,
timing text[] (e.g., ['am','with_meal']), start_date date, end_date date null,
notes text, created_at
```

**`medical_events`** — unified for injury / diagnosis / surgery / medication_change / lab_test (includes lab VO2 max tests).

```
id uuid pk, user_id uuid fk, event_type text check (
  'injury'|'diagnosis'|'surgery'|'medication_change'|'lab_test'|'other'),
event_date date, title text, details text,
attachment_path text null,
structured_data jsonb null,
created_at
```

For `event_type='lab_test'` with VO2 payload, `structured_data` shape:
`{ protocol: string, vo2_max_ml_kg_min: number, max_hr: number, lactate_threshold?: number }`.

**`garmin_credentials`** — one row per user while connected.

```
user_id uuid pk fk, vault_secret_id_email uuid, vault_secret_id_password uuid,
session_token_encrypted text, session_expires_at timestamptz,
last_sync_at timestamptz, last_sync_status text, connected_at
```

Credentials stored via Supabase Vault; app holds only the UUID references.

**`garmin_daily`**

```
user_id uuid fk, date date, sleep_total_min, sleep_deep_min, sleep_rem_min,
sleep_light_min, sleep_awake_min, sleep_score int,
hrv_overnight_avg numeric, hrv_morning_status text,
resting_hr int, body_battery_start int, body_battery_end int,
body_battery_min int, body_battery_max int, stress_avg int,
steps int, active_kcal int,
primary key (user_id, date)
```

**`garmin_vo2_trend`** — appended only when Garmin's estimate changes.

```
id, user_id fk, measured_on date, modality text ('run'|'ride'),
vo2_max numeric, fitness_age int null, created_at
```

**`body_composition_measurements`**

```
id, user_id fk, measured_on date, method text ('scale'|'dexa'|'caliper'|'tape'),
weight_kg numeric, body_fat_pct numeric null, lean_mass_kg numeric null,
measurements jsonb null, notes, created_at
```

**`doctor_reports`** — generated report metadata for history/audit.

```
id, user_id fk, generated_at, window_start date, window_end date,
window_preset text ('3mo'|'6mo'|'12mo'|'custom'),
pdf_file_path text, snapshot_json jsonb
```

`snapshot_json` freezes the data that rendered the report so re-downloads stay deterministic even if underlying data changes.

### RLS

All new tables: `user_id = auth.uid()` on SELECT/INSERT/UPDATE/DELETE. Follows the existing pattern in `002_rls_policies.sql` and subsequent migrations.

### Storage

Two Supabase Storage buckets, both RLS-scoped to `user_id` (path prefix `{user_id}/`). Bucket creation + RLS policies declared in the same `016_metrics_dashboard.sql` migration via `storage.create_bucket(...)` and `storage.objects` policies.

- **`lab-reports`** — original uploaded PDFs.
- **`doctor-reports`** — generated PDF outputs.

---

## Runtime flows

### Overview page load (Next.js 16 Server Component)

```
/data/page.tsx
  Promise.all([
    block-adherence.ts:currentBlockHeatmap(),
    coach-bias.ts:allCoachesRAG(),
    duration-variance.ts:currentBlockVariance(),
    off-plan-tally.ts:currentBlockTally(),
    ai-coach.actions.ts:getUnreviewedInterventions(),
    health/bloodwork-snapshot.ts:latest(),
    health/garmin-trends.ts:sevenDay(),
    health/supplements-snapshot.ts:activeCount(),
  ])
  render 5 tiles + inbox
```

### Pattern detection (called post-workout, not on page load)

```
After each workout completion (wired in Phase 2):
  → coach-bias.ts:evaluatePattern(coach, userId)
       if threshold crossed AND cooldown clear (no intervention from this coach in 7 days):
         ai-coach.actions.ts:createIntervention(coach, 'rolling_pattern', patternSignal)
         → also logs to agent_activity (Phase 3)
```

### Block-end trigger

```
block-pointer reaches final day_index + session completed:
  for each coach in [strength, hypertrophy, endurance, conditioning, mobility, recovery]:
    if non-trivial deltas this block:
      createIntervention(coach, 'block_end', patternSignal)
  → also triggers Phase 3 journal writes
```

### Off-plan log flow

```
/log-session (rebuilt in Phase 2) → off_plan_sessions INSERT
  → updates OffPlanTally on next overview render
  → if count_toward_load=true: feeds load-scoring.ts for that calendar date
```

### Intervention response

```
User responds via /coach/ inbox (keep | harder | recalibrate):
  → UPDATE agent_interventions.user_response
  → if recalibrate: updates next-block prescription inputs (training_max, target_intensities)
  → response logged to agent_activity (Phase 3)
```

### Lab PDF upload → extract → confirm → save

```
1. /data/health/bloodwork/upload: file input → Server Action
   → Supabase Storage bucket `lab-reports` upload
   → lab_panels INSERT with status='pending_extraction'

2. Server Action → lab-pdf-extractor.ts:
   → Claude Haiku 4.5 call with PDF (Files API or base64)
   → prompt: translate Portuguese→English + extract strict JSON
     (panel_date, lab_name, marker[] with name_en, name_original, value,
      unit, ref ranges, is_out_of_range, confidence, notes)
   → Zod-validate response
   → lab_panels UPDATE status='needs_review', extraction_json stored
   → lab_markers INSERT (one per marker) status='needs_review'

3. Review screen renders parsed table:
   → batch actions: Accept all / Accept all except flagged / Reject and retry
   → per-row edits supported (marker, value, unit, range)

4. Confirm → lab_markers UPDATE status='confirmed',
            lab_panels UPDATE status='ready', out_of_range_count cached.
            Original PDF retained in storage.
```

### Garmin daily cron

```
vercel.json cron '0 7 * * *' → /api/cron/garmin-sync
  For each user with active garmin_credentials:
    → garmin-sync.ts:
        → read session token from Vault
        → if expired: re-auth using stored credentials
        → if re-auth fails: UPDATE last_sync_status='auth_failed'; continue
        → fetch yesterday's dailies
        → upsert garmin_daily on (user_id, date)
        → if VO2 Max changed: INSERT garmin_vo2_trend
        → UPDATE last_sync_at, last_sync_status='ok'
```

### Doctor report generation

```
/data/health/doctor-report:
  User picks window (default 6mo) → Server Component fetch:
    doctor-report-builder.ts(userId, windowStart, windowEnd)
      → returns DoctorReportSnapshot { cover, bloodwork, garmin, supplements, medicals, bodyComp }
  → renders printable web view (Tailwind HTML)
  → "Download PDF" click:
      → Server Action: if doctor_reports row exists for this window+user and is <5min old,
                       reuse its snapshot_json; otherwise re-run builder.
      → renders doctor-report-pdf.tsx via @react-pdf/renderer
      → streams PDF to client
      → writes file to `doctor-reports` bucket
      → doctor_reports INSERT (or UPDATE) with snapshot_json frozen copy.
      Re-downloads of a previously-generated report always use its stored snapshot.
```

---

## Doctor report — content structure

In render order:

1. **Cover** — athlete name, date range, generated-on date. One-line summary: "47 bloodwork markers tracked across 2 panels; 3 currently out of range. 12 active supplements. 2 medical events in window."
2. **Bloodwork** — timeline of panels. For each panel: marker table (name, value, unit, ref range, ▲/▼/— status; out-of-range highlighted). Trend chart for key recurring markers (ferritin, vitamin D, testosterone, etc.) over the window.
3. **Garmin daily trends** — four small-multiples SVG charts: sleep, HRV, RHR, VO2 Max. 7-day rolling averages.
4. **Supplements** — active list at report-end date + any started/stopped within the window.
5. **Medicals** — event timeline (type badge, date, title, details). Attached PDFs listed as references, not inlined.
6. **Body composition** — weight + body-fat trend chart if data exists in the window.
7. **Footer** — "Data sourced from user-uploaded lab reports and Garmin Connect. Not a medical diagnosis. Discuss abnormal values with physician."

Default window: **6 months**. Picker options: 3mo, 6mo, 12mo, custom.

Sections with no data in the selected window render "No data in selected window" rather than hiding — so the doctor knows the absence is true.

---

## Error handling

### Training adherence (carried from Phase 1)

- **Missing data** (no completed sessions yet, new user, empty block): tiles render empty states. `BlockAdherenceHeatmap` shows "Complete your first session to see adherence signal."
- **Stale coach prompts**: auto-archive on block completion. Unreviewed prompts older than one block move to history.
- **Conditioning page with no data**: "no conditioning_logs yet" empty state.
- **Pattern detection rate limit**: 7-day rolling cooldown per coach.
- **LLM failure during intervention write**: retry once; on persistent failure, write stub marked `needs_retry`, surface on inbox with retry button.

### Health

- **Lab extraction — malformed JSON / non-lab PDF / low-quality scan**: actionable message, PDF retained, retry + manual-entry both available. Low-confidence markers flagged amber on review screen.
- **Lab extraction — translation ambiguity**: `name_original` always preserved; English name canonical for display; audit trail available.
- **Garmin — expired session**: auto-reauth → if reauth fails, mark `last_sync_status='auth_failed'`, surface "Reconnect" CTA.
- **Garmin — rate limit / 429**: exponential backoff within cron run; defer to next day if still failing.
- **Garmin — package breakage** (auth API changes): fallback CSV import route planned (`/data/health/garmin/import-csv`) with identical schema shape; not built MVP.
- **Garmin — user disconnects**: delete `garmin_credentials` row (cascade); keep historical `garmin_daily` rows.
- **Vault read failure**: treated as disconnected; sync halts; user prompted to reconnect.
- **Empty snapshot tile / subpages**: render clean empty states with actionable CTAs ("Upload your first report →").
- **Doctor report with sparse data**: sections render "No data in selected window" placeholder rather than hiding.
- **PDF render failure**: printable web view still renders; "PDF temporarily unavailable, please print this page" fallback.

---

## Testing

### Vitest units

**Training adherence:**
- `block-adherence.ts` rollup produces correct heatmap cells for a fixture block.
- `coach-bias.ts` RAG classification edge cases (boundary thresholds, insufficient data).
- `coach-bias.ts` cooldown logic (pattern crosses threshold twice within 7 days — only one intervention fired).
- `duration-variance.ts` aggregation by coach and domain.
- Off-plan linkage to domain (modality → linked_domain defaults).

**Health:**
- `lab-pdf-extractor.ts`: fixture Portuguese panel with mocked Claude response → asserts translation + marker/unit/range parse + Zod validation.
- Out-of-range computation: value vs range, edge cases (equal to bound, missing range).
- `doctor-report-builder.ts`: given a fixture `DoctorReportSnapshot` input → deterministic section data; 6mo default window math; custom range boundary conditions.
- `garmin-sync.ts` daily upsert idempotency on `(user_id, date)` conflict.
- VO2 trend row inserted only when value changes.

### Fixture-based integration

- 6-week block with mixed under/over/on-track sessions; assert RAG colors, intervention firing cadence, adherence heatmap cells all consistent.
- Block completion triggers block-end interventions for all coaches with non-trivial deltas.
- Lab upload flow end-to-end: fixture PDF → mocked Claude → review screen → accept → appears on bloodwork subpage.
- Garmin sync: mocked client returns a 7-day window → asserts all rows inserted, VO2 trend row added only on change.

### Integration tests

- Complete workout → pattern eval → intervention created → visible on overview inbox.
- Intervention response updates next-block prescription inputs.

### E2E (Playwright, light)

- `/data/` overview renders five tiles populated with fixture data.
- Tile click navigates to respective subpage.
- Coach prompt response updates intervention state.
- `/data/health/` landing renders five cards with data.
- Upload fixture lab PDF → review → accept → marker appears on bloodwork subpage.
- Generate doctor report → printable web view renders → PDF download produces a file.

---

## Out of scope

- **Coach coupling with biomarkers** — no biomarker → intervention plumbing. Revisit post-MVP once the training loop is trusted.
- **Subjective wellness tracking** — existing `athlete_self_reports` from check-ins covers this; no duplicate entry surface.
- **Nutrition / macro logging** — feature-sized on its own; deferred.
- **Formal standalone VO2 lab test UI** — folded into `medical_events` with `event_type='lab_test'` + structured_data payload; no dedicated subpage.
- **Performance comparison vs external benchmarks** (VDOT percentiles, strength standards). Self-vs-plan only in this phase.
- **Multi-user sharing / clinician logins** — doctor receives a PDF; no app access.
- **Integrations beyond Garmin** (Apple Health, Whoop, Oura) — Garmin-only for MVP. Schema shape designed to accept additional providers later.
- **Fallback Garmin CSV import UI** — route reserved, not built MVP.
- **Fixing Log (404), History (unwired), Coach (dead)** — known parallel tech debt outside this spec. The Health half ships independent of `/coach/`; the training-adherence inbox tile depends on `/coach/` revival but does not block the rest of the spec.
- **Export/sharing of training-adherence metrics** — Phase 1 scope was self-vs-plan only; unchanged.
