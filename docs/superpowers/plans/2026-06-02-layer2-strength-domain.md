# Layer 2 — Strength Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the immutable `ResistancePrescription` model, wire strength generation to Layer 1's canonical capabilities, close the live target-overwrite leak, and surface plan-vs-actual feedback.

**Architecture:** New typed model under `src/core/domains/strength/` that existing `StrengthExercise` maps onto (seam). `buildStrengthMethodologyContext` reads `athleteState.capabilities.strength` (source-aware TM) with benchmark fallback. `updateExerciseSetTargets` is removed so `exercise_sets.target_*` becomes write-once; the live logger's in-session edits already flow into actuals. Pure, tested helpers compute plan-vs-actual deltas and progression recommendations.

**Tech Stack:** Next.js 16 (App Router, server actions, client components), Supabase, TypeScript, Vitest (`environment: 'node'` — no React component unit tests; client-component changes are verified manually/by screenshot).

**Specs:** [design](../specs/2026-06-02-layer2-strength-domain-design.md) · [discovery](../specs/2026-06-02-layer2-strength-domain-discovery.md) · [master](../specs/2026-06-01-hybrid-core-rebuild-design.md)

**Conventions (verified):** tests in `__tests__/*.test.ts`, run `npm test -- <pattern>`; skills are objects with `.execute(input)` validated by Zod; server actions use `'use server'` + `createClient`; `StrengthCapability` = `{ key, label, currentValueKg, source, updatedAt, evidence }` (`src/lib/types/athlete-state.types.ts`). Known pre-existing noise: `garmin-sync.test.ts` fails (missing `garmin-connect` dep); repo has ~247 `no-explicit-any` lint errors (house style); `database.types.ts` is hand-augmented (never blind-regen).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/domains/strength/prescription.types.ts` | `ResistancePrescription`, `StrengthPrescription`, `HypertrophyPrescription`. |
| `src/core/domains/strength/from-strength-exercise.ts` | Adapter: `StrengthExercise` → `StrengthPrescription` (derives `source`). |
| `src/core/domains/strength/training-max.ts` | `trainingMaxFromCapability(cap)` — source-aware TM from a `StrengthCapability`. |
| `src/core/domains/strength/plan-vs-actual.ts` | `computeSetDelta(prescribed, actual)` — pure delta. |
| `src/core/domains/strength/progression-feedback.ts` | `nextSetRecommendation(...)` — wraps `progressionEngineSkill` (RIR→RPE). |
| `src/lib/engine/mesocycle/context.ts` | **Modify** `buildStrengthMethodologyContext` — capability-sourced TM + fallback. |
| `src/lib/engine/mesocycle/generate.ts:75` | **Modify** caller — pass `ctx.athleteState?.capabilities.strength`. |
| `src/lib/actions/logging.actions.ts:171-208` | **Modify** — remove `updateExerciseSetTargets` (the leak). |
| `src/components/workout/WorkoutLogger.tsx` | **Modify** — remove `handleSaveTargets` + import + "Save Targets" UI; add minimal delta readout. |
| `src/core/domains/strength/__tests__/*.test.ts` | Unit tests per pure module. |

---

## Task 1: `ResistancePrescription` model types

**Files:**
- Create: `src/core/domains/strength/prescription.types.ts`

- [ ] **Step 1: Write the types (pure module — no test)**

```ts
// src/core/domains/strength/prescription.types.ts
// Layer 2: the immutable resistance prescription model. One ResistancePrescription
// is one exercise's prescribed work, produced by generation and never mutated.
// Strength and Hypertrophy share the core; they differ only in category + a few fields.

export type ResistanceSource = 'formula' | 'ai'  // 531-derived vs AI-chosen accessory

export interface ResistancePrescription {
  exerciseName: string
  muscleGroup: string
  sets: number
  targetReps: number
  targetWeightKg: number | null
  targetRir: number
  source: ResistanceSource
  methodologySource?: string   // e.g. "5/3/1 wk1: 5+ @ 85% TM" — present when source = 'formula'
  notes?: string | null
}

export interface StrengthPrescription extends ResistancePrescription {
  category: 'primary_compound' | 'secondary_compound' | 'accessory' | 'warm_up'
  isBenchmarkTest?: boolean
}

export interface HypertrophyPrescription extends ResistancePrescription {
  category: 'compound' | 'isolation' | 'machine' | 'warm_up'
  tempo?: string | null
  restSeconds?: number | null
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep prescription.types || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/core/domains/strength/prescription.types.ts
git commit -m "feat(layer2): ResistancePrescription model types"
```

---

## Task 2: Adapter — `StrengthExercise` → `StrengthPrescription`

**Files:**
- Create: `src/core/domains/strength/from-strength-exercise.ts`
- Test: `src/core/domains/strength/__tests__/from-strength-exercise.test.ts`

The existing `StrengthExercise` (`src/lib/types/coach-context.ts:232`) has fields `exerciseName, muscleGroup, category, sets, targetReps, targetWeightKg, targetRir, notes, isBenchmarkTest?, methodologySource?`. `source` is derived: `'formula'` when `methodologySource` is set, else `'ai'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/domains/strength/__tests__/from-strength-exercise.test.ts
import { describe, it, expect } from 'vitest'
import { fromStrengthExercise } from '../from-strength-exercise'

const base = {
  exerciseName: 'Back Squat', muscleGroup: 'Quads',
  category: 'primary_compound' as const, sets: 3, targetReps: 5,
  targetWeightKg: 85, targetRir: 2, notes: null,
}

describe('fromStrengthExercise', () => {
  it('maps core fields and marks formula-sourced when methodologySource is present', () => {
    const p = fromStrengthExercise({ ...base, methodologySource: '5/3/1 wk1: 5+ @ 85% TM' })
    expect(p).toMatchObject({
      exerciseName: 'Back Squat', muscleGroup: 'Quads', sets: 3, targetReps: 5,
      targetWeightKg: 85, targetRir: 2, category: 'primary_compound',
      source: 'formula', methodologySource: '5/3/1 wk1: 5+ @ 85% TM',
    })
  })

  it('marks ai-sourced when no methodologySource (accessory)', () => {
    const p = fromStrengthExercise({ ...base, exerciseName: 'Cable Fly', category: 'accessory' })
    expect(p.source).toBe('ai')
    expect(p.methodologySource).toBeUndefined()
  })

  it('preserves isBenchmarkTest', () => {
    const p = fromStrengthExercise({ ...base, isBenchmarkTest: true })
    expect(p.isBenchmarkTest).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- from-strength-exercise`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/core/domains/strength/from-strength-exercise.ts
// Seam adapter: maps the existing AI-generated StrengthExercise shape onto the
// immutable StrengthPrescription model. source is derived from methodologySource.

import type { StrengthExercise } from '@/lib/types/coach-context'
import type { StrengthPrescription } from './prescription.types'

export function fromStrengthExercise(ex: StrengthExercise): StrengthPrescription {
  return {
    exerciseName: ex.exerciseName,
    muscleGroup: ex.muscleGroup,
    sets: ex.sets,
    targetReps: ex.targetReps,
    targetWeightKg: ex.targetWeightKg,
    targetRir: ex.targetRir,
    category: ex.category,
    notes: ex.notes,
    source: ex.methodologySource ? 'formula' : 'ai',
    ...(ex.methodologySource ? { methodologySource: ex.methodologySource } : {}),
    ...(ex.isBenchmarkTest ? { isBenchmarkTest: true } : {}),
  }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- from-strength-exercise`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/domains/strength/from-strength-exercise.ts src/core/domains/strength/__tests__/from-strength-exercise.test.ts
git commit -m "feat(layer2): StrengthExercise → StrengthPrescription adapter"
```

---

## Task 3: Source-aware training max from a capability

**Files:**
- Create: `src/core/domains/strength/training-max.ts`
- Test: `src/core/domains/strength/__tests__/training-max.test.ts`

A `StrengthCapability.currentValueKg` is **already a training max** when it came through `setTrainingMax` (`source` ∈ recalibration/manual/test) but is a **raw benchmark weight** when `source === 'onboarding'`. To get a usable TM we mirror the old `resolveTrainingMaxForExercise`: training-max sources are used directly; an onboarding/raw value is converted via the training-max skill (e1RM × 0.9, at 1 rep).

- [ ] **Step 1: Write the failing test**

```ts
// src/core/domains/strength/__tests__/training-max.test.ts
import { describe, it, expect } from 'vitest'
import { trainingMaxFromCapability } from '../training-max'

describe('trainingMaxFromCapability', () => {
  it('uses currentValueKg directly when source is a training max (recalibration)', () => {
    const tm = trainingMaxFromCapability({
      key: 'back_squat', label: 'Back Squat', currentValueKg: 86.5,
      source: 'recalibration', updatedAt: 't', evidence: {},
    })
    expect(tm).toBe(86.5)
  })

  it('uses currentValueKg directly for manual/test sources', () => {
    expect(trainingMaxFromCapability({ key: 'x', label: 'x', currentValueKg: 100, source: 'manual', updatedAt: 't', evidence: {} })).toBe(100)
    expect(trainingMaxFromCapability({ key: 'x', label: 'x', currentValueKg: 100, source: 'test', updatedAt: 't', evidence: {} })).toBe(100)
  })

  it('converts a raw onboarding value to a training max via the skill (e1RM x 0.9 at 1 rep)', () => {
    // trainingMaxSkill: estimated1RM = weight*(1+1/30); TM = estimated1RM*0.9 rounded to 0.5kg
    // 100*(1+1/30)=103.33 -> *0.9=93.0
    const tm = trainingMaxFromCapability({
      key: 'back_squat', label: 'Back Squat', currentValueKg: 100,
      source: 'onboarding', updatedAt: 't', evidence: {},
    })
    expect(tm).toBeCloseTo(93.0, 1)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- training-max`
Expected: FAIL (module not found). (Note: scope the pattern — `npm test -- domains/strength/__tests__/training-max` if `training-max` is too broad.)

- [ ] **Step 3: Implement**

```ts
// src/core/domains/strength/training-max.ts
// Resolve a usable training max from a Layer-1 StrengthCapability. Training-max
// sources (recalibration/manual/test, written via setTrainingMax) are already TMs;
// a raw onboarding value is converted via the training-max skill (mirrors the legacy
// resolveTrainingMaxForExercise behaviour).

import type { StrengthCapability } from '@/lib/types/athlete-state.types'
import { trainingMaxSkill } from '@/lib/skills/domains/strength/training-max-estimation'

export function trainingMaxFromCapability(cap: StrengthCapability): number {
  if (cap.source === 'onboarding') {
    return trainingMaxSkill.execute({ weightKg: cap.currentValueKg, reps: 1 }).trainingMax
  }
  return cap.currentValueKg
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- training-max`
Expected: PASS (3 tests). If the `93.0` expectation is off, read `src/lib/skills/domains/strength/training-max-estimation.ts` and adjust the expected value to the skill's actual rounding — do not change the implementation to force a number.

- [ ] **Step 5: Commit**

```bash
git add src/core/domains/strength/training-max.ts src/core/domains/strength/__tests__/training-max.test.ts
git commit -m "feat(layer2): source-aware training max from capability"
```

---

## Task 4: Wire capabilities into `buildStrengthMethodologyContext`

**Files:**
- Modify: `src/lib/engine/mesocycle/context.ts:343-395`
- Modify: `src/lib/engine/mesocycle/generate.ts:75-81` (caller)
- Test: `src/lib/engine/mesocycle/__tests__/strength-methodology-capability.test.ts`

`buildStrengthMethodologyContext` currently resolves TM from `benchmarks` via `resolveTrainingMaxForExercise`. Add an optional `capabilities` param; when a capability exists for a lift, use `trainingMaxFromCapability`; else fall back to the existing benchmark path (so generation never breaks when capabilities are absent).

- [ ] **Step 1: Read the current function** (`context.ts:343-395`) and the lift map. The four lifts map to capability keys: Squat→`back_squat`, Bench Press→`bench_press`, Deadlift→`deadlift`, OHP→`overhead_press`.

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/engine/mesocycle/__tests__/strength-methodology-capability.test.ts
import { describe, it, expect } from 'vitest'
import { buildStrengthMethodologyContext } from '../context'

const profile = { strength_methodology: '531', lifting_experience: 'intermediate' }

describe('buildStrengthMethodologyContext capability sourcing', () => {
  it('uses a capability TM (recalibration) over the benchmark for the 5/3/1 protocol', async () => {
    const benchmarks: any = [{ benchmark_name: 'Back Squat', value: 120, user_id: 'u', modality: 'LIFTING', unit: 'kg', source: 'self_reported', tested_at: null, created_at: 't', id: '1' }]
    const capabilities: any = [{ key: 'back_squat', label: 'Back Squat', currentValueKg: 86.5, source: 'recalibration', updatedAt: 't', evidence: {} }]
    const ctx = await buildStrengthMethodologyContext(profile as any, benchmarks, 1, 4, false, capabilities)
    // 5/3/1 week 1 top set = 85% TM. With capability TM 86.5 -> 0.85*86.5 ~= 73.5 (rounded to 2.5)
    expect(ctx?.liftingProtocol).toContain('TM: 86.5kg')
    expect(ctx?.liftingProtocol).not.toContain('TM: 120')
  })

  it('falls back to benchmark-derived TM when no capability is present', async () => {
    const benchmarks: any = [{ benchmark_name: 'Back Squat', value: 100, user_id: 'u', modality: 'LIFTING', unit: 'kg', source: 'self_reported', tested_at: null, created_at: 't', id: '1' }]
    const ctx = await buildStrengthMethodologyContext(profile as any, benchmarks, 1, 4, false, [])
    expect(ctx?.liftingProtocol).toContain('Back Squat')
  })
})
```

Note: the fallback test exercises `resolveTrainingMaxForExercise`, which calls `getTrainingMax` (Supabase). If that throws in the test env it is caught internally and falls back to the benchmark estimate (see methodology-helpers.ts) — the test only asserts the lift appears, so no Supabase mock is needed. If it does require auth, wrap by mocking `@/lib/supabase/server` with a `from().select().eq().maybeSingle()` returning `{ data: null }` and `auth.getUser()` returning a user; read an existing engine test for the mock shape and replicate.

- [ ] **Step 3: Run — expect FAIL**

Run: `npm test -- strength-methodology-capability`
Expected: FAIL (capabilities param not yet supported / wrong TM).

- [ ] **Step 4: Modify `buildStrengthMethodologyContext`**

Add the import near the top of `context.ts`:
```ts
import { trainingMaxFromCapability } from '@/core/domains/strength/training-max'
import type { StrengthCapability } from '@/lib/types/athlete-state.types'
```
Change the signature (add a trailing optional param):
```ts
export async function buildStrengthMethodologyContext(
    profile: { strength_methodology?: string | null; lifting_experience?: string | null },
    benchmarks: AthleteBenchmark[],
    weekNumber: number,
    totalWeeks: number,
    isDeload: boolean,
    capabilities: StrengthCapability[] = [],
): Promise<MethodologyContext | undefined> {
```
Inside the `if (strengthMethod === '531')` loop, extend `liftMap` rows with the capability key and resolve TM from the capability first. Replace the existing `liftMap` + loop body with:
```ts
        const liftMap: Array<[string, string, string[]]> = [
            ['Squat', 'back_squat', ['squat', 'back_squat']],
            ['Bench Press', 'bench_press', ['bench', 'bench_press']],
            ['Deadlift', 'deadlift', ['deadlift']],
            ['OHP', 'overhead_press', ['ohp', 'overhead_press', 'overhead']],
        ]
        const lines: string[] = []
        for (const [displayName, capKey, keywords] of liftMap) {
            const cap = capabilities.find(c => c.key === capKey)
            let tm: number | null = null
            if (cap) {
                tm = trainingMaxFromCapability(cap)
            } else {
                const bm = benchmarks.find(b =>
                    keywords.some(kw => b.benchmark_name.toLowerCase().includes(kw))
                )
                if (bm) tm = await resolveTrainingMaxForExercise(displayName, bm.value, 1)
            }
            if (tm !== null) {
                const wave = calculate531Wave(tm, weekInCycle)
                const setsStr = wave.sets.map(s =>
                    `${s.reps}${s.isAmrap ? '+' : ''} @ ${s.weightKg}kg (${Math.round(s.percentTM * 100)}%TM)`
                ).join(', ')
                lines.push(`  ${displayName} (TM: ${tm}kg): ${wave.weekLabel} — ${setsStr}`)
            }
        }
```

- [ ] **Step 5: Update the caller** at `generate.ts:75`:
```ts
    const methodologyContext: MethodologyContext | undefined = await buildStrengthMethodologyContext(
        ctx.profile,
        ctx.benchmarks,
        1,
        ctx.totalWeeks,
        ctx.isDeload,
        ctx.athleteState?.capabilities.strength ?? [],
    )
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npm test -- strength-methodology-capability && npx tsc --noEmit 2>&1 | grep -E "context.ts|generate.ts" || echo "tsc clean"`
Expected: PASS; `tsc clean`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/engine/mesocycle/context.ts src/lib/engine/mesocycle/generate.ts src/lib/engine/mesocycle/__tests__/strength-methodology-capability.test.ts
git commit -m "feat(layer2): strength methodology reads canonical capabilities with benchmark fallback"
```

---

## Task 5: Remove the leak (server) — delete `updateExerciseSetTargets`

**Files:**
- Modify: `src/lib/actions/logging.actions.ts:171-208`

`updateExerciseSetTargets` is the only server path that writes `exercise_sets.target_*` from the execution surface. It has **no test references** (verified). Remove it.

- [ ] **Step 1: Delete the function + its section comment**

In `src/lib/actions/logging.actions.ts`, delete the block from the `// ─── Update Exercise Set Targets ───` comment (line ~171) through the end of the `updateExerciseSetTargets` function (line ~208, its closing `}`). Leave the surrounding functions intact.

- [ ] **Step 2: Add a write-once contract comment** where the section was:
```ts
// NOTE (Layer 2): exercise_sets.target_* columns are WRITE-ONCE — owned by generation
// (insertLiftingSets). The execution surface must never write targets; in-session edits
// are recorded as actuals (actual_weight_kg / actual_reps / rir_actual / rpe_actual).
```

- [ ] **Step 3: Typecheck (will fail at the WorkoutLogger import — that's expected, fixed in Task 6)**

Run: `npx tsc --noEmit 2>&1 | grep "updateExerciseSetTargets" || echo "no server-side refs"`
Expected: the only remaining reference is the import in `WorkoutLogger.tsx` (removed in Task 6). Confirm `logging.actions.ts` itself no longer defines or exports it.

- [ ] **Step 4: Commit** (with Task 6 — do not commit a broken build alone). Skip commit here; proceed to Task 6, then commit both together.

---

## Task 6: Remove the leak (client) — drop "Save Targets" from WorkoutLogger

**Files:**
- Modify: `src/components/workout/WorkoutLogger.tsx`

`WorkoutLogger.tsx` is a React client component; the project has no React unit-test setup (`vitest environment: 'node'`), so this is verified by typecheck + manual/screenshot. The in-session ±RIR auto-suggest (writes `localSets` only) and set-completion logging (writes actuals via `updateExerciseSet`) STAY. Only the target-overwrite path goes.

- [ ] **Step 1: Read the component** to find every reference to `updateExerciseSetTargets`, `handleSaveTargets`, `targetEdits`, and the "Save Targets" button/expander UI. Map them before editing.

- [ ] **Step 2: Remove the import** — delete `updateExerciseSetTargets` from the import on line 13:
```ts
// before: import { updateExerciseSet, updateExerciseSetTargets, logCardioSession } from "@/lib/actions/logging.actions"
import { updateExerciseSet, logCardioSession } from "@/lib/actions/logging.actions"
```

- [ ] **Step 3: Remove `handleSaveTargets`** (the `useCallback` at ~line 943 that loops `edits` and calls `updateExerciseSetTargets`). Remove the function and the JSX button/control that invokes it ("Save Targets"). Keep `targetEdits`/`setTargetEdits` ONLY if they still feed the per-set actual-entry inputs; if `targetEdits` was used solely for the save-targets flow, remove it and its state too. Do NOT remove `localSets` or the auto-suggest block (835-875) or set-completion logging.

- [ ] **Step 4: Verify the in-session entry still flows to actuals** — confirm that completing a set still calls `updateExerciseSet` with the entered weight/reps/RIR (writing `actual_*`). The athlete's edits live in `localSets` and become actuals on completion; nothing should write `target_*` anymore.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "WorkoutLogger|updateExerciseSetTargets" || echo "tsc clean"`
Expected: `tsc clean` (no remaining references anywhere).

- [ ] **Step 6: Manual verification (REQUIRED — live path)**

Start the app (`npm run dev`, port 3001) and open a workout with prescribed sets. Confirm:
1. No "Save Targets" control is present.
2. Completing a set with a different weight than prescribed records it (the set shows your logged weight; the prescribed target is unchanged).
3. The ±RIR auto-suggest still pre-fills the next set's input.

Capture a screenshot of the workout screen showing prescribed targets intact after logging a different actual. (If you cannot run the app in this environment, report DONE_WITH_CONCERNS and flag that manual verification is pending for the controller.)

- [ ] **Step 7: Commit (Tasks 5 + 6 together)**

```bash
git add src/lib/actions/logging.actions.ts src/components/workout/WorkoutLogger.tsx
git commit -m "fix(layer2): remove target-overwrite leak — target_* is now write-once"
```

---

## Task 7: Plan-vs-actual delta (pure helper)

**Files:**
- Create: `src/core/domains/strength/plan-vs-actual.ts`
- Test: `src/core/domains/strength/__tests__/plan-vs-actual.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/domains/strength/__tests__/plan-vs-actual.test.ts
import { describe, it, expect } from 'vitest'
import { computeSetDelta } from '../plan-vs-actual'

describe('computeSetDelta', () => {
  it('computes weight/reps/rir deltas (actual - prescribed)', () => {
    const d = computeSetDelta(
      { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      { actualWeightKg: 82.5, actualReps: 6, rirActual: 1 },
    )
    expect(d).toEqual({ weightKg: -2.5, reps: 1, rir: -1, status: 'under' })
  })

  it('reports on_target when weight matches', () => {
    const d = computeSetDelta(
      { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      { actualWeightKg: 85, actualReps: 5, rirActual: 2 },
    )
    expect(d.status).toBe('on_target')
    expect(d.weightKg).toBe(0)
  })

  it('reports over when actual weight exceeds prescribed', () => {
    const d = computeSetDelta(
      { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      { actualWeightKg: 90, actualReps: 5, rirActual: 2 },
    )
    expect(d.status).toBe('over')
    expect(d.weightKg).toBe(5)
  })

  it('returns null deltas when an actual is missing', () => {
    const d = computeSetDelta(
      { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      { actualWeightKg: null, actualReps: null, rirActual: null },
    )
    expect(d).toEqual({ weightKg: null, reps: null, rir: null, status: 'unlogged' })
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- plan-vs-actual`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/core/domains/strength/plan-vs-actual.ts
// Pure plan-vs-actual delta for one set. Derives actual - prescribed; no storage.
// Powers the "am I above/below prescription" feedback. status keys off weight.

export interface PrescribedSet { targetWeightKg: number | null; targetReps: number; targetRir: number }
export interface ActualSet { actualWeightKg: number | null; actualReps: number | null; rirActual: number | null }

export interface SetDelta {
  weightKg: number | null
  reps: number | null
  rir: number | null
  status: 'over' | 'under' | 'on_target' | 'unlogged'
}

export function computeSetDelta(prescribed: PrescribedSet, actual: ActualSet): SetDelta {
  if (actual.actualWeightKg === null || actual.actualReps === null) {
    return { weightKg: null, reps: null, rir: null, status: 'unlogged' }
  }
  const weightKg = prescribed.targetWeightKg === null
    ? null
    : Number((actual.actualWeightKg - prescribed.targetWeightKg).toFixed(2))
  const reps = actual.actualReps - prescribed.targetReps
  const rir = actual.rirActual === null ? null : actual.rirActual - prescribed.targetRir
  const status: SetDelta['status'] =
    weightKg === null || weightKg === 0 ? 'on_target' : weightKg > 0 ? 'over' : 'under'
  return { weightKg, reps, rir, status }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- plan-vs-actual`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/domains/strength/plan-vs-actual.ts src/core/domains/strength/__tests__/plan-vs-actual.test.ts
git commit -m "feat(layer2): plan-vs-actual set delta helper"
```

---

## Task 8: Progression recommendation (pure helper)

**Files:**
- Create: `src/core/domains/strength/progression-feedback.ts`
- Test: `src/core/domains/strength/__tests__/progression-feedback.test.ts`

Wraps the existing `progressionEngineSkill` (`src/lib/skills/domains/strength/progression-engine.ts`), which needs **RPE** (1-10) but prescriptions store **RIR**. Convert: `rpe = 10 - rir` (clamped to 1-10). The skill requires positive weights/reps, so guard. This produces a *feedback* recommendation ("next time: +2.5kg") — auto-applying it into next-session generation is deferred to the Coordinator layer (Layer 6).

- [ ] **Step 1: Write the failing test**

```ts
// src/core/domains/strength/__tests__/progression-feedback.test.ts
import { describe, it, expect } from 'vitest'
import { nextSetRecommendation } from '../progression-feedback'

describe('nextSetRecommendation', () => {
  it('recommends an increase when reps beat target with RIR to spare', () => {
    const rec = nextSetRecommendation({
      exerciseName: 'Back Squat',
      prescribed: { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      actual: { actualWeightKg: 85, actualReps: 8, rirActual: 3 },
    })
    expect(rec).not.toBeNull()
    expect(rec!.adjustment).toBe('increase')
    expect(rec!.nextWeightKg).toBeGreaterThan(85)
  })

  it('returns null when the set is unlogged or has no prescribed weight', () => {
    expect(nextSetRecommendation({
      exerciseName: 'Cable Fly',
      prescribed: { targetWeightKg: null, targetReps: 12, targetRir: 1 },
      actual: { actualWeightKg: 20, actualReps: 12, rirActual: 1 },
    })).toBeNull()
    expect(nextSetRecommendation({
      exerciseName: 'Back Squat',
      prescribed: { targetWeightKg: 85, targetReps: 5, targetRir: 2 },
      actual: { actualWeightKg: null, actualReps: null, rirActual: null },
    })).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- progression-feedback`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (read `progression-engine.ts` first to confirm the exact input/output field names — the draft below matches the discovery: input `{exerciseName, prescribedWeightKg, prescribedReps, prescribedRpe, actualWeightKg, actualReps, actualRpe}`, output `{nextWeightKg, incrementKg, adjustment, reason}`).

```ts
// src/core/domains/strength/progression-feedback.ts
// Feedback-only: given a logged set vs its prescription, recommend next-session weight
// via the existing progression engine. RIR is converted to RPE (rpe = 10 - rir, clamped).
// Returns null when not applicable (no prescribed weight, or set unlogged). Auto-applying
// this into next-session generation is deferred to the Coordinator layer.

import { progressionEngineSkill } from '@/lib/skills/domains/strength/progression-engine'
import type { PrescribedSet, ActualSet } from './plan-vs-actual'

const rirToRpe = (rir: number): number => Math.min(10, Math.max(1, 10 - rir))

export interface ProgressionRecommendation {
  nextWeightKg: number
  incrementKg: number
  adjustment: 'increase' | 'maintain' | 'decrease'
  reason: string
}

export function nextSetRecommendation(args: {
  exerciseName: string
  prescribed: PrescribedSet
  actual: ActualSet
}): ProgressionRecommendation | null {
  const { exerciseName, prescribed, actual } = args
  if (prescribed.targetWeightKg === null || prescribed.targetWeightKg <= 0) return null
  if (actual.actualWeightKg === null || actual.actualWeightKg <= 0) return null
  if (actual.actualReps === null || actual.actualReps <= 0) return null

  const out = progressionEngineSkill.execute({
    exerciseName,
    prescribedWeightKg: prescribed.targetWeightKg,
    prescribedReps: prescribed.targetReps,
    prescribedRpe: rirToRpe(prescribed.targetRir),
    actualWeightKg: actual.actualWeightKg,
    actualReps: actual.actualReps,
    actualRpe: rirToRpe(actual.rirActual ?? prescribed.targetRir),
  })
  return {
    nextWeightKg: out.nextWeightKg,
    incrementKg: out.incrementKg,
    adjustment: out.adjustment,
    reason: out.reason,
  }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- progression-feedback`
Expected: PASS (2 tests). If the skill's field names differ from the draft, fix the call to match the real schema (do not invent fields) and adjust expectations to the skill's real output.

- [ ] **Step 5: Commit**

```bash
git add src/core/domains/strength/progression-feedback.ts src/core/domains/strength/__tests__/progression-feedback.test.ts
git commit -m "feat(layer2): progression recommendation feedback helper"
```

---

## Task 9: Surface the delta readout + full verification

**Files:**
- Modify: `src/components/workout/WorkoutLogger.tsx` (minimal delta display)

- [ ] **Step 1: Read** the per-set render in `WorkoutLogger.tsx` (where a set's prescribed target and logged actual are shown). Identify where to add a small inline delta.

- [ ] **Step 2: Add a minimal delta readout** for completed sets using `computeSetDelta`. Import it:
```ts
import { computeSetDelta } from "@/core/domains/strength/plan-vs-actual"
```
For each set that has actuals, render a small badge/text near the set row, e.g. `−2.5 kg · +1 rep` with a color/label keyed off `status` (`over`/`under`/`on_target`). Keep it minimal — a single line; the rich version is Layer 4. Match the component's existing styling conventions (Tailwind classes already in the file). Map the set row's fields to `PrescribedSet`/`ActualSet` (`target_weight_kg`→`targetWeightKg`, `actual_weight_kg`→`actualWeightKg`, `rir_actual`→`rirActual`, etc.).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep WorkoutLogger || echo "tsc clean"`
Expected: `tsc clean`.

- [ ] **Step 4: Manual verification (REQUIRED — live path)**

Run the app, log a set below prescription (e.g. prescribed 85kg, log 82.5kg), and confirm the delta readout shows `−2.5 kg` (status under). Screenshot it. (If the app can't run here, report DONE_WITH_CONCERNS with manual verification pending.)

- [ ] **Step 5: Commit**

```bash
git add src/components/workout/WorkoutLogger.tsx
git commit -m "feat(layer2): minimal plan-vs-actual delta readout in workout logger"
```

---

## Task 10: Full suite green + cleanup note

- [ ] **Step 1: Run the full suite**

Run: `npm test 2>&1 | tail -5`
Expected: all pass except the pre-existing `garmin-sync.test.ts` (missing `garmin-connect` dep). New Layer 2 tests (from-strength-exercise, training-max, strength-methodology-capability, plan-vs-actual, progression-feedback) all green.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "@react-pdf|garmin-connect|@playwright|workout-start-rebind" | grep -i error || echo "no new errors"`
Expected: `no new errors`.

- [ ] **Step 3: Record deferred items** — append to the master spec §11 (Deferred cleanups): the `resolveTrainingMaxForExercise` + `deduplicateBenchmarks` removal is now unblocked for the 4 main lifts (strength reads capabilities) but still used as the no-capability fallback; full removal waits until accessory capabilities + endurance (Layer 3) also read the canonical store. Auto-applying `nextSetRecommendation` into next-session prescriptions is deferred to the Coordinator (Layer 6).

- [ ] **Step 4: Final commit**

```bash
git add docs/superpowers/specs/2026-06-01-hybrid-core-rebuild-design.md
git commit -m "chore(layer2): strength domain complete — suite green; record deferrals"
```

---

## Self-Review (completed)

**Spec coverage:**
- §2 ResistancePrescription model → Tasks 1, 2. ✓
- §3 capability wiring + fallback → Tasks 3, 4. ✓
- §4 kill the leak → Tasks 5, 6 (server + client). ✓
- §5 plan-vs-actual + progression → Tasks 7, 8, 9. ✓
- §6 seam (map existing onto model, no schema migration) → Task 2 adapter; no migration anywhere. ✓
- §7 non-goals respected: no execution-table split, no endurance, no dashboard (minimal readout only), no coordinator (progression auto-apply deferred, Task 8/10). ✓

**Type consistency:** `ResistancePrescription`/`StrengthPrescription` (Task 1) used by `fromStrengthExercise` (Task 2); `StrengthCapability` (Layer 1) consumed by `trainingMaxFromCapability` (Task 3) and Task 4; `PrescribedSet`/`ActualSet` defined in Task 7 reused by Task 8; `computeSetDelta` (Task 7) used in Task 9. Consistent.

**Placeholder scan:** Tasks 6 and 9 require reading the live component first (concrete instruction + screenshot verification) because `WorkoutLogger.tsx` has no unit-test harness; both name exact imports/removals. No vague TODOs; all logic tasks show complete code. Tasks 5+6 commit together to avoid a broken-build commit.
