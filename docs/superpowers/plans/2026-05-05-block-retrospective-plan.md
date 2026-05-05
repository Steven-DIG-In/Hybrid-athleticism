# Block Retrospective Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship sub-project A — close out Block 1 cleanly and produce a frozen `block_retrospectives` snapshot consumed by both the human review screen and (later) the Block 2 AI planner.

**Architecture:** New `block_retrospectives` table with one row per closed mesocycle holding a typed JSONB snapshot. Atomic close via PL/pgSQL RPC. Snapshot built in TypeScript by `buildBlockRetrospectiveSnapshot()`, then persisted via `closeMesocycle()` server action. Dedicated retrospective view at `/data/blocks/[mesocycleId]/retrospective`. Dashboard gains a CTA, nudge banner, confirm modal, and no-active-block empty state.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase (Postgres 17 + RLS), Vitest 4 (`include: ['src/**/__tests__/**/*.test.ts']`, env: `node`), Tailwind 4, Framer Motion 12, lucide-react.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-05-block-retrospective-design.md`
- Live state: branch `main`, current commit `51493d3` (spec amendment) on top of `702a347` (spec).
- Test patterns: `src/lib/actions/__tests__/log-off-plan.test.ts`, `src/lib/actions/health/__tests__/supplements.actions.test.ts`.
- Type regen procedure: `~/.claude/memory/feedback/supabase-type-regen-clobbers-aliases.md`.
- Existing drill pattern: `src/app/data/overview/[tile]/page.tsx` (DrillShell inline component).
- Coach-domain helpers: `src/lib/analytics/shared/coach-domain.ts`.

**Out of scope reminders (do not drift):**
- No `completeWorkout` source fix — Phase 2 already shipped it (commit `cc4d80b`); the 14-row drift on Block 1 is purely historical.
- No PDF export, no `/data/blocks` index page, no DataNav "Blocks" tab, no per-coach AI narrative, no Garmin/health in the snapshot.
- Sub-projects B/C/D are separate plans; do not pull their work into this one.

**Branch:** Create `feat/block-retrospective` cut from `main` before starting Task 1.

```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
git checkout main && git pull && git checkout -b feat/block-retrospective
```

---

## File map

### Create

| Path | Responsibility |
|---|---|
| `supabase/migrations/018_block_retrospectives.sql` | Table + RPC + RLS |
| `supabase/migrations/019_backfill_session_inventory_status.sql` | One-shot data heal |
| `src/lib/types/block-retrospective.types.ts` | `BlockRetrospectiveSnapshot` + subtypes |
| `src/lib/analytics/block-retrospective.ts` | `buildBlockRetrospectiveSnapshot(mesocycleId)` pure assembler |
| `src/lib/analytics/__tests__/block-retrospective.test.ts` | 6 fixture-driven scenarios |
| `src/lib/actions/block-retrospective.actions.ts` | `closeMesocycle`, `getLatestBlockRetrospective`, `getBlockRetrospective` |
| `src/lib/actions/__tests__/block-retrospective.actions.test.ts` | Mocked Supabase tests |
| `src/components/blocks/BlockRetrospectiveHeader.tsx` | Title strip |
| `src/components/blocks/BlockHeadlineTiles.tsx` | 4-up tile grid |
| `src/components/blocks/AdherenceByWeekChart.tsx` | Stacked bars per week |
| `src/components/blocks/AdherenceByDomainTable.tsx` | 6-row coach-domain table |
| `src/components/blocks/RecalibrationTimeline.tsx` | Chronological list |
| `src/components/blocks/InterventionLog.tsx` | Chronological list with response badges |
| `src/components/blocks/MissedSessionsList.tsx` | Collapsed-by-default list |
| `src/components/dashboard/CloseBlockCta.tsx` | Quiet header button |
| `src/components/dashboard/CloseBlockNudgeBanner.tsx` | Conditional banner |
| `src/components/dashboard/CloseBlockConfirmModal.tsx` | Pre-close preview modal |
| `src/components/dashboard/DashboardNoActiveBlockEmpty.tsx` | Empty-state card |
| `src/app/data/blocks/[mesocycleId]/retrospective/page.tsx` | Server route |
| `tests/e2e/block-retrospective.spec.ts` | Playwright spec (committed, not runnable) |

### Modify

| Path | Change |
|---|---|
| `src/lib/types/database.types.ts` | Regenerate after migrations 018+019; re-append the existing alias appendix; add `BlockRetrospectivesRow` / `BlockRetrospectivesInsert` aliases |
| `src/app/dashboard/page.tsx` | Branch on `getActiveMesocycle()`; render empty state when null; otherwise render existing layout with new CTA + banner |
| `src/lib/actions/workout.actions.ts` | Export new `getActiveMesocycle()` if not already exposed (used by dashboard branching). Verify against current shape — may already be reachable via `getDashboardData()`. |

### Skip (deliberately)

- Component snapshot tests. `vitest.config.ts` includes only `.test.ts` (not `.test.tsx`) and runs in `node` env (not `jsdom`). Component testing requires config changes that are out of scope. Real-data verification covers visual behavior.

---

## Task 1: Apply migrations 018 + 019, regenerate types

**Files:**
- Create: `supabase/migrations/018_block_retrospectives.sql`
- Create: `supabase/migrations/019_backfill_session_inventory_status.sql`
- Modify: `src/lib/types/database.types.ts`

- [ ] **Step 1.1: Snapshot the type alias appendix BEFORE regen**

The hand-written aliases at the bottom of `src/lib/types/database.types.ts` get clobbered on regen. Capture them now.

```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
# Find the line where the auto-generated portion ends and the hand-written aliases begin.
# As of commit 51493d3, the appendix begins at the AICoachIntervention interface comment.
grep -n "AICoachIntervention — hand-written" src/lib/types/database.types.ts
# Save everything from that line (and a few lines of preceding context for the JSDoc) to end of file.
tail -n +<line_from_grep_minus_a_few> src/lib/types/database.types.ts > /tmp/db-types-aliases.snapshot.ts
wc -l /tmp/db-types-aliases.snapshot.ts
```

Expected: ~140 lines saved to `/tmp/db-types-aliases.snapshot.ts`.

- [ ] **Step 1.2: Write migration 018 — table, RPC, RLS**

Create `supabase/migrations/018_block_retrospectives.sql`:

```sql
-- Block Retrospective table + atomic close RPC.
-- See docs/superpowers/specs/2026-05-05-block-retrospective-design.md

CREATE TABLE public.block_retrospectives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mesocycle_id    uuid NOT NULL REFERENCES public.mesocycles(id) ON DELETE CASCADE,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  schema_version  smallint NOT NULL DEFAULT 1,
  snapshot        jsonb NOT NULL,
  UNIQUE (user_id, mesocycle_id)
);

CREATE INDEX block_retrospectives_user_generated_at_idx
  ON public.block_retrospectives (user_id, generated_at DESC);

ALTER TABLE public.block_retrospectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON public.block_retrospectives
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON public.block_retrospectives
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Snapshot is frozen — no UPDATE / DELETE policies.

-- Atomic close RPC.
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

  -- Defensive pending → missed: guard against the historical inventory drift
  -- by excluding rows with a matching completed workout. After migration 019
  -- runs, this NOT EXISTS clause becomes a no-op safety net.
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

- [ ] **Step 1.3: Write migration 019 — data heal**

Create `supabase/migrations/019_backfill_session_inventory_status.sql`:

```sql
-- One-shot heal of session_inventory.status drift on Block 1.
-- All 14 drifted rows are completions logged before Phase 2 (cc4d80b)
-- shipped the completeWorkout → session_inventory state transition on
-- 2026-04-20. Phase 2 prevents recurrence; this migration is a no-op
-- on subsequent runs.

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

- [ ] **Step 1.4: Apply both migrations to live Supabase via MCP**

Use the Supabase MCP `apply_migration` tool against project `kuqgtholljrxnbxtmrnz`. Run 018 first, then 019. After each, run `list_migrations` and confirm the new version appears.

Verify post-apply with the MCP `execute_sql` tool:

```sql
-- Confirm table + RPC exist
SELECT to_regclass('public.block_retrospectives') AS tbl,
       to_regprocedure('public.close_mesocycle(uuid, jsonb)') AS rpc;

-- Confirm migration 019 healed Block 1: should now read 21 / 21 / 0
SELECT
  count(*) FILTER (WHERE status='completed') AS completed,
  count(*) FILTER (WHERE status='pending')   AS pending,
  count(*) FILTER (WHERE status='missed')    AS missed
FROM session_inventory
WHERE mesocycle_id = '50ccb2aa-61e8-470c-8404-966064c31cef';
```

Expected after 019: `completed: 21, pending: 30, missed: 0`. (The 30 pending stays — they get flipped to `missed` only when Block 1 is closed via the RPC.)

- [ ] **Step 1.5: Regenerate Supabase types and re-append aliases**

Use the Supabase MCP `generate_typescript_types` tool for project `kuqgtholljrxnbxtmrnz`. Save the output to `src/lib/types/database.types.ts` (overwriting the auto-generated portion). Then append the snapshot from `/tmp/db-types-aliases.snapshot.ts` back to the bottom of the file.

```bash
cat /tmp/db-types-aliases.snapshot.ts >> src/lib/types/database.types.ts
```

Add two new aliases inside the appendix (after the existing `Tables<>` aliases):

```ts
export type BlockRetrospectivesRow = Tables<'block_retrospectives'>
export type BlockRetrospectivesInsert = TablesInsert<'block_retrospectives'>
```

- [ ] **Step 1.6: Verify build is clean**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` (or equivalent). No type errors. If type errors reference re-appended aliases, double-check the snapshot was complete.

- [ ] **Step 1.7: Commit**

```bash
git add supabase/migrations/018_block_retrospectives.sql \
        supabase/migrations/019_backfill_session_inventory_status.sql \
        src/lib/types/database.types.ts
git commit -m "$(cat <<'EOF'
feat(db): add block_retrospectives table + close_mesocycle RPC

Migration 018 creates the table (frozen snapshot, owner-only RLS) and
the atomic close RPC that handles snapshot insert, mesocycle completion,
pending → missed inventory transition, block_pointer cleanup, and an
agent_activity audit row in one transaction.

Migration 019 heals the 14-row session_inventory.status drift on Block 1
caused by pre-Phase 2 completions. Idempotent on re-run.

Regenerated types; re-appended the alias appendix; added
BlockRetrospectivesRow / BlockRetrospectivesInsert aliases.
EOF
)"
```

---

## Task 2: Snapshot type definitions

**Files:**
- Create: `src/lib/types/block-retrospective.types.ts`

- [ ] **Step 2.1: Write the type module**

Create `src/lib/types/block-retrospective.types.ts`:

```ts
import type { CoachDomain } from '@/lib/analytics/shared/coach-domain'

export type AdherenceCounts = {
  prescribed: number
  completed: number
  missed: number
  pct: number  // 0-100, integer rounded
}

export type DomainExecution = {
  sessionsWithDeltas: number
  meanDeltaPct: number  // signed; positive = over-performed prescription
  classificationCounts: { over: number; on: number; under: number }
}

export type RecalibrationTrigger =
  | 'drift_lt_5' | 'drift_5_to_10' | 'drift_gt_10' | 'manual'

export type RecalibrationSource =
  | 'recalibration' | 'intervention_response' | 'manual'

export type RecalibrationEntry = {
  exerciseName: string
  fromKg: number
  toKg: number
  source: RecalibrationSource
  triggeredBy: RecalibrationTrigger
  occurredAt: string  // ISO timestamp
}

export type InterventionUserResponse = 'keep' | 'harder' | 'recalibrate' | null

export type InterventionEntry = {
  id: string
  coachDomain: CoachDomain | null
  triggerType: string
  rationale: string
  presentedToUser: boolean
  userResponse: InterventionUserResponse
  occurredAt: string
}

export type MissedSessionEntry = {
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

/** All valid CoachDomain values, used to seed empty `Record<CoachDomain, …>`. */
export const COACH_DOMAINS: readonly CoachDomain[] = [
  'strength', 'hypertrophy', 'endurance', 'conditioning', 'mobility', 'recovery',
] as const

export function emptyAdherenceCounts(): AdherenceCounts {
  return { prescribed: 0, completed: 0, missed: 0, pct: 0 }
}

export function emptyDomainExecution(): DomainExecution {
  return {
    sessionsWithDeltas: 0,
    meanDeltaPct: 0,
    classificationCounts: { over: 0, on: 0, under: 0 },
  }
}

export function emptyByCoachDomainAdherence(): Record<CoachDomain, AdherenceCounts> {
  return Object.fromEntries(
    COACH_DOMAINS.map(d => [d, emptyAdherenceCounts()]),
  ) as Record<CoachDomain, AdherenceCounts>
}

export function emptyByCoachDomainExecution(): Record<CoachDomain, DomainExecution> {
  return Object.fromEntries(
    COACH_DOMAINS.map(d => [d, emptyDomainExecution()]),
  ) as Record<CoachDomain, DomainExecution>
}
```

- [ ] **Step 2.2: Verify it compiles**

```bash
npx tsc --noEmit src/lib/types/block-retrospective.types.ts 2>&1 | head
```

Expected: no output (clean compile). If TS complains about missing module, double-check the `CoachDomain` import path matches `src/lib/analytics/shared/coach-domain.ts`.

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/types/block-retrospective.types.ts
git commit -m "feat(types): block retrospective snapshot type definitions"
```

---

## Task 3: `buildBlockRetrospectiveSnapshot` — TDD

**Files:**
- Create: `src/lib/analytics/block-retrospective.ts`
- Create: `src/lib/analytics/__tests__/block-retrospective.test.ts`

This task is bigger; proceed carefully. The pattern: write all 6 fixture-driven tests first against an empty stub that throws, watch them fail, implement, watch them pass.

- [ ] **Step 3.1: Write the test file with all 6 scenarios**

Create `src/lib/analytics/__tests__/block-retrospective.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Fixture state — mutated per test ──────────────────────────────────
const { fixtures } = vi.hoisted(() => ({
  fixtures: {
    mesocycle: null as any,
    microcycles: [] as any[],
    workouts: [] as any[],
    sessionInventory: [] as any[],
    performanceDeltas: [] as any[],
    agentActivity: [] as any[],
    interventions: [] as any[],
  },
}))

vi.mock('@/lib/supabase/server', () => {
  const handler = (table: string) => {
    if (table === 'mesocycles') {
      return makeQuery(() => fixtures.mesocycle ? [fixtures.mesocycle] : [])
    }
    if (table === 'microcycles') {
      return makeQuery(() => fixtures.microcycles)
    }
    if (table === 'workouts') {
      return makeQuery(() => fixtures.workouts)
    }
    if (table === 'session_inventory') {
      return makeQuery(() => fixtures.sessionInventory)
    }
    if (table === 'performance_deltas') {
      return makeQuery(() => fixtures.performanceDeltas)
    }
    if (table === 'agent_activity') {
      return makeQuery(() => fixtures.agentActivity)
    }
    if (table === 'ai_coach_interventions') {
      return makeQuery(() => fixtures.interventions)
    }
    return makeQuery(() => [])
  }
  const client = {
    from: vi.fn(handler),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  }
  return { createClient: vi.fn(async () => client) }
})

/** Builds a thenable query chain that resolves to {data, error}. Supports
 *  chained .select().eq().eq()...  filters by ignoring filter values
 *  (fixtures already represent the post-filter result set). */
function makeQuery(getRows: () => any[]) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: getRows()[0] ?? null, error: null })),
    single: vi.fn(async () => ({ data: getRows()[0] ?? null, error: null })),
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: getRows(), error: null }).then(resolve, reject),
  }
  return chain
}

import { buildBlockRetrospectiveSnapshot } from '../block-retrospective'

const MESO_ID = 'meso-1'
const USER = 'u1'

function resetFixtures() {
  fixtures.mesocycle = null
  fixtures.microcycles = []
  fixtures.workouts = []
  fixtures.sessionInventory = []
  fixtures.performanceDeltas = []
  fixtures.agentActivity = []
  fixtures.interventions = []
}

function seedMesocycle(overrides: Partial<any> = {}) {
  fixtures.mesocycle = {
    id: MESO_ID, user_id: USER, name: 'Test Block',
    goal: 'HYBRID_PEAKING', week_count: 6,
    start_date: '2026-03-23', is_active: true, is_complete: false,
    ...overrides,
  }
  fixtures.microcycles = Array.from({ length: 6 }, (_, i) => ({
    id: `mc-${i + 1}`, mesocycle_id: MESO_ID, user_id: USER,
    week_number: i + 1,
    start_date: `2026-03-${23 + i * 7}`,
    end_date: `2026-03-${29 + i * 7}`,
  }))
}

/** Inserts an inventory row + matching workout (status pending or completed). */
function seedSession(opts: {
  weekNumber: number; trainingDay: number; modality: string;
  status: 'pending' | 'completed' | 'missed';
  withDeltas?: { weight: number; actualWeight: number }[];
}) {
  const id = `inv-${opts.weekNumber}-${opts.trainingDay}-${opts.modality}`
  const mc = fixtures.microcycles.find(m => m.week_number === opts.weekNumber)!
  fixtures.sessionInventory.push({
    id, mesocycle_id: MESO_ID, user_id: USER,
    week_number: opts.weekNumber, training_day: opts.trainingDay,
    session_slot: 1, modality: opts.modality, name: `${opts.modality} session`,
    status: opts.status,
  })
  if (opts.status === 'completed') {
    fixtures.workouts.push({
      id: `w-${id}`, microcycle_id: mc.id, user_id: USER,
      session_inventory_id: id,
      completed_at: '2026-03-25T10:00:00Z',
      training_day: opts.trainingDay, session_slot: 1,
    })
    for (const d of opts.withDeltas ?? []) {
      fixtures.performanceDeltas.push({
        id: `d-${id}-${fixtures.performanceDeltas.length}`,
        user_id: USER, session_inventory_id: id,
        exercise_name: 'Bench Press',
        prescribed_weight: d.weight, actual_weight: d.actualWeight,
        prescribed_reps: null, actual_reps: null,
        prescribed_rpe: null, actual_rpe: null,
        delta_classification:
          d.actualWeight > d.weight ? 'over' :
          d.actualWeight < d.weight ? 'under' : 'on',
        created_at: '2026-03-25T10:30:00Z',
      })
    }
  }
}

describe('buildBlockRetrospectiveSnapshot', () => {
  beforeEach(() => {
    resetFixtures()
    vi.clearAllMocks()
  })

  it('1: happy path — mixed adherence with recalibrations and interventions', async () => {
    seedMesocycle()
    // 4 strength done, 2 strength pending → 4/6 = 67%
    for (let i = 1; i <= 4; i++) {
      seedSession({
        weekNumber: 1, trainingDay: i, modality: 'lifting',
        status: 'completed',
        withDeltas: [{ weight: 100, actualWeight: 100 }],
      })
    }
    seedSession({ weekNumber: 1, trainingDay: 5, modality: 'lifting', status: 'pending' })
    seedSession({ weekNumber: 1, trainingDay: 6, modality: 'lifting', status: 'pending' })

    fixtures.agentActivity = [
      {
        id: 'a1', user_id: USER, coach: 'strength',
        decision_type: 'recalibration',
        target_entity: { exercise_name: 'Bench Press' },
        reasoning_structured: {
          from_kg: 75, to_kg: 72,
          source: 'recalibration', triggered_by: 'drift_5_to_10',
        },
        created_at: '2026-04-24T05:25:37Z',
      },
      {
        id: 'a2', user_id: USER, coach: 'strength',
        decision_type: 'recalibration',
        target_entity: { exercise_name: 'Overhead Press' },
        reasoning_structured: {
          from_kg: 52, to_kg: 49.5,
          source: 'intervention_response', triggered_by: 'drift_gt_10',
        },
        created_at: '2026-04-24T05:26:05Z',
      },
    ]
    fixtures.interventions = [
      {
        id: 'i1', user_id: USER, microcycle_id: 'mc-2',
        coach_domain: 'strength', trigger_type: 'rolling_under_pattern',
        rationale: 'Three sessions under-performing.',
        presented_to_user: true, user_response: 'keep',
        created_at: '2026-04-10T12:00:00Z',
      },
    ]

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)

    expect(snap.schemaVersion).toBe(1)
    expect(snap.block.id).toBe(MESO_ID)
    expect(snap.adherence.overall).toEqual({
      prescribed: 6, completed: 4, missed: 2, pct: 67,
    })
    expect(snap.adherence.byCoachDomain.strength).toEqual({
      prescribed: 6, completed: 4, missed: 2, pct: 67,
    })
    expect(snap.adherence.byWeek[0]).toMatchObject({
      weekNumber: 1, prescribed: 6, completed: 4, missed: 2, pct: 67,
    })
    expect(snap.recalibrations).toHaveLength(2)
    expect(snap.recalibrations[0]).toMatchObject({
      exerciseName: 'Bench Press', fromKg: 75, toKg: 72,
      source: 'recalibration', triggeredBy: 'drift_5_to_10',
    })
    expect(snap.interventions).toHaveLength(1)
    expect(snap.interventions[0].userResponse).toBe('keep')
  })

  it('2: 100% adherence, no recalibrations, no interventions', async () => {
    seedMesocycle()
    for (let i = 1; i <= 3; i++) {
      seedSession({ weekNumber: 1, trainingDay: i, modality: 'lifting', status: 'completed' })
    }

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)

    expect(snap.adherence.overall).toEqual({
      prescribed: 3, completed: 3, missed: 0, pct: 100,
    })
    expect(snap.recalibrations).toEqual([])
    expect(snap.interventions).toEqual([])
    expect(snap.missedSessions).toEqual([])
  })

  it('3: 0% adherence — block abandoned, all pending', async () => {
    seedMesocycle()
    for (let i = 1; i <= 4; i++) {
      seedSession({ weekNumber: 1, trainingDay: i, modality: 'cardio', status: 'pending' })
    }

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)

    expect(snap.adherence.overall).toEqual({
      prescribed: 4, completed: 0, missed: 4, pct: 0,
    })
    expect(snap.adherence.byCoachDomain.endurance.pct).toBe(0)
    expect(snap.executionQuality.byCoachDomain.endurance.sessionsWithDeltas).toBe(0)
    expect(snap.executionQuality.byCoachDomain.endurance.meanDeltaPct).toBe(0)
    expect(snap.missedSessions).toHaveLength(4)
    expect(snap.missedSessions[0].coachDomain).toBe('endurance')
  })

  it('4: completed sessions but no performance_deltas (legacy pre-Phase 1)', async () => {
    seedMesocycle()
    seedSession({ weekNumber: 1, trainingDay: 1, modality: 'lifting', status: 'completed' })
    seedSession({ weekNumber: 1, trainingDay: 2, modality: 'lifting', status: 'completed' })
    // no withDeltas → no performance_deltas rows seeded

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)

    expect(snap.adherence.overall.completed).toBe(2)
    expect(snap.executionQuality.byCoachDomain.strength.sessionsWithDeltas).toBe(0)
    expect(snap.executionQuality.byCoachDomain.strength.meanDeltaPct).toBe(0)
    expect(snap.executionQuality.byCoachDomain.strength.classificationCounts)
      .toEqual({ over: 0, on: 0, under: 0 })
  })

  it('5: agent_activity rows of other decision_types are filtered out', async () => {
    seedMesocycle()
    seedSession({ weekNumber: 1, trainingDay: 1, modality: 'lifting', status: 'completed' })
    fixtures.agentActivity = [
      {
        id: 'a1', user_id: USER, coach: 'strength',
        decision_type: 'intervention_fired',  // NOT 'recalibration'
        target_entity: {}, reasoning_structured: {},
        created_at: '2026-03-25T10:00:00Z',
      },
      {
        id: 'a2', user_id: USER, coach: 'strength',
        decision_type: 'block_close',
        target_entity: {}, reasoning_structured: {},
        created_at: '2026-03-25T10:00:00Z',
      },
    ]

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)
    expect(snap.recalibrations).toEqual([])
  })

  it('6: division by zero is guarded (mesocycle with no sessions in inventory)', async () => {
    seedMesocycle()
    // no seedSession calls

    const snap = await buildBlockRetrospectiveSnapshot(MESO_ID)
    expect(snap.adherence.overall).toEqual({
      prescribed: 0, completed: 0, missed: 0, pct: 0,
    })
    for (const d of Object.keys(snap.adherence.byCoachDomain) as Array<keyof typeof snap.adherence.byCoachDomain>) {
      expect(snap.adherence.byCoachDomain[d].pct).toBe(0)
    }
  })
})
```

- [ ] **Step 3.2: Run tests — verify they all fail with module-not-found**

```bash
npm test -- --run src/lib/analytics/__tests__/block-retrospective.test.ts 2>&1 | tail -30
```

Expected: 6 failures, all citing missing `block-retrospective` module.

- [ ] **Step 3.3: Implement `buildBlockRetrospectiveSnapshot`**

Create `src/lib/analytics/block-retrospective.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import {
  modalityToCoachDomain,
  computeExerciseDeltaPct,
  type CoachDomain,
} from './shared/coach-domain'
import {
  type BlockRetrospectiveSnapshot,
  type RecalibrationEntry,
  type RecalibrationSource,
  type RecalibrationTrigger,
  type InterventionEntry,
  type InterventionUserResponse,
  type MissedSessionEntry,
  type AdherenceCounts,
  type DomainExecution,
  COACH_DOMAINS,
  emptyByCoachDomainAdherence,
  emptyByCoachDomainExecution,
  emptyAdherenceCounts,
} from '@/lib/types/block-retrospective.types'

function pct(num: number, den: number): number {
  if (den === 0) return 0
  return Math.round((num / den) * 100)
}

function withPct(c: Omit<AdherenceCounts, 'pct'>): AdherenceCounts {
  return { ...c, pct: pct(c.completed, c.prescribed) }
}

/** Pure assembler — loads everything needed and returns the typed snapshot.
 *  No mutations; safe to call as a dry-run for the pre-close confirm modal. */
export async function buildBlockRetrospectiveSnapshot(
  mesocycleId: string,
): Promise<BlockRetrospectiveSnapshot> {
  const supabase = await createClient()

  const { data: meso } = await supabase
    .from('mesocycles').select('*').eq('id', mesocycleId).maybeSingle()
  if (!meso) throw new Error(`mesocycle ${mesocycleId} not found`)

  const { data: microcycles } = await supabase
    .from('microcycles').select('*').eq('mesocycle_id', mesocycleId).order('week_number')

  const microcycleIds = (microcycles ?? []).map(mc => mc.id)
  const { data: workouts } = microcycleIds.length
    ? await supabase.from('workouts').select('*').in('microcycle_id', microcycleIds)
    : { data: [] as any[] }

  const { data: inventory } = await supabase
    .from('session_inventory').select('*').eq('mesocycle_id', mesocycleId)

  const inventoryIds = (inventory ?? []).map(i => i.id)
  const { data: deltas } = inventoryIds.length
    ? await supabase.from('performance_deltas').select('*').in('session_inventory_id', inventoryIds)
    : { data: [] as any[] }

  const { data: agentRows } = await supabase
    .from('agent_activity').select('*')
    .eq('user_id', meso.user_id).eq('decision_type', 'recalibration')
    .gte('created_at', meso.start_date)

  const { data: interventionRows } = microcycleIds.length
    ? await supabase.from('ai_coach_interventions').select('*').in('microcycle_id', microcycleIds)
    : { data: [] as any[] }

  // ─── Adherence ───────────────────────────────────────────────────────
  const completedInvIds = new Set(
    (workouts ?? [])
      .filter(w => w.completed_at != null && w.session_inventory_id)
      .map(w => w.session_inventory_id as string),
  )

  const byWeekCounts = new Map<number, { prescribed: number; completed: number }>()
  const byDomainCounts: Record<CoachDomain, { prescribed: number; completed: number }> =
    Object.fromEntries(COACH_DOMAINS.map(d => [d, { prescribed: 0, completed: 0 }])) as any

  for (const inv of inventory ?? []) {
    const w = byWeekCounts.get(inv.week_number) ?? { prescribed: 0, completed: 0 }
    w.prescribed++
    const isDone = completedInvIds.has(inv.id)
    if (isDone) w.completed++
    byWeekCounts.set(inv.week_number, w)

    const domain = modalityToCoachDomain(inv.modality ?? '')
    if (domain) {
      byDomainCounts[domain].prescribed++
      if (isDone) byDomainCounts[domain].completed++
    }
  }

  const overallPrescribed = (inventory ?? []).length
  const overallCompleted = completedInvIds.size
  const overallAdherence = withPct({
    prescribed: overallPrescribed,
    completed: overallCompleted,
    missed: overallPrescribed - overallCompleted,
  })

  const byCoachDomainAdherence = emptyByCoachDomainAdherence()
  for (const d of COACH_DOMAINS) {
    const c = byDomainCounts[d]
    byCoachDomainAdherence[d] = withPct({
      prescribed: c.prescribed,
      completed: c.completed,
      missed: c.prescribed - c.completed,
    })
  }

  const byWeek = (microcycles ?? []).map(mc => {
    const c = byWeekCounts.get(mc.week_number) ?? { prescribed: 0, completed: 0 }
    return {
      weekNumber: mc.week_number,
      ...withPct({
        prescribed: c.prescribed,
        completed: c.completed,
        missed: c.prescribed - c.completed,
      }),
    }
  })

  // ─── Execution quality ───────────────────────────────────────────────
  // Per-session delta_pct = mean of per-exercise deltas (with sign).
  // Domain meanDeltaPct = mean of per-session deltas, only counting sessions
  // that produced at least one valid delta.
  const invToDomain = new Map<string, CoachDomain>()
  for (const inv of inventory ?? []) {
    const domain = modalityToCoachDomain(inv.modality ?? '')
    if (domain) invToDomain.set(inv.id, domain)
  }

  const perSessionByDomain: Record<CoachDomain, number[]> =
    Object.fromEntries(COACH_DOMAINS.map(d => [d, [] as number[]])) as any
  const classByDomain: Record<CoachDomain, { over: number; on: number; under: number }> =
    Object.fromEntries(COACH_DOMAINS.map(d => [d, { over: 0, on: 0, under: 0 }])) as any

  // Group deltas by session_inventory_id
  const deltasBySession = new Map<string, any[]>()
  for (const d of deltas ?? []) {
    if (!d.session_inventory_id) continue
    const arr = deltasBySession.get(d.session_inventory_id) ?? []
    arr.push(d)
    deltasBySession.set(d.session_inventory_id, arr)
  }

  for (const [invId, exDeltas] of deltasBySession) {
    const domain = invToDomain.get(invId)
    if (!domain) continue
    const valid = exDeltas
      .map(d => computeExerciseDeltaPct(d))
      .filter((v): v is number => v != null)
    if (valid.length === 0) continue
    const sessionDelta = valid.reduce((a, c) => a + c, 0) / valid.length
    perSessionByDomain[domain].push(sessionDelta)

    // Classification: use the per-exercise delta_classification if present;
    // otherwise derive from sign of session delta.
    for (const d of exDeltas) {
      const cls: 'over' | 'on' | 'under' =
        d.delta_classification === 'over' || d.delta_classification === 'on' || d.delta_classification === 'under'
          ? d.delta_classification
          : sessionDelta > 1 ? 'over' : sessionDelta < -1 ? 'under' : 'on'
      classByDomain[domain][cls]++
    }
  }

  const executionByDomain = emptyByCoachDomainExecution()
  for (const d of COACH_DOMAINS) {
    const sessions = perSessionByDomain[d]
    const exec: DomainExecution = {
      sessionsWithDeltas: sessions.length,
      meanDeltaPct: sessions.length === 0
        ? 0
        : Math.round((sessions.reduce((a, c) => a + c, 0) / sessions.length) * 10) / 10,
      classificationCounts: classByDomain[d],
    }
    executionByDomain[d] = exec
  }

  // ─── Recalibrations from agent_activity ──────────────────────────────
  const recalibrations: RecalibrationEntry[] = (agentRows ?? [])
    .filter(r => r.decision_type === 'recalibration')
    .map(r => {
      const target = r.target_entity ?? {}
      const reason = r.reasoning_structured ?? {}
      return {
        exerciseName: String(target.exercise_name ?? 'Unknown'),
        fromKg: Number(reason.from_kg ?? 0),
        toKg: Number(reason.to_kg ?? 0),
        source: ((reason.source as RecalibrationSource) ?? 'manual'),
        triggeredBy: ((reason.triggered_by as RecalibrationTrigger) ?? 'manual'),
        occurredAt: String(r.created_at),
      }
    })
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  // ─── Interventions ───────────────────────────────────────────────────
  const interventions: InterventionEntry[] = (interventionRows ?? []).map(r => {
    const domain = r.coach_domain
      ? (COACH_DOMAINS.includes(r.coach_domain as CoachDomain) ? (r.coach_domain as CoachDomain) : null)
      : null
    return {
      id: r.id,
      coachDomain: domain,
      triggerType: r.trigger_type ?? 'unknown',
      rationale: r.rationale ?? '',
      presentedToUser: r.presented_to_user === true,
      userResponse: ((r.user_response as InterventionUserResponse) ?? null),
      occurredAt: String(r.created_at),
    }
  }).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  // ─── Missed sessions (post-close, status='missed') ───────────────────
  const missedSessions: MissedSessionEntry[] = (inventory ?? [])
    .filter(inv => inv.status === 'missed' && !completedInvIds.has(inv.id))
    .map(inv => {
      const domain = modalityToCoachDomain(inv.modality ?? '')
      return {
        sessionInventoryId: inv.id,
        name: inv.name ?? 'Untitled',
        modality: inv.modality ?? 'unknown',
        coachDomain: domain ?? 'recovery',  // unknown modalities bucket here
        weekNumber: inv.week_number,
        trainingDay: inv.training_day ?? 0,
      }
    })

  // ─── Block header ────────────────────────────────────────────────────
  const endDate = (microcycles ?? []).reduce<string>(
    (max, mc) => (mc.end_date && mc.end_date > max ? mc.end_date : max),
    meso.start_date,
  )

  return {
    schemaVersion: 1,
    block: {
      id: meso.id,
      name: meso.name,
      goal: meso.goal,
      weekCount: meso.week_count,
      startDate: meso.start_date,
      endDate,
      closedAt: new Date().toISOString(),
    },
    adherence: {
      overall: overallAdherence,
      byCoachDomain: byCoachDomainAdherence,
      byWeek,
    },
    executionQuality: { byCoachDomain: executionByDomain },
    recalibrations,
    interventions,
    missedSessions,
  }
}
```

- [ ] **Step 3.4: Run tests — verify all pass**

```bash
npm test -- --run src/lib/analytics/__tests__/block-retrospective.test.ts 2>&1 | tail -20
```

Expected: 6 passed, 0 failed.

If a test fails:
- Check fixture seeding matches what the assembler queries (table names, filter columns).
- The mocked query chain in `makeQuery` ignores filter values — fixtures must already represent the post-filter result. If the assembler does e.g. `.in('microcycle_id', ids)` on `workouts`, fixtures.workouts should ONLY contain rows that should pass the filter.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/analytics/block-retrospective.ts \
        src/lib/analytics/__tests__/block-retrospective.test.ts
git commit -m "$(cat <<'EOF'
feat(analytics): buildBlockRetrospectiveSnapshot pure assembler

Loads mesocycle + microcycles + workouts + inventory + performance_deltas +
agent_activity + ai_coach_interventions and derives the typed snapshot.
Reuses modalityToCoachDomain / computeExerciseDeltaPct.

6 fixture-driven scenarios cover happy path, 100% / 0% adherence, missing
deltas, agent_activity decision_type filtering, and division-by-zero.
EOF
)"
```

---

## Task 4: `closeMesocycle` server action — TDD

**Files:**
- Create: `src/lib/actions/block-retrospective.actions.ts`
- Create: `src/lib/actions/__tests__/block-retrospective.actions.test.ts`

- [ ] **Step 4.1: Write the test file**

Create `src/lib/actions/__tests__/block-retrospective.actions.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    mesocycle: null as any,
    existingRetrospective: null as any,
    rpcCalls: [] as Array<{ name: string; args: any }>,
    rpcResult: null as any,
    rpcShouldThrow: null as Error | null,
    user: { id: 'u1' } as any,
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
  const handler = (table: string) => {
    if (table === 'mesocycles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: state.mesocycle, error: null })),
            })),
            maybeSingle: vi.fn(async () => ({ data: state.mesocycle, error: null })),
          })),
        })),
      }
    }
    if (table === 'block_retrospectives') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: state.existingRetrospective, error: null,
              })),
            })),
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: state.existingRetrospective, error: null,
                })),
              })),
            })),
          })),
        })),
      }
    }
    return {}
  }
  const client = {
    from: vi.fn(handler),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: state.user } }) },
    rpc: vi.fn(async (name: string, args: any) => {
      state.rpcCalls.push({ name, args })
      if (state.rpcShouldThrow) throw state.rpcShouldThrow
      return { data: state.rpcResult, error: null }
    }),
  }
  return { createClient: vi.fn(async () => client) }
})

vi.mock('@/lib/analytics/block-retrospective', () => ({
  buildBlockRetrospectiveSnapshot: vi.fn(async (id: string) => ({
    schemaVersion: 1,
    block: { id, name: 'Test', goal: 'X', weekCount: 1,
      startDate: '2026-01-01', endDate: '2026-01-07', closedAt: '2026-01-08T00:00:00Z' },
    adherence: { overall: { prescribed: 1, completed: 1, missed: 0, pct: 100 },
      byCoachDomain: {} as any, byWeek: [] },
    executionQuality: { byCoachDomain: {} as any },
    recalibrations: [], interventions: [], missedSessions: [],
  })),
}))

import {
  closeMesocycle,
  getLatestBlockRetrospective,
  getBlockRetrospective,
} from '../block-retrospective.actions'

describe('block-retrospective actions', () => {
  beforeEach(() => {
    state.mesocycle = null
    state.existingRetrospective = null
    state.rpcCalls.length = 0
    state.rpcResult = null
    state.rpcShouldThrow = null
    state.user = { id: 'u1' }
    vi.clearAllMocks()
  })

  describe('closeMesocycle', () => {
    it('happy path — calls RPC with snapshot, returns success', async () => {
      state.mesocycle = { id: 'm1', user_id: 'u1', is_active: true, is_complete: false }
      state.rpcResult = { id: 'retro-1', mesocycle_id: 'm1' }

      const r = await closeMesocycle('m1')

      expect(r.success).toBe(true)
      expect(state.rpcCalls).toHaveLength(1)
      expect(state.rpcCalls[0].name).toBe('close_mesocycle')
      expect(state.rpcCalls[0].args.p_mesocycle_id).toBe('m1')
      expect(state.rpcCalls[0].args.p_snapshot.schemaVersion).toBe(1)
    })

    it('rejects when mesocycle is already closed', async () => {
      state.mesocycle = { id: 'm1', user_id: 'u1', is_active: false, is_complete: true }
      state.existingRetrospective = { id: 'retro-1', mesocycle_id: 'm1' }

      const r = await closeMesocycle('m1')

      expect(r.success).toBe(false)
      if (!r.success) expect(r.error).toMatch(/already closed/i)
      expect(state.rpcCalls).toHaveLength(0)
    })

    it('rejects when not authenticated', async () => {
      state.user = null
      const r = await closeMesocycle('m1')
      expect(r.success).toBe(false)
      if (!r.success) expect(r.error).toMatch(/not authenticated/i)
    })

    it('surfaces RPC throw as failure result', async () => {
      state.mesocycle = { id: 'm1', user_id: 'u1', is_active: true, is_complete: false }
      state.rpcShouldThrow = new Error('mesocycle already closed')

      const r = await closeMesocycle('m1')

      expect(r.success).toBe(false)
      if (!r.success) expect(r.error).toMatch(/already closed/i)
    })
  })

  describe('getLatestBlockRetrospective', () => {
    it('returns the snapshot when one exists', async () => {
      state.existingRetrospective = {
        id: 'r1', mesocycle_id: 'm1',
        snapshot: { schemaVersion: 1, block: { id: 'm1' } },
      }
      const r = await getLatestBlockRetrospective()
      expect(r.success).toBe(true)
      if (r.success) expect(r.data?.block.id).toBe('m1')
    })

    it('returns null when no retrospectives exist', async () => {
      state.existingRetrospective = null
      const r = await getLatestBlockRetrospective()
      expect(r.success).toBe(true)
      if (r.success) expect(r.data).toBeNull()
    })
  })

  describe('getBlockRetrospective', () => {
    it('returns the snapshot for a specific mesocycle', async () => {
      state.existingRetrospective = {
        id: 'r1', mesocycle_id: 'm1',
        snapshot: { schemaVersion: 1, block: { id: 'm1' } },
      }
      const r = await getBlockRetrospective('m1')
      expect(r.success).toBe(true)
      if (r.success) expect(r.data?.block.id).toBe('m1')
    })

    it('returns null when not found', async () => {
      state.existingRetrospective = null
      const r = await getBlockRetrospective('nope')
      expect(r.success).toBe(true)
      if (r.success) expect(r.data).toBeNull()
    })
  })
})
```

- [ ] **Step 4.2: Run tests — verify they fail with module-not-found**

```bash
npm test -- --run src/lib/actions/__tests__/block-retrospective.actions.test.ts 2>&1 | tail -10
```

Expected: failures citing missing module.

- [ ] **Step 4.3: Implement the action module**

Create `src/lib/actions/block-retrospective.actions.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildBlockRetrospectiveSnapshot } from '@/lib/analytics/block-retrospective'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'
import type { ActionResult } from '@/lib/types/training.types'

export async function closeMesocycle(
  mesocycleId: string,
): Promise<ActionResult<{ retrospectiveMesocycleId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Pre-check: mesocycle exists, owned by user, not already closed.
  const { data: meso } = await supabase
    .from('mesocycles')
    .select('id, is_active, is_complete')
    .eq('id', mesocycleId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!meso) return { success: false, error: 'Block not found' }
  if (meso.is_complete) return { success: false, error: 'Block already closed' }

  // Pre-check: retrospective doesn't already exist (UNIQUE catches it,
  // but the friendly error is nicer).
  const { data: existing } = await supabase
    .from('block_retrospectives')
    .select('id')
    .eq('mesocycle_id', mesocycleId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) return { success: false, error: 'Block already closed' }

  // Build snapshot (TS pure assembler).
  let snapshot: BlockRetrospectiveSnapshot
  try {
    snapshot = await buildBlockRetrospectiveSnapshot(mesocycleId)
  } catch (e) {
    return { success: false, error: `Failed to build retrospective snapshot: ${(e as Error).message}` }
  }

  // Atomic close via RPC.
  try {
    await supabase.rpc('close_mesocycle', {
      p_mesocycle_id: mesocycleId,
      p_snapshot: snapshot as unknown as Record<string, unknown>,
    })
  } catch (e) {
    const msg = (e as Error).message
    return { success: false, error: msg.includes('already closed') ? 'Block already closed' : msg }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/data/blocks/${mesocycleId}/retrospective`)
  return { success: true, data: { retrospectiveMesocycleId: mesocycleId } }
}

export async function getLatestBlockRetrospective(): Promise<ActionResult<BlockRetrospectiveSnapshot | null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('block_retrospectives')
    .select('snapshot')
    .eq('user_id', user.id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ? (data.snapshot as unknown as BlockRetrospectiveSnapshot) : null }
}

export async function getBlockRetrospective(
  mesocycleId: string,
): Promise<ActionResult<BlockRetrospectiveSnapshot | null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('block_retrospectives')
    .select('snapshot')
    .eq('user_id', user.id)
    .eq('mesocycle_id', mesocycleId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ? (data.snapshot as unknown as BlockRetrospectiveSnapshot) : null }
}
```

- [ ] **Step 4.4: Run tests — verify all pass**

```bash
npm test -- --run src/lib/actions/__tests__/block-retrospective.actions.test.ts 2>&1 | tail -15
```

Expected: 7 passed.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/actions/block-retrospective.actions.ts \
        src/lib/actions/__tests__/block-retrospective.actions.test.ts
git commit -m "$(cat <<'EOF'
feat(actions): closeMesocycle + retrospective read actions

closeMesocycle assembles the snapshot via buildBlockRetrospectiveSnapshot,
then calls the close_mesocycle RPC for atomic persistence. Pre-checks for
already-closed and unauthenticated cases. Friendly error mapping.

getLatestBlockRetrospective and getBlockRetrospective expose the snapshot
to the dashboard empty state and the retrospective view (and to sub-project
D's planner integration when it lands).
EOF
)"
```

---

## Task 5: Retrospective view components (no tests)

**Files:**
- Create: `src/components/blocks/BlockRetrospectiveHeader.tsx`
- Create: `src/components/blocks/BlockHeadlineTiles.tsx`
- Create: `src/components/blocks/AdherenceByWeekChart.tsx`
- Create: `src/components/blocks/AdherenceByDomainTable.tsx`
- Create: `src/components/blocks/RecalibrationTimeline.tsx`
- Create: `src/components/blocks/InterventionLog.tsx`
- Create: `src/components/blocks/MissedSessionsList.tsx`

All components are server-renderable (no `'use client'`) — pure presentational against typed snapshot props. Tailwind 4 + lucide-react. Earth-tone aesthetic matching existing dashboard.

- [ ] **Step 5.1: BlockRetrospectiveHeader**

Create `src/components/blocks/BlockRetrospectiveHeader.tsx`:

```tsx
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

export function BlockRetrospectiveHeader({ block }: { block: BlockRetrospectiveSnapshot['block'] }) {
  const fmt = (d: string) => format(new Date(d), 'MMM d, yyyy', { locale: enUS })
  return (
    <header className="border-b border-neutral-800 pb-3 mb-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-space-grotesk font-bold text-white tracking-tight">
          {block.name}
        </h1>
        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/70 px-2 py-0.5 border border-amber-500/30 rounded-sm">
          {block.goal}
        </span>
      </div>
      <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-1">
        {fmt(block.startDate)} → {fmt(block.endDate)} · {block.weekCount} weeks · closed {fmt(block.closedAt)}
      </p>
    </header>
  )
}
```

- [ ] **Step 5.2: BlockHeadlineTiles**

Create `src/components/blocks/BlockHeadlineTiles.tsx`:

```tsx
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

function adherenceColor(pct: number): string {
  if (pct >= 75) return 'text-emerald-400'
  if (pct >= 60) return 'text-neutral-200'
  return 'text-amber-400'
}

function Tile({ label, value, sub, valueClass }: {
  label: string; value: string; sub: string; valueClass?: string
}) {
  return (
    <div className="border border-neutral-800 bg-neutral-950/60 p-3">
      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-space-grotesk font-bold mt-1 ${valueClass ?? 'text-white'}`}>{value}</p>
      <p className="text-[11px] font-inter text-neutral-500 mt-0.5">{sub}</p>
    </div>
  )
}

export function BlockHeadlineTiles({ snapshot }: { snapshot: BlockRetrospectiveSnapshot }) {
  const a = snapshot.adherence.overall

  // Mean drift = mean of executionQuality.byCoachDomain[*].meanDeltaPct,
  // weighted by sessionsWithDeltas. Domains with no signal don't contribute.
  let driftNum = 0
  let driftDen = 0
  for (const d of Object.values(snapshot.executionQuality.byCoachDomain)) {
    driftNum += d.meanDeltaPct * d.sessionsWithDeltas
    driftDen += d.sessionsWithDeltas
  }
  const meanDrift = driftDen === 0 ? null : Math.round((driftNum / driftDen) * 10) / 10

  const recals = snapshot.recalibrations.length
  const interventions = snapshot.interventions
  const reviewed = interventions.filter(i => i.userResponse !== null).length
  const acceptanceRate = interventions.length === 0
    ? null
    : Math.round((reviewed / interventions.length) * 100)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Tile
        label="Adherence"
        value={`${a.completed} / ${a.prescribed}`}
        sub={`${a.pct}% completed`}
        valueClass={adherenceColor(a.pct)}
      />
      <Tile
        label="Mean drift"
        value={meanDrift == null ? '—' : `${meanDrift > 0 ? '+' : ''}${meanDrift}%`}
        sub="weight prescribed vs lifted"
      />
      <Tile
        label="Recalibrations"
        value={String(recals)}
        sub="training-max changes"
      />
      <Tile
        label="Interventions"
        value={String(interventions.length)}
        sub={acceptanceRate == null ? 'no interventions' : `${acceptanceRate}% reviewed`}
      />
    </div>
  )
}
```

- [ ] **Step 5.3: AdherenceByWeekChart**

Create `src/components/blocks/AdherenceByWeekChart.tsx`:

```tsx
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

export function AdherenceByWeekChart({ byWeek }: { byWeek: BlockRetrospectiveSnapshot['adherence']['byWeek'] }) {
  if (byWeek.length === 0) return null
  const maxPrescribed = Math.max(...byWeek.map(w => w.prescribed), 1)
  const barWidth = 32
  const gap = 16
  const chartHeight = 120
  const chartWidth = byWeek.length * (barWidth + gap)

  return (
    <section className="border border-neutral-800 bg-neutral-950/60 p-3">
      <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">
        Adherence by week
      </h2>
      <svg width={chartWidth} height={chartHeight + 30}>
        {byWeek.map((w, i) => {
          const x = i * (barWidth + gap)
          const completedH = (w.completed / maxPrescribed) * chartHeight
          const missedH = (w.missed / maxPrescribed) * chartHeight
          return (
            <g key={w.weekNumber}>
              <rect
                x={x} y={chartHeight - completedH - missedH}
                width={barWidth} height={missedH}
                className="fill-neutral-700"
              />
              <rect
                x={x} y={chartHeight - completedH}
                width={barWidth} height={completedH}
                className="fill-emerald-600"
              />
              <text
                x={x + barWidth / 2} y={chartHeight + 12}
                textAnchor="middle"
                className="fill-neutral-400 text-[10px] font-mono"
              >
                W{w.weekNumber}
              </text>
              <text
                x={x + barWidth / 2} y={chartHeight + 24}
                textAnchor="middle"
                className="fill-neutral-500 text-[9px] font-mono"
              >
                {w.pct}%
              </text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}
```

- [ ] **Step 5.4: AdherenceByDomainTable**

Create `src/components/blocks/AdherenceByDomainTable.tsx`:

```tsx
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'
import { COACH_DOMAINS } from '@/lib/types/block-retrospective.types'

const DOMAIN_LABEL: Record<string, string> = {
  strength: 'Strength', hypertrophy: 'Hypertrophy',
  endurance: 'Endurance', conditioning: 'Conditioning',
  mobility: 'Mobility', recovery: 'Recovery',
}

export function AdherenceByDomainTable({ snapshot }: { snapshot: BlockRetrospectiveSnapshot }) {
  return (
    <section className="border border-neutral-800 bg-neutral-950/60 p-3">
      <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">
        By coach domain
      </h2>
      <table className="w-full text-[12px] font-inter">
        <thead>
          <tr className="text-neutral-500 text-[10px] font-mono uppercase tracking-wider border-b border-neutral-800">
            <th className="text-left py-1.5 pr-2">Domain</th>
            <th className="text-right py-1.5 px-2">Done / Rx</th>
            <th className="text-right py-1.5 px-2">%</th>
            <th className="text-right py-1.5 px-2">Δ%</th>
            <th className="text-right py-1.5 pl-2">Over / On / Under</th>
          </tr>
        </thead>
        <tbody>
          {COACH_DOMAINS.map(d => {
            const a = snapshot.adherence.byCoachDomain[d]
            const e = snapshot.executionQuality.byCoachDomain[d]
            const noSignal = e.sessionsWithDeltas === 0
            const drift = noSignal
              ? '—'
              : `${e.meanDeltaPct > 0 ? '+' : ''}${e.meanDeltaPct}`
            return (
              <tr key={d} className="border-b border-neutral-800/50 last:border-0">
                <td className="text-left py-1.5 pr-2 text-neutral-300">{DOMAIN_LABEL[d]}</td>
                <td className="text-right py-1.5 px-2 font-mono text-neutral-300">
                  {a.completed} / {a.prescribed}
                </td>
                <td className="text-right py-1.5 px-2 font-mono">
                  <span className={a.pct >= 75 ? 'text-emerald-400' : a.pct >= 60 ? 'text-neutral-200' : 'text-amber-400'}>
                    {a.pct}%
                  </span>
                </td>
                <td className="text-right py-1.5 px-2 font-mono text-neutral-400">{drift}</td>
                <td className="text-right py-1.5 pl-2 font-mono text-neutral-400">
                  {noSignal
                    ? '—'
                    : `${e.classificationCounts.over} / ${e.classificationCounts.on} / ${e.classificationCounts.under}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
```

- [ ] **Step 5.5: RecalibrationTimeline**

Create `src/components/blocks/RecalibrationTimeline.tsx`:

```tsx
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { ArrowRight } from 'lucide-react'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

const TRIGGER_LABEL: Record<string, string> = {
  drift_lt_5: 'Drift <5%',
  drift_5_to_10: 'Drift 5-10%',
  drift_gt_10: 'Drift >10%',
  manual: 'Manual',
}

export function RecalibrationTimeline({ recalibrations }: {
  recalibrations: BlockRetrospectiveSnapshot['recalibrations']
}) {
  return (
    <section className="border border-neutral-800 bg-neutral-950/60 p-3">
      <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">
        Recalibrations ({recalibrations.length})
      </h2>
      {recalibrations.length === 0 ? (
        <p className="text-[12px] font-inter text-neutral-500">No recalibrations this block.</p>
      ) : (
        <ul className="space-y-1.5">
          {recalibrations.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-[12px] font-inter">
              <span className="text-[10px] font-mono text-neutral-500 w-20 shrink-0">
                {format(new Date(r.occurredAt), 'MMM d', { locale: enUS })}
              </span>
              <span className="text-neutral-300 w-40 truncate">{r.exerciseName}</span>
              <span className="font-mono text-neutral-400">{r.fromKg}kg</span>
              <ArrowRight className="w-3 h-3 text-neutral-600" />
              <span className="font-mono text-amber-400">{r.toKg}kg</span>
              <span className="text-[10px] font-mono text-neutral-500 ml-auto">
                {TRIGGER_LABEL[r.triggeredBy] ?? r.triggeredBy}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 5.6: InterventionLog**

Create `src/components/blocks/InterventionLog.tsx`:

```tsx
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

const RESPONSE_STYLE: Record<string, string> = {
  keep: 'text-emerald-400 border-emerald-500/30',
  harder: 'text-amber-400 border-amber-500/30',
  recalibrate: 'text-cyan-400 border-cyan-500/30',
}

export function InterventionLog({ interventions }: {
  interventions: BlockRetrospectiveSnapshot['interventions']
}) {
  return (
    <section className="border border-neutral-800 bg-neutral-950/60 p-3">
      <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">
        Interventions ({interventions.length})
      </h2>
      {interventions.length === 0 ? (
        <p className="text-[12px] font-inter text-neutral-500">No interventions logged.</p>
      ) : (
        <ul className="space-y-2">
          {interventions.map(i => {
            const style = i.userResponse ? RESPONSE_STYLE[i.userResponse] ?? '' : 'text-neutral-500 border-neutral-700'
            return (
              <li key={i.id} className="border-l border-neutral-800 pl-2.5">
                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                  <span>{format(new Date(i.occurredAt), 'MMM d', { locale: enUS })}</span>
                  <span>·</span>
                  <span className="text-neutral-400">{i.coachDomain ?? '—'}</span>
                  <span>·</span>
                  <span>{i.triggerType}</span>
                  <span className={`ml-auto px-1.5 py-0.5 border rounded-sm ${style}`}>
                    {i.userResponse ?? 'unreviewed'}
                  </span>
                </div>
                <p className="text-[12px] font-inter text-neutral-300 mt-1">{i.rationale}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 5.7: MissedSessionsList**

Create `src/components/blocks/MissedSessionsList.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

export function MissedSessionsList({ missedSessions }: {
  missedSessions: BlockRetrospectiveSnapshot['missedSessions']
}) {
  const [open, setOpen] = useState(false)
  const Icon = open ? ChevronDown : ChevronRight

  return (
    <section className="border border-neutral-800 bg-neutral-950/60 p-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-[10px] font-mono text-neutral-500 uppercase tracking-wider hover:text-neutral-300 transition-colors"
      >
        <Icon className="w-3 h-3" />
        Missed sessions ({missedSessions.length})
      </button>
      {open && missedSessions.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12px] font-inter">
          {missedSessions.map(m => (
            <li key={m.sessionInventoryId} className="flex items-center gap-2 text-neutral-400">
              <span className="text-[10px] font-mono text-neutral-500 w-16 shrink-0">
                W{m.weekNumber} · D{m.trainingDay}
              </span>
              <span className="w-24 text-neutral-500 text-[10px] font-mono uppercase">
                {m.coachDomain}
              </span>
              <span>{m.name}</span>
            </li>
          ))}
        </ul>
      )}
      {open && missedSessions.length === 0 && (
        <p className="text-[12px] font-inter text-neutral-500 mt-3">No missed sessions.</p>
      )}
    </section>
  )
}
```

- [ ] **Step 5.8: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 5.9: Commit**

```bash
git add src/components/blocks/
git commit -m "$(cat <<'EOF'
feat(blocks): retrospective view components

Seven presentational components consuming the typed snapshot:
header, headline tiles (4-up), by-week chart (custom SVG bars),
by-domain table (6 rows), recalibration timeline, intervention log
with user-response badges, collapsed missed-sessions list.

Earth-tone aesthetic; date-fns forced to enUS locale per the
date-fns-locale-leak feedback rule.
EOF
)"
```

---

## Task 6: Retrospective page route

**Files:**
- Create: `src/app/data/blocks/[mesocycleId]/retrospective/page.tsx`

- [ ] **Step 6.1: Write the page**

Create `src/app/data/blocks/[mesocycleId]/retrospective/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getBlockRetrospective } from '@/lib/actions/block-retrospective.actions'
import { BlockRetrospectiveHeader } from '@/components/blocks/BlockRetrospectiveHeader'
import { BlockHeadlineTiles } from '@/components/blocks/BlockHeadlineTiles'
import { AdherenceByWeekChart } from '@/components/blocks/AdherenceByWeekChart'
import { AdherenceByDomainTable } from '@/components/blocks/AdherenceByDomainTable'
import { RecalibrationTimeline } from '@/components/blocks/RecalibrationTimeline'
import { InterventionLog } from '@/components/blocks/InterventionLog'
import { MissedSessionsList } from '@/components/blocks/MissedSessionsList'

export default async function Page({ params }: { params: Promise<{ mesocycleId: string }> }) {
  const { mesocycleId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const result = await getBlockRetrospective(mesocycleId)
  if (!result.success || !result.data) notFound()
  const snapshot = result.data

  return (
    <div className="space-y-3 p-4 max-w-4xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" /> Back to dashboard
      </Link>
      <BlockRetrospectiveHeader block={snapshot.block} />
      <BlockHeadlineTiles snapshot={snapshot} />
      <AdherenceByWeekChart byWeek={snapshot.adherence.byWeek} />
      <AdherenceByDomainTable snapshot={snapshot} />
      <RecalibrationTimeline recalibrations={snapshot.recalibrations} />
      <InterventionLog interventions={snapshot.interventions} />
      <MissedSessionsList missedSessions={snapshot.missedSessions} />
    </div>
  )
}
```

- [ ] **Step 6.2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build, route appears in the build output.

- [ ] **Step 6.3: Commit**

```bash
git add src/app/data/blocks/
git commit -m "feat(routes): /data/blocks/[mesocycleId]/retrospective view"
```

---

## Task 7: Dashboard CTA, nudge banner, confirm modal

**Files:**
- Create: `src/components/dashboard/CloseBlockCta.tsx`
- Create: `src/components/dashboard/CloseBlockNudgeBanner.tsx`
- Create: `src/components/dashboard/CloseBlockConfirmModal.tsx`

- [ ] **Step 7.1: CloseBlockCta**

Create `src/components/dashboard/CloseBlockCta.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { CloseBlockConfirmModal } from './CloseBlockConfirmModal'

export function CloseBlockCta({ mesocycleId }: { mesocycleId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-neutral-700 hover:border-neutral-500 text-[11px] font-mono text-neutral-400 hover:text-neutral-200 uppercase tracking-wider transition-colors"
      >
        <CheckCircle2 className="w-3 h-3" />
        Close block
      </button>
      {open && (
        <CloseBlockConfirmModal
          mesocycleId={mesocycleId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 7.2: CloseBlockNudgeBanner**

Create `src/components/dashboard/CloseBlockNudgeBanner.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { differenceInDays } from 'date-fns'
import { AlertCircle } from 'lucide-react'
import { CloseBlockConfirmModal } from './CloseBlockConfirmModal'

export function CloseBlockNudgeBanner({
  mesocycleId, blockName, endDate,
}: {
  mesocycleId: string; blockName: string; endDate: string
}) {
  const [open, setOpen] = useState(false)
  const daysOver = differenceInDays(new Date(), new Date(endDate))

  return (
    <>
      <div className="border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-[12px] font-inter text-neutral-200 flex-1">
          <span className="font-bold">{blockName}</span>{' '}
          {daysOver > 0
            ? `wrapped ${daysOver} day${daysOver === 1 ? '' : 's'} ago.`
            : 'is ready to close.'} Ready to review?
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-mono uppercase tracking-wider transition-colors"
        >
          Close & review
        </button>
      </div>
      {open && (
        <CloseBlockConfirmModal
          mesocycleId={mesocycleId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 7.3: CloseBlockConfirmModal**

Create `src/components/dashboard/CloseBlockConfirmModal.tsx`:

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { closeMesocycle } from '@/lib/actions/block-retrospective.actions'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

// Server action wrapper that runs the snapshot build for preview only.
// Lives here as a client-side dynamic import to avoid pulling the assembler
// into the dashboard's initial JS bundle.
async function dryRunSnapshot(mesocycleId: string): Promise<BlockRetrospectiveSnapshot> {
  const { buildBlockRetrospectiveSnapshot } = await import('@/lib/analytics/block-retrospective')
  return buildBlockRetrospectiveSnapshot(mesocycleId)
}

export function CloseBlockConfirmModal({
  mesocycleId, onClose,
}: {
  mesocycleId: string; onClose: () => void
}) {
  const [snap, setSnap] = useState<BlockRetrospectiveSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    dryRunSnapshot(mesocycleId)
      .then(s => { if (!cancelled) setSnap(s) })
      .catch(e => { if (!cancelled) setError((e as Error).message) })
    return () => { cancelled = true }
  }, [mesocycleId])

  const handleConfirm = () => {
    startTransition(async () => {
      const r = await closeMesocycle(mesocycleId)
      if (!r.success) {
        setError(r.error)
        return
      }
      onClose()
      router.push(`/data/blocks/${mesocycleId}/retrospective`)
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog">
      <div className="bg-neutral-950 border border-neutral-800 max-w-md w-full p-4 m-4">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-base font-space-grotesk font-bold text-white">
            Close {snap?.block.name ?? 'block'}
          </h2>
          <button
            type="button" onClick={onClose}
            className="text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <p className="text-[12px] font-inter text-amber-400 mb-3 border border-amber-500/30 bg-amber-500/5 p-2">
            {error}
          </p>
        )}

        {!snap && !error && (
          <div className="flex items-center gap-2 text-neutral-500 text-[12px] font-inter">
            <Loader2 className="w-3 h-3 animate-spin" /> Building preview…
          </div>
        )}

        {snap && (
          <>
            <dl className="text-[12px] font-inter text-neutral-300 space-y-1.5 mb-3 border border-neutral-800 p-2">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Prescribed</dt>
                <dd className="font-mono">{snap.adherence.overall.prescribed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Completed</dt>
                <dd className="font-mono">
                  {snap.adherence.overall.completed} ({snap.adherence.overall.pct}%)
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Pending → missed</dt>
                <dd className="font-mono text-amber-400">
                  {snap.adherence.overall.missed}
                </dd>
              </div>
              <div className="flex justify-between border-t border-neutral-800 pt-1.5">
                <dt className="text-neutral-500">Recalibrations</dt>
                <dd className="font-mono">{snap.recalibrations.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Interventions</dt>
                <dd className="font-mono">{snap.interventions.length}</dd>
              </div>
            </dl>
            <p className="text-[11px] font-inter text-neutral-500 mb-3">
              Pending sessions will be marked missed and cannot be resumed.
            </p>
          </>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button" onClick={onClose}
            disabled={pending}
            className="px-3 py-1.5 border border-neutral-700 hover:border-neutral-500 text-[11px] font-mono text-neutral-400 uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            type="button" onClick={handleConfirm}
            disabled={pending || !snap || !!error}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-[11px] font-mono uppercase tracking-wider transition-colors"
          >
            {pending && <Loader2 className="w-3 h-3 animate-spin" />}
            Close & generate retrospective
          </button>
        </div>
      </div>
    </div>
  )
}
```

> **Note about dryRunSnapshot:** `buildBlockRetrospectiveSnapshot` lives in a server-only path (uses `@/lib/supabase/server`). The dynamic import in a client component will fail at runtime. The cleanest fix is to add a thin server action `previewRetrospective(mesocycleId)` that returns the snapshot for preview. See Step 7.4.

- [ ] **Step 7.4: Add `previewRetrospective` server action**

The modal needs a server action to fetch the dry-run snapshot. Add to `src/lib/actions/block-retrospective.actions.ts` (after `getBlockRetrospective`):

```ts
/** Preview the snapshot WITHOUT closing — used by the pre-close confirm modal. */
export async function previewRetrospective(
  mesocycleId: string,
): Promise<ActionResult<BlockRetrospectiveSnapshot>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Verify ownership before running the assembler.
  const { data: meso } = await supabase
    .from('mesocycles').select('id').eq('id', mesocycleId).eq('user_id', user.id).maybeSingle()
  if (!meso) return { success: false, error: 'Block not found' }

  try {
    const snap = await buildBlockRetrospectiveSnapshot(mesocycleId)
    return { success: true, data: snap }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

Update `CloseBlockConfirmModal.tsx` — replace the `dryRunSnapshot` helper with a call to the new action:

```tsx
// REPLACE the dryRunSnapshot import + function with:
import { closeMesocycle, previewRetrospective } from '@/lib/actions/block-retrospective.actions'

// REPLACE the useEffect body:
useEffect(() => {
  let cancelled = false
  previewRetrospective(mesocycleId).then(r => {
    if (cancelled) return
    if (r.success) setSnap(r.data)
    else setError(r.error)
  })
  return () => { cancelled = true }
}, [mesocycleId])
```

- [ ] **Step 7.5: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 7.6: Add a quick test for previewRetrospective**

Add to `src/lib/actions/__tests__/block-retrospective.actions.test.ts` inside the existing `describe('block-retrospective actions', …)` block (above the closing `})`):

```ts
  describe('previewRetrospective', () => {
    it('returns the snapshot when mesocycle exists', async () => {
      state.mesocycle = { id: 'm1', user_id: 'u1', is_active: true, is_complete: false }
      const r = await previewRetrospective('m1')
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.schemaVersion).toBe(1)
    })

    it('rejects when mesocycle not found', async () => {
      state.mesocycle = null
      const r = await previewRetrospective('nope')
      expect(r.success).toBe(false)
    })
  })
```

Also add `previewRetrospective` to the import line at the top of the test file:

```ts
import {
  closeMesocycle,
  getLatestBlockRetrospective,
  getBlockRetrospective,
  previewRetrospective,
} from '../block-retrospective.actions'
```

Run tests:

```bash
npm test -- --run src/lib/actions/__tests__/block-retrospective.actions.test.ts 2>&1 | tail -10
```

Expected: 9 passed.

- [ ] **Step 7.7: Commit**

```bash
git add src/components/dashboard/CloseBlockCta.tsx \
        src/components/dashboard/CloseBlockNudgeBanner.tsx \
        src/components/dashboard/CloseBlockConfirmModal.tsx \
        src/lib/actions/block-retrospective.actions.ts \
        src/lib/actions/__tests__/block-retrospective.actions.test.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): close-block CTA, nudge banner, confirm modal

CloseBlockCta is a quiet header button always-available once the block
has any completed sessions. CloseBlockNudgeBanner appears when end_date
has passed. CloseBlockConfirmModal previews the snapshot via a new
previewRetrospective server action (dry-run, no DB writes), confirms with
the user, then calls closeMesocycle and redirects to the retrospective.
EOF
)"
```

---

## Task 8: Dashboard empty state + page branching

**Files:**
- Create: `src/components/dashboard/DashboardNoActiveBlockEmpty.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 8.1: DashboardNoActiveBlockEmpty**

Create `src/components/dashboard/DashboardNoActiveBlockEmpty.tsx`:

```tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getLatestBlockRetrospective } from '@/lib/actions/block-retrospective.actions'

export async function DashboardNoActiveBlockEmpty() {
  const result = await getLatestBlockRetrospective()
  const lastBlock = result.success ? result.data : null

  return (
    <div className="max-w-md mx-auto mt-12 space-y-3 text-center">
      <h2 className="text-lg font-space-grotesk font-bold text-white">
        No active block
      </h2>
      {lastBlock ? (
        <p className="text-[12px] font-inter text-neutral-400">
          {lastBlock.block.name} closed —{' '}
          {lastBlock.adherence.overall.completed}/{lastBlock.adherence.overall.prescribed} sessions
          ({lastBlock.adherence.overall.pct}%).
        </p>
      ) : (
        <p className="text-[12px] font-inter text-neutral-400">
          You haven't closed any blocks yet.
        </p>
      )}

      <div className="flex flex-col gap-2 mt-4">
        {lastBlock && (
          <Link
            href={`/data/blocks/${lastBlock.block.id}/retrospective`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-neutral-700 hover:border-neutral-500 text-[12px] font-mono text-neutral-300 hover:text-white uppercase tracking-wider transition-colors"
          >
            Review last block
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
        <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider mt-1">
          Block 2 wizard ships next
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 8.2: Modify `src/app/dashboard/page.tsx` to branch on active mesocycle**

Read the current file first to know exact insertion points:

```bash
cat src/app/dashboard/page.tsx
```

Then update the early-return / render logic. The exact diff depends on what `getDashboardData()` returns when there's no active mesocycle. From the existing code (lines 14-22), `result.success === false` is treated as a sync failure — but we want a *successful* "no active block" state.

The path of least disruption: check `data.currentMesocycle` after the success branch and route to the empty state if null. Insert near the top of the JSX render block (after `const { data } = result`):

```tsx
import { DashboardNoActiveBlockEmpty } from '@/components/dashboard/DashboardNoActiveBlockEmpty'
import { CloseBlockCta } from '@/components/dashboard/CloseBlockCta'
import { CloseBlockNudgeBanner } from '@/components/dashboard/CloseBlockNudgeBanner'

// ... existing imports + early returns ...

  const { data } = result

  // No active block — empty state with link to last retrospective
  if (!data.currentMesocycle) {
    return <DashboardNoActiveBlockEmpty />
  }

  // Compute nudge condition (end_date passed OR all sessions resolved)
  const today = new Date()
  const endPassed = data.currentMesocycle.end_date != null
    && new Date(data.currentMesocycle.end_date) < today
  const allResolved = data.allSessionsResolved === true  // NEW field; see Step 8.3
  const showNudge = endPassed || allResolved
  const hasAnyCompleted = (data.completedSessionCount ?? 0) > 0  // NEW field; see Step 8.3
```

Then in the existing JSX, find the spot after the personalized greeting and before the existing dashboard layout. Insert the banner conditionally:

```tsx
{showNudge && data.currentMesocycle.end_date && (
  <CloseBlockNudgeBanner
    mesocycleId={data.currentMesocycle.id}
    blockName={data.currentMesocycle.name}
    endDate={data.currentMesocycle.end_date}
  />
)}
```

And add the quiet CTA next to the mesocycle name in the header area:

```tsx
{hasAnyCompleted && (
  <CloseBlockCta mesocycleId={data.currentMesocycle.id} />
)}
```

- [ ] **Step 8.3: Extend `getDashboardData()` to return the missing fields**

The page-level branch needs `completedSessionCount` and `allSessionsResolved`. (`currentMesocycle.end_date` is already returned — `getDashboardData` does `mesocycles.select('*')` at line 442 and `mesocycles.end_date` is a real column.)

Insert a parallel-counts block in `src/lib/actions/workout.actions.ts:getDashboardData`. Locate the existing `if (currentMesocycle) { ... }` block that runs after `currentMesocycle` is fetched (around lines 452-503 — the block that resolves `currentWeek`). Immediately AFTER that block ends and BEFORE the next `if (currentMesocycle)` block (around line 528), insert:

```ts
    // Counts driving the close-block CTA + nudge banner conditions.
    let completedSessionCount = 0
    let allSessionsResolved = false
    if (currentMesocycle) {
        const [{ count: completed }, { count: pendingActive }] = await Promise.all([
            supabase.from('session_inventory')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('mesocycle_id', currentMesocycle.id)
                .eq('status', 'completed'),
            supabase.from('session_inventory')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('mesocycle_id', currentMesocycle.id)
                .in('status', ['pending', 'active']),
        ])
        completedSessionCount = completed ?? 0
        allSessionsResolved = (pendingActive ?? 0) === 0
    }
```

Then in the return-object literal at line 660 (`data: { currentMesocycle: ..., currentWeek: ..., ... }`), append two new fields after the existing ones:

```ts
            // ... existing fields stay as-is ...
            completedSessionCount,
            allSessionsResolved,
        },
    }
```

Find the `DashboardData` type definition (look near the top of `workout.actions.ts` or in `@/lib/types/training.types`) and add the two new fields. If `DashboardData` is defined in `training.types.ts`:

```ts
export type DashboardData = {
    // ... existing fields ...
    completedSessionCount: number
    allSessionsResolved: boolean
}
```

If it's an inferred type (no explicit `DashboardData` export), the inferred return type widens automatically — no extra step.

- [ ] **Step 8.4: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build. Type errors here usually mean the `Dashboard.data` type definitions need to widen to include the new fields — fix at the type definition site.

- [ ] **Step 8.5: Commit**

```bash
git add src/components/dashboard/DashboardNoActiveBlockEmpty.tsx \
        src/app/dashboard/page.tsx \
        src/lib/actions/workout.actions.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): empty state + close-block trigger surfaces

Branch dashboard render on getActiveMesocycle: when null, render
DashboardNoActiveBlockEmpty with a "Review last block" link from
getLatestBlockRetrospective. When active, render CloseBlockCta in the
header (always reachable once any session is completed) and
CloseBlockNudgeBanner above the week view when end_date has passed
or all sessions are resolved.

Extended getDashboardData with completedSessionCount, allSessionsResolved,
and end_date on currentMesocycle to support the new conditions.
EOF
)"
```

---

## Task 9: Playwright spec (committed, not runnable)

**Files:**
- Create: `tests/e2e/block-retrospective.spec.ts`

- [ ] **Step 9.1: Write the spec**

Create `tests/e2e/block-retrospective.spec.ts`:

```ts
// Block retrospective E2E spec.
// COMMITTED BUT NOT RUNNABLE: Playwright infrastructure is not configured
// in this repo. Spec lives here so it runs once @playwright/test +
// playwright.config.ts land. Same convention as Plan 2 / Plan 3.

import { test, expect } from '@playwright/test'

test.describe('Block retrospective close-out flow', () => {
  test.beforeEach(async ({ page }) => {
    // Auth fixture would log in as test user here.
    await page.goto('/dashboard')
  })

  test('close button appears once any session completed', async ({ page }) => {
    await expect(page.getByRole('button', { name: /close block/i })).toBeVisible()
  })

  test('nudge banner appears when end_date has passed', async ({ page }) => {
    // Pre-condition: test fixture seeded an active block past its end_date.
    await expect(page.getByText(/wrapped \d+ days? ago/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /close & review/i })).toBeVisible()
  })

  test('confirm modal previews snapshot, then closes block', async ({ page }) => {
    await page.getByRole('button', { name: /close & review/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await expect(modal.getByText(/prescribed/i)).toBeVisible()
    await expect(modal.getByText(/completed/i)).toBeVisible()
    await modal.getByRole('button', { name: /close & generate retrospective/i }).click()
    await page.waitForURL(/\/data\/blocks\/.+\/retrospective$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('dashboard shows empty state with "Review last block" after close', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/no active block/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /review last block/i })).toBeVisible()
  })
})
```

- [ ] **Step 9.2: Commit**

```bash
git add tests/e2e/block-retrospective.spec.ts
git commit -m "test(e2e): block retrospective close-out spec (not runnable, no playwright infra)"
```

---

## Task 10: Real-data verification gate

**Files:** none (this task is operational, not code).

- [ ] **Step 10.1: Push branch and review**

```bash
git push -u origin feat/block-retrospective
```

Open the branch in GitHub. Skim diffs for sanity.

- [ ] **Step 10.2: Run the full test suite**

```bash
npm test 2>&1 | tail -20
```

Expected: all existing 265 tests still passing, plus the new block-retrospective tests. Total around 280+.

- [ ] **Step 10.3: Run a build**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build, all routes generated.

- [ ] **Step 10.4: Start dev server, click through the flow with real data**

```bash
npm run dev
```

Then in a browser at `http://localhost:3001/dashboard`:

1. Confirm the nudge banner appears ("HYBRID_PEAKING Block 1 wrapped 3 days ago. Ready to review?").
2. Click "Close & review."
3. Confirm modal previews: 21 / 51 / 41% adherence, 4 recalibrations, N interventions.
4. Click "Close & generate retrospective."
5. Land on `/data/blocks/50ccb2aa-61e8-470c-8404-966064c31cef/retrospective`.
6. Confirm headline tiles read 21/51 (41%), 4 recalibrations, intervention count.
7. Confirm by-week chart shows 6 weeks of bars with completed/missed split.
8. Confirm by-domain table shows all 6 coach domains (some may be 0/0 — that's correct).
9. Confirm recalibration timeline shows the 4 known recalibrations (Bench 75→72, OHP 52→49.5, Deadlift, Row).
10. Take a screenshot of the retrospective page; save as `docs/superpowers/specs/2026-05-05-block-retrospective-screenshot.png`.
11. Navigate to `/dashboard` — confirm the empty state shows with "Review last block" link.
12. Click "Review last block" — confirm it returns you to the retrospective page.

If any step fails, revert the bad task's commit, fix it, retry. Do not move on with broken behavior.

- [ ] **Step 10.5: Verify against the live DB**

Use the Supabase MCP `execute_sql` tool:

```sql
SELECT id, mesocycle_id, generated_at, snapshot -> 'adherence' -> 'overall' AS adherence
FROM block_retrospectives
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'incubatepro@gmail.com');

SELECT id, name, is_active, is_complete, completed_at FROM mesocycles
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'incubatepro@gmail.com')
ORDER BY start_date DESC LIMIT 3;

SELECT count(*) FILTER (WHERE status='missed') AS missed,
       count(*) FILTER (WHERE status='completed') AS completed
FROM session_inventory
WHERE mesocycle_id = '50ccb2aa-61e8-470c-8404-966064c31cef';

SELECT id, decision_type, target_entity, reasoning_text, created_at FROM agent_activity
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'incubatepro@gmail.com')
  AND decision_type = 'block_close'
ORDER BY created_at DESC LIMIT 1;

SELECT * FROM block_pointer
WHERE mesocycle_id = '50ccb2aa-61e8-470c-8404-966064c31cef';
```

Expected:
- One block_retrospectives row with adherence ≈ 41%.
- mesocycles: Block 1 has `is_active=false, is_complete=true, completed_at` set.
- session_inventory: 21 completed, 30 missed, 0 pending.
- agent_activity: one `block_close` row referencing the new retrospective.
- block_pointer: zero rows for Block 1's mesocycle_id.

- [ ] **Step 10.6: Add the screenshot to git and commit the verification artifact**

```bash
git add docs/superpowers/specs/2026-05-05-block-retrospective-screenshot.png
git commit -m "docs: add screenshot of Block 1 retrospective (verification gate)"
git push
```

- [ ] **Step 10.7: Open PR**

```bash
gh pr create --title "feat: block retrospective (sub-project A of Block N→N+1 transition)" --body "$(cat <<'EOF'
## Summary

- New `block_retrospectives` table + atomic `close_mesocycle` RPC (migration 018).
- One-shot data heal of pre-Phase 2 inventory drift on Block 1 (migration 019).
- `buildBlockRetrospectiveSnapshot()` pure assembler — adherence, execution quality, recalibrations, interventions, missed-session list.
- `closeMesocycle` server action + `getLatestBlockRetrospective` / `getBlockRetrospective` / `previewRetrospective` read APIs.
- 7-section retrospective view at `/data/blocks/[mesocycleId]/retrospective`.
- Dashboard close-block CTA + nudge banner + pre-close confirm modal.
- Dashboard empty state for the no-active-block period between this PR and sub-project D.

Spec: `docs/superpowers/specs/2026-05-05-block-retrospective-design.md`

Closes sub-project A of the Block N → N+1 transition framework. Sub-projects B/C/D ship separately.

## Test plan

- [x] vitest suite green (snapshot assembler 6 scenarios + actions 9 scenarios)
- [x] `next build` clean
- [x] Migrations 018 + 019 applied to live Supabase
- [x] Closed Block 1 against live data via the dashboard CTA
- [x] Retrospective screenshot attached to spec dir
- [x] Live DB verified: block_retrospectives row, mesocycle is_complete=true, inventory 21/30/0, agent_activity block_close logged, block_pointer cleared
- [ ] Playwright spec committed at `tests/e2e/block-retrospective.spec.ts` (not runnable until infra lands)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist (run before handing off)

After writing this plan, the author should confirm:

- [x] Every spec section maps to a task: data model → T1 + T2; close-out flow → T3 + T4; retrospective view → T5 + T6; dashboard surfaces → T7 + T8; testing → tests within T3 + T4 + T7; e2e → T9; real-data gate → T10.
- [x] No placeholder text. All code blocks are complete and self-contained.
- [x] Type / function names match across tasks: `BlockRetrospectiveSnapshot`, `buildBlockRetrospectiveSnapshot`, `closeMesocycle`, `getBlockRetrospective`, `getLatestBlockRetrospective`, `previewRetrospective` are consistent everywhere they appear.
- [x] Migration numbers (018, 019) match the spec.
- [x] Test patterns mirror existing repo conventions (`vi.hoisted` + `vi.mock('@/lib/supabase/server', …)`).
- [x] No source-bug-fix task for `completeWorkout` — Phase 2 already shipped it.
- [x] No component snapshot test tasks — vitest config doesn't pick them up.
- [x] Real-data verification is the closing gate, not just a passing test suite.
