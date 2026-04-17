# Phase 2 — Training Loop: Allocation, Planner, Execution

**Date:** 2026-04-17
**Status:** Approved design, implementation pending
**Implementation order:** First of three phases (Phase 2 → Phase 1 → Phase 3)

> ⚠️ **Next.js 16 reminder:** This project runs Next.js 16 with breaking changes from prior versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.

---

## Purpose

Fix the fractured allocation → planner → execution loop. Today, the UI is calendar-date-anchored but the data model is training-day-model (Day 1…Day N). Five concrete bugs break daily usage:

1. Allocated sessions don't show on the dashboard calendar.
2. `/planner` lists workouts but can't launch or read them.
3. Sessions can't be moved.
4. Starting a session on Wednesday doesn't rebind the session to Wednesday.
5. Same-day overreach/load detection is wrong.

Root cause: the UI solves the wrong problem. This phase aligns the UI with the existing training-day-model and collapses the `/planner` redundancy.

---

## Architecture

Retire the date-anchored mental model. Sessions are **ordered day-slots** (Day 1…Day N in a block). Calendar is a **visual overlay** that maps the next 7 day-slots to real weekdays so the athlete can plan around real-life commitments. Day-slot is the source of truth; calendar position is advisory.

### Invariants

- A block = ordered sequence of sessions with `day_index` (1, 2, 3…).
- At any moment, the athlete has a **next-training-day pointer** — the next unfinished session.
- **Allocate this week** takes the next 7 pending day-slots and assigns tentative calendar dates starting from the next-training-day pointer, forward from today.
- **Drag-to-reschedule** swaps the calendar date of a day-slot within the current 7-day window; it never changes `day_index`.
- **Start a session** auto-rebinds its calendar date to today. Day-slot order is preserved; what changes is the date.
- **Miss a day** → session marked `missed`, next-training-day pointer advances. Missed sessions are recoverable: drag to a later date or launch retroactively.
- **Missed-session behavior (Q9, B+recovery):** skip forward by default; athlete can manually move a missed session to another day or complete it retroactively.

---

## Components

### Retire

- `/planner` page (`src/app/planner/page.tsx`, `src/components/planner/PlannerClient.tsx`) — functionality merges into the dashboard's week view.

### Evolve

- `src/components/dashboard/SessionPoolClient.tsx` — inventory side only (cleaner scope, removes `/planner` link).
- `src/components/planner/PlannerClient.tsx` → **moved to** `src/components/dashboard/WeekViewClient.tsx`. Renders the 7-day calendar strip with drag-to-reschedule and load overlay.
- `src/lib/actions/inventory.actions.ts` — allocation rewritten around `day_index` + next-training-day pointer. Adds `rebindCalendarDate(sessionId, newDate)`, `rescheduleToToday(sessionId)`, `markMissed(sessionId)`.
- `src/lib/scheduling/load-scoring.ts` — fix same-day load aggregation (bug #5). Realized load is computed per **calendar date**, not per day-slot.
- `src/lib/actions/workout.actions.ts` — on session start, auto-rebind calendar date to today (bug #4).
- `src/lib/skills/training-max-estimation.ts` — wire output into next-session prescribed weights (fixes stale 1RM). Currently the skill exists but isn't feeding prescriptions.
- `src/components/workout/CoachNotesBanner.tsx` — surfaces recalibration line when tiered threshold fires ("Training max: 140→132kg based on last session").

### New

- `src/lib/actions/recalibration.actions.ts` — tiered recalibration gate (Q11, D). All three tiers log to `agent_activity` (since all three change prescription or surface to the athlete, per Phase 3's content model):
  - Drift < 5%: apply new training-max; visible in `CoachNotesBanner` next session; `agent_activity` row with `decision_type='recalibration'`, tier tag in `reasoning_structured`.
  - Drift 5–10%: apply; `agent_activity` row with `decision_type='recalibration'`.
  - Drift > 10%: create unreviewed intervention via existing `ai-coach.actions.ts` pipeline; `agent_activity` row with `decision_type='intervention_fired'` referencing the intervention id.
- `src/app/log-session/page.tsx` — rebuilt off-plan logging page. Replaces the blank page. Quick-log form: modality, duration, RPE, optional notes, "count toward training load?" toggle (default ON for run/strength/conditioning, OFF for other modalities per Q5, C).

### Bug-to-fix map

| Bug | Root cause | Fix |
|---|---|---|
| 1. Allocated→calendar mismatch | Two sources of truth | `WeekViewClient` reads from a single `workouts.scheduled_date` column |
| 2. `/planner` can't launch sessions | Redundant UI layer | Retire `/planner`; week view launches workouts |
| 3. Can't move sessions | No UI for reschedule | Drag-to-reschedule in `WeekViewClient` → `rebindCalendarDate` |
| 4. Start session doesn't rebind to today | Start action doesn't touch `scheduled_date` | `workout.actions.ts:startSession` calls `rescheduleToToday` |
| 5. Same-day overreach detection broken | `load-scoring` aggregates by `day_index`, not by calendar date | Re-key aggregation by `completed_date` (or `scheduled_date` for pending) |

---

## Data model

**Migration:** `supabase/migrations/012_training_day_model_cleanup.sql`

- `session_inventory`:
  - Ensure `day_index` (int, 1-indexed per block) is non-null and indexed.
  - Add `status` enum (`pending | active | completed | missed | off_plan`).
- `workouts`:
  - `scheduled_date` becomes nullable + advisory (calendar position only).
  - Add `completed_date` (set on completion).
  - Drop any unique constraints tying `workouts` to a fixed date.
- `block_pointer` (new table):
  - One row per (user_id, mesocycle_id, block_id) storing `next_day_index`.
  - Updated on session state transitions (completion advances, missed advances).
  - Chosen over a derived view because pointer writes are atomic and testable; a view would require recomputing the pointer on every query.
- `agent_activity` (new table, owned by Phase 2 — first writer):
  - Minimal shape to support Phase 2's recalibration logs for the 5–10% drift tier.
  - Columns: `id`, `user_id`, `coach`, `decision_type`, `target_entity` (jsonb), `reasoning_structured` (jsonb), `reasoning_text`, `block_id`, `created_at`.
  - Indexes: `(user_id, created_at desc)` and `(user_id, coach, created_at desc)`.
  - Phase 3 extends this table (adds `coach_journals`, additional consumers) but does not recreate it.
- `performance_deltas` — no schema change; wire existing data into recalibration trigger.

---

## Runtime flows

### Session start

```
User taps session → workout.actions.ts:startSession(sessionId)
  UPDATE workouts.scheduled_date = today (rebind, bug #4 fix)
  UPDATE session_inventory.status = 'active'
  (block_pointer advances on completion, not start)
```

### Session complete

```
WorkoutLogger.complete()
  → performance-deltas.actions.ts:computeDeltas() [existing, auto]
  → recalibration.actions.ts:evaluate(deltas)
       drift < 5%: apply + visible note + agent_activity row (recalibration)
       drift 5-10%: apply + agent_activity row (recalibration)
       drift > 10%: intervention via ai-coach.actions.ts + agent_activity row (intervention_fired)
  → load-scoring.ts:recompute(completed_date)
  → block_pointer.advance()
  → check-in.actions.ts:fire() [existing logic]
```

### Allocate week

```
SessionPoolClient.allocateWeek()
  → take next 7 pending sessions from block_pointer
  → inventory.actions.ts:allocateWeek()
       distributes across next 7 weekdays from today,
       respecting existing load-aware allocation algorithm
  → sessions receive tentative scheduled_date (calendar position only)
```

### Drag-to-reschedule

```
WeekViewClient.onDrop(sessionId, newDate)
  → rebindCalendarDate(sessionId, newDate)
  → UPDATE workouts.scheduled_date = newDate
  → load-scoring.recompute(oldDate) and load-scoring.recompute(newDate)
  → NO change to day_index
```

### Missed-session recovery

```
End of day (no start triggered) → session.status = 'missed', block_pointer advances.
Athlete can:
  - Drag missed session to a future date in WeekViewClient → status back to 'pending', new scheduled_date.
  - Launch missed session retroactively → status to 'completed', completed_date = today.
```

---

## Error handling

- **Concurrent drags** (unlikely single-user): last-write-wins; load recompute is idempotent.
- **Partial block** (user abandons mid-block): `block_pointer` stays at last unfinished `day_index`; resume correctly shows next-training-day.
- **Missed-session recovery**: dragging a `missed` session transitions status to `pending` and sets a new `scheduled_date`.
- **Stale recalibration intervention**: if a >10% drift fires an intervention but the user doesn't review before the next session of the same type, the intervention stays active (not auto-resolved). Coach prompts accumulate but are capped at 1 per coach per week mid-block.
- **Load-scoring failure** during reschedule: log + retry once; on persistent failure, surface banner on `WeekViewClient` rather than blocking the drag.

---

## Testing

### Vitest units
- `block_pointer` state transitions (complete advances, start doesn't, missed advances).
- Tiered recalibration gate (< 5%, 5–10%, > 10% paths).
- Off-plan load toggle default logic by modality.
- Drag-to-reschedule does not change `day_index`.
- `rescheduleToToday` on session start.

### Integration tests
- **Full training loop:** allocate → start (rebinds to today) → complete → recompute deltas → recalibrate → pointer advances.
- **Drag-reschedule with load recompute:** assert both old and new dates get recomputed.
- **Missed-session recovery:** skip a day, assert status transitions, then recover via drag.
- **Fixture:** 6-week block with 1 injected missed session + 1 under-performing strength session; assert pointer, recalibration, and deltas remain consistent.

### E2E (light, Playwright)
- Allocate week → session appears on `WeekViewClient` (bug #1 regression test).
- Launch workout from dashboard week view (bug #2 regression).
- Drag session across days (bug #3 regression).
- Start on wrong day rebinds (bug #4 regression).

---

## Out of scope

- Two-a-day support enhancements (existing data model supports it, UI stays as-is this phase).
- Block-level programming changes (Phase 1 surfaces delta signal; any programming changes happen in Phase 3's recalibration flows or separately).
- Mobility/Nutrition coach enhancements (separate projects).
