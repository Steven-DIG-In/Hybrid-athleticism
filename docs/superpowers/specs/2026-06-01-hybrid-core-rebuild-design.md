# Hybrid Athleticism — Ground-Up Core Rebuild

**Date:** 2026-06-01
**Status:** Approved design — master decomposition spec
**Scope:** Architecture of a layer-by-layer rebuild of the training engine. This is the *master* spec; each of the six layers gets its own spec → plan → implementation cycle.

---

## 1. Motivation

The platform feels like it is "built on top of bugs." Two reported symptoms, when traced, turn out to be the *same disease*:

1. **"Strength algorithms overwrite coach-prescribed work mid-sets."**
   Traced to the live logging layer (`WorkoutLogger.tsx`), not generation. Server-side there is **no** auto-mutation of the program — but the in-session auto-suggest (±RIR weight nudges) edits the same in-memory set values that hold the prescription, and a "Save Targets" path can write them back. Because **prescription and in-session adjustment share the same fields and surface**, adjustment reads as overwrite.

2. **"Legacy notes from programming changes persist in workouts."**
   A real data-lifecycle bug. `coach_notes` are copied through a chain — generation → `session_inventory` → `applyAllocation()` copies them onto the workout (`inventory.actions.ts:730`) — with **no owner and no clearing step**. Regeneration replaces workouts but stale notes survive in inventory and get re-copied.

**The through-line:** there is no clean boundary between layers, and no single owner for each piece of state. *Prescription*, *execution*, and *commentary* are tangled into shared columns and copied around without lifecycle rules. A ground-up, layer-by-layer rebuild that gives each kind of truth one owner is the fix.

## 2. The Spine

**Pattern: Strangler-fig.** Build a clean domain core in `src/core/`, bottom-up, on the **same Supabase database**. The existing app keeps running; we migrate surfaces onto the core one domain at a time and delete the old path as each domain solidifies. Retire `_legacy_archive/` and the three conflicting `INVENTORY-*.md` design docs as their subjects are replaced.

Rejected alternatives:
- **Fresh parallel app** — value lives in the encoded domain skills (531, VDOT, volume landmarks, deloads) and the live Supabase data, not the screens. A new app re-ports all of it, runs two deployments, and forces a big-bang cutover without guaranteeing better boundaries.
- **In-place re-architecture** — the tangle is real; refactoring in place risks the live system on every change and never lets a domain be frozen and trusted.

**The one rule every layer obeys:**

> **Coach prescribes → Athlete executes → System observes. Each is owned by one layer. No layer overwrites another's truth.**

- **Prescription** — written once by generation, immutable thereafter.
- **Execution** — written only by logging.
- **Commentary** — owned by whatever created it, with an explicit birth-and-death lifecycle; never copied sideways.

## 3. State-Boundary Decision (core fix)

A single `exercise_sets` row currently mixes three kinds of truth in overlapping columns: prescription (`target_*`), execution (`*_actual`), commentary (`notes`). Decision: **immutable prescription + separate execution + lifecycle-owned commentary.**

- **Prescription columns become write-once** — set at generation, never touched by the live app.
- **Execution gets its own clearly-named columns** (what was actually performed). Plan and actual become *different objects, side by side, forever*.
- **Auto-regulation becomes a proposal** the athlete accepts into *execution* — it can never write to *prescription*. This makes "the app changed my program" structurally impossible.
- **Commentary is owned by its artifact** — a workout's notes are born and die with that workout; regeneration replaces artifact + notes atomically; notes are never copied through inventory/allocation.

Rejected: pure-convention ownership (no enforcement — what caused the bug); full event-sourcing (correct in the abstract but oversized for an essentially single-athlete platform; biggest build, real schema shift, no audit/scale requirement to justify replay semantics).

**Database approach:** additive and safe — no big-bang migration. Add cleanly-named execution columns and tighten note lifecycle. Live training data is untouched.

## 4. The Six Layers

Built bottom-up under `src/core/<layer>/`. Each is a self-contained module with a typed model, its own logic/skills, a narrow public interface, and one owner per piece of state. The coordinator is **last** — a coordinator built on shaky domains is the current failure mode.

### Layer 1 — Athlete & State `src/core/athlete/`
The source of facts. Profile, benchmarks (1RMs, race times, VDOT), injuries/constraints, and current readiness (recovery, Garmin signals). Owns the athlete's truth and exposes it **read-only** upward. Produces one canonical `AthleteState` snapshot consumed by both generation and logging so they can never disagree about current maxes. Prescribes nothing; executes nothing.
**Recovery folds in here** as a readiness signal (see §5).

### Layer 2 — Strength domain `src/core/domains/strength/`
The strength prescription model + deterministic progression (531, training-max estimation, deload). Output: a typed, **immutable** `ResistancePrescription` (exercises, sets, target load/reps/RIR). Knows nothing about logging or the live app. Answers only: "given this athlete + this week's brief, what is the prescribed strength work?" **Proves the domain template.**

### Layer 3 — Endurance domain `src/core/domains/endurance/`
First-class peer with a *fundamentally different output type*: `EndurancePrescription` (modality run/row/bike/ruck, distance or duration, target pace/zone, interval structure). Own skills (VDOT pacing, 80/20 zone distribution). Deliberately **not** unified with strength into a "session" god-object — a strength prescription and an endurance prescription are different types, not variations of one. **Proves the second prescription shape.**

### Layer 4 — Execution / Logging `src/core/execution/`
The live workout. **Owns execution truth** and is structurally forbidden from touching prescription. Reads the immutable `Prescription`, presents it, records what actually happened in its own `Execution` record. Auto-regulation (±RIR suggestion) lives here as a **proposal** accepted into execution — never a write-back to prescription. This is where bug #1 dies.

### Layer 5 — Coaching commentary `src/core/commentary/`
Notes, cues, rationale, interventions. Every note is **owned by the artifact that created it** and is **never copied sideways** through inventory/allocation. Regeneration replaces the artifact and its notes atomically. This is where bug #2 dies.

### Layer 6 — Coordinator `src/core/coordinator/`
The head coach. Orchestrates domains into a coherent mesocycle/microcycle: allocates the week across domains, manages interference (e.g. don't fry legs the day before a long run), sequences deloads, applies the week brief. **Calls down** into the domain layers and composes their immutable prescriptions; never reaches into their internals, never edits execution or commentary. Built last, on top of layers already trusted.

## 5. Coach Taxonomy

Coaches are **not** one kind of thing. The litmus test: *does it author a session, or does it shape one?*

### A. Prescribing coaches — author sessions (Layer 2/3 domains)
One shared template (skills → prescription → immutable), grouped by prescription family:

| Coach | Prescription family | Native vocabulary | Build cost |
|---|---|---|---|
| **Strength** | Resistance | exercises, sets, load, reps, RIR | Full (proves template) |
| **Hypertrophy** | Resistance *(reuses Strength's `ResistancePrescription` type)* | sets, load, reps, proximity-to-failure, weekly volume MEV/MAV/MRV | **Light** — swaps driving skill (volume-landmarks for 531) |
| **Conditioning** | Work-capacity / time-domain | rounds, intervals, work:rest, target intensity | Medium — own shape |
| **Endurance** | Pace-zone | modality, distance/duration, pace, zone | Full (proves second shape) |
| **Mobility** | Movement-quality | movements, duration, focus areas | Lightest — simple shape |

Hypertrophy is a **sibling that reuses strength's prescription type**, not a variant — which is why it is cheap.

### B. Modulating / advisory coaches — shape sessions, never author them
- **Recovery** → produces a **readiness signal**, not a workout. Lives in **Layer 1** as an input; consumed by **Layer 6 (Coordinator)** to scale/deload and by **Layer 4 (Execution)** to inform auto-regulation. It can *propose* a lighter day to the coordinator; it can never reach into an immutable prescription.
- **Nutrition** *(future; not a coach today)* → advisory module keyed to goals + health data (body-comp, bloodwork, Garmin). Output is recommendations/targets on a **nutrition surface — not the workout**. Sits beside the training domains, reads Layer 1, stays outside the session-prescription pipeline.

## 6. Build Order & Sub-Projects

Each layer is its own sub-project with a dedicated spec → plan → implementation cycle.

1. **Layer 1 — Athlete & State** (incl. Recovery as a state signal)
2. **Layer 2 — Strength domain** (proves the domain template + `ResistancePrescription`)
3. **Layer 3 — Endurance domain** (proves the second prescription shape)
4. **Layer 4 — Execution / Logging** (kills the overwrite bug)
5. **Layer 5 — Coaching commentary** (kills the stale-notes bug)
6. **Layer 6 — Coordinator** (composes everything; built last)

Hypertrophy, Conditioning, Mobility are folded in as additional domain modules on the proven template (after Layer 2/3), each small. Nutrition is deferred.

## 7. What Gets Retired
- `_legacy_archive/`
- The three competing inventory design docs (`INVENTORY-ARCHITECTURE-IMPLEMENTATION.md`, `INVENTORY-INTEGRATION-STATUS.md`, `QUICK-START-INVENTORY.md`).
- The `session_inventory` / allocation subsystem is **simplified or retired**: in the new core the coordinator composes prescriptions directly. Inventory is kept only if it earns its place. Much of today's bug surface (notes copied on allocate, orphan workouts) is incidental complexity from this subsystem.

## 8. Non-Goals
- No big-bang database migration; changes are additive.
- No fresh/separate app; same repo, same DB.
- No event-sourcing.
- No new framework, design-system, or visual rework (the Arctic Observatory design system is unaffected by this rebuild).
- Nutrition is out of scope for the initial build.

## 9. Success Criteria
- Prescription is recoverable and immutable; the live app can never alter it. Plan-vs-actual is visible for every session.
- A regenerated/changed program carries **no** stale notes; notes live and die with their artifact.
- Strength and endurance are distinct prescription types, not branches of one session object.
- Recovery modulates without authoring; nutrition (when added) advises without entering the workout flow.
- The coordinator composes already-trusted domain layers; removing/adding a domain does not require touching another domain's internals.

## 10. Open Questions (resolved per-layer, not here)
- Exact column/table split for execution vs prescription in `exercise_sets` (Layer 4 spec).
- Whether `session_inventory` is retired outright or retained in reduced form (Layer 6 spec).
- Migration mechanics for moving each existing screen onto the new core (per-layer).

## 11. Deferred cleanups (carried forward to later layers)

Layer 1 (Athlete & State) shipped the canonical `athlete_capabilities` store and the
`getAthleteState` read model behind the `buildAthleteContext` seam. The following are
intentionally **left in place** until the Strength/Endurance domain layers (Layer 2/3) read
`athleteState.capabilities` directly, then removed:
- `deduplicateBenchmarks()` (`src/lib/engine/mesocycle/context.ts`) — the old read-time
  recency-dedup; superseded by the canonical store.
- `resolveTrainingMaxForExercise()` (`src/lib/training/methodology-helpers.ts`) — old scattered
  current-max resolution.
- `AthleteContextPacket.benchmarks` — kept until no consumer reads it.
- `Record<string, any>` row casts in `capabilities.actions.ts` and `get-athlete-state.ts` —
  replace with a generated DB row type for `athlete_capabilities`. **Important:**
  `src/lib/types/database.types.ts` is **hand-augmented** (a generated `Database` block plus a
  hand-written `Profile` interface and `Tables<>` aliases the codebase imports). Do **NOT** run a
  blind `supabase gen types > database.types.ts` — it clobbers the hand-written section and breaks
  the build. Add the `athlete_capabilities` table **surgically** to the generated `Tables` block
  and add `export type AthleteCapability = Tables<'athlete_capabilities'>`, then swap the casts.
  Deferred to the Layer 2 cast-cleanup.

**Layer 1 status (2026-06-02):** 11 implementation tasks complete on branch
`rebuild/core-architecture`; 331 unit tests pass (the only failing suite, `garmin-sync`, is a
pre-existing missing-dependency issue unrelated to this work). Migrations 021 + 022 applied to
the live database and verified (split-brain resolved). Type regen deferred (surgical add — see
above).

### Layer 2 (Strength Domain) deferrals — added 2026-06-02

Layer 2 shipped the immutable `ResistancePrescription` model (`src/core/domains/strength/`),
wired strength `5/3/1` generation to `athleteState.capabilities.strength` (benchmark fallback),
removed the target-overwrite leak (`updateExerciseSetTargets` + dead `logExerciseSet` deleted;
`exercise_sets.target_*` is now write-once), and added a plan-vs-actual delta readout +
progression-feedback helper. Carried forward:
- `resolveTrainingMaxForExercise()` + `deduplicateBenchmarks()` removal is now **unblocked for the
  4 main lifts** (strength reads capabilities) but both remain as the *no-capability fallback*
  (accessories, and lifts with no capability row). Full removal waits until accessory capabilities
  and Endurance (Layer 3) also read the canonical store.
- Auto-applying `nextSetRecommendation` into next-session prescriptions is **deferred to the
  Coordinator (Layer 6)** — Layer 2 surfaces it as feedback only.
- The execution-record table split (separating `actual_*` from `target_*` physically) and the
  polished plan-vs-actual feedback surface remain **Layer 4 (Execution)**.

**Layer 2 status (2026-06-02):** 10 implementation tasks complete on `rebuild/core-architecture`;
345 unit tests pass (same lone pre-existing `garmin-sync` dep failure). **Pending:** live
screenshot verification of the two `WorkoutLogger.tsx` changes (removed "Save Changes"/read-only
prescription display; per-set delta readout) — static checks (tsc + full read-through review)
pass, but the visual behaviour on the live workout screen needs an eyeball.
