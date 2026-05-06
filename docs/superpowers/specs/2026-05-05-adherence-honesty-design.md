# Adherence Honesty — Sub-project B of Block N → N+1 Transition

**Date:** 2026-05-05
**Status:** Approved design, implementation pending
**Position in larger initiative:** Second of four sub-projects (A retrospective ✓ → **B adherence honesty** → C engine refactor → D Block 2 wizard).

> ⚠️ **Next.js 16 reminder:** This project runs Next.js 16. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code that touches App Router behavior.

---

## Purpose

Close the gap between what the system thinks the athlete can do and what's actually possible. Block 1's adherence reality (21/51 done = 41%) was driven by three things the coaches never asked about:

- **Optimistic availability** — onboarding assumed 7 days/week × 60-min sessions. Real life delivered less.
- **Time overrun per session** — the athlete's self-added warm-up (~20 min) and supplemental cardio routinely pushed past the budgeted window, leaving no time for prescribed work.
- **(One-time, out of scope)** — mid-block reload chaos during allocation fixes; resolved at the source.

The fix is **not** roster changes. The Block 1 retrospective shows weights / methodology / volume targets matched what the athlete committed to at onboarding. The coaches were right; their inputs were stale. Sub-project B installs **two coupled feedback mechanisms** that keep those inputs honest:

1. **Availability re-validation** — the athlete is asked at block boundaries (and when signals demand) to re-confirm real availability: days/week, session minutes, warm-up overhead, cooldown overhead.
2. **Time-budget transparency** — the system watches existing per-workout duration data; when sessions consistently overrun budget, it surfaces a quiet prompt asking for the granular reason.

Both mechanisms write to a single carryover store (`profiles.pending_planner_notes jsonb`) consumed by sub-project D's planner. B writes; D reads-and-clears.

---

## Architecture

```
                    ┌─────────────────────────────┐
                    │  profiles.pending_planner_  │ ◀── consumed by
                    │  notes (jsonb, single-entry)│     generateMesocyclePlan
                    └──────────────▲──────────────┘     (sub-project D)
                                   │ writes
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
   ┌────────┴────────┐   ┌─────────┴────────┐   ┌────────┴────────┐
   │ Boundary prompt │   │ Boundary prompt  │   │ Mid-block       │
   │  on close-block │   │  on Block 2      │   │  signal prompt  │
   │  flow           │   │  wizard start    │   │  (signal-fired) │
   │  (sub-project A │   │  (sub-project D) │   │                 │
   │   surface)      │   │                  │   │                 │
   └─────────────────┘   └──────────────────┘   └────────▲────────┘
                                                         │ fires when
                                                         │
                                          ┌──────────────┴────────────────┐
                                          │  overrun signal engine        │
                                          │  reads workouts.actual_       │
                                          │  duration_minutes vs          │
                                          │  session_inventory.estimated_ │
                                          │  duration_minutes             │
                                          └───────────────────────────────┘
```

### Invariants

- **Single-entry carryover** — at most one `PendingPlannerNotes` per athlete at a time. New entries merge into the existing one (latest `capturedAt` wins on top-level fields; `availability` deep-merged; `freeText` appended; `signalEvidence` overwritten).
- **Consumed-and-cleared** — sub-project D's planner reads and clears in one transaction. After clear, the slate is fresh for next block's signals.
- **Suppression via presence** — `pending_planner_notes IS NOT NULL` doubles as "signal already captured this block." The mid-block signal engine checks for null before firing. No separate `last_signal_dismissed_at` column.
- **All prompts are optional** — every boundary prompt and the signal modal include a Skip / Dismiss path. Skipping the boundary prompt writes nothing; dismissing the signal writes a minimal marker (so D knows the athlete saw the signal but chose not to act).
- **Coach voice = `head`** — all prompts attribute to the head coach (existing `coach='head'` value in `agent_activity`). This is cross-coach programming-level feedback, not a single domain coach's call.
- **No background jobs / cron / async** — signal fires on dashboard render via a pure function. Cheap to recompute; always reflects current data.
- **No mid-block re-allocate** — answers never trigger regeneration of the current block's session_inventory. The athlete keeps control of the current block; the next block reflects what the system learned.

---

## Components

### New

- **`src/components/reality-check/RealityCheckForm.tsx`** — shared 5-question form. Optional fields: days/week, session minutes, warm-up minutes, cooldown minutes, free-text (200 char max). Pre-fill from current `profiles` values + any existing pending notes. Pre-fill optionally from props for grounding context (close-out page passes the just-closed retrospective's adherence numbers).
- **`src/components/reality-check/OverrunSignalBanner.tsx`** — dashboard banner. Mirrors `CloseBlockNudgeBanner` from sub-project A. Shows evidence summary + Dismiss / Update CTAs. Renders only when `evaluateOverrunSignal()` returns `shouldFire: true`.
- **`src/components/reality-check/OverrunSignalModal.tsx`** — modal wrapper. Embeds `RealityCheckForm` with an evidence header at top showing the per-session overrun list. Submit writes to `pending_planner_notes` with `source='mid_block_signal'` + `signalEvidence` populated.
- **`src/app/data/blocks/[mesocycleId]/reality-check/page.tsx`** — standalone post-close page. Server component. Embeds `RealityCheckForm` with retrospective context shown above. Two CTAs: Skip (redirect to retrospective) and Save & continue (write notes, then redirect to retrospective).
- **`src/lib/analytics/overrun-signal.ts`** — `evaluateOverrunSignal(userId): Promise<OverrunSignal>` pure function.
- **`src/lib/actions/pending-notes.actions.ts`** — `submitRealityCheck(input)`, `dismissOverrunSignal()`, `getPendingPlannerNotes()`, `clearPendingPlannerNotes()`.
- **`src/lib/types/pending-planner-notes.types.ts`** — `PendingPlannerNotes` + subtypes.

### Evolve

- **`src/components/dashboard/CloseBlockConfirmModal.tsx`** — after `closeMesocycle()` succeeds, redirect to `/data/blocks/[id]/reality-check` instead of `/data/blocks/[id]/retrospective`. The reality-check page itself redirects to the retrospective on save/skip. Adds one extra step to the close-out journey but keeps each step focused.
- **`src/app/dashboard/page.tsx`** — call `evaluateOverrunSignal()` and render `OverrunSignalBanner` between greeting and `WeekViewClient` (placement matches `CloseBlockNudgeBanner` from sub-project A).
- **`src/lib/types/database.types.ts`** — regenerate after migration 020 (re-append alias appendix per the type-regen procedure).

### Retire

- None. Purely additive.

---

## Data model

### New column — migration `020_pending_planner_notes.sql`

```sql
-- Adherence honesty carryover store. Single-entry, consumed-and-cleared by
-- generateMesocyclePlan in sub-project D. Source-tagged by where the entry
-- was captured: block close-out, Block 2 wizard, or mid-block overrun signal.
ALTER TABLE public.profiles
  ADD COLUMN pending_planner_notes jsonb;

COMMENT ON COLUMN public.profiles.pending_planner_notes IS
  'Carryover from sub-project B (Adherence Honesty). One pending entry per
   athlete, merged on subsequent writes. Read + cleared by sub-project D
   planner. Shape: PendingPlannerNotes type in
   src/lib/types/pending-planner-notes.types.ts';
```

No RLS changes (`profiles` already has owner-only RLS, inherited). No backfill (NULL is the expected starting state).

### Type module — `src/lib/types/pending-planner-notes.types.ts`

```ts
export type PendingPlannerNoteSource =
  | 'block_close'
  | 'block_start_wizard'
  | 'mid_block_signal'

export type AvailabilityAnswers = {
  daysPerWeek: number
  sessionMinutes: number
  warmupMinutes: number   // 0 means skipped
  cooldownMinutes: number // 0 means none
}

export type SignalEvidence = {
  overrunSessions: Array<{
    workoutId: string
    estimatedMinutes: number
    actualMinutes: number
  }>
  avgOverrunMinutes: number
  avgOverrunPct: number
  sessionsConsidered: number
}

export type PendingPlannerNotes = {
  schemaVersion: 1
  source: PendingPlannerNoteSource
  capturedAt: string  // ISO timestamp
  availability?: AvailabilityAnswers
  freeText?: string  // max 200 chars, sanitized
  signalEvidence?: SignalEvidence
  dismissedWithoutAnswer?: boolean  // only when source='mid_block_signal' + dismiss
}
```

### Merge rule

When `submitRealityCheck` or `dismissOverrunSignal` writes to a profile that already has a non-null `pending_planner_notes`:

- `schemaVersion`, `source`, `capturedAt` — overwritten by new entry.
- `availability` — deep-merged. New keys override existing keys; existing keys preserved if not present in new entry. (E.g., boundary-check answers `daysPerWeek + sessionMinutes`, then signal modal answers `warmupMinutes` only — final entry has all three.)
- `freeText` — appended with `\n` separator, then truncated to 200 chars total.
- `signalEvidence` — overwritten by latest fire (most recent evidence is what matters).
- `dismissedWithoutAnswer` — overwritten (a subsequent answer-bearing write clears the flag).

Merge happens server-side in the action — read current value, compute merged value, single UPDATE.

---

## Runtime flows

### Boundary prompt (post-close)

```
User clicks "Close & generate retrospective" in CloseBlockConfirmModal
  → closeMesocycle() succeeds (sub-project A)
  → router.push('/data/blocks/[id]/reality-check')   ← changed from /retrospective
  → /data/blocks/[id]/reality-check page renders
       fetches snapshot via getBlockRetrospective(mesocycleId)
       fetches profile values for pre-fill
       renders RealityCheckForm with grounding context

User clicks "Save & continue":
  → submitRealityCheck({ source: 'block_close', availability: {...}, freeText? })
       writes/merges to profiles.pending_planner_notes
  → router.push('/data/blocks/[id]/retrospective')

User clicks "Skip":
  → router.push('/data/blocks/[id]/retrospective') directly
  → no write
```

### Boundary prompt (Block 2 wizard start)

Owned by sub-project D. B exposes:
- `RealityCheckForm` component (D embeds in wizard step 2)
- `getPendingPlannerNotes()` (D reads for pre-fill)
- `submitRealityCheck({ source: 'block_start_wizard', ... })` (D calls on submit)

### Mid-block signal

```
GET /dashboard
  → server component calls evaluateOverrunSignal(userId)
       reads last 3 completed workouts (actual_duration_minutes IS NOT NULL)
       joins to session_inventory.estimated_duration_minutes
       computes avg overrun (minutes + percentage)
       checks active mesocycle exists
       checks profiles.pending_planner_notes IS NULL
       returns { shouldFire: boolean, evidence: {...} }
  → if shouldFire, render <OverrunSignalBanner evidence={...} />

User clicks "Update":
  → opens <OverrunSignalModal>
  → modal embeds RealityCheckForm + evidence header
  → submit calls submitRealityCheck({ source: 'mid_block_signal', signalEvidence: {...}, ... })
  → modal closes, banner disappears (suppression engaged)

User clicks "Dismiss":
  → calls dismissOverrunSignal()
       writes minimal entry: { source: 'mid_block_signal',
                                signalEvidence,
                                dismissedWithoutAnswer: true,
                                capturedAt: now }
  → banner disappears (suppression engaged)
  → next planner sees evidence + dismiss flag, applies mild conservatism
    without specific direction
```

### Sub-project D consumption (out of scope here, listed for the contract)

```
User triggers Block 2 generation in the wizard
  → generateMesocyclePlan() reads getPendingPlannerNotes()
       if present: injects {availability, freeText, signalEvidence,
                            dismissedWithoutAnswer} into prompt context
       generates mesocycle plan with corrected assumptions
  → on success: clearPendingPlannerNotes()
  → next block starts with NULL pending_notes — signal can re-fire
```

---

## Trigger thresholds (overrun signal)

All conditions must hold for `shouldFire: true`:

1. **Active mesocycle exists** — signal is mid-block, never between blocks.
2. **At least 3 completed workouts** with non-null `actual_duration_minutes` AND non-null matching `session_inventory.estimated_duration_minutes`. Look back through the most recent N completions only.
3. **Average overrun ≥ 20%** of estimated, across those last 3 sessions.
4. **AND average overrun ≥ 8 minutes absolute**, across those last 3 sessions. (Floor exists to suppress noise on short sessions — a 15-min mobility flow running 20 min is 33% but only +5 min absolute, which doesn't fire.)
5. **`profiles.pending_planner_notes IS NULL`** — suppression check.

**Why "last 3 completed":** matches the existing rolling-pattern intervention window. Short enough to surface drift fast, long enough to filter one-off late sessions.

**Why 20% / 8 min:** matches the athlete's stated experience (20-min warm-up on a 60-min session = 33% overrun, +20 min). 20% catches systematic drift without firing on minor variance; 8-min floor protects short-session noise.

---

## Error handling

- **`submitRealityCheck` against unauthenticated user** — returns `{success: false, error: 'Not authenticated'}`. No write.
- **Merge conflict (concurrent writes)** — last-write-wins per the merge rule. Single-user app means concurrent writes are an edge case; not designing for it.
- **`pending_planner_notes` row corrupted (e.g., schema_version > 1)** — actions read defensively. If parsing fails, treat as null (signal can re-fire). Logged via `console.error`.
- **`evaluateOverrunSignal` query failure** — logged, returns `{shouldFire: false, evidence: <empty>}`. Banner doesn't render. Athlete sees no banner; no false alarm.
- **Reality-check page navigated for a mesocycle the user doesn't own** — `notFound()`.
- **Reality-check page navigated for a non-closed mesocycle** — page still renders. Submit still works. Caveat: post-close flow is the natural entry point but direct URL access works for re-revisiting the prompt.
- **Form submission with all fields empty** — submit button disabled until at least one field is set OR Skip is clicked. Free-text alone is enough to enable Save.

---

## Testing

### Vitest units

All tests mock `@/lib/supabase/server` via `vi.mock` + `vi.hoisted`. No live-DB writes. Pattern matches sub-project A's test files.

- **`evaluateOverrunSignal()` — 6 fixture scenarios:**
  1. Active meso, 3 sessions all under-budget → `shouldFire: false`
  2. Active meso, 3 sessions averaging +25%, +18 min → `shouldFire: true`
  3. Active meso, 3 sessions averaging +30%, +5 min → `shouldFire: false` (below absolute floor)
  4. Active meso, 3 sessions averaging +12%, +20 min → `shouldFire: false` (below percentage threshold)
  5. Active meso but `pending_planner_notes` non-null → `shouldFire: false` (suppressed)
  6. No active meso → `shouldFire: false`
- **`submitRealityCheck()`:**
  - Happy path — empty `pending_planner_notes`, write succeeds
  - Merge — existing `pending_planner_notes` from boundary check, signal modal answers a different field, deep-merge result
  - 200-char free-text truncation
  - Auth rejection
- **`dismissOverrunSignal()`:**
  - Writes minimal dismiss-marker
  - Idempotency — second dismiss merges, doesn't error
- **`getPendingPlannerNotes()` / `clearPendingPlannerNotes()`:**
  - Read returns null when none
  - Read returns typed entry when present
  - Clear sets to null

### Component tests

Skipped — `vitest.config.ts` includes only `.test.ts` (not `.test.tsx`) and uses `node` env. Same constraint as sub-project A. Components verified visually.

### Playwright E2E

Committed but not runnable (no infra) at `tests/e2e/reality-check.spec.ts`:
- Boundary flow: close-block → reality-check page → save → land on retrospective
- Boundary flow with skip: close-block → reality-check page → skip → land on retrospective without DB write
- Signal flow: dashboard banner appears (fixture-seeded) → click Update → modal opens → submit → banner gone
- Signal flow with dismiss: banner appears → click Dismiss → banner gone, dismiss-marker in `pending_planner_notes`

### Real-data verification (gating artifact)

Trickier than sub-project A because Block 1 is closed and Block 2 doesn't exist. Adapted path:

1. Apply migration 020 to live Supabase. Verify column exists: `SELECT pg_typeof(pending_planner_notes) FROM profiles WHERE id = …`.
2. Manually navigate to `/data/blocks/50ccb2aa-61e8-470c-8404-966064c31cef/reality-check`. Confirm the form renders with retrospective-grounded copy (showing 21/51 = 41% adherence numbers above the form).
3. Submit answers (e.g., `daysPerWeek: 5, sessionMinutes: 50, warmupMinutes: 15, cooldownMinutes: 5, freeText: "Mid-block reload chaos was real"`). Save.
4. Verify `profiles.pending_planner_notes` is populated with the expected JSON shape via `SELECT pending_planner_notes FROM profiles WHERE id = …`.
5. Re-navigate to the reality-check page — confirm pre-fill from `pending_planner_notes`.
6. Submit different values. Confirm merge logic produced the expected deep-merge result.
7. **Defer dashboard banner verification until sub-project D creates Block 2** — the signal engine + banner are unit-tested; visual confirmation lands once a real active block exists.

Screenshot of the populated reality-check page committed as `docs/superpowers/specs/2026-05-XX-reality-check-screenshot.png`.

---

## Out of scope

The following are explicitly out of scope for sub-project B and live in later sub-projects or are deferred:

- **Sub-project D consumption** — `getPendingPlannerNotes` / `clearPendingPlannerNotes` are exposed by B; D wires them into `generateMesocyclePlan` and the wizard pre-fill.
- **Mid-block dashboard banner visual verification** — needs an active block; lands as part of D's verification window or a follow-up.
- **Strength microcycle variation audit** — parked as candidate sub-project E or sidecar to C. The athlete observed that strength sessions felt static across a week (no perceived load/RPE/scheme variation). Needs a data audit before deciding what to change.
- **Coach roster / config / signal-weight tuning** — the original B framing. Deferred indefinitely; the retrospective showed weights matched onboarding commitments.
- **Multi-entry archive of past pending notes** — single-entry merging only. If a history is wanted later, it's an additive change (new `pending_planner_notes_archive` table or jsonb array column).
- **Snapshot assembler bug fix** — the recalibration extraction in `src/lib/analytics/block-retrospective.ts` looks for `{from_kg, to_kg, source, triggered_by, exercise_name}` but the actual `agent_activity.reasoning_structured` shape is `{previousMax, newMax, tier, driftPct, evidence: {exercise, topSet, sessionIds}}`. Filed as a small follow-up to sub-project A; doesn't block B.
- **Mid-block re-allocate** — explicitly rejected. Answers never trigger regeneration of the current block.
- **Coach-voice variation per prompt** — all prompts attribute to `head` coach. No domain-specific framing.

## Forward-compat note

- `schemaVersion: 1` on `PendingPlannerNotes` lets D evolve the contract independently. If D needs a v2 shape (e.g., adding new question fields), bump and version.
- New boundary-prompt questions are additive changes to `AvailabilityAnswers`. Existing carryover entries stay valid (omitted fields = "don't override profile defaults").
- The signal engine's threshold constants (20% / 8 min / 3 sessions) are encoded in `overrun-signal.ts`. Tuning is a one-line edit; no schema change.
