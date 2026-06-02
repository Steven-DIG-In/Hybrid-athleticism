# Layer 2 — Strength Domain: Discovery Findings

**Date:** 2026-06-02
**Status:** Discovery (reality-grounding for the Layer 2 spec)
**Parent:** [2026-06-01-hybrid-core-rebuild-design.md](./2026-06-01-hybrid-core-rebuild-design.md)
**Method:** Code inventory (Explore agent) + live DB verification (project `kuqgtholljrxnbxtmrnz`).

Documents how strength prescription works **today**, before designing the immutable
`ResistancePrescription` model. No changes proposed here.

---

## 1. What exists (verified)

**Strength coach** (`src/lib/coaches/configs/strength.ts:12-94`) — persona Marcus Cole; assigned
skills `['531-progression','training-max-estimation','progression-engine','deload-calculator']`;
programming meta → `StrengthProgramSchema`, `resultKey:'strengthProgram'`, temp 0.7, 8192 tokens.

**Skills** (`src/lib/skills/domains/strength/`):
- `fiveThreeOneSkill` (531-progression.ts:90) — in `{trainingMaxKg, weekInCycle:1-4}` → out
  `{weekLabel, sets:[{reps, percentTM, weightKg, isAmrap}]}`. Rounds to 2.5kg. The deterministic
  core that turns a training max into prescribed sets.
- `trainingMaxSkill` (training-max-estimation.ts:37) — `{weightKg, reps, rpe?}` → `{estimated1RM,
  trainingMax}` (e1RM × 0.9).
- `progressionEngineSkill` (progression-engine.ts:76) — prescribed vs actual → `{nextWeightKg,
  adjustment:'increase'|'maintain'|'decrease', reason}`. +5kg lower / +2.5kg upper.
- `deloadCalculatorSkill` (shared) — strength defaults intensity 0.6, volume 0.5.

**Prescription types** (`src/lib/types/coach-context.ts`): `StrengthProgramWeek` (216),
`StrengthSession` (222), `StrengthExercise` (232) with `sets, targetReps, targetWeightKg,
targetRir, category, notes, methodologySource, isBenchmarkTest`. Zod in
`src/lib/ai/schemas/week-brief.ts:123-163`.

**Generation flow:**
- `buildStrengthMethodologyContext(profile, benchmarks, weekNumber, totalWeeks, isDeload)`
  (`context.ts:343-395`) — resolves TM per lift, calls `calculate531Wave`, formats the protocol
  string injected into the prompt as `methodologyContext.liftingProtocol`.
- Strength coach prompts (`ai/prompts/strength-coach.ts:86-220`) assemble the program; output
  stored as `mesocycles.strength_program` JSONB.
- Microcycle: `insertLiftingSets()` (`engine/microcycle/persistence.ts:130-172`) writes
  `exercise_sets` rows with the target_* columns from each `StrengthExercise`.

## 2. Real data (live, 2026-06-02)

| Metric | Value |
|---|---|
| exercise_sets rows | 448 |
| …with actuals logged | 193 |
| …with a target weight | 360 |
| workouts with sets | 27 |

Real strength history exists — the rebuild must preserve it (additive, no destructive migration).

## 3. `exercise_sets` — prescription vs execution (one table, verified live)

| Column | Class |
|---|---|
| `target_reps`, `target_weight_kg`, `target_rir` | **PRESCRIPTION** |
| `actual_reps`, `actual_weight_kg`, `rir_actual`, `rpe_actual`, `logged_at`, `is_pr` | **EXECUTION** |
| `id, workout_id, user_id, exercise_name, muscle_group, set_number, notes, created_at` | metadata |

Prescription and execution live in the **same row** — the master-spec tangle, confirmed.

## 4. Tensions the rebuild must resolve

### Tension A — Prescription is NOT immutable today (the headline bug, root-caused)
The master spec assumes prescription is "written once, never updated by the live app." **It isn't.**
`updateExerciseSetTargets()` (`src/lib/actions/logging.actions.ts:177-191`) writes
`target_weight_kg`/`target_reps`/`target_rir`, and it is called from **the live workout UI** at
`src/components/workout/WorkoutLogger.tsx:965` (the "Save Targets" path, fed by the in-session
±RIR auto-suggest). So the execution surface can and does overwrite the coach's prescription.
*This is the exact mechanism behind "strength algorithms overwriting my working sets."*

**Layer 2/4 implication:** `ResistancePrescription` must be **write-once** (owned by generation).
The auto-suggest/"Save Targets" behavior is **execution** and must move to Layer 4 as a *proposal
into an execution record* — never a write-back into the prescription columns. Layer 2 defines the
immutable model; Layer 4 enforces the surface. Removing/redirecting `updateExerciseSetTargets`
is the concrete fix and should be sequenced with Layer 4.

### Tension B — Prescription + execution share one table
`exercise_sets` holds both. Layer 2 defines the prescription model over the `target_*` columns
(owned by generation); the physical split of execution into its own record is **Layer 4**. For
Layer 2, treat the target_* columns as the prescription's storage and forbid mutation, rather than
migrating the table now.

### Tension C — `ResistancePrescription` is real (Strength ⊕ Hypertrophy)
`StrengthExercise` and `HypertrophyExercise` share an **identical prescription core**
(`exerciseName, muscleGroup, sets, targetReps, targetWeightKg, targetRir, notes,
methodologySource`). They differ only in: `category` enum (strength:
primary/secondary_compound/accessory/warm_up vs hypertrophy: compound/isolation/machine/warm_up),
and hypertrophy-only `tempo` + `restSeconds`, strength-only `isBenchmarkTest`. This confirms the
master-spec design: a shared `ResistancePrescription` type with thin domain extensions — hypertrophy
reuses it as a sibling.

### Tension D — Strength generation still reads the OLD capability path
`buildStrengthMethodologyContext` → `resolveTrainingMaxForExercise()`
(`training/methodology-helpers.ts:78-93`) still reads `profiles.training_maxes` / benchmark
estimate. Layer 1's canonical `athleteState.capabilities.strength[]` (currentValueKg) exists but
strength generation does **not** read it yet. **Layer 2 should switch strength to read
`athleteState.capabilities.strength`**, then retire `resolveTrainingMaxForExercise` +
`deduplicateBenchmarks` (the deferred cleanup from Layer 1 §11).

### Tension E — Only the 4 main lifts are formula-driven
`buildStrengthMethodologyContext` hardcodes Squat/Bench/Deadlift/OHP for 531 — exactly the four
strength keys in the capability registry. Accessories get AI-chosen `targetWeightKg` (no skill).
So `ResistancePrescription` must support both *formula-sourced* (methodologySource set, weight from
531) and *AI-sourced* (weight from the model) exercises. Capability coverage for accessories is a
known gap (registry currently = 4 lifts), consistent with Layer 1.

## 5. Corrections to master-spec assumptions
- "Prescription is immutable once written" is **aspirational, not current** — there is a live
  mutation path (Tension A). Layer 2 builds the immutable model; Layer 4 closes the surface.
- "Immutable-prescription via regeneration" is *partly* real: deloads/modifications regenerate
  whole weeks (new rows) rather than mutating — except for the `updateExerciseSetTargets` leak.
- 531 covers only the 4 main lifts; the model must represent AI-sourced accessory weights too.

## 6. Open questions for the Layer 2 design
- Does `ResistancePrescription` become a new typed model in `src/core/domains/strength/` that the
  existing `StrengthExercise` maps onto (seam), or a refactor of the existing type in place?
- When strength generation switches to `athleteState.capabilities.strength`, what is the fallback
  when a lift has no capability row (e.g. a new accessory)? (Registry gap from Tension E.)
- How far to go on Tension A in Layer 2 vs deferring the surface fix to Layer 4 (model now,
  enforce the write-once boundary at the execution layer later) — likely: define immutable model +
  stop generation-side mutation now; redirect the logger's "Save Targets" in Layer 4.
