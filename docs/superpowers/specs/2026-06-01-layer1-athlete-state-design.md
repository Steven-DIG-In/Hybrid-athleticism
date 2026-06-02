# Layer 1 — Athlete & State: Design

**Date:** 2026-06-01
**Status:** Approved design — ready for implementation plan
**Parent:** [2026-06-01-hybrid-core-rebuild-design.md](./2026-06-01-hybrid-core-rebuild-design.md)
**Discovery:** [2026-06-01-layer1-athlete-state-discovery.md](./2026-06-01-layer1-athlete-state-discovery.md)

---

## 1. Purpose

Produce one read-only `AthleteState` snapshot that **generation and execution both consume**,
so they can never disagree about the athlete. This is the foundation every higher layer reads
from. Layer 1 owns the athlete's facts; it prescribes nothing and executes nothing.

The existing tables stay. We add **one canonical capability store** and unify the read model
behind a single function (`getAthleteState`). No destructive migration.

## 2. The canonical capability store (resolves Tension A)

Today "current strength" is split across three disagreeing sources (append-only
`athlete_benchmarks`, `profiles.training_maxes` JSON, `agent_activity` recalibration log).
Layer 1 introduces a single concrete source of truth.

**New table `athlete_capabilities` (additive):**

| column | type | purpose |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk | athlete |
| `capability_key` | text | controlled stable key (e.g. `back_squat`, `bench_press`, `run_5k`, `row_2000m`) |
| `family` | text | `strength` \| `endurance` (drives the typed read shape) |
| `current_value` | numeric | canonical current value |
| `unit` | text | `kg` (strength) / `seconds` (endurance) |
| `source` | text | `onboarding` \| `recalibration` \| `manual` \| `test` |
| `evidence` | jsonb | provenance, e.g. `{reps, rpe}` or `{driftPct, tier, previousValue}` |
| `updated_at` | timestamptz | freshness |

- **One row per `(user_id, capability_key)`** — the single canonical "what can this athlete do
  right now." Unique constraint on `(user_id, capability_key)`.
- `athlete_benchmarks` (history) and `agent_activity` recalibrations (audit) remain
  **write-through inputs**: they append as today, and the same action upserts the canonical row.
- Nobody reads the three-way split anymore; all reads go through `AthleteState`.

## 3. Capability keys (resolves Tension C)

Benchmark identity today is free-text `benchmark_name` + string `modality`. Layer 1 adds a
small **controlled registry** mapping free-text names → stable keys + family + unit:

```
back_squat   → { family: strength,  unit: kg }
bench_press  → { family: strength,  unit: kg }
deadlift     → { family: strength,  unit: kg }
overhead_press → { family: strength, unit: kg }
run_5k       → { family: endurance, unit: seconds }
row_2000m    → { family: endurance, unit: seconds }
swim_1k      → { family: endurance, unit: seconds }
```

(Registry is the authoritative seed list; extended as new capabilities appear.) A domain layer
can then resolve `state.capabilities.strength['back_squat']` deterministically and link it to a
prescription's exercise. Unmapped benchmark names are surfaced (logged), not silently dropped.

## 4. The typed read model

Assembled by a new `getAthleteState(userId): Promise<AthleteState>`:

```ts
interface AthleteState {
  identity: {
    age, sex, bodyweightKg,
    experienceByModality: Record<Modality, ExperienceLevel>,
    goalArchetype, primaryGoal,
  }
  constraints: {
    injuries: AthleteInjury[]          // active only
    movementsToAvoid: string[]
    equipment: { list, access, usageIntents }
    environment, availability,         // env + days + session length + two-a-day + time-of-day
  }
  capabilities: {
    strength:  StrengthCapability[]    // load-based   (current value in kg)
    endurance: EnduranceCapability[]   // time/pace-based (current value in seconds)
  }
  readiness: Readiness | { status: 'UNKNOWN' }   // optional — see §5
}
```

Capability families are **distinct types**, mirroring the prescription-family split — a
`StrengthCapability` is not a variant of an `EnduranceCapability`.

## 5. Readiness is optional, never fabricated (respects Tension B)

Garmin (`garmin_daily`/`vo2`/`credentials`) and `athlete_self_reports` are currently **empty**.

- `readiness` is `{ status: 'UNKNOWN' }` until real input data exists.
- The existing `recovery-scorer` skill (`skills/domains/recovery/recovery-scorer.ts`) is
  **reused unchanged** to produce GREEN/YELLOW/RED when inputs are present. Layer 1 only owns
  surfacing readiness as an optional field.
- Consumers (Coordinator scaling, Execution auto-reg) **must handle `UNKNOWN`** and degrade
  gracefully — never scale off a fabricated status.

## 6. The immutability property (structural fix for the headline bug)

Capability lives **only** in Layer 1. Prescription is frozen at generation in the domain layer.
They meet **only at generation time**:

- A recalibration changes **capability** and flows into the **next** generation.
- It never touches already-prescribed sets. The current block stays frozen (per master spec §3,
  confirmed decision: "frozen; affects next generation only").
- To apply a new max sooner, the athlete explicitly regenerates (a visible action, owned by the
  Coordinator layer later — out of scope here).

"The app changed my working sets" becomes impossible by construction.

## 7. The seam (incremental migration)

- `getAthleteState(userId)` is the new single entry point.
- The existing `buildAthleteContext()` (`src/lib/engine/mesocycle/context.ts:86`) is refactored
  to call `getAthleteState()` internally, so existing generation paths keep working unchanged
  while we migrate surfaces onto the new read model.
- Once all consumers read `AthleteState`, delete the scattered resolution logic:
  `deduplicateBenchmarks()` (context.ts:320) and `resolveTrainingMaxForExercise()`
  (`training/methodology-helpers.ts:78`).

## 8. One-time backfill

A migration/script populates `athlete_capabilities` from existing data:
- Map the 31 `athlete_benchmarks` rows → capability keys (latest value per key wins).
- Merge `profiles.training_maxes` JSON (recalibrated strength values take precedence over raw
  benchmarks where present, carrying `source: recalibration`).
- Preserve provenance in `evidence`. Non-destructive: source tables are untouched.

## 9. Non-goals
- No Garmin ingestion rework.
- No changes to recovery-scoring logic (reuse the skill as-is).
- No changes to generation logic beyond the read seam in `buildAthleteContext`.
- No re-prescribe / propagate-to-current-block flow (deferred to Coordinator layer).
- No destructive migration; source tables remain.

## 10. Success criteria
- One canonical `athlete_capabilities` row per capability key; reads never consult the
  three-way split.
- `getAthleteState()` returns identity + constraints + distinct-typed capabilities + optional
  readiness; `buildAthleteContext` delegates to it.
- Readiness returns `UNKNOWN` cleanly given today's empty wearable/self-report data.
- A simulated recalibration updates capability without altering any existing prescription.
- Backfill reproduces today's effective current maxes (spot-checked: Back Squat resolves to the
  recalibrated/latest value, not a stale duplicate).
