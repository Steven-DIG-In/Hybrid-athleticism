# Metrics Dashboard — Schema Audit & Resolution

**Date:** 2026-04-20
**Trigger:** Applying migration 016 from the metrics-dashboard specs revealed significant divergence between the plan's assumed schema and the live database. This document records the findings and the resolution strategy.

---

## Divergences found

### 1. `ai_coach_interventions` (live) vs `agent_interventions` (plan)

**Live table exists** (`public.ai_coach_interventions`):

```
id uuid, microcycle_id uuid NOT NULL, user_id uuid,
trigger_type text, rationale text, volume_adjustments jsonb, exercise_swaps jsonb,
rir_adjustment numeric, model_used text, input_payload jsonb, raw_response text,
presented_to_user bool, user_accepted bool, user_feedback text, created_at timestamptz
```

**Plan referenced** a non-existent `agent_interventions` with:
```
coach_domain, trigger_type, pattern_signal jsonb, message,
user_response enum(keep|harder|recalibrate), needs_retry
```

**Decision:** Extend `ai_coach_interventions` with additive columns. Keeps one source of truth, backwards-compatible, allows old LLM-authored interventions and new block-end / rolling-pattern interventions to coexist. Specifically ADD:

- `coach_domain text` (nullable, legacy rows null)
- `pattern_signal jsonb` (nullable)
- `user_response text CHECK (user_response IN ('keep','harder','recalibrate'))` (nullable; co-exists with the legacy `user_accepted boolean`)
- `needs_retry boolean DEFAULT false`
- `trigger_type` is already present — widen its check constraint (or leave unconstrained since it's plain text) to permit `'block_end'`, `'rolling_pattern'`, `'recalibration_prompt'`.

Rename in all plan/spec references: `agent_interventions` → `ai_coach_interventions`.

### 2. `performance_deltas` is per-exercise, not per-session

**Live shape:**
```
id, user_id, session_inventory_id, exercise_name,
prescribed_weight, actual_weight, prescribed_reps, actual_reps,
prescribed_rpe, actual_rpe, delta_classification text, created_at
```

**Plan assumed:** one row per session with `delta_pct`, `coach_domain`, `workout_id`, `block_id`, `delta_magnitude_pct` generated column.

**Decision:** Do NOT alter `performance_deltas`. Derive everything in the analytics layer:

- **coach_domain:** join via `session_inventory_id` → `session_inventory.modality`. Map modality → coach domain (e.g., `strength` → `strength`, `metcon` / `conditioning` → `conditioning`, etc.).
- **delta_pct:** compute per-exercise:
  - weight: `(actual_weight - prescribed_weight) / prescribed_weight * 100` (when both present)
  - reps: similar, fallback when weights aren't prescribed (e.g., bodyweight)
  - **rolled up per session:** mean of per-exercise magnitudes (or sum of magnitudes / session — choose in analytics).
- **delta_magnitude_pct:** `ABS(delta_pct)`, computed per-session in-memory.
- `delta_classification` (existing text column, e.g. `'missed_reps'`, `'exceeded'`) is a useful auxiliary signal — keep as an additional input.

Drop the proposed `delta_magnitude_pct` generated column from migration 016.

### 3. `off_plan_sessions` already exists

Live shape matches the plan exactly:
```
id, user_id, logged_at, modality, duration_minutes, rpe,
notes, count_toward_load, linked_domain
```

**Decision:** `CREATE TABLE IF NOT EXISTS` guard in migration 016 is a no-op. Keep it for idempotency; no further action. Plan 1's off-plan-tally analytics works as-is.

### 4. Mesocycle / microcycle / training_day terminology

**Live model:**
- `mesocycles` — multi-week training block (4–8 weeks). Has `start_date`, `week_count`, `is_active`.
- `microcycles` — a single week within a mesocycle. Has `week_number`, `is_deload`.
- `session_inventory.training_day` — ordinal day within a microcycle (1..N).
- `block_pointer` — per-(user, mesocycle, week) cursor on `next_training_day`.

**Plan used:** "block" ambiguously to mean either mesocycle or microcycle.

**Decision:** Normalize plan terminology:
- "block" = `microcycle` (a week)
- "mesocycle" = multi-week training block
- `currentBlockHeatmap(userId, microcycleId)` parameters renamed `(userId, microcycleId)` or equivalently the current week's microcycle.

### 5. `agent_activity` exists and is a different structure

Live `agent_activity`:
```
id, user_id, coach text, decision_type text, target_entity jsonb,
reasoning_structured jsonb, reasoning_text text, mesocycle_id, week_number, created_at
```

This is Phase 2's decision audit trail — not something the metrics dashboard writes to. Leave untouched. Plans that referenced `agent_activity` (mostly as "Phase 3 extends it") don't need this migration to touch it.

### 6. Older Garmin tables exist

Live tables `garmin_tokens` and `garmin_activities` predate this work and appear unused (0 rows). They don't conflict with the new `garmin_credentials`, `garmin_daily`, `garmin_vo2_trend` tables — different names and purposes. Leave them alone. Can be cleaned up in a later pass if confirmed orphaned.

### 7. `profiles.display_name` exists ✓

Doctor-report-builder depends on this. Confirmed.

---

## Resolution: corrected migration 016

Write a replacement `supabase/migrations/016_metrics_dashboard.sql` that:

- **ADDS** columns to `ai_coach_interventions` (additive, nullable)
- **CREATES** all new health tables (lab_panels, lab_markers, supplements, medical_events, garmin_credentials, garmin_daily, garmin_vo2_trend, body_composition_measurements, doctor_reports)
- **CREATES** storage buckets `lab-reports`, `doctor-reports` with RLS
- **KEEPS** the `CREATE TABLE IF NOT EXISTS off_plan_sessions` guard as a no-op
- **DROPS** any reference to `agent_interventions` (wrong name) and `delta_magnitude_pct` generated column (wrong source)

This is what gets applied. See `supabase/migrations/016_metrics_dashboard.sql` (revised in this commit).

---

## Plan impact summary

### Plan 1 (training adherence)

**Rewrites:**
- All references to `agent_interventions` → `ai_coach_interventions`.
- `saveCoachIntervention` extension: add `coach_domain`, `trigger_type`, `pattern_signal`, `user_response` mapping to `ai_coach_interventions` columns. Keep the existing LLM-output fields in place — new path can pass them as null.
- `coach-bias.ts` / `block-adherence.ts`: compute delta_pct and coach_domain from JOINed `performance_deltas + session_inventory`. Provide a small helper `modalityToCoachDomain(modality)` (already partially in plan via `linkedDomainForModality`, reuse).
- "block" → "microcycle" in parameter names and variable names (backwards-compat exposed as `block` is fine in UI copy).

Task-level edits to the plan are summarized below; the plan file itself is updated in this commit.

### Plan 2 (health core + doctor report)

**Smaller changes:**
- Migration 016: strip `agent_interventions` creation, strip `delta_magnitude_pct` ALTER, keep everything health-related. Keep the `off_plan_sessions` no-op guard.
- `doctor-report-builder.ts`: nothing schema-dependent to change — `profiles.display_name` exists.
- All health subpages/actions unaffected.

### Plan 3 (auto-ingestion)

**No changes** — only touches the health tables created in the corrected migration.

---

## Verification steps

1. Corrected migration applied to Supabase project `kuqgtholljrxnbxtmrnz` via `apply_migration`.
2. Types regenerated with `supabase gen types` so consumer code compiles.
3. Existing test suite (198 passing) still green.
4. Plan 1 + Plan 2 + Plan 3 plan files updated and committed.
5. This worktree (`feat/metrics-schema-audit`) merged into `main`, then Plans 1 and 2 launched in parallel worktrees.
