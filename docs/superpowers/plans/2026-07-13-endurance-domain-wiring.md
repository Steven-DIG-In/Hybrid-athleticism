# Endurance Domain Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the orphaned immutable endurance domain into the live path so cardio sessions get VDOT-derived targets, a frozen prescription that survives to the logger, an inline plan-vs-actual readout, and populated `/data/endurance` charts.

**Architecture:** Add a thin adapter from the live `programming.ts` `EnduranceSession` → immutable `EndurancePrescription` (resolving VDOT for running from the athlete's run capability). Freeze that prescription on a new `workouts.endurance_prescription` jsonb column, carried through `convert → allocate` the way LIFTING carries `exercise_sets`. The WorkoutLogger and a new endurance delta series both read it via `computeEnduranceDelta`. Retire the ambiguous `cardio_logs` target skeleton.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres), Vitest 4, Zod.

## Global Constraints

- Prod deploy = `git push origin main` (GitHub integration). Gate before push: `npm install`, full `npx vitest run` green, `npm run build` clean.
- Migrations applied via Supabase MCP `apply_migration` (project `kuqgtholljrxnbxtmrnz`), THEN regenerate `src/lib/types/database.types.ts` and re-append the hand-written alias appendix (type-regen ritual — the appendix is clobbered on regen).
- Single live user; NEVER run destructive tests against the live user id. Unit tests use `vi.mock`/`vi.hoisted` Supabase mocks (pattern: `src/lib/actions/__tests__/inventory-allocation-pointer.test.ts`).
- Immutable-prescription principle: the prescription is frozen at generation; the logger/analytics read it, never rewrite it.
- Deferred (do NOT build): `/data/conditioning` charts (METCON/`conditioning_logs`, different model), per-interval structured modeling, strength-domain symmetric cleanup.

---

### Task 1: Migration — `workouts.endurance_prescription`

**Files:**
- Migration: apply via Supabase MCP `apply_migration` (name `023_workouts_endurance_prescription`)
- Modify: `src/lib/types/database.types.ts` (regen + re-append alias appendix)

**Interfaces:**
- Produces: `workouts.endurance_prescription` (jsonb, nullable) on the `workouts` table; `Database['public']['Tables']['workouts']['Row'].endurance_prescription: Json | null`.

- [ ] **Step 1: Apply the migration**

Via Supabase MCP `apply_migration`, project `kuqgtholljrxnbxtmrnz`:
```sql
ALTER TABLE public.workouts ADD COLUMN endurance_prescription jsonb;
COMMENT ON COLUMN public.workouts.endurance_prescription IS
  'Frozen immutable EndurancePrescription for CARDIO workouts (VDOT target etc). Null for non-cardio.';
```

- [ ] **Step 2: Verify the column exists**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='workouts' AND column_name='endurance_prescription';
```
Expected: one row, `jsonb`.

- [ ] **Step 3: Regenerate types + re-append aliases**

Snapshot the hand-written alias appendix at the bottom of `database.types.ts` first. Regenerate via Supabase MCP `generate_typescript_types`, write it, then re-append the alias appendix (per `feedback/supabase-type-regen-clobbers-aliases.md`). Confirm `workouts` Row now includes `endurance_prescription: Json | null`.

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: clean (no type errors from the new column).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/database.types.ts
git commit -m "feat(db): add workouts.endurance_prescription jsonb (migration 023)"
```

---

### Task 2: `endurancePrescriptionFromLiveSession` adapter

**Files:**
- Create: `src/core/domains/endurance/from-live-session.ts`
- Test: `src/core/domains/endurance/__tests__/from-live-session.test.ts`

**Interfaces:**
- Consumes: `EnduranceSession` (type export `programming.ts:201`), `VdotPaces` + `vdotPacesFromCapability` (`from-endurance-session.ts`), `EndurancePrescription` (`prescription.types.ts`).
- Produces: `endurancePrescriptionFromLiveSession(session: EnduranceSession, runVdotPaces?: VdotPaces | null): EndurancePrescription`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { endurancePrescriptionFromLiveSession } from '../from-live-session'
import type { VdotPaces } from '../from-endurance-session'
import type { EnduranceSession } from '@/lib/ai/schemas/programming'

const base: EnduranceSession = {
  name: 'Tempo Run', modality: 'CARDIO', enduranceModality: 'running',
  estimatedDurationMinutes: 40, intensityZone: 'tempo',
  targetDistanceKm: 8, targetPaceSecPerKm: 320, intervalStructure: null,
  coachNotes: 'stay controlled', ruckWeightLbs: null,
}
const vdot: VdotPaces = {
  vdot: 38.3, easyPaceSecPerKm: 402, tempoPaceSecPerKm: 341,
  thresholdPaceSecPerKm: 322, intervalPaceSecPerKm: 290,
}

describe('endurancePrescriptionFromLiveSession', () => {
  it('running + VDOT → formula pace for the zone', () => {
    const p = endurancePrescriptionFromLiveSession(base, vdot)
    expect(p.modality).toBe('running')
    expect(p.targetPaceSecPerKm).toBe(341) // tempo band, not the AI 320
    expect(p.source).toBe('formula')
    expect(p.paceSource).toContain('VDOT 38.3')
  })
  it('running without VDOT → AI pace, source ai', () => {
    const p = endurancePrescriptionFromLiveSession(base, null)
    expect(p.targetPaceSecPerKm).toBe(320)
    expect(p.source).toBe('ai')
  })
  it('non-running → zone-only (null pace)', () => {
    const p = endurancePrescriptionFromLiveSession(
      { ...base, enduranceModality: 'rowing', ruckWeightLbs: null }, vdot)
    expect(p.targetPaceSecPerKm).toBeNull()
    expect(p.source).toBe('ai')
  })
  it('rucking → ruckWeightKg normalized from lbs', () => {
    const p = endurancePrescriptionFromLiveSession(
      { ...base, enduranceModality: 'rucking', ruckWeightLbs: 45 }, null)
    expect(p.ruckWeightKg).toBeCloseTo(20.4, 1)
  })
}) 
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/domains/endurance/__tests__/from-live-session.test.ts`
Expected: FAIL — module `from-live-session` not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// Adapter: live programming.ts EnduranceSession → immutable EndurancePrescription.
// Sibling to from-endurance-session.ts (which targets the week-brief schema).
import type { EnduranceSession } from '@/lib/ai/schemas/programming'
import { formatPace } from '@/lib/skills/domains/endurance/vdot-pacer'
import type { VdotPaces } from './from-endurance-session'
import type { EndurancePrescription, EnduranceSource, IntensityZone } from './prescription.types'

const LBS_TO_KG = 0.45359237

function vdotPaceForZone(zone: IntensityZone, p: VdotPaces): number {
  switch (zone) {
    case 'easy':
    case 'zone_2': return p.easyPaceSecPerKm
    case 'tempo': return p.tempoPaceSecPerKm
    case 'threshold': return p.thresholdPaceSecPerKm
    case 'vo2max':
    case 'interval': return p.intervalPaceSecPerKm
  }
}

export function endurancePrescriptionFromLiveSession(
  session: EnduranceSession,
  runVdotPaces?: VdotPaces | null,
): EndurancePrescription {
  const ruckWeightKg = session.ruckWeightLbs != null
    ? Number((session.ruckWeightLbs * LBS_TO_KG).toFixed(1)) : null

  let targetPaceSecPerKm: number | null = session.targetPaceSecPerKm ?? null
  let source: EnduranceSource = 'ai'
  let paceSource: string | null = null

  if (session.enduranceModality === 'running' && runVdotPaces) {
    targetPaceSecPerKm = vdotPaceForZone(session.intensityZone, runVdotPaces)
    source = 'formula'
    paceSource = `VDOT ${runVdotPaces.vdot} → ${session.intensityZone} ${formatPace(targetPaceSecPerKm)}/km`
  } else if (session.enduranceModality !== 'running') {
    targetPaceSecPerKm = null
    source = 'ai'
  }

  return {
    modality: session.enduranceModality,
    intensityZone: session.intensityZone,
    targetDistanceKm: session.targetDistanceKm,
    targetDurationMin: session.estimatedDurationMinutes,
    targetPaceSecPerKm,
    ruckWeightKg,
    intervalStructure: session.intervalStructure ?? null,
    source,
    ...(paceSource ? { paceSource } : {}),
    notes: session.coachNotes,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/domains/endurance/__tests__/from-live-session.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/domains/endurance/from-live-session.ts src/core/domains/endurance/__tests__/from-live-session.test.ts
git commit -m "feat(endurance): live-session → immutable prescription adapter with VDOT"
```

---

### Task 3: Wire generation — freeze prescription on the workout, drop the skeleton

**Files:**
- Modify: `src/lib/engine/microcycle/generate-pool.ts:446-489` (the insert loop)
- Modify: `src/lib/engine/microcycle/persistence.ts` (delete `insertEnduranceTarget`)

**Interfaces:**
- Consumes: `endurancePrescriptionFromLiveSession` (Task 2), `getAthleteState` (`@/lib/athlete/get-athlete-state`), `vdotPacesFromCapability` (`from-endurance-session.ts`).
- Produces: every CARDIO temp workout row carries `endurance_prescription`; no `cardio_logs` skeleton is written.

- [ ] **Step 1: Verify the run-capability shape**

Read `src/lib/types/athlete-state.types.ts` for `EnduranceCapability` (`key`, `currentValueSeconds`) and confirm `getAthleteState(userId)` returns `{ capabilities: { endurance: EnduranceCapability[] } }`. Confirm `vdotPacesFromCapability` accepts one `EnduranceCapability`.

- [ ] **Step 2: Compute run VDOT paces once, before the insert loop**

Near the top of `generateSessionPool` (after `user` is resolved, before the `for` loop at line 446), add:
```typescript
import { getAthleteState } from '@/lib/athlete/get-athlete-state'
import { vdotPacesFromCapability } from '@/core/domains/endurance/from-endurance-session'
import { endurancePrescriptionFromLiveSession } from '@/core/domains/endurance/from-live-session'

const athleteStateForVdot = await getAthleteState(user.id).catch(() => undefined)
const runCap = athleteStateForVdot?.capabilities.endurance
  .find(c => ['run_5k', 'run_10k', 'run_1mile'].includes(c.key))
const runVdotPaces = vdotPacesFromCapability(runCap)
```

- [ ] **Step 3: Attach the prescription to the CARDIO insert; remove the skeleton call**

In the insert loop, compute the prescription and include it in the workout insert payload:
```typescript
const endurancePrescription = session.modality === 'CARDIO'
  ? endurancePrescriptionFromLiveSession(session, runVdotPaces)
  : null
```
Add `endurance_prescription: endurancePrescription` to the `.from('workouts').insert({...})` payload (line 458). DELETE the `if (session.modality === 'CARDIO') { await insertEnduranceTarget(...) }` block (lines 485-488) and its import.

- [ ] **Step 4: Delete `insertEnduranceTarget`**

Remove the `insertEnduranceTarget` function from `persistence.ts` and any remaining import of it. Run: `grep -rn insertEnduranceTarget src` → expect no matches.

- [ ] **Step 5: Typecheck / build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/microcycle/generate-pool.ts src/lib/engine/microcycle/persistence.ts
git commit -m "feat(endurance): freeze VDOT prescription on cardio workouts at generation; drop cardio_logs skeleton"
```

---

### Task 4: Carry the prescription through convert → allocate

**Files:**
- Modify: `src/lib/actions/inventory-generation.actions.ts:41-117` (`convertWorkoutsToInventory`)
- Modify: `src/lib/actions/inventory.actions.ts` (workout insert ~724 + after the LIFTING rebuild ~745)
- Test: `src/lib/actions/__tests__/endurance-roundtrip.test.ts`

**Interfaces:**
- Consumes: `workouts.endurance_prescription` (Task 1), `adjustment_pending` jsonb on `session_inventory`.
- Produces: allocated CARDIO workouts carry `endurance_prescription` (round-tripped via `session_inventory.adjustment_pending.endurancePrescription`).

- [ ] **Step 1: Convert — copy the cardio prescription into inventory**

In `convertWorkoutsToInventory`, in the per-workout loop, alongside the LIFTING `exercisePrescription` block, add:
```typescript
let endurancePrescription: unknown = null
if (workout.modality === 'CARDIO') {
  endurancePrescription = (workout as { endurance_prescription?: unknown }).endurance_prescription ?? null
}
```
Change the inventory insert's `adjustment_pending` to carry whichever exists:
```typescript
adjustment_pending: exercisePrescription
  ? { prescription: exercisePrescription }
  : endurancePrescription
    ? { endurancePrescription }
    : null,
```
Remove the now-dead `await supabase.from('cardio_logs').delete().in('workout_id', workoutIds)` line (the skeleton no longer exists; deleting real completed logs here would be wrong — verify it only ran on temp ids, then drop it).

- [ ] **Step 2: Allocate — write the prescription onto the new workout**

In `inventory.actions.ts` `applyAllocation`, add `endurance_prescription` to the workout `.insert({...})` payload (~line 725):
```typescript
endurance_prescription:
  (session.adjustment_pending as { endurancePrescription?: unknown } | null)?.endurancePrescription ?? null,
```

- [ ] **Step 3: Write the round-trip test**

```typescript
// src/lib/actions/__tests__/endurance-roundtrip.test.ts
// Mock supabase per inventory-allocation-pointer.test.ts pattern. Assert:
// (1) convertWorkoutsToInventory inserts session_inventory with
//     adjustment_pending.endurancePrescription for a CARDIO temp workout that
//     has endurance_prescription set;
// (2) applyAllocation's workout insert payload includes endurance_prescription
//     taken from session.adjustment_pending.endurancePrescription.
```
(Full mock mirrors the existing allocation-pointer test; assert the insert payloads via captured `chain._payload`.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/actions/__tests__/endurance-roundtrip.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + build + commit**

Run: `npx vitest run && npm run build` → green.
```bash
git add src/lib/actions/inventory-generation.actions.ts src/lib/actions/inventory.actions.ts src/lib/actions/__tests__/endurance-roundtrip.test.ts
git commit -m "feat(endurance): round-trip prescription through convert+allocate onto the workout"
```

---

### Task 5: WorkoutLogger — show target + inline delta; fix swallowed cardio result

**Files:**
- Modify: `src/components/workout/WorkoutLogger.tsx` (endurance section ~511, completion handler ~215)
- Create: `src/core/domains/endurance/__tests__/plan-vs-actual.wiring.test.ts` (mapping-only, if a pure mapping helper is extracted)

**Interfaces:**
- Consumes: `workout.endurance_prescription` (Task 1/4), `computeEnduranceDelta` + `PrescribedEndurance`/`ActualEndurance` (`plan-vs-actual.ts`).
- Produces: cardio target displayed; inline `EnduranceDelta` readout after logging; `logCardioSession` result checked.

- [ ] **Step 1: Read the current endurance section**

Read `WorkoutLogger.tsx:505-560` (the "LOG YOUR ENDURANCE RESULT" block) and `:210-230` (the `logCardioSession` call) to see the actuals form fields and completion flow.

- [ ] **Step 2: Display the target**

Parse `workout.endurance_prescription` into `PrescribedEndurance` and render target zone / distance / duration / pace above the actuals inputs, showing `paceSource` when `source === 'formula'` (e.g. "Target: tempo 5:41/km — VDOT 38.3"). Null prescription → render nothing (graceful for pre-migration rows).

- [ ] **Step 3: Inline delta on completion**

After the athlete enters actuals, compute and show:
```typescript
import { computeEnduranceDelta } from '@/core/domains/endurance/plan-vs-actual'
const delta = prescription
  ? computeEnduranceDelta(prescription, {
      distanceKm, durationMinutes, avgPaceSecPerKm, avgHeartRateBpm, perceivedEffortRpe,
    })
  : null
// render delta.paceDeltaSecPerKm, delta.durationDeltaMin, delta.zoneAdherence
// mirroring the strength computeSetDelta readout block (~line 1485).
```

- [ ] **Step 4: Fix the swallowed cardio result (Stage-3 bug)**

At the `await logCardioSession({...})` call (~215), check the result and surface an error instead of proceeding to `completeWorkout`:
```typescript
const res = await logCardioSession({ ...cardioInput })
if (!res.success) { setError(res.error); return }
```

- [ ] **Step 5: Verify in the running app**

Run: `npm run dev`, open a CARDIO workout, confirm the target renders and the delta appears on entry. (No destructive DB writes; use an existing allocated cardio session or read-only inspection.)

- [ ] **Step 6: Commit**

```bash
git add src/components/workout/WorkoutLogger.tsx
git commit -m "feat(endurance): logger shows VDOT target + inline plan-vs-actual; check cardio log result"
```

---

### Task 6: `/data/endurance` delta series

**Files:**
- Create: `src/lib/analytics/shared/endurance-series.ts`
- Test: `src/lib/analytics/shared/__tests__/endurance-series.test.ts`
- Modify: `src/app/data/endurance/page.tsx:26`

**Interfaces:**
- Consumes: completed CARDIO `workouts` (with `endurance_prescription`) + their `cardio_logs`; `computeEnduranceDelta`.
- Produces: `getRecentEnduranceDeltaSeries(userId: string, opts?: { limit?: number }): Promise<DeltaPoint[]>` where `DeltaPoint` matches `PerformanceDeltaChart`'s point prop.

- [ ] **Step 1: Confirm the chart point shape**

Read `src/app/data/endurance/page.tsx` + the `PerformanceDeltaChart` component to capture the exact `points` element type (label/date + numeric delta). Define `DeltaPoint` to match it exactly.

- [ ] **Step 2: Write the failing test**

```typescript
// Given N completed cardio workouts with endurance_prescription + a matching
// cardio_logs row, the series returns N points; primary metric = pace delta %
// for running, duration delta % otherwise; empty array when no cardio.
// Mock supabase per existing analytics test patterns.
```

- [ ] **Step 3: Implement `getRecentEnduranceDeltaSeries`**

Query completed CARDIO workouts joined to `cardio_logs`, run `computeEnduranceDelta(prescription, actual)` per session, map to a `DeltaPoint` using pace-delta-% for running and duration-delta-% otherwise (documented in a comment), newest `limit` (default 20), oldest-first for the chart.

- [ ] **Step 4: Wire the page**

In `src/app/data/endurance/page.tsx`, replace `getRecentCoachDeltaSeries(user.id, 'endurance', {limit:20})` with `getRecentEnduranceDeltaSeries(user.id, {limit:20})`. Leave the `PatternFlagCard`/chart JSX intact.

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run src/lib/analytics/shared/__tests__/endurance-series.test.ts && npm run build`
Expected: PASS + clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics/shared/endurance-series.ts src/lib/analytics/shared/__tests__/endurance-series.test.ts src/app/data/endurance/page.tsx
git commit -m "feat(endurance): /data/endurance delta series from prescription vs cardio_logs"
```

---

### Task 7: Full gate + deploy

- [ ] **Step 1:** `npm install && npx vitest run` → all green (existing 373 + new tests).
- [ ] **Step 2:** `npm run build` → clean.
- [ ] **Step 3:** `git push origin main` → confirm the production deploy reaches READY (Vercel MCP `list_deployments`, top deploy `target: production`, `state: READY`, sha = HEAD).
- [ ] **Step 4:** Verify live: Steven regenerates a week (or `regenerateWeekInventory`) → new cardio sessions carry VDOT targets; the logger shows them; `/data/endurance` populates after a logged cardio session.

## Self-Review

- **Spec coverage:** VDOT resolution (T2/T3) ✓; frozen prescription on workout + migration (T1/T3/T4) ✓; retire cardio_logs skeleton (T3) ✓; logger target + inline delta (T5) ✓; swallowed-result fix (T5) ✓; /data/endurance charts (T6) ✓; graceful degradation for null prescription (T5/T6) ✓; conditioning explicitly deferred (constraints) ✓.
- **Placeholder scan:** Tasks 4-Step3, 5, 6-Step2 describe test intent rather than full code because they depend on shapes verified in that task's Step 1 (chart point type, logger form fields) — each has a concrete first verification step so no placeholder reaches implementation. All pure-unit code (T2) is complete.
- **Type consistency:** `endurancePrescriptionFromLiveSession(session, runVdotPaces?)` used identically in T2/T3; `EndurancePrescription` fields match `prescription.types.ts`; `computeEnduranceDelta(prescribed, actual)` signature matches `plan-vs-actual.ts`; `endurance_prescription` column name consistent T1/T3/T4.
