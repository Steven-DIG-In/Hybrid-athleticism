# Layer 2 — Strength Domain: Design

**Date:** 2026-06-02
**Status:** Approved design — ready for implementation plan
**Parent:** [2026-06-01-hybrid-core-rebuild-design.md](./2026-06-01-hybrid-core-rebuild-design.md)
**Discovery:** [2026-06-02-layer2-strength-domain-discovery.md](./2026-06-02-layer2-strength-domain-discovery.md)
**Builds on:** Layer 1 — Athlete & State ([design](./2026-06-01-layer1-athlete-state-design.md))

---

## 1. Purpose

Establish the **immutable strength prescription model** (`ResistancePrescription`), wire strength
generation to Layer 1's canonical capabilities, and **close the one live mutation leak** so the
coach's prescription becomes sacred. This kills the headline "strength algorithms overwriting my
working sets" bug and preserves the plan-vs-actual signal the athlete needs.

This is the layer that proves the domain template; Hypertrophy reuses its core type as a sibling.

## 2. The `ResistancePrescription` model

A new immutable type in `src/core/domains/strength/`, capturing the prescription core the discovery
confirmed is shared between strength and hypertrophy.

```ts
// Shared resistance prescription core (one exercise's prescribed work).
interface ResistancePrescription {
  exerciseName: string
  muscleGroup: string
  sets: number
  targetReps: number
  targetWeightKg: number | null
  targetRir: number
  source: 'formula' | 'ai'      // 531-derived vs AI-chosen accessory (discovery Tension E)
  methodologySource?: string    // e.g. "5/3/1 wk1: 5+ @ 85% TM" — set when source = 'formula'
  notes?: string | null
}

// Strength = core + strength-specific metadata.
interface StrengthPrescription extends ResistancePrescription {
  category: 'primary_compound' | 'secondary_compound' | 'accessory' | 'warm_up'
  isBenchmarkTest?: boolean
}

// Hypertrophy (sibling, reuses the core) — defined here for the contract; built in a later layer.
interface HypertrophyPrescription extends ResistancePrescription {
  category: 'compound' | 'isolation' | 'machine' | 'warm_up'
  tempo?: string | null
  restSeconds?: number | null
}
```

**Immutability:** a `ResistancePrescription` is produced by generation and **never mutated**. It is
the typed view over the `exercise_sets.target_*` columns. The existing `StrengthExercise`
(`coach-context.ts:232`) and the generation pipeline **map onto** this model (seam pattern) so
generation keeps working while consumers migrate.

## 3. Capability wiring (resolves discovery Tension D)

Strength generation switches from `resolveTrainingMaxForExercise → profiles.training_maxes` to
Layer 1's canonical `athleteState.capabilities.strength`.

- `buildStrengthMethodologyContext` (`engine/mesocycle/context.ts:343-395`) reads
  `state.capabilities.strength` (keyed `back_squat`/`bench_press`/`deadlift`/`overhead_press`) and
  feeds `currentValueKg` to `fiveThreeOneSkill`.
- **Fallback (Tension E):** a lift with a capability row → `source: 'formula'` (531 weight). A lift
  with **no** capability row → `source: 'ai'` accessory, weight from the model — exactly today's
  behavior. A missing capability is the *signal that the exercise isn't formula-driven*, never an
  error.
- **Capability-absent safety:** if Layer 1's `athleteState` is undefined (the seam degrades — e.g.
  capabilities table missing), strength generation falls back to the existing
  `resolveTrainingMaxForExercise` path so generation never breaks. Once `athleteState` is reliably
  present, retire `resolveTrainingMaxForExercise` + `deduplicateBenchmarks` (Layer 1 §11 deferred
  cleanup).

## 4. Killing the leak (immutability enforcement)

The headline bug's mechanism: `updateExerciseSetTargets()` (`logging.actions.ts:177-191`) writes
`target_weight_kg`/`target_reps`/`target_rir`, called from the live UI at `WorkoutLogger.tsx:965`
("Save Targets").

- **Remove `updateExerciseSetTargets`** and its `target_*` write path entirely.
- **Redirect the caller:** in-session weight/rep changes write to the **actual** columns
  (`actual_weight_kg`, `actual_reps`, `rir_actual`/`rpe_actual`) via the existing logging action —
  never `target_*`. The ±RIR auto-suggest becomes a suggestion for the **actual** entry.
- **Guard:** add a comment/contract at the logging layer that `target_*` columns are write-once,
  owned by generation, so no future code re-introduces an execution-side target write.

Result: `exercise_sets.target_*` becomes write-once by construction. The athlete can still log what
they actually did; they can no longer overwrite what the coach prescribed.

## 5. Plan-vs-actual feedback + progression (athlete requirement)

Keeping prescription immutable while recording actuals separately is precisely what makes this
possible — overwriting targets is what *destroys* the signal today.

- **Delta readout:** a per-set / per-exercise indicator deriving `actual − prescribed` for weight,
  reps, and RIR/RPE (e.g. "−2.5 kg, +1 rep, RIR 1 under target"), surfaced in the logger and
  session view. Pure derivation from the two preserved values; **no new storage**.
- **Progression from actuals:** next-session targets computed via `progressionEngineSkill`
  (`skills/domains/strength/progression-engine.ts` — prescribed vs actual → increase/maintain/
  decrease + reason), reading the preserved actuals. Makes "follow-on sessions calculate from my
  last entries" reliable.

The data + progression wiring is Layer 2; the rich visual feedback surface is mostly Layer 4. Layer
2 guarantees the data exists and ships a **minimal** delta readout so the feedback is usable now.

## 6. Seam & migration

- New model under `src/core/domains/strength/`. Existing `StrengthExercise` and the strength
  generation/persistence paths map onto it; the JSONB `strength_program` shape and `exercise_sets`
  table are unchanged (additive seam — like Layer 1's `buildAthleteContext`).
- No schema migration: the `target_*` / `actual_*` columns already exist; Layer 2 changes *who may
  write them*, not their shape.

## 7. Non-goals
- No physical execution-record table split — Layer 4 (use existing `actual_*` columns now).
- No rich analytics/feedback dashboard — Layer 4 (Layer 2 ships a minimal delta readout).
- No endurance — Layer 3.
- No coordinator/orchestration changes — Layer 6.
- No hypertrophy build-out — only the shared `ResistancePrescription` contract is defined here.
- No destructive migration.

## 8. Success criteria
- `ResistancePrescription` exists; `StrengthPrescription`/`HypertrophyPrescription` extend it;
  existing strength generation maps onto it without behavior change.
- Strength generation reads `athleteState.capabilities.strength` for the 4 main lifts; accessories
  are `source: 'ai'`; generation never breaks when capabilities are absent.
- `updateExerciseSetTargets` is gone; no code path writes `exercise_sets.target_*` from the
  execution surface; the live "Save Targets" action now records actuals.
- A set logged below/above prescription shows a correct plan-vs-actual delta; next-session weight is
  derived from actuals via the progression engine.
- All existing tests pass; new tests cover the model mapping, capability wiring + fallback, the
  removed-leak (target_* unwritable from logging), and the delta derivation.

## 9. Open questions (resolved in the plan)
- Exact file placement of the `ResistancePrescription` types and the mapping adapter from
  `StrengthExercise`.
- Whether the minimal delta readout lives in `WorkoutLogger` or a small shared component.
- Precise wiring point for capability-sourced TM inside `buildStrengthMethodologyContext`.
