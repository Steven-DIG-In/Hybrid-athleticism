# Endurance Domain Wiring — Design (2026-07-13)

## Problem

Layer 3's immutable endurance domain (`src/core/domains/endurance/`) is built and unit-tested
but has **zero production callers**. The consequences on the live path:

1. **Targets are destroyed.** `convertWorkoutsToInventory` reads only `exercise_sets` (LIFTING)
   into inventory and hard-deletes the `cardio_logs` skeleton written by `insertEnduranceTarget`.
   `applyAllocation` rebuilds `exercise_sets` for LIFTING but nothing for CARDIO. Allocated cardio
   sessions therefore carry only free-text `coach_notes` — no structured target.
2. **No VDOT.** Live generation (`generateSessionPool` → `programming.ts` `EnduranceSessionSchema`)
   emits whatever pace the AI chooses. The VDOT resolver (`vdotPacesFromCapability` + `fromEnduranceSession`)
   is never invoked, even though the athlete's `run_5k` capability is available at generation via
   `getAthleteState`.
3. **No plan-vs-actual.** The WorkoutLogger shows a blank target for cardio; `computeEnduranceDelta`
   has no consumer. `/data/endurance` calls `getRecentCoachDeltaSeries(_, 'endurance')`, which reads
   the strength-only `performance_deltas` table → always empty.

Root cause of the orphaning: a **schema mismatch** — `fromEnduranceSession` was written against the
newer `week-brief.ts` `EnduranceProgramValidated` shape, while the live pipeline emits the older
`programming.ts` `EnduranceSessionSchema`.

## Goals

- Running cardio sessions get a **real VDOT-derived pace** (zone-only for row/ruck/swim/bike, as the
  domain already models).
- The endurance target survives the inventory→allocation round-trip and reaches the WorkoutLogger as
  a **frozen, structured prescription**.
- The WorkoutLogger shows the target and an **inline `computeEnduranceDelta` readout** on completion,
  mirroring how strength uses `computeSetDelta`.
- `/data/endurance` **historical delta charts populate** from real endurance deltas.
- Retire the ambiguous `cardio_logs` target-skeleton; `cardio_logs` holds **actuals only**.

## Non-goals (deferred)

- `/data/conditioning` charts (METCON uses `conditioning_logs`, a different data model — no
  `EndurancePrescription`). Explicitly out of scope; documented as remaining-empty.
- Structured per-interval modeling (`intervalStructure` stays an opaque string).
- Symmetric strength-domain cleanup (`fromStrengthExercise` remains orphaned; `computeSetDelta` is
  already wired — untouched).
- Migrating the whole generation path to the `week-brief.ts` schema. We adapt in place instead.

## Architecture

Five wiring points, each a small, independently-testable unit. Data flows:

```
generateSessionPool (programming.ts EnduranceSession)
  └─► [1] endurancePrescriptionFromLiveSession(session, runVdotPaces)  → EndurancePrescription (VDOT for running)
        └─► stored on the temp workout row
  └─► [2] convertWorkoutsToInventory: copy prescription → session_inventory.adjustment_pending.endurancePrescription
        (stop writing/deleting the cardio_logs skeleton)
  └─► [3] applyAllocation: write prescription → workouts.endurance_prescription (jsonb, NEW column)
        └─► WorkoutLogger reads workout.endurance_prescription
              └─► [4] displays target; on completion computeEnduranceDelta(prescription, actuals) → inline readout
  └─► [5] /data/endurance: getRecentEnduranceDeltaSeries(userId) → computeEnduranceDelta per completed cardio session → chart
```

### Data model change (one migration)

`ALTER TABLE workouts ADD COLUMN endurance_prescription jsonb;` — nullable; holds a serialized
`EndurancePrescription` for CARDIO workouts, null otherwise. Analog of `exercise_sets` for LIFTING,
but a single frozen object rather than relational rows (endurance prescription is one object, not a
set list). Regenerate `database.types.ts` after.

### Components

**[1] `endurancePrescriptionFromLiveSession` (new, `src/core/domains/endurance/from-live-session.ts`)**
- *What:* pure adapter mapping the **live** `programming.ts` `EnduranceSession` (+ optional
  `VdotPaces`) onto `EndurancePrescription`. A sibling to `fromEnduranceSession` (which targets the
  week-brief schema) — reuses `vdotPaceForZone` logic. The live schema lacks `methodologySource`
  and `ruckWeightLbs`; those map to `source: 'ai'` / `ruckWeightKg: null` respectively.
- *Depends on:* `vdot-pacer` skill (via `vdotPacesFromCapability`), `prescription.types.ts`.
- *Why a new adapter, not reuse:* the two generation schemas differ; forcing one adapter to serve
  both couples them. A thin second adapter is clearer than a union type.

**[2] `generateSessionPool` wiring (`src/lib/engine/microcycle/generate-pool.ts`)**
- Replace the `insertEnduranceTarget` call (line ~486) with: compute `runVdotPaces` once per pool
  from `athleteState.capabilities.endurance` (the run benchmark), then for each CARDIO session build
  the prescription via [1] and write it to the temp workout's `endurance_prescription`.
- Delete `insertEnduranceTarget` (`persistence.ts`) — no more cardio_logs skeleton.

**[3] `convertWorkoutsToInventory` + `applyAllocation` (`inventory-generation.actions.ts`, `inventory.actions.ts`)**
- Convert: for CARDIO workouts, copy `workout.endurance_prescription` →
  `session_inventory.adjustment_pending.endurancePrescription` (mirrors the LIFTING `prescription`
  branch). Remove the now-dead `cardio_logs` delete for temps (skeleton no longer exists).
- Allocate: when rebuilding the workout, if `adjustment_pending.endurancePrescription` is present,
  write it to the new `workouts.endurance_prescription` column.

**[4] WorkoutLogger (`src/components/workout/WorkoutLogger.tsx`)**
- Read `workout.endurance_prescription`. In the existing "LOG YOUR ENDURANCE RESULT" section, show
  target pace/distance/duration/zone (with `paceSource` label when `source === 'formula'`).
- On completion, call `computeEnduranceDelta(prescription, actualsFromForm)` and render an inline
  readout mirroring the strength `computeSetDelta` block.

**[5] `getRecentEnduranceDeltaSeries` (new, `src/lib/analytics/shared/endurance-series.ts`)**
- *What:* fetch completed CARDIO workouts (with `endurance_prescription`) joined to their
  `cardio_logs` actual, run `computeEnduranceDelta` per session, return a chart-ready series.
- Map to the existing `PerformanceDeltaChart` point shape using a **single primary metric**:
  pace delta % for running, duration delta % otherwise (documented in code). `/data/endurance/page.tsx`
  switches from `getRecentCoachDeltaSeries(_, 'endurance')` to this.

## Error handling / degradation

- **No run capability / non-running:** `vdotPacesFromCapability` returns null → prescription pace is
  AI-emitted (`source: 'ai'`). Already the domain's designed behavior; no error.
- **No prescription on an old workout** (pre-migration cardio sessions): logger + series treat a null
  `endurance_prescription` as "no target" — show actuals only, `computeEnduranceDelta` returns
  null-deltas with `status: 'unlogged'`/absent target. No crash, graceful blank.
- **cardio_logs insert failure on completion:** fix the swallowed-result bug in passing —
  `WorkoutLogger` must check `logCardioSession`'s `ActionResult` and surface an error instead of
  marking the session complete (Stage-3 finding).

## Testing (TDD — test-first per unit)

- **[1]** unit tests: running+VDOT → formula pace for each zone; running w/o capability → AI pace;
  non-running → zone-only null pace; ruck weight null (live schema has no lbs field).
- **[3]** the idempotency guard already added stays green; add: CARDIO prescription round-trips
  convert→allocate onto `workouts.endurance_prescription` (mock Supabase, mirror existing action tests).
- **[5]** unit test: given completed cardio workouts + logs, series has one point per session with the
  correct primary-metric mapping; empty when no cardio.
- **[4]** logic-level test of the delta readout mapping (component render optional; keep to the pure
  mapping fn).
- Full suite + `next build` green before deploy. Prod deploy = `git push origin main`; migration
  applied via Supabase MCP `apply_migration` first, then `database.types.ts` regen (preserve the
  hand-written alias appendix per the type-regen ritual).

## Rollout

1. Migration `workouts.endurance_prescription` + type regen.
2. Land [1]–[5] behind normal generation (no flag needed; degrades gracefully for pre-existing rows).
3. Steven's next generated week (or a `regenerateWeekInventory`) produces VDOT-paced cardio targets;
   existing week-1 cardio sessions show actuals-only until regenerated.

## Open risk

`programming.ts` `EnduranceSession` field names must be verified against `fromEnduranceSession`'s
expectations during implementation (e.g. `estimatedDurationMinutes` vs the base session's duration
field). The plan's first task is a field-mapping check so [1] compiles against the real live type.
