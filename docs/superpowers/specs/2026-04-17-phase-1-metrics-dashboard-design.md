# Phase 1 — Actual-vs-Projected Metrics Dashboard

**Date:** 2026-04-17
**Status:** Approved design, implementation pending
**Implementation order:** Second of three phases (Phase 2 → **Phase 1** → Phase 3)
**Depends on:** Phase 2's `recalibration.actions.ts`, `block_pointer`, and `agent_activity` write points.

> ⚠️ **Next.js 16 reminder:** Read `node_modules/next/dist/docs/` before writing code — breaking changes from prior versions.

---

## Purpose

Close the feedback loop between prescribed and actual training. Bidirectional use:

- **Athlete:** spot coach prescription bias (e.g., metcon coach consistently over-prescribes), duration overruns, and personal adherence patterns; decide whether to apply harder or recalibrate.
- **Coaches:** get structured adherence signal that feeds next-block programming and intervention prompts.

Data-rich but not overbearing — overview surface shows signal, domain pages hold the depth.

---

## Architecture

- **Overview page** at `/data/` (replaces existing landing): four lean tiles; each drill-downable to a dedicated subpage (chose subpages over modals for shareable URLs, Next 16 dynamic routes, back-button UX).
- **Existing domain pages** enhanced inline with delta widgets + pattern flags.
- **New conditioning domain page** (gap: `conditioning_logs` has no UI today).
- **Coach dialogue** piggybacks on existing `ai-coach.actions.ts` interventions pipeline and `/coach/` review page. Fires at two cadences (Q4, D): block-end review always + mid-block rolling pattern flags capped at 1 per coach per week.

---

## Components

### New derivation layer (`src/lib/analytics/`)

- `block-adherence.ts` — rolls up `performance_deltas` + session completion state into a per-block heatmap (session × day-slot × status).
- `coach-bias.ts` — per-coach aggregate: mean delta over last N sessions, RAG classification (red/amber/green), pattern-flag detection (e.g., "5/6 metcon sessions under-performed intensity target by >10%").
- `duration-variance.ts` — `session_inventory.estimated_duration_minutes` vs `workouts.actual_duration_minutes`, aggregated by coach and domain.
- `off-plan-tally.ts` — counts logged off-plan sessions (Phase 2's `/log-session`) in current block, grouped by modality; flags those with `count_toward_load=true`.

### Overview page

- `src/app/data/page.tsx` — replaces current landing. Four tiles in a calm grid.
- `src/components/data/overview/`:
  - `BlockAdherenceHeatmap.tsx` — click → subpage with full-block breakdown.
  - `CoachPromptsInbox.tsx` — lists unreviewed interventions from `ai-coach.actions.ts`. Links to `/coach/` (evolved to `/coach/activity?tab=inbox` in Phase 3).
  - `CoachBiasTile.tsx` — 6-coach RAG grid. Click → per-coach bias trend subpage.
  - `OffPlanTally.tsx` — current-block off-plan summary. Click → `/log-session`.
- `src/app/data/overview/[tile]/page.tsx` — dynamic subpages for tile drill-downs.

### Domain pages (evolved)

- `src/app/data/strength/page.tsx`, `data/endurance/page.tsx`, `data/recovery/page.tsx` — each adds:
  - `PerformanceDeltaChart` (SVG, matching existing aesthetic; no charting library).
  - `PatternFlagCard` (shows active flags for that domain if `coach-bias.ts` has any).
- `src/app/data/conditioning/page.tsx` — **new** page. Same structure as strength/endurance. Surfaces `conditioning_logs` data that's currently never rolled up.

### Coach dialogue (C+ from Q2)

Reuses existing `ai-coach.actions.ts` interventions pipeline.

- **Block-end trigger:** block completion hook fan-outs to each coach with non-trivial deltas. Coach authors intervention in its voice with three response options: `Keep prescription` / `Apply harder` / `Recalibrate down`.
- **Rolling mid-block trigger:** when `coach-bias.ts` detects a pattern crossing threshold (3+ consecutive same-direction deltas >10%), fires intervention. Hard cap: 1 per coach per week mid-block. Cooldown enforced in `coach-bias.ts`.
- Inbox surfaces on `CoachPromptsInbox` tile. Review + response happens at `/coach/` (Phase 3 evolves this to tabbed `/coach/activity`). Response updates next block's prescription logic.

---

## Data model

**Migration:** `supabase/migrations/013_metrics_dashboard.sql`

- `agent_interventions` — verify schema against existing `ai-coach.actions.ts` usage and add fields if missing:
  - `coach_domain` text
  - `trigger_type` enum (`block_end | rolling_pattern | recalibration_prompt`)
  - `pattern_signal` jsonb — the evidence (deltas referenced, threshold crossed, session IDs).
  - `user_response` enum (`keep | harder | recalibrate`, nullable until responded).
- `off_plan_sessions` — new table (also populated by Phase 2's `/log-session`):
  - `id uuid`, `user_id uuid`, `logged_at timestamptz`
  - `modality text` (`strength | run | ride | conditioning | other`)
  - `duration_minutes int`
  - `rpe int` (nullable)
  - `notes text` (nullable)
  - `count_toward_load boolean` (default driven by modality)
  - `linked_domain text` (nullable, derived from modality)
- `performance_deltas` — add `delta_magnitude_pct` generated column if not present (enables threshold queries without recomputation).

---

## Runtime flows

### Overview page load (Next.js 16 Server Component)

```
/data/page.tsx
  Promise.all([
    block-adherence.ts:currentBlockHeatmap(),
    coach-bias.ts:allCoachesRAG(),
    duration-variance.ts:currentBlockVariance(),
    off-plan-tally.ts:currentBlockTally(),
    ai-coach.actions.ts:getUnreviewedInterventions()
  ])
  render 4 tiles + inbox
```

### Pattern detection (called post-workout, not on page load)

```
After each workout completion (wired in Phase 2):
  → coach-bias.ts:evaluatePattern(coach, userId)
       if threshold crossed AND cooldown clear (no intervention from this coach in 7 days):
         ai-coach.actions.ts:createIntervention(coach, 'rolling_pattern', patternSignal)
         → also logs to agent_activity (Phase 3)
```

### Block-end trigger

```
block-pointer reaches final day_index + session completed:
  for each coach in [strength, hypertrophy, endurance, conditioning, mobility, recovery]:
    if non-trivial deltas this block:
      createIntervention(coach, 'block_end', patternSignal)
  → also triggers Phase 3 journal writes
```

### Off-plan log flow

```
/log-session (rebuilt in Phase 2) → off_plan_sessions INSERT
  → updates OffPlanTally on next overview render
  → if count_toward_load=true: feeds load-scoring.ts for that calendar date (Phase 2)
```

### Intervention response

```
User responds via /coach/ inbox (keep | harder | recalibrate):
  → UPDATE agent_interventions.user_response
  → if recalibrate: updates next-block prescription inputs (training_max, target_intensities)
  → response logged to agent_activity (Phase 3)
```

---

## Error handling

- **Missing data** (no completed sessions yet, brand new user, empty block): tiles render empty states, not errors. `BlockAdherenceHeatmap` shows "Complete your first session to see adherence signal."
- **Stale coach prompts** (user reviewed but block moved on): auto-archive on block completion. Unreviewed prompts older than one block are moved to a history view.
- **Conditioning page with no data**: "no conditioning_logs yet" empty state.
- **Pattern detection rate limit**: cooldown enforced per-coach (7 days rolling) to prevent prompt spam if deltas oscillate near threshold.
- **LLM failure during intervention write**: retry once; on persistent failure, write a stub intervention marked `needs_retry` and surface on inbox with a retry button. Better to show "something to review here" than drop the signal.

---

## Testing

### Vitest units
- `block-adherence.ts` rollup produces correct heatmap cells for a fixture block.
- `coach-bias.ts` RAG classification edge cases (boundary thresholds, insufficient data).
- `coach-bias.ts` cooldown logic (pattern crosses threshold twice within 7 days — only one intervention fired).
- `duration-variance.ts` aggregation by coach and domain.
- Off-plan linkage to domain (modality → linked_domain defaults).

### Fixture-based integration
- 6-week block with mixed under/over/on-track sessions; assert RAG colors, intervention firing cadence, adherence heatmap cells all consistent.
- Block completion triggers block-end interventions for all coaches with non-trivial deltas.

### Integration tests
- Complete workout → pattern eval → intervention created → visible on overview inbox.
- Intervention response updates next-block prescription inputs.

### E2E (Playwright, light)
- Overview page renders with all four tiles populated.
- Tile click navigates to subpage.
- Coach prompt response updates intervention state.

---

## Out of scope

- Performance comparison vs external benchmarks (VDOT percentiles, strength standards). This phase is self-vs-plan only.
- Nutrition or recovery metrics beyond what's already tracked.
- Multi-user / athlete comparison features.
- Export/sharing of metrics.
