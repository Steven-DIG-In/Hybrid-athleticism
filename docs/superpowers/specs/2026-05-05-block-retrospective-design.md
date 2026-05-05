# Block Retrospective — Sub-project A of Block N → N+1 Transition

**Date:** 2026-05-05
**Status:** Approved design, implementation pending
**Position in larger initiative:** First of four sub-projects (A retrospective → B coach roster → C engine refactor → D Block 2 wizard).

> ⚠️ **Next.js 16 reminder:** This project runs Next.js 16. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code that touches App Router behavior.

---

## Purpose

Close out the active mesocycle ("Block 1 — `HYBRID_PEAKING`") cleanly and produce a frozen, structured snapshot — the **block retrospective** — that serves two consumers with one source of truth:

1. **Steven (human review).** A screen-rendered review surface he reads before deciding the next block's coach roster (sub-project B) and before approving the AI-generated Block 2 plan (sub-project D).
2. **The Block 2 AI planner.** A typed JSON snapshot consumed by `generateMesocyclePlan` so the planner reasons against what was actually done — not what was prescribed — when proposing volume curves, deload timing, and emphasis for the next block.

The retrospective is the data spine that makes the rest of the transition framework work. Without it, sub-project B (coach roster) is guesswork and sub-project D (Block 2 wizard) feeds the planner stale assumptions.

### Live state at design time (2026-05-05)

- Active mesocycle: `HYBRID_PEAKING Block 1`, 6 weeks, started 2026-03-23, end-date 2026-05-02 (3 days passed; still flagged `is_active=true, is_complete=false`).
- 51 workouts prescribed, 21 completed (~41% adherence). Last completed workout 2026-04-27.
- Training-max recalibrations during the block: 4 (Bench 72, OHP 49.5, Deadlift 114, Row 80). Sources: 3× recalibration, 1× intervention_response.
- Schema gap surfaced: `session_inventory.status` is in drift on Block 1 — 14 of 21 completed workouts have a matching inventory row still flagged `'pending'`. **Cause is historical:** all 14 drifted rows are completions from before Phase 2 (`cc4d80b`, merged 2026-04-20) shipped the `completeWorkout` → `session_inventory` state transition. Every completion logged after Phase 2 merged (the 7 from weeks of Apr 20 + Apr 27) flipped both rows correctly. Healed by one-shot migration 019. No source-bug fix needed — Phase 2 already shipped it.

---

## Architecture

A single new table `block_retrospectives` holds one row per closed mesocycle. The row's `snapshot` JSONB column is the typed retrospective — frozen at the moment of close, never mutated. All consumers (the screen, the AI planner) read the snapshot; nothing recomputes against live tables. Same pattern as the doctor-report `snapshot_json` shipped in Plan 2.

Closing a block is an **explicit user action** — a "Close block" CTA on the dashboard plus a nudge banner once `end_date` has passed or all sessions have resolved. Auto-close on date or 100%-completion both fail in practice (Block 1 sat past its end-date with 41% completion).

The close action is one transactional PL/pgSQL RPC `close_mesocycle(p_mesocycle_id, p_snapshot)` that performs the snapshot insert, marks the mesocycle complete, transitions remaining `pending` sessions to `missed`, and clears `block_pointer`. The TypeScript server action assembles the snapshot first, then calls the RPC, so all DB mutations happen atomically.

### Invariants

- One `block_retrospectives` row per mesocycle (`UNIQUE (user_id, mesocycle_id)`).
- Snapshot is **frozen** — `block_retrospectives` is insert-only after creation; no UPDATE path is exposed.
- Closing a block is irreversible from the application surface (admin-only fix if needed).
- The active block is whichever `mesocycles` row has `is_active=true`; closing a block always sets `is_active=false`. There is no "no active block" failure mode for users — the dashboard handles the empty state explicitly.
- `block_pointer` rows exist only for active blocks; closing deletes the pointer row.
- Adherence numbers come from `workouts.completed_at` (not `session_inventory.status`) for honesty in the face of the Phase 2 inventory-status drift.

---

## Components

### New

- **`src/lib/actions/block-retrospective.actions.ts`**
  - `closeMesocycle(mesocycleId)` — server action. Loads context, calls `buildBlockRetrospectiveSnapshot()`, calls the `close_mesocycle` RPC. Pre-checks `is_active` and absence of existing retrospective for friendly errors.
  - `getLatestBlockRetrospective()` — returns the most recent retrospective for the authed user (sub-project D consumer).
  - `getBlockRetrospective(mesocycleId)` — returns a specific snapshot.
- **`src/lib/analytics/block-retrospective.ts`**
  - `buildBlockRetrospectiveSnapshot(mesocycleId): Promise<BlockRetrospectiveSnapshot>` — pure assembler. Loads mesocycle + microcycles + workouts + inventory + performance_deltas + agent_activity (recalibrations) + ai_coach_interventions + profile, then derives the typed snapshot. Reuses `modalityToCoachDomain()` and `computeExerciseDeltaPct()` — does not invent new derivation logic.
- **`src/lib/types/block-retrospective.types.ts`**
  - `BlockRetrospectiveSnapshot` type and the supporting subtypes.
- **`src/app/data/blocks/[mesocycleId]/retrospective/page.tsx`**
  - Server component. Fetches the snapshot via `getBlockRetrospective(params.mesocycleId)`, renders the seven sections via the components below. Wrapped in `DrillShell` with "← Back to dashboard" link, mirroring `/data/overview/[tile]`.
- **`src/components/blocks/BlockRetrospectiveHeader.tsx`** — block name, goal chip, date range, week count, "Closed [date]" timestamp.
- **`src/components/blocks/BlockHeadlineTiles.tsx`** — 4-up tile grid (adherence / mean drift / recalibrations / interventions).
- **`src/components/blocks/AdherenceByWeekChart.tsx`** — stacked bar chart, one bar per week (completed vs missed). Custom SVG + Framer Motion, matching `/data/strength` chart conventions.
- **`src/components/blocks/AdherenceByDomainTable.tsx`** — 6-row table (one row per CoachDomain): prescribed | completed | % | mean delta | over/on/under bars.
- **`src/components/blocks/RecalibrationTimeline.tsx`** — chronological list with from/to, source badge, date.
- **`src/components/blocks/InterventionLog.tsx`** — chronological list with coach, trigger type, rationale (truncated, expandable), user-response badge.
- **`src/components/blocks/MissedSessionsList.tsx`** — collapsed-by-default list of missed sessions with name, modality, week + day, coach domain.
- **`src/components/dashboard/CloseBlockCta.tsx`** — quiet "Close block" button in the existing active-mesocycle dashboard header. Always available once any session has been completed.
- **`src/components/dashboard/CloseBlockNudgeBanner.tsx`** — banner that appears when `today > mesocycle.end_date` OR all sessions have resolved. Single CTA: "Close & review."
- **`src/components/dashboard/CloseBlockConfirmModal.tsx`** — pre-close preview modal showing prescribed / completed / pending-to-be-missed counts, adherence by domain, recalibration count, intervention count. Renders the headline numbers from a dry-run snapshot before the user commits.
- **`src/components/dashboard/DashboardNoActiveBlockEmpty.tsx`** — empty-state card shown when `getActiveMesocycle()` returns null. Two CTAs: "Review last block" (links to last retrospective) + a placeholder for "Start new block" (sub-project D).

### Evolve

- **`src/app/dashboard/page.tsx`** — branches on `getActiveMesocycle()`. If null, renders `DashboardNoActiveBlockEmpty`. Otherwise, renders the existing active-block layout with `CloseBlockCta` in the header and `CloseBlockNudgeBanner` above the week view when conditions match.

### Retire

- None. The Phase 2 close-out CTA didn't exist; the dashboard didn't have a "no active block" path. We're additive across the board.

---

## Data model

### New table — migration `018_block_retrospectives.sql`

```sql
CREATE TABLE public.block_retrospectives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mesocycle_id    uuid NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  schema_version  smallint NOT NULL DEFAULT 1,
  snapshot        jsonb NOT NULL,
  UNIQUE (user_id, mesocycle_id)
);
CREATE INDEX block_retrospectives_user_generated_at_idx
  ON block_retrospectives (user_id, generated_at DESC);

ALTER TABLE public.block_retrospectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON public.block_retrospectives
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON public.block_retrospectives
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No UPDATE / DELETE policies — snapshot is frozen.
```

### New RPC — same migration

```sql
CREATE OR REPLACE FUNCTION public.close_mesocycle(
  p_mesocycle_id uuid,
  p_snapshot jsonb
) RETURNS public.block_retrospectives
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_meso public.mesocycles%ROWTYPE;
  v_retro public.block_retrospectives%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_meso
  FROM public.mesocycles
  WHERE id = p_mesocycle_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mesocycle not found';
  END IF;

  IF v_meso.is_complete THEN
    RAISE EXCEPTION 'mesocycle already closed';
  END IF;

  -- Defensive: only flip pending → missed where no completed workout exists.
  -- After migration 019 heals the historical drift on Block 1, the NOT EXISTS
  -- clause becomes a no-op safety net rather than load-bearing (Phase 2 already
  -- ensures live completions flip both rows in the same transaction).
  -- Workouts FK to session_inventory directly via session_inventory_id.
  UPDATE public.session_inventory si
  SET status = 'missed'
  WHERE si.mesocycle_id = p_mesocycle_id
    AND si.status = 'pending'
    AND NOT EXISTS (
      SELECT 1
      FROM public.workouts w
      WHERE w.session_inventory_id = si.id
        AND w.completed_at IS NOT NULL
    );

  INSERT INTO public.block_retrospectives (user_id, mesocycle_id, snapshot)
  VALUES (v_user_id, p_mesocycle_id, p_snapshot)
  RETURNING * INTO v_retro;

  UPDATE public.mesocycles
  SET is_active = false, is_complete = true, completed_at = now()
  WHERE id = p_mesocycle_id;

  DELETE FROM public.block_pointer
  WHERE user_id = v_user_id AND mesocycle_id = p_mesocycle_id;

  INSERT INTO public.agent_activity (
    user_id, coach, decision_type, target_entity,
    reasoning_structured, reasoning_text
  ) VALUES (
    v_user_id, 'system', 'block_close',
    jsonb_build_object('mesocycle_id', p_mesocycle_id, 'retrospective_id', v_retro.id),
    p_snapshot -> 'adherence' -> 'overall',
    format('Closed block %s — %s%% adherence',
      v_meso.name,
      ((p_snapshot -> 'adherence' -> 'overall' ->> 'pct'))
    )
  );

  RETURN v_retro;
END;
$$;

REVOKE ALL ON FUNCTION public.close_mesocycle(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.close_mesocycle(uuid, jsonb) TO authenticated;
```

### Data heal — migration `019_backfill_session_inventory_status.sql`

```sql
-- One-shot heal of session_inventory.status drift on Block 1.
-- All 14 drifted rows are completions from before Phase 2 (cc4d80b)
-- shipped the completeWorkout → session_inventory state transition
-- on 2026-04-20. Phase 2 prevents recurrence; this migration only
-- meaningfully runs once (re-runs are idempotent no-ops).
UPDATE public.session_inventory si
SET status = 'completed', updated_at = now()
WHERE si.status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.workouts w
    WHERE w.session_inventory_id = si.id
      AND w.completed_at IS NOT NULL
  );
```

After both migrations apply, regenerate Supabase types via the procedure documented in `~/.claude/memory/feedback/supabase-type-regen-clobbers-aliases.md` (snapshot the alias appendix → regen → re-append → verify `next build`). Add `BlockRetrospectivesRow` / `BlockRetrospectivesInsert` to the type aliases.

### Snapshot shape (TypeScript)

```ts
type CoachDomain =
  | 'strength' | 'hypertrophy' | 'endurance'
  | 'conditioning' | 'mobility' | 'recovery'

type AdherenceCounts = {
  prescribed: number
  completed: number
  missed: number
  pct: number  // 0-100, integer rounded
}

type DomainExecution = {
  sessionsWithDeltas: number
  meanDeltaPct: number  // signed; positive = over-performed prescription
  classificationCounts: { over: number; on: number; under: number }
}

type RecalibrationEntry = {
  exerciseName: string
  fromKg: number
  toKg: number
  source: 'recalibration' | 'intervention_response' | 'manual'
  triggeredBy: 'drift_lt_5' | 'drift_5_to_10' | 'drift_gt_10' | 'manual'
  occurredAt: string  // ISO timestamp
}

type InterventionEntry = {
  id: string
  coachDomain: CoachDomain | null
  triggerType: string
  rationale: string
  presentedToUser: boolean
  userResponse: 'keep' | 'harder' | 'recalibrate' | null
  occurredAt: string
}

type MissedSessionEntry = {
  sessionInventoryId: string
  name: string
  modality: string
  coachDomain: CoachDomain
  weekNumber: number
  trainingDay: number
}

export type BlockRetrospectiveSnapshot = {
  schemaVersion: 1
  block: {
    id: string
    name: string
    goal: string
    weekCount: number
    startDate: string
    endDate: string  // computed: max(microcycle.end_date)
    closedAt: string
  }
  adherence: {
    overall: AdherenceCounts
    byCoachDomain: Record<CoachDomain, AdherenceCounts>
    byWeek: Array<AdherenceCounts & { weekNumber: number }>
  }
  executionQuality: {
    byCoachDomain: Record<CoachDomain, DomainExecution>
  }
  recalibrations: RecalibrationEntry[]
  interventions: InterventionEntry[]
  missedSessions: MissedSessionEntry[]
}
```

### Source-of-truth notes

- **Adherence prescribed counts** — `count(*)` of `session_inventory` rows per `(mesocycle_id, week_number)`, then summed.
- **Adherence completed counts** — `count(*)` of `workouts` rows with `completed_at IS NOT NULL`, joined to `microcycles` to filter by `mesocycle_id`. Workouts table is the source of truth, not inventory status.
- **Missed counts** — derived as `prescribed − completed` after the close transaction has flipped `pending → missed`.
- **`executionQuality`** — derived from `performance_deltas` (per-exercise) via `computeExerciseDeltaPct()` for the per-exercise sign, then averaged per `session_inventory_id` to get a per-session delta, then averaged across sessions per `CoachDomain` derived via `modalityToCoachDomain(session_inventory.modality)`. Sessions with **zero per-exercise deltas** (e.g., legacy completed workouts pre-Phase 1) are excluded from `meanDeltaPct` and from `sessionsWithDeltas`. A domain with `sessionsWithDeltas: 0` reports `meanDeltaPct: 0` and `classificationCounts: { over: 0, on: 0, under: 0 }` — the renderer treats this as a "no signal" state, not as "on-track."
- **`recalibrations`** — reconstructed from `agent_activity` rows with `decision_type='recalibration'` for the user, scoped by the block window (`agent_activity.created_at` between `mesocycle.start_date` and `closedAt`). Extracts `exerciseName`, `fromKg`, `toKg`, `source`, `triggeredBy` from `reasoning_structured`. The `profiles.training_maxes` JSONB blob holds only the current value, so it cannot serve as history; `agent_activity` is the de-facto history.
- **`interventions`** — `ai_coach_interventions` rows for the user where `microcycle_id` belongs to the block. Includes both legacy LLM-output rows and the migration-016 pattern-based rows.
- **`missedSessions`** — list of `session_inventory` rows that are NOT in the `completedInvIds` set, with their derived `coachDomain`. Post-close this is equivalent to `status='missed'` (the RPC has flipped pending → missed). Pre-close (dry-run for the confirm modal), this includes still-pending rows so the modal preview reflects the snapshot the user is about to freeze.

---

## Runtime flows

### Close block

```
User clicks "Close block" CTA (or the nudge banner's CTA)
  → CloseBlockConfirmModal opens
  → Modal calls dry-run buildBlockRetrospectiveSnapshot(mesocycleId) for preview
  → User confirms
  → closeMesocycle(mesocycleId) server action
       → buildBlockRetrospectiveSnapshot(mesocycleId)  [TypeScript, pure]
       → close_mesocycle(mesocycleId, snapshot)         [PL/pgSQL, atomic]
            FOR UPDATE on mesocycle row
            UPDATE pending → missed (with NOT EXISTS guard)
            INSERT block_retrospectives row
            UPDATE mesocycle is_active=false, is_complete=true
            DELETE block_pointer row
            INSERT agent_activity row (decision_type='block_close')
       → revalidatePath('/dashboard')
       → revalidatePath('/data/blocks/[mesocycleId]/retrospective')
  → Client redirects to /data/blocks/[mesocycleId]/retrospective
```

### View retrospective

```
GET /data/blocks/[mesocycleId]/retrospective
  → server component fetches getBlockRetrospective(params.mesocycleId)
  → renders 7 sections from snapshot, all pure presentation
  → no live queries, no recomputation
```

### Dashboard renders empty state

```
GET /dashboard
  → getActiveMesocycle() returns null
  → getLatestBlockRetrospective() returns the most recent snapshot (or null)
  → render DashboardNoActiveBlockEmpty
       → "Review last block" target = `/data/blocks/${snapshot.block.id}/retrospective`
         (CTA hidden if no closed blocks exist — first-ever-onboarded user)
       → "Start new block" → disabled placeholder for sub-project D
```

---

## Error handling

- **Already-closed mesocycle.** Server action pre-check returns `{success: false, error: 'Block already closed'}`. UNIQUE constraint catches it as a hard guarantee even if pre-check races.
- **Not the user's mesocycle.** RLS rejects the SELECT; server action returns "Not found."
- **Not active.** Server action returns "Block is not active." (Distinct from already-closed: covers a paused-but-not-yet-closed state if one is ever introduced.)
- **Snapshot build fails partway.** Transaction never opens; user sees a clean error with a retry. No partial state on the DB side.
- **RPC fails after snapshot build.** Whole transaction rolls back atomically; mesocycle stays open, no `block_retrospectives` row, no inventory drift, no `agent_activity` row, no pointer deletion. User retries.
- **Concurrent "Close block" clicks.** `FOR UPDATE` lock on the mesocycle row serializes them; second click sees `is_complete=true` and returns "Already closed."
- **No completed workouts in the block.** Snapshot still generates; `executionQuality` and `recalibrations` arrays are empty; adherence is `0 / N`. Retrospective renders a quiet "No sessions completed" state in each empty section.
- **Active mesocycle with zero sessions in inventory.** Edge case (broken onboarding); snapshot has `prescribed: 0`, division-by-zero is guarded → `pct: 0`. Close still works.

---

## Testing

### Vitest units

All tests mock `@/lib/supabase/server` via `vi.mock` + `vi.hoisted`. No live-DB writes. No destructive seeds. Reference patterns: `src/lib/actions/__tests__/log-off-plan.test.ts`, `src/lib/actions/health/__tests__/supplements.actions.test.ts`.

- `buildBlockRetrospectiveSnapshot()` — fixture-driven; six scenarios:
  1. Happy path: mixed adherence (~50%), 2 recalibrations, 1 intervention with `userResponse='keep'`.
  2. 100% adherence, no recalibrations, no interventions.
  3. 0% adherence (block abandoned).
  4. Sessions completed but no `performance_deltas` rows (older sessions pre-Phase 1).
  5. `agent_activity` rows present with `decision_type` other than `recalibration` (filter must reject).
  6. Mesocycle with no `ai_coach_interventions` (intervention list = []).
- `closeMesocycle()` server action:
  - Happy path: snapshot built, RPC called, redirect target returned.
  - Already-closed: pre-check rejects.
  - Not authenticated: returns "Not authenticated".
  - RPC throws: error surfaced to caller, no partial state.
- Component snapshot tests against fixture snapshots:
  - `BlockHeadlineTiles` (mixed adherence, 100%, 0%, no recalibrations).
  - `AdherenceByDomainTable` (all 6 domains populated, missing domains, division-by-zero guard).

### PL/pgSQL function testing

The project does not use pgTAP. The TS-level mocked test of `closeMesocycle` covers the input/output contract; real-data verification (below) covers the function's behavior end-to-end.

### Playwright E2E

Committed-but-not-runnable spec at `tests/e2e/block-retrospective.spec.ts`, mirroring Plan 2 / Plan 3 conventions. Covers: dashboard banner appearance → click "Close & review" → confirm modal → submit → land on retrospective with the expected headline numbers.

### Real-data verification (closing-artifact gate)

Per `~/.claude/CLAUDE.md` confidence gate: before marking sub-project A done,

1. Apply migrations 018 + 019 against the live Supabase project.
2. Click "Close Block 1" against your live data through the dashboard CTA.
3. Confirm the retrospective screen reads honest numbers (~41% overall, the 4 recalibrations you actually had, the interventions you actually saw).
4. Screenshot the retrospective.
5. Verify dashboard renders the empty state with "Review last block" linking back to the retrospective.

That screenshot + the snapshot row in `block_retrospectives` are the evidence.

---

## Out of scope

The following are explicitly out of scope for sub-project A and live in later sub-projects or are deferred:

- **Reopen / unclose a block.** No reversibility from the application surface. Admin-only fix if a close is a mistake.
- **`/data/blocks` index page** listing all closed blocks — premature with one block in existence; trivially added when 2+ blocks exist.
- **DataNav "Blocks" tab** — discoverability is via the dashboard "Review last block" link in the empty state; tab can come later.
- **PDF export** — the retrospective audience is Steven's screen + the AI planner; no shareable-with-doctor use case.
- **Per-coach AI narrative** (option D from question 2) — deferred. Snapshot exposes structured signal; narrative can be a one-shot Haiku call against the snapshot if it later proves valuable.
- **Garmin / health / lab data in the snapshot** (option C from question 2) — declined. Health belongs in `/data/health`; including it in the training retrospective dilutes the planner's signal.
- **Wiring `generateMesocyclePlan` to consume the snapshot** — sub-project D.
- **Coach roster / config / signal-weight changes** — sub-project B.
- **Refactor of `programming.actions.ts` / `orchestrator.ts`** — sub-project C.
- **The uncommitted `cache_control: { type: 'ephemeral' }` change in `src/lib/ai/client.ts`** — out of scope; either committed separately or reverted before this plan starts.

## Forward-compat note (sub-project B coupling)

The `CoachDomain` enum baked into the snapshot is the current 6-coach roster (`strength | hypertrophy | endurance | conditioning | mobility | recovery`). Sub-project B may add, remove, merge, or rename coach domains. When that happens:

- Bump `schemaVersion` from `1` to `2` and version the snapshot type.
- Block 1's snapshot stays valid (frozen at v1) — renderers and the AI planner keep a v1 path for historical retrospectives.
- New blocks close to v2 with the new domain set.

No code change required in sub-project A — the `schemaVersion` field exists precisely to absorb this.
