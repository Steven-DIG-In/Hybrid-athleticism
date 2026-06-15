# Layer 3 — Endurance Domain: Design

**Date:** 2026-06-14
**Status:** Approved design — implementing
**Parent:** [2026-06-01-hybrid-core-rebuild-design.md](./2026-06-01-hybrid-core-rebuild-design.md)
**Builds on:** Layer 1 — Athlete & State, Layer 2 — Strength Domain

---

## 1. Purpose

Mirror Layer 2 for endurance: establish an **immutable `EndurancePrescription`** model in
`src/core/domains/endurance/`, wire pace/zone generation to Layer 1's canonical capabilities, and
ship a **minimal plan-vs-actual** readout. This **proves the second prescription shape** —
pace/zone/distance/duration, fundamentally not sets/reps/load.

Unlike Layer 2 there is **no overwrite leak to kill**: endurance actuals already live in a separate
`cardio_logs` table, physically distinct from the prescription. So this layer is the constructive
half only — model + capability wiring + plan-vs-actual.

## 2. The `EndurancePrescription` model

Immutable typed view over the existing `EnduranceSessionSchema` generation output. Per the design
decision: **typed scalars + interval structure kept as an opaque string** (no structured interval
modeling this layer).

```ts
type EnduranceModality = 'running' | 'rucking' | 'rowing' | 'swimming' | 'cycling'
type IntensityZone = 'easy' | 'zone_2' | 'tempo' | 'threshold' | 'vo2max' | 'interval'
type EnduranceSource = 'formula' | 'ai'   // VDOT-derived pace vs AI-chosen (mirrors strength)

interface EndurancePrescription {
  modality: EnduranceModality
  intensityZone: IntensityZone
  targetDistanceKm: number | null     // distance- or…
  targetDurationMin: number | null    // …time-based
  targetPaceSecPerKm: number | null   // precise for running; null = zone-only (others)
  ruckWeightKg: number | null         // rucking only (normalized from lbs)
  intervalStructure: string | null    // opaque, e.g. "8x400m @ 5K pace, 90s rest"
  source: EnduranceSource
  paceSource?: string | null          // e.g. "VDOT 48 → threshold 4:42/km"
  notes?: string | null
}
```

Immutability: produced by generation, never mutated — exactly like `ResistancePrescription`.

## 3. Capability wiring (run = precise, others = zone-only)

Resolves the multi-modal pace decision: **running gets precise VDOT paces; row/swim/bike/ruck are
zone-only** this layer.

- **Running:** read `athleteState.capabilities.endurance` (`run_5k` → 5 km benchmark; you have it at
  1500 s) → `vdotPacerSkill` → easy/tempo/threshold/interval paces → map the session's
  `intensityZone` onto the matching band → `targetPaceSecPerKm`, `source: 'formula'`, `paceSource`
  stamped (e.g. `"VDOT 48 → threshold 4:42/km"`).
- **Row / swim / bike / ruck:** `targetPaceSecPerKm = null`, carry `intensityZone` +
  distance/duration only; intensity governed by HR/RPE. `source: 'ai'`.
- **Fallback (mirrors Layer 2 Tension E):** no `run_5k` capability, or no resolved VDOT paces → fall
  back to the AI-emitted pace + `methodologySource`-derived source. A missing capability is the
  *signal it is not formula-driven*, never an error.
- Zone→VDOT band mapping: `easy`/`zone_2` → easy; `tempo` → tempo; `threshold` → threshold;
  `vo2max`/`interval` → interval.

`zoneDistributorSkill` (80/20) stays where it is — week-level distribution is the **Coordinator
(Layer 6)**, not re-homed here.

## 4. Mapping seam (existing generation → immutable type)

Additive seam, identical to Layer 2's `fromStrengthExercise`. The AI generator keeps emitting
`EnduranceSessionSchema` objects unchanged — **no schema migration, no prompt rewrite**.

- New pure adapter `src/core/domains/endurance/from-endurance-session.ts`: maps one generated
  endurance session → `EndurancePrescription`. Owns the unit normalizations
  (`ruckWeightLbs` → `ruckWeightKg`; `estimatedDurationMinutes` → `targetDurationMin`) and the
  capability→pace resolution from §3 (so `source`/`paceSource` are stamped once and frozen).
- The source session type is derived via indexed access on the exported `EnduranceProgramValidated`
  (no edit to `week-brief.ts`).
- The JSONB generation shape and `cardio_logs` are untouched; consumers migrate to read the typed
  model.

## 5. Plan-vs-actual readout (minimal, mirrors Layer 2)

Pure derivation, **no new storage** — `EndurancePrescription` (target) vs the matching `cardio_logs`
row (`distance_km`, `avg_pace_sec_per_km`, `duration_minutes`, `avg_heart_rate_bpm`,
`perceived_effort_rpe`).

```ts
// src/core/domains/endurance/plan-vs-actual.ts
interface EnduranceDelta {
  distanceDeltaKm: number | null      // actual − target
  durationDeltaMin: number | null     // actual − target
  paceDeltaSecPerKm: number | null    // actual − target (running)
  zoneAdherence: 'in_zone' | 'too_hard' | 'too_easy' | 'unknown'  // RPE vs zone band
  status: 'logged' | 'unlogged'
}
```

`zoneAdherence` is the endurance analog of strength's RIR delta — it answers Nadia's core question
("did the easy day stay easy?"). RPE is the universal signal (works for zone-only modalities too).
Surfaced as a small readout on the session/logger view; the rich visual surface is **Layer 4**.

## 6. Module shape

Mirrors `src/core/domains/strength/`:

```
src/core/domains/endurance/
  prescription.types.ts        # EndurancePrescription + enums
  from-endurance-session.ts    # generation → immutable adapter (+ capability/pace resolution)
  plan-vs-actual.ts            # target vs cardio_logs delta + zoneAdherence
  __tests__/                   # adapter mapping, capability wiring + fallback, delta/zone
```

## 7. Non-goals

- No per-interval plan-vs-actual (intervals stay opaque this layer).
- No row/swim/bike pace models (zone-only).
- No 80/20 weekly orchestration / interference logic → **Layer 6 Coordinator**.
- No rich feedback dashboard → **Layer 4**.
- No AI prompt/schema changes, no DB migration, no destructive changes.

## 8. Success criteria

1. `EndurancePrescription` exists; existing generation maps onto it via the adapter with no behavior
   change.
2. Running reads `capabilities.endurance.run_5k` → VDOT paces (`source: 'formula'`); other
   modalities are zone-only (`source: 'ai'`); generation never breaks when capabilities/`athleteState`
   are absent.
3. A logged cardio session produces correct distance/pace/duration deltas + `zoneAdherence`.
4. All existing tests pass; new unit tests cover the adapter mapping (incl. lbs→kg, duration),
   capability wiring + fallback, and the delta/zone-adherence derivation.
