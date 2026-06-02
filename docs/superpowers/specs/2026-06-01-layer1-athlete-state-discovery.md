# Layer 1 — Athlete & State: Discovery Findings

**Date:** 2026-06-01
**Status:** Discovery (reality-grounding for the Layer 1 spec)
**Parent:** [2026-06-01-hybrid-core-rebuild-design.md](./2026-06-01-hybrid-core-rebuild-design.md)
**Method:** Code inventory (Explore agent) + live DB verification (project `kuqgtholljrxnbxtmrnz`).

This documents what the "Athlete & State" layer **actually is today** — schema, code, and real data — before designing its rebuild. No changes proposed here.

---

## 1. What exists (verified against live schema)

Nine tables make up athlete/state. All confirmed present with columns as mapped.

| Concern | Table(s) | Owner code |
|---|---|---|
| Identity / preferences / constraints | `profiles` (single row) | `profiles` actions; assembled in `buildAthleteContext()` |
| Strength + endurance benchmarks | `athlete_benchmarks` | onboarding + benchmark discovery |
| Persisted per-exercise training max | `profiles.training_maxes` (jsonb) | `training-maxes.actions.ts` (recalibration) |
| Recalibration audit log | `agent_activity` (decision_type='recalibration') | `agent-activity.actions.ts` |
| Injuries / movement restrictions | `athlete_injuries`, `profiles.movements_to_avoid` | onboarding |
| Self-reported readiness | `athlete_self_reports` | weekly check-in |
| Wearable readiness | `garmin_daily`, `garmin_vo2_trend`, `garmin_credentials` | `garmin-sync.ts`, cron |
| Recent training snapshot | `recent_training_activity` | onboarding |

**Assembly point:** `buildAthleteContext(userId, mesocycleId, weekNumber, options?)` →
`src/lib/engine/mesocycle/context.ts:86`, returns `AthleteContextPacket`
(`src/lib/types/coach-context.ts:38`). This is the single function every generation
path calls to gather athlete facts. It deduplicates benchmarks by recency
(`deduplicateBenchmarks()`, context.ts:320).

**Recovery model:** `RecoveryStatus = GREEN|YELLOW|RED` + `RecoveryAssessment`
(`coach-context.ts:159-179`). Produced by the always-active Recovery coach
(`configs/recovery.ts`) via the `recovery-scorer` skill
(`skills/domains/recovery/recovery-scorer.ts`; thresholds: >0.7 GREEN, 0.4–0.7 YELLOW,
<0.4 RED). Consumes self-report + completion/RIR/RPE signals.

## 2. Real data present (live counts, 2026-06-01)

| Table | Rows | Note |
|---|---|---|
| profiles | 1 | **Single athlete.** |
| athlete_benchmarks | 31 | **Append-only duplicates** (see Tension A). |
| agent_activity (recalibration) | 16 | Recalibration is active and writing maxes. |
| recent_training_activity | 7 | Onboarding snapshot. |
| athlete_injuries (active) | 0 | None currently. |
| athlete_self_reports | 0 | **Empty — no readiness self-report data.** |
| garmin_credentials | 0 | **Garmin never connected.** |
| garmin_daily | 0 | **Empty.** |
| garmin_vo2_trend | 0 | **Empty.** |

## 3. Tensions the rebuild must resolve

### Tension A — "Current strength" is split-brained (3 sources of truth)
The same lift's strength lives in three places that can disagree:
1. `athlete_benchmarks` — append-only, no canonical "current"; e.g. `Back Squat` rows
   at 102, 105, 120, 120, 120. Read path reconstructs "current" by dedup-by-`created_at`.
2. `profiles.training_maxes` (jsonb) — per-exercise training max, updated by recalibration
   (`source: onboarding|recalibration|intervention_response`).
3. `agent_activity` recalibration events — `{previousMax, newMax, tier, driftPct, evidence}`.

There is no single canonical "what can this athlete do right now." Resolution today is
scattered across `resolveTrainingMaxForExercise()` (methodology-helpers.ts:78) and dedup
logic. **Layer 1 must define one canonical current-capability source** with benchmarks/
recalibration as inputs/history, not competing truths.

### Tension B — Readiness has no live data
Garmin (credentials/daily/vo2) and self-reports are **all empty**. The recovery scorer runs,
but on defaults. Implications for Layer 1:
- `AthleteState` must model readiness as **legitimately absent** (not zero, not assumed).
- Downstream consumers (Coordinator scaling, Execution auto-reg) must behave correctly when
  readiness is unknown — degrade gracefully, don't fabricate a status.
- Garmin ingestion is built but unproven against real data; treat as an unverified input.

### Tension C — Benchmark identity is by free-text name + per-modality string
`benchmark_name` is free text ('Back Squat', 'Run 5km', 'Row 2000m'), `modality` is a string
('LIFTING'/'CARDIO'). No controlled exercise identity links a benchmark to a prescription's
exercise. Layer 1 should define a stable capability key so strength/endurance domains can
resolve "the athlete's current X" deterministically.

## 4. Single canonical output (target for Layer 1 spec)
Layer 1's job: produce one read-only `AthleteState` snapshot — identity, constraints, a
**canonical current-capability** map (resolving Tension A), and an **optional readiness**
signal (respecting Tension B) — consumed identically by generation and execution so they can
never disagree. The existing `buildAthleteContext` / `AthleteContextPacket` is the seam to
refactor behind; tables stay, the read model is unified.

## 5. Corrections to the master spec's assumptions
- "Benchmarks (1RMs, race times, VDOT)" — VDOT is **not** stored; only raw race times
  (`Run 5km` = 1500s). VDOT is computed by the `vdot-pacer` skill at generation time.
- Recovery is **already** an always-active coach with a real skill + thresholds — Layer 1
  folds in its *state production*, but the scoring logic already exists and is reusable.
- Event-sourcing rejection reaffirmed: single athlete, no audit/scale driver.
