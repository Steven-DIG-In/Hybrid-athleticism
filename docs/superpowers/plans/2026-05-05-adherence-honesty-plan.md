# Adherence Honesty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship sub-project B — a feedback loop that keeps athlete availability and time-budget assumptions honest, via boundary prompts (block close + Block 2 wizard) and a mid-block overrun signal, all writing to a single carryover store consumed by sub-project D's planner.

**Architecture:** One nullable JSONB column on `profiles` (`pending_planner_notes`) holds at most one entry per athlete. Three prompt surfaces (post-close page, Block 2 wizard step, mid-block signal modal) all share a single `RealityCheckForm` component and write through `submitRealityCheck` / `dismissOverrunSignal` server actions. Mid-block signal is a pure read-only function called on dashboard render — no cron, no triggers. Suppression via presence of pending notes; notes consumed-and-cleared by sub-project D.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase (Postgres 17 + RLS), Vitest 4, Tailwind 4, lucide-react.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-05-adherence-honesty-design.md`
- Sub-project A spec/plan (ships first): `docs/superpowers/specs/2026-05-05-block-retrospective-design.md`, `docs/superpowers/plans/2026-05-05-block-retrospective-plan.md`
- Test patterns: `src/lib/actions/__tests__/log-off-plan.test.ts`, `src/lib/analytics/__tests__/block-retrospective.test.ts` (just shipped in A — use as reference)
- Type regen procedure: `~/.claude/memory/feedback/supabase-type-regen-clobbers-aliases.md`

**Out of scope reminders:**
- Sub-project D's planner integration (consumption side) — B exposes the API; D wires it.
- Mid-block dashboard banner *visual* verification — needs an active block, deferred to D.
- Coach roster / config / signal-weight tuning — explicitly rejected after the brainstorm reframe.
- Strength microcycle variation audit — parked as candidate sub-project E.

**Branch:** Continue on `feat/block-retrospective` (same branch as sub-project A — simpler than splitting; merge strategy decided at PR time).

---

## File map

### Create

| Path | Responsibility |
|---|---|
| `supabase/migrations/020_pending_planner_notes.sql` | ALTER TABLE profiles, add nullable JSONB column |
| `src/lib/types/pending-planner-notes.types.ts` | `PendingPlannerNotes` + subtypes |
| `src/lib/analytics/overrun-signal.ts` | `evaluateOverrunSignal()` pure function |
| `src/lib/analytics/__tests__/overrun-signal.test.ts` | 6 fixture-driven threshold scenarios |
| `src/lib/actions/pending-notes.actions.ts` | `submitRealityCheck`, `dismissOverrunSignal`, `getPendingPlannerNotes`, `clearPendingPlannerNotes` |
| `src/lib/actions/__tests__/pending-notes.actions.test.ts` | Action tests (merge, dismiss, get, clear) |
| `src/components/reality-check/RealityCheckForm.tsx` | Shared 5-question form, client component |
| `src/components/reality-check/OverrunSignalBanner.tsx` | Dashboard banner with Dismiss/Update CTAs |
| `src/components/reality-check/OverrunSignalModal.tsx` | Modal wrapper around RealityCheckForm |
| `src/app/data/blocks/[mesocycleId]/reality-check/page.tsx` | Post-close standalone page |
| `tests/e2e/reality-check.spec.ts` | Playwright spec (committed, not runnable) |

### Modify

| Path | Change |
|---|---|
| `src/lib/types/database.types.ts` | Regenerate after migration 020; re-append alias appendix |
| `src/components/dashboard/CloseBlockConfirmModal.tsx` | Change redirect target from `/retrospective` to `/reality-check` (the reality-check page itself redirects forward to retrospective) |
| `src/app/dashboard/page.tsx` | Wire `evaluateOverrunSignal()` and render `OverrunSignalBanner` between greeting and `WeekViewClient` |

### Skip (deliberately)

- Component snapshot tests. `vitest.config.ts` includes only `.test.ts` (not `.test.tsx`) and runs in `node` env. Same constraint as sub-project A.

---

## Task 1: Migration 020 + type regen

**Files:**
- Create: `supabase/migrations/020_pending_planner_notes.sql`
- Modify: `src/lib/types/database.types.ts`

- [ ] **Step 1.1: Snapshot the type alias appendix BEFORE regen**

```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
grep -n "AICoachIntervention — hand-written" src/lib/types/database.types.ts
# Use the line number found; tail from a few lines before to capture the JSDoc above the interface.
# Sub-project A's appendix is 139 lines starting at line 3210ish. Use whatever the grep returns.
tail -n +<line_from_grep_minus_2> src/lib/types/database.types.ts > /tmp/db-types-aliases-b.snapshot.ts
wc -l /tmp/db-types-aliases-b.snapshot.ts
```

Expected: ~141 lines (139 from sub-project A's appendix + the 2-line `BlockRetrospective` aliases added in T1 of A).

- [ ] **Step 1.2: Write migration 020**

Create `supabase/migrations/020_pending_planner_notes.sql`:

```sql
-- Adherence honesty carryover store. Single-entry, consumed-and-cleared by
-- generateMesocyclePlan in sub-project D. Source-tagged by where the entry
-- was captured: block close-out, Block 2 wizard, or mid-block overrun signal.

ALTER TABLE public.profiles
  ADD COLUMN pending_planner_notes jsonb;

COMMENT ON COLUMN public.profiles.pending_planner_notes IS
  'Carryover from sub-project B (Adherence Honesty). One pending entry per
   athlete, merged on subsequent writes. Read + cleared by sub-project D
   planner. Shape: PendingPlannerNotes type in
   src/lib/types/pending-planner-notes.types.ts';
```

No RLS changes needed (`profiles` already has owner-only RLS, inherited by the new column). No backfill (NULL is the expected starting state for all rows).

- [ ] **Step 1.3: Apply migration via Supabase MCP**

Use the Supabase MCP `apply_migration` tool against project `kuqgtholljrxnbxtmrnz`. Migration name: `020_pending_planner_notes`. After apply, run `list_migrations` to confirm.

Verify via MCP `execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles' AND column_name='pending_planner_notes';
```

Expected: `pending_planner_notes | jsonb | YES`.

- [ ] **Step 1.4: Regenerate types and re-append aliases**

Use Supabase MCP `generate_typescript_types` for project `kuqgtholljrxnbxtmrnz`. Save the output to `src/lib/types/database.types.ts` (overwriting). Then append the snapshot:

```bash
cat /tmp/db-types-aliases-b.snapshot.ts >> src/lib/types/database.types.ts
```

Verify the regenerated `Profile` type now includes `pending_planner_notes: Json | null` (or similar, based on Supabase's JSONB type generation).

- [ ] **Step 1.5: Verify type-check is clean**

```bash
npx tsc --noEmit 2>&1 | grep -v "Cannot find module '@react-pdf\|Cannot find module 'garmin-connect\|Cannot find module '@playwright" | grep -v "data-overview.spec\|doctor-report.spec\|workout-start-rebind\|.next/dev/types/validator" | tail -10
```

Expected: no NEW errors. Pre-existing errors filtered out.

- [ ] **Step 1.6: Commit**

```bash
git add supabase/migrations/020_pending_planner_notes.sql src/lib/types/database.types.ts
git -c commit.gpgsign=false commit -m "$(cat <<'EOF'
feat(db): add profiles.pending_planner_notes for adherence honesty carryover

Single nullable JSONB column on profiles holds at most one PendingPlannerNotes
entry per athlete. Written by sub-project B (boundary prompts + mid-block
signal), read + cleared by sub-project D's planner. Owner-only RLS inherited
from profiles. No backfill (NULL is expected starting state).

Regenerated types; re-appended the alias appendix.
EOF
)"
```

---

## Task 2: PendingPlannerNotes type definitions

**Files:**
- Create: `src/lib/types/pending-planner-notes.types.ts`

- [ ] **Step 2.1: Write the type module**

Create `src/lib/types/pending-planner-notes.types.ts`:

```ts
export type PendingPlannerNoteSource =
  | 'block_close'
  | 'block_start_wizard'
  | 'mid_block_signal'

export type AvailabilityAnswers = {
  daysPerWeek: number
  sessionMinutes: number
  warmupMinutes: number   // 0 means skipped
  cooldownMinutes: number // 0 means none
}

export type SignalEvidence = {
  overrunSessions: Array<{
    workoutId: string
    estimatedMinutes: number
    actualMinutes: number
  }>
  avgOverrunMinutes: number
  avgOverrunPct: number
  sessionsConsidered: number
}

export type PendingPlannerNotes = {
  schemaVersion: 1
  source: PendingPlannerNoteSource
  capturedAt: string  // ISO timestamp
  availability?: AvailabilityAnswers
  freeText?: string  // max 200 chars, sanitized
  signalEvidence?: SignalEvidence
  dismissedWithoutAnswer?: boolean  // only when source='mid_block_signal' + dismiss
}

/** Deep-merges `next` into `prev` per the spec's merge rule.
 *  - schemaVersion / source / capturedAt: overwritten by `next`
 *  - availability: deep-merged (next keys override; prev keys preserved)
 *  - freeText: appended with \n separator, truncated to 200 chars
 *  - signalEvidence: overwritten by `next`
 *  - dismissedWithoutAnswer: overwritten by `next` (next answer-bearing write clears the flag)
 */
export function mergePendingPlannerNotes(
  prev: PendingPlannerNotes | null,
  next: PendingPlannerNotes,
): PendingPlannerNotes {
  if (!prev) return next

  const availability: AvailabilityAnswers | undefined =
    prev.availability || next.availability
      ? { ...(prev.availability ?? {}), ...(next.availability ?? {}) } as AvailabilityAnswers
      : undefined

  let freeText: string | undefined
  if (prev.freeText && next.freeText) {
    freeText = `${prev.freeText}\n${next.freeText}`.slice(0, 200)
  } else {
    freeText = next.freeText ?? prev.freeText
  }

  return {
    schemaVersion: 1,
    source: next.source,
    capturedAt: next.capturedAt,
    ...(availability ? { availability } : {}),
    ...(freeText ? { freeText } : {}),
    ...(next.signalEvidence ? { signalEvidence: next.signalEvidence } : {}),
    ...(next.dismissedWithoutAnswer != null
      ? { dismissedWithoutAnswer: next.dismissedWithoutAnswer }
      : {}),
  }
}
```

- [ ] **Step 2.2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "pending-planner-notes" | head
```

Expected: no output (clean compile for the new file).

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/types/pending-planner-notes.types.ts
git -c commit.gpgsign=false commit -m "feat(types): pending planner notes + merge helper"
```

---

## Task 3: `evaluateOverrunSignal` — TDD with 6 scenarios

**Files:**
- Create: `src/lib/analytics/overrun-signal.ts`
- Create: `src/lib/analytics/__tests__/overrun-signal.test.ts`

- [ ] **Step 3.1: Write the test file with all 6 scenarios**

Create `src/lib/analytics/__tests__/overrun-signal.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { fixtures } = vi.hoisted(() => ({
  fixtures: {
    activeMesocycle: null as any,
    profile: { id: 'u1', pending_planner_notes: null } as any,
    workouts: [] as any[],
    inventory: [] as any[],
  },
}))

vi.mock('@/lib/supabase/server', () => {
  const handler = (table: string) => {
    if (table === 'mesocycles') {
      return makeQuery(() => fixtures.activeMesocycle ? [fixtures.activeMesocycle] : [])
    }
    if (table === 'profiles') {
      return makeQuery(() => fixtures.profile ? [fixtures.profile] : [])
    }
    if (table === 'workouts') {
      return makeQuery(() => fixtures.workouts)
    }
    if (table === 'session_inventory') {
      return makeQuery(() => fixtures.inventory)
    }
    return makeQuery(() => [])
  }
  const client = {
    from: vi.fn(handler),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  }
  return { createClient: vi.fn(async () => client) }
})

function makeQuery(getRows: () => any[]) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    not: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: getRows()[0] ?? null, error: null })),
    single: vi.fn(async () => ({ data: getRows()[0] ?? null, error: null })),
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: getRows(), error: null }).then(resolve, reject),
  }
  return chain
}

import { evaluateOverrunSignal } from '../overrun-signal'

const USER = 'u1'

function resetFixtures() {
  fixtures.activeMesocycle = null
  fixtures.profile = { id: USER, pending_planner_notes: null }
  fixtures.workouts = []
  fixtures.inventory = []
}

function seedActive() {
  fixtures.activeMesocycle = { id: 'meso-1', user_id: USER, is_active: true, is_complete: false }
}

/** Adds an inventory row + matching workout pair with the given estimated/actual minutes. */
function seedSession(workoutId: string, estimated: number, actual: number) {
  const invId = `inv-${workoutId}`
  fixtures.inventory.push({
    id: invId, mesocycle_id: 'meso-1', user_id: USER,
    estimated_duration_minutes: estimated,
  })
  fixtures.workouts.push({
    id: workoutId, user_id: USER, session_inventory_id: invId,
    actual_duration_minutes: actual,
    completed_at: '2026-05-04T10:00:00Z',
  })
}

describe('evaluateOverrunSignal', () => {
  beforeEach(() => {
    resetFixtures()
    vi.clearAllMocks()
  })

  it('1: 3 sessions all under-budget → shouldFire false', async () => {
    seedActive()
    seedSession('w1', 60, 55)
    seedSession('w2', 60, 50)
    seedSession('w3', 60, 58)

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(false)
  })

  it('2: 3 sessions averaging +25%, +18 min → shouldFire true', async () => {
    seedActive()
    seedSession('w1', 60, 78)  // +30%, +18
    seedSession('w2', 60, 75)  // +25%, +15
    seedSession('w3', 60, 81)  // +35%, +21

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(true)
    expect(r.evidence.sessionsConsidered).toBe(3)
    expect(r.evidence.avgOverrunMinutes).toBeGreaterThanOrEqual(8)
    expect(r.evidence.avgOverrunPct).toBeGreaterThanOrEqual(20)
  })

  it('3: percentage above threshold but absolute below floor → shouldFire false', async () => {
    seedActive()
    // 15-min mobility flows running 20 min: 33% over, +5 min absolute (below 8 min floor)
    seedSession('w1', 15, 20)
    seedSession('w2', 15, 20)
    seedSession('w3', 15, 20)

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(false)
  })

  it('4: absolute above floor but percentage below threshold → shouldFire false', async () => {
    seedActive()
    // 60-min sessions running 70 min: 17% over, +10 min absolute
    seedSession('w1', 60, 70)
    seedSession('w2', 60, 70)
    seedSession('w3', 60, 70)

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(false)
  })

  it('5: signal suppressed when pending_planner_notes is non-null', async () => {
    seedActive()
    seedSession('w1', 60, 78)
    seedSession('w2', 60, 75)
    seedSession('w3', 60, 81)
    fixtures.profile = {
      id: USER,
      pending_planner_notes: { schemaVersion: 1, source: 'block_close', capturedAt: '2026-05-01T00:00:00Z' },
    }

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(false)
  })

  it('6: no active mesocycle → shouldFire false', async () => {
    // no seedActive()
    seedSession('w1', 60, 78)
    seedSession('w2', 60, 75)
    seedSession('w3', 60, 81)

    const r = await evaluateOverrunSignal(USER)
    expect(r.shouldFire).toBe(false)
  })
})
```

- [ ] **Step 3.2: Run tests — verify all 6 fail with module-not-found**

```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
npm test -- --run src/lib/analytics/__tests__/overrun-signal.test.ts 2>&1 | tail -10
```

Expected: 6 failures citing missing `overrun-signal` module.

- [ ] **Step 3.3: Implement `evaluateOverrunSignal`**

Create `src/lib/analytics/overrun-signal.ts`:

```ts
import { createClient } from '@/lib/supabase/server'

export type OverrunSignalEvidence = {
  overrunSessions: Array<{
    workoutId: string
    estimatedMinutes: number
    actualMinutes: number
  }>
  avgOverrunMinutes: number
  avgOverrunPct: number
  sessionsConsidered: number
}

export type OverrunSignal = {
  shouldFire: boolean
  evidence: OverrunSignalEvidence
}

const SESSIONS_WINDOW = 3
const OVERRUN_PCT_THRESHOLD = 20
const OVERRUN_MIN_FLOOR = 8

const EMPTY_EVIDENCE: OverrunSignalEvidence = {
  overrunSessions: [],
  avgOverrunMinutes: 0,
  avgOverrunPct: 0,
  sessionsConsidered: 0,
}

/** Pure read-only signal evaluator. Returns whether the mid-block overrun
 *  banner should fire for the given user, plus the evidence backing it.
 *  Called on dashboard render. */
export async function evaluateOverrunSignal(userId: string): Promise<OverrunSignal> {
  const supabase = await createClient()

  // 1. Active mesocycle check
  const { data: activeMeso } = await supabase
    .from('mesocycles')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (!activeMeso) {
    return { shouldFire: false, evidence: EMPTY_EVIDENCE }
  }

  // 2. Suppression check — pending_planner_notes presence
  const { data: profile } = await supabase
    .from('profiles')
    .select('pending_planner_notes')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.pending_planner_notes != null) {
    return { shouldFire: false, evidence: EMPTY_EVIDENCE }
  }

  // 3. Fetch last N completed workouts
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, session_inventory_id, actual_duration_minutes, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .not('actual_duration_minutes', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(SESSIONS_WINDOW)

  const recentWorkouts = workouts ?? []
  if (recentWorkouts.length < SESSIONS_WINDOW) {
    return { shouldFire: false, evidence: EMPTY_EVIDENCE }
  }

  // 4. Pull matching inventory rows
  const inventoryIds = recentWorkouts
    .map((w: any) => w.session_inventory_id)
    .filter((id: string | null): id is string => id != null)
  if (inventoryIds.length < SESSIONS_WINDOW) {
    return { shouldFire: false, evidence: EMPTY_EVIDENCE }
  }
  const { data: inventory } = await supabase
    .from('session_inventory')
    .select('id, estimated_duration_minutes')
    .in('id', inventoryIds)
  const invById = new Map<string, any>()
  for (const inv of inventory ?? []) {
    invById.set(inv.id, inv)
  }

  // 5. Build per-session evidence (only sessions with both estimated + actual)
  const overrunSessions: OverrunSignalEvidence['overrunSessions'] = []
  for (const w of recentWorkouts) {
    const inv = invById.get(w.session_inventory_id)
    if (!inv?.estimated_duration_minutes || !w.actual_duration_minutes) continue
    overrunSessions.push({
      workoutId: w.id,
      estimatedMinutes: inv.estimated_duration_minutes,
      actualMinutes: w.actual_duration_minutes,
    })
  }
  if (overrunSessions.length < SESSIONS_WINDOW) {
    return { shouldFire: false, evidence: EMPTY_EVIDENCE }
  }

  // 6. Compute averages
  const totalOverrunMin = overrunSessions.reduce(
    (a, s) => a + (s.actualMinutes - s.estimatedMinutes), 0)
  const totalOverrunPct = overrunSessions.reduce(
    (a, s) => a + ((s.actualMinutes - s.estimatedMinutes) / s.estimatedMinutes) * 100, 0)
  const avgOverrunMinutes = Math.round((totalOverrunMin / overrunSessions.length) * 10) / 10
  const avgOverrunPct = Math.round((totalOverrunPct / overrunSessions.length) * 10) / 10

  const evidence: OverrunSignalEvidence = {
    overrunSessions,
    avgOverrunMinutes,
    avgOverrunPct,
    sessionsConsidered: overrunSessions.length,
  }

  // 7. Apply both thresholds
  const shouldFire =
    avgOverrunPct >= OVERRUN_PCT_THRESHOLD &&
    avgOverrunMinutes >= OVERRUN_MIN_FLOOR

  return { shouldFire, evidence }
}
```

- [ ] **Step 3.4: Run tests — verify all 6 pass**

```bash
npm test -- --run src/lib/analytics/__tests__/overrun-signal.test.ts 2>&1 | tail -15
```

Expected: 6 passed.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/analytics/overrun-signal.ts src/lib/analytics/__tests__/overrun-signal.test.ts
git -c commit.gpgsign=false commit -m "$(cat <<'EOF'
feat(analytics): evaluateOverrunSignal pure read-only function

Reads last 3 completed workouts (with non-null actual + estimated durations),
computes avg overrun (minutes + percentage), returns shouldFire when both
thresholds met (≥20% AND ≥8 min absolute). Suppressed when active mesocycle
absent or pending_planner_notes is non-null. No async, no jobs.

6 fixture-driven scenarios cover under-budget / over-budget / floor / pct /
suppression / no-active-meso paths.
EOF
)"
```

---

## Task 4: `pending-notes.actions.ts` — TDD

**Files:**
- Create: `src/lib/actions/pending-notes.actions.ts`
- Create: `src/lib/actions/__tests__/pending-notes.actions.test.ts`

- [ ] **Step 4.1: Write the test file**

Create `src/lib/actions/__tests__/pending-notes.actions.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    profile: { id: 'u1', pending_planner_notes: null } as any,
    updates: [] as Array<{ table: string; patch: any }>,
    user: { id: 'u1' } as any,
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
  const handler = (table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: state.profile, error: null })),
            single: vi.fn(async () => ({ data: state.profile, error: null })),
          })),
        })),
        update: vi.fn((patch: any) => ({
          eq: vi.fn(async () => {
            state.updates.push({ table, patch })
            // Mutate fixture so subsequent reads see the new value (merge tests need this).
            state.profile = { ...state.profile, ...patch }
            return { data: null, error: null }
          }),
        })),
      }
    }
    return {}
  }
  const client = {
    from: vi.fn(handler),
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
  }
  return { createClient: vi.fn(async () => client) }
})

import {
  submitRealityCheck,
  dismissOverrunSignal,
  getPendingPlannerNotes,
  clearPendingPlannerNotes,
} from '../pending-notes.actions'

describe('pending-notes actions', () => {
  beforeEach(() => {
    state.profile = { id: 'u1', pending_planner_notes: null }
    state.updates.length = 0
    state.user = { id: 'u1' }
    vi.clearAllMocks()
  })

  describe('submitRealityCheck', () => {
    it('happy path — empty profile, writes new entry', async () => {
      const r = await submitRealityCheck({
        source: 'block_close',
        availability: { daysPerWeek: 5, sessionMinutes: 50, warmupMinutes: 15, cooldownMinutes: 5 },
      })
      expect(r.success).toBe(true)
      expect(state.updates).toHaveLength(1)
      const note = state.updates[0].patch.pending_planner_notes
      expect(note.schemaVersion).toBe(1)
      expect(note.source).toBe('block_close')
      expect(note.availability.daysPerWeek).toBe(5)
      expect(note.capturedAt).toBeTruthy()
    })

    it('merges with existing pending notes (deep merge on availability)', async () => {
      state.profile = {
        id: 'u1',
        pending_planner_notes: {
          schemaVersion: 1,
          source: 'block_close',
          capturedAt: '2026-05-01T00:00:00Z',
          availability: { daysPerWeek: 5, sessionMinutes: 60, warmupMinutes: 10, cooldownMinutes: 5 },
        },
      }
      const r = await submitRealityCheck({
        source: 'mid_block_signal',
        availability: { daysPerWeek: 5, sessionMinutes: 60, warmupMinutes: 20, cooldownMinutes: 5 },
        signalEvidence: {
          overrunSessions: [], avgOverrunMinutes: 18, avgOverrunPct: 25, sessionsConsidered: 3,
        },
      })
      expect(r.success).toBe(true)
      const note = state.updates[0].patch.pending_planner_notes
      expect(note.source).toBe('mid_block_signal')
      expect(note.availability.warmupMinutes).toBe(20)  // overridden
      expect(note.signalEvidence.avgOverrunMinutes).toBe(18)
    })

    it('truncates freeText to 200 chars', async () => {
      const longText = 'x'.repeat(300)
      const r = await submitRealityCheck({ source: 'block_close', freeText: longText })
      expect(r.success).toBe(true)
      const note = state.updates[0].patch.pending_planner_notes
      expect(note.freeText.length).toBe(200)
    })

    it('rejects when not authenticated', async () => {
      state.user = null
      const r = await submitRealityCheck({ source: 'block_close' })
      expect(r.success).toBe(false)
      if (!r.success) expect(r.error).toMatch(/not authenticated/i)
    })
  })

  describe('dismissOverrunSignal', () => {
    it('writes minimal dismiss-marker', async () => {
      const r = await dismissOverrunSignal({
        overrunSessions: [{ workoutId: 'w1', estimatedMinutes: 60, actualMinutes: 78 }],
        avgOverrunMinutes: 18, avgOverrunPct: 30, sessionsConsidered: 1,
      })
      expect(r.success).toBe(true)
      const note = state.updates[0].patch.pending_planner_notes
      expect(note.source).toBe('mid_block_signal')
      expect(note.dismissedWithoutAnswer).toBe(true)
      expect(note.signalEvidence.avgOverrunMinutes).toBe(18)
      expect(note.availability).toBeUndefined()
    })

    it('idempotent — second dismiss merges, doesn\'t error', async () => {
      const evidence = {
        overrunSessions: [], avgOverrunMinutes: 18, avgOverrunPct: 30, sessionsConsidered: 3,
      }
      await dismissOverrunSignal(evidence)
      const r = await dismissOverrunSignal(evidence)
      expect(r.success).toBe(true)
    })
  })

  describe('getPendingPlannerNotes', () => {
    it('returns null when none', async () => {
      const r = await getPendingPlannerNotes()
      expect(r.success).toBe(true)
      if (r.success) expect(r.data).toBeNull()
    })

    it('returns typed entry when present', async () => {
      state.profile = {
        id: 'u1',
        pending_planner_notes: {
          schemaVersion: 1, source: 'block_close', capturedAt: '2026-05-01T00:00:00Z',
        },
      }
      const r = await getPendingPlannerNotes()
      expect(r.success).toBe(true)
      if (r.success) expect(r.data?.source).toBe('block_close')
    })
  })

  describe('clearPendingPlannerNotes', () => {
    it('sets profile.pending_planner_notes to null', async () => {
      state.profile = {
        id: 'u1',
        pending_planner_notes: { schemaVersion: 1, source: 'block_close', capturedAt: '2026-05-01T00:00:00Z' },
      }
      const r = await clearPendingPlannerNotes()
      expect(r.success).toBe(true)
      expect(state.updates[0].patch.pending_planner_notes).toBeNull()
    })
  })
})
```

- [ ] **Step 4.2: Run tests — verify they fail with module-not-found**

```bash
npm test -- --run src/lib/actions/__tests__/pending-notes.actions.test.ts 2>&1 | tail -10
```

Expected: failures citing missing module.

- [ ] **Step 4.3: Implement the action module**

Create `src/lib/actions/pending-notes.actions.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  type PendingPlannerNotes,
  type PendingPlannerNoteSource,
  type AvailabilityAnswers,
  type SignalEvidence,
  mergePendingPlannerNotes,
} from '@/lib/types/pending-planner-notes.types'
import type { ActionResult } from '@/lib/types/training.types'

const FREE_TEXT_LIMIT = 200

export type SubmitRealityCheckInput = {
  source: PendingPlannerNoteSource
  availability?: AvailabilityAnswers
  freeText?: string
  signalEvidence?: SignalEvidence
}

export async function submitRealityCheck(
  input: SubmitRealityCheckInput,
): Promise<ActionResult<{ written: PendingPlannerNotes }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('pending_planner_notes')
    .eq('id', user.id)
    .maybeSingle()

  const prev = (profile?.pending_planner_notes ?? null) as PendingPlannerNotes | null
  const next: PendingPlannerNotes = {
    schemaVersion: 1,
    source: input.source,
    capturedAt: new Date().toISOString(),
    ...(input.availability ? { availability: input.availability } : {}),
    ...(input.freeText
      ? { freeText: input.freeText.slice(0, FREE_TEXT_LIMIT) }
      : {}),
    ...(input.signalEvidence ? { signalEvidence: input.signalEvidence } : {}),
  }
  const merged = mergePendingPlannerNotes(prev, next)

  const { error } = await supabase
    .from('profiles')
    .update({ pending_planner_notes: merged as unknown as Record<string, unknown> })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  return { success: true, data: { written: merged } }
}

export async function dismissOverrunSignal(
  signalEvidence: SignalEvidence,
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('pending_planner_notes')
    .eq('id', user.id)
    .maybeSingle()

  const prev = (profile?.pending_planner_notes ?? null) as PendingPlannerNotes | null
  const next: PendingPlannerNotes = {
    schemaVersion: 1,
    source: 'mid_block_signal',
    capturedAt: new Date().toISOString(),
    signalEvidence,
    dismissedWithoutAnswer: true,
  }
  const merged = mergePendingPlannerNotes(prev, next)

  const { error } = await supabase
    .from('profiles')
    .update({ pending_planner_notes: merged as unknown as Record<string, unknown> })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

export async function getPendingPlannerNotes(): Promise<ActionResult<PendingPlannerNotes | null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('profiles')
    .select('pending_planner_notes')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  return {
    success: true,
    data: (data?.pending_planner_notes ?? null) as PendingPlannerNotes | null,
  }
}

export async function clearPendingPlannerNotes(): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ pending_planner_notes: null })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}
```

- [ ] **Step 4.4: Run tests — verify all pass**

```bash
npm test -- --run src/lib/actions/__tests__/pending-notes.actions.test.ts 2>&1 | tail -15
```

Expected: 9 passed (4 submit + 2 dismiss + 2 get + 1 clear).

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/actions/pending-notes.actions.ts src/lib/actions/__tests__/pending-notes.actions.test.ts
git -c commit.gpgsign=false commit -m "$(cat <<'EOF'
feat(actions): pending-notes actions for adherence honesty carryover

submitRealityCheck merges new entries into existing pending_planner_notes
per the spec's deep-merge rule. dismissOverrunSignal writes a minimal
marker (dismissedWithoutAnswer + signalEvidence) for sub-project D's
planner to read. getPendingPlannerNotes / clearPendingPlannerNotes are
the read/clear API exposed for D consumption.

9 mocked scenarios cover happy path, merge, free-text truncation, dismiss,
idempotency, get, and clear.
EOF
)"
```

---

## Task 5: RealityCheckForm shared component

**Files:**
- Create: `src/components/reality-check/RealityCheckForm.tsx`

- [ ] **Step 5.1: Write the form component**

Create `src/components/reality-check/RealityCheckForm.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { submitRealityCheck } from '@/lib/actions/pending-notes.actions'
import type {
  AvailabilityAnswers,
  PendingPlannerNoteSource,
  SignalEvidence,
} from '@/lib/types/pending-planner-notes.types'

const FREE_TEXT_LIMIT = 200

export type RealityCheckFormProps = {
  source: PendingPlannerNoteSource
  /** Profile defaults shown as placeholder + initial value if no prefill. */
  defaults: { daysPerWeek: number; sessionMinutes: number; warmupMinutes: number; cooldownMinutes: number }
  /** Pre-fill from existing pending notes (overrides defaults if set). */
  prefill?: Partial<AvailabilityAnswers> & { freeText?: string }
  /** Optional signal evidence to forward into the write. */
  signalEvidence?: SignalEvidence
  /** Called when the form successfully submits or is skipped. */
  onComplete: (action: 'saved' | 'skipped') => void
}

export function RealityCheckForm({
  source, defaults, prefill, signalEvidence, onComplete,
}: RealityCheckFormProps) {
  const [daysPerWeek, setDaysPerWeek] = useState(prefill?.daysPerWeek ?? defaults.daysPerWeek)
  const [sessionMinutes, setSessionMinutes] = useState(prefill?.sessionMinutes ?? defaults.sessionMinutes)
  const [warmupMinutes, setWarmupMinutes] = useState(prefill?.warmupMinutes ?? defaults.warmupMinutes)
  const [cooldownMinutes, setCooldownMinutes] = useState(prefill?.cooldownMinutes ?? defaults.cooldownMinutes)
  const [freeText, setFreeText] = useState(prefill?.freeText ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Submit-enabled rule: any field changed from defaults OR free-text non-empty.
  const dirty =
    daysPerWeek !== defaults.daysPerWeek ||
    sessionMinutes !== defaults.sessionMinutes ||
    warmupMinutes !== defaults.warmupMinutes ||
    cooldownMinutes !== defaults.cooldownMinutes ||
    freeText.trim().length > 0

  const handleSave = () => {
    startTransition(async () => {
      const result = await submitRealityCheck({
        source,
        availability: { daysPerWeek, sessionMinutes, warmupMinutes, cooldownMinutes },
        ...(freeText.trim() ? { freeText: freeText.trim() } : {}),
        ...(signalEvidence ? { signalEvidence } : {}),
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      onComplete('saved')
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-[12px] font-inter text-amber-400 border border-amber-500/30 bg-amber-500/5 p-2">
          {error}
        </p>
      )}

      <Field label="Days you actually trained per week"
             help={`Setting: ${defaults.daysPerWeek} days`}>
        <NumberInput value={daysPerWeek} onChange={setDaysPerWeek} min={1} max={7} />
      </Field>

      <Field label="Real session window (minutes)"
             help={`Setting: ${defaults.sessionMinutes} min`}>
        <NumberInput value={sessionMinutes} onChange={setSessionMinutes} min={15} max={180} step={5} />
      </Field>

      <Field label="Warm-up overhead (minutes)"
             help="What you do BEFORE prescribed work. 0 if you skip warm-up.">
        <NumberInput value={warmupMinutes} onChange={setWarmupMinutes} min={0} max={60} step={5} />
      </Field>

      <Field label="Cool-down / self-added cardio (minutes)"
             help="What you do AFTER prescribed work. 0 if none.">
        <NumberInput value={cooldownMinutes} onChange={setCooldownMinutes} min={0} max={60} step={5} />
      </Field>

      <Field label="Anything else?" help={`${FREE_TEXT_LIMIT - freeText.length} chars left`}>
        <textarea
          value={freeText}
          onChange={e => setFreeText(e.target.value.slice(0, FREE_TEXT_LIMIT))}
          rows={3}
          className="w-full px-2.5 py-1.5 bg-[#111] border border-neutral-800 text-white text-[12px] font-inter placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50 resize-none"
          placeholder="Free-form note for the next block planner..."
        />
      </Field>

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={() => onComplete('skipped')}
          disabled={pending}
          className="px-3 py-1.5 border border-neutral-700 hover:border-neutral-500 text-[11px] font-mono text-neutral-400 uppercase tracking-wider transition-colors"
        >
          Skip — no changes
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-[11px] font-mono uppercase tracking-wider transition-colors"
        >
          {pending && <Loader2 className="w-3 h-3 animate-spin" />}
          Save & continue
        </button>
      </div>
    </div>
  )
}

function Field({ label, help, children }: {
  label: string; help?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {help && <p className="text-[10px] font-mono text-neutral-600">{help}</p>}
    </div>
  )
}

function NumberInput({ value, onChange, min, max, step = 1 }: {
  value: number; onChange: (v: number) => void
  min: number; max: number; step?: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => {
        const n = parseInt(e.target.value, 10)
        if (!isNaN(n)) onChange(n)
      }}
      className="w-full px-2.5 py-1.5 bg-[#111] border border-neutral-800 text-white text-[12px] font-mono focus:outline-none focus:border-amber-500/50"
    />
  )
}
```

- [ ] **Step 5.2: Verify type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "Cannot find module '@react-pdf\|Cannot find module 'garmin-connect\|Cannot find module '@playwright" | grep -v "data-overview.spec\|doctor-report.spec\|workout-start-rebind\|.next/dev/types/validator" | grep "RealityCheckForm" | head
```

Expected: no errors referencing the new file.

- [ ] **Step 5.3: Commit**

```bash
git add src/components/reality-check/RealityCheckForm.tsx
git -c commit.gpgsign=false commit -m "$(cat <<'EOF'
feat(reality-check): shared 5-question form component

Client component with controlled state for daysPerWeek, sessionMinutes,
warmupMinutes, cooldownMinutes, and a 200-char freeText. Submits via
submitRealityCheck server action. Pre-fill from props (existing pending
notes) or profile defaults. Save-disabled until at least one field
changes from default OR freeText is non-empty.

Consumed by both the post-close reality-check page and the mid-block
overrun signal modal.
EOF
)"
```

---

## Task 6: Reality-check page route

**Files:**
- Create: `src/app/data/blocks/[mesocycleId]/reality-check/page.tsx`

- [ ] **Step 6.1: Write the page**

Create `src/app/data/blocks/[mesocycleId]/reality-check/page.tsx`. Note: this is a server component that fetches everything, then renders a small client wrapper around `RealityCheckForm` (since the form needs `useRouter` for the post-submit redirect).

```tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getBlockRetrospective } from '@/lib/actions/block-retrospective.actions'
import { getPendingPlannerNotes } from '@/lib/actions/pending-notes.actions'
import { RealityCheckPageClient } from './RealityCheckPageClient'

export default async function Page({ params }: { params: Promise<{ mesocycleId: string }> }) {
  const { mesocycleId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const [retroResult, profileQuery, notesResult] = await Promise.all([
    getBlockRetrospective(mesocycleId),
    supabase
      .from('profiles')
      .select('available_days, session_duration_minutes')
      .eq('id', user.id)
      .maybeSingle(),
    getPendingPlannerNotes(),
  ])

  if (!retroResult.success || !retroResult.data) notFound()
  const snapshot = retroResult.data

  const profile = profileQuery.data
  const defaults = {
    daysPerWeek: profile?.available_days ?? 5,
    sessionMinutes: profile?.session_duration_minutes ?? 60,
    warmupMinutes: 0,   // not yet captured at profile level
    cooldownMinutes: 0,
  }
  const prefill = notesResult.success && notesResult.data?.availability
    ? { ...notesResult.data.availability, freeText: notesResult.data.freeText }
    : undefined

  return (
    <div className="space-y-3 p-4 max-w-md mx-auto">
      <Link
        href={`/data/blocks/${mesocycleId}/retrospective`}
        className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" /> Skip to retrospective
      </Link>

      <header className="border-b border-neutral-800 pb-3 mb-2">
        <h1 className="text-lg font-space-grotesk font-bold text-white tracking-tight">
          Quick reality check
        </h1>
        <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-1">
          {snapshot.block.name}
        </p>
      </header>

      <div className="border border-neutral-800 bg-neutral-950/60 p-3 mb-3">
        <p className="text-[12px] font-inter text-neutral-300">
          Last block: {snapshot.adherence.overall.completed}/{snapshot.adherence.overall.prescribed} sessions
          ({snapshot.adherence.overall.pct}%). Setting was {defaults.daysPerWeek} days/week × {defaults.sessionMinutes} min.
          What was real?
        </p>
      </div>

      <RealityCheckPageClient
        mesocycleId={mesocycleId}
        defaults={defaults}
        prefill={prefill}
      />
    </div>
  )
}
```

- [ ] **Step 6.2: Write the client wrapper**

Create `src/app/data/blocks/[mesocycleId]/reality-check/RealityCheckPageClient.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { RealityCheckForm } from '@/components/reality-check/RealityCheckForm'
import type { AvailabilityAnswers } from '@/lib/types/pending-planner-notes.types'

export function RealityCheckPageClient({
  mesocycleId, defaults, prefill,
}: {
  mesocycleId: string
  defaults: AvailabilityAnswers
  prefill?: Partial<AvailabilityAnswers> & { freeText?: string }
}) {
  const router = useRouter()
  const handleComplete = () => {
    router.push(`/data/blocks/${mesocycleId}/retrospective`)
    router.refresh()
  }
  return (
    <RealityCheckForm
      source="block_close"
      defaults={defaults}
      prefill={prefill}
      onComplete={handleComplete}
    />
  )
}
```

- [ ] **Step 6.3: Verify build**

```bash
npx tsc --noEmit 2>&1 | grep -v "Cannot find module '@react-pdf\|Cannot find module 'garmin-connect\|Cannot find module '@playwright" | grep -v "data-overview.spec\|doctor-report.spec\|workout-start-rebind\|.next/dev/types/validator" | tail -10
```

Expected: no NEW errors.

- [ ] **Step 6.4: Commit**

```bash
git add src/app/data/blocks/
git -c commit.gpgsign=false commit -m "feat(routes): /data/blocks/[id]/reality-check post-close prompt page"
```

---

## Task 7: Redirect close-block flow through reality-check

**Files:**
- Modify: `src/components/dashboard/CloseBlockConfirmModal.tsx`

- [ ] **Step 7.1: Read current redirect path**

```bash
grep -n "router.push" src/components/dashboard/CloseBlockConfirmModal.tsx
```

Current behavior: after `closeMesocycle()` succeeds, redirects to `/data/blocks/${mesocycleId}/retrospective`. Change target to `/data/blocks/${mesocycleId}/reality-check`. The reality-check page itself redirects forward to retrospective on save/skip.

- [ ] **Step 7.2: Apply the one-line change**

In `src/components/dashboard/CloseBlockConfirmModal.tsx`, locate `router.push(\`/data/blocks/${mesocycleId}/retrospective\`)` and change to `router.push(\`/data/blocks/${mesocycleId}/reality-check\`)`.

- [ ] **Step 7.3: Verify the existing actions test still passes**

```bash
npm test -- --run src/lib/actions/__tests__/block-retrospective.actions.test.ts 2>&1 | tail -10
```

Expected: 10 passed (the action test doesn't exercise the redirect, so still green).

- [ ] **Step 7.4: Commit**

```bash
git add src/components/dashboard/CloseBlockConfirmModal.tsx
git -c commit.gpgsign=false commit -m "feat(close-flow): redirect through reality-check page after close

Reality-check page itself redirects forward to retrospective on save or
skip. Adds one screen to the close journey but keeps each step focused
on a single decision."
```

---

## Task 8: OverrunSignalBanner + OverrunSignalModal

**Files:**
- Create: `src/components/reality-check/OverrunSignalBanner.tsx`
- Create: `src/components/reality-check/OverrunSignalModal.tsx`

- [ ] **Step 8.1: OverrunSignalBanner**

Create `src/components/reality-check/OverrunSignalBanner.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { AlertCircle } from 'lucide-react'
import { dismissOverrunSignal } from '@/lib/actions/pending-notes.actions'
import { OverrunSignalModal } from './OverrunSignalModal'
import type { SignalEvidence } from '@/lib/types/pending-planner-notes.types'

export type OverrunSignalBannerProps = {
  evidence: SignalEvidence
  defaults: { daysPerWeek: number; sessionMinutes: number; warmupMinutes: number; cooldownMinutes: number }
}

export function OverrunSignalBanner({ evidence, defaults }: OverrunSignalBannerProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [pending, startTransition] = useTransition()

  if (dismissed) return null

  const handleDismiss = () => {
    startTransition(async () => {
      await dismissOverrunSignal(evidence)
      setDismissed(true)
    })
  }

  return (
    <>
      <div className="border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-[12px] font-inter text-neutral-200 flex-1">
          Your last {evidence.sessionsConsidered} sessions ran{' '}
          <span className="font-bold">+{evidence.avgOverrunMinutes} min</span> over budget on average.
          Worth a quick reality-check on your time estimates.
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={pending}
          className="px-2.5 py-1 border border-neutral-700 hover:border-neutral-500 text-[11px] font-mono text-neutral-400 uppercase tracking-wider transition-colors"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-mono uppercase tracking-wider transition-colors"
        >
          Update
        </button>
      </div>
      {modalOpen && (
        <OverrunSignalModal
          evidence={evidence}
          defaults={defaults}
          onClose={(action) => {
            setModalOpen(false)
            if (action === 'saved') setDismissed(true)
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 8.2: OverrunSignalModal**

Create `src/components/reality-check/OverrunSignalModal.tsx`:

```tsx
'use client'

import { X } from 'lucide-react'
import { RealityCheckForm } from './RealityCheckForm'
import type { SignalEvidence, AvailabilityAnswers } from '@/lib/types/pending-planner-notes.types'

export type OverrunSignalModalProps = {
  evidence: SignalEvidence
  defaults: AvailabilityAnswers
  onClose: (action: 'saved' | 'skipped') => void
}

export function OverrunSignalModal({ evidence, defaults, onClose }: OverrunSignalModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog">
      <div className="bg-neutral-950 border border-neutral-800 max-w-md w-full p-4 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-base font-space-grotesk font-bold text-white">
            Reality check
          </h2>
          <button
            type="button" onClick={() => onClose('skipped')}
            className="text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="border border-amber-500/30 bg-amber-500/5 p-2 mb-4">
          <p className="text-[10px] font-mono text-amber-400 uppercase tracking-wider mb-1">
            Last {evidence.sessionsConsidered} sessions
          </p>
          <ul className="space-y-0.5">
            {evidence.overrunSessions.map((s) => (
              <li key={s.workoutId} className="text-[12px] font-mono text-neutral-300 flex justify-between">
                <span>est {s.estimatedMinutes} min</span>
                <span className="text-amber-400">
                  +{s.actualMinutes - s.estimatedMinutes} min over
                </span>
              </li>
            ))}
          </ul>
        </div>

        <RealityCheckForm
          source="mid_block_signal"
          defaults={defaults}
          signalEvidence={evidence}
          onComplete={onClose}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 8.3: Verify type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "Cannot find module '@react-pdf\|Cannot find module 'garmin-connect\|Cannot find module '@playwright" | grep -v "data-overview.spec\|doctor-report.spec\|workout-start-rebind\|.next/dev/types/validator" | tail -10
```

Expected: no NEW errors.

- [ ] **Step 8.4: Commit**

```bash
git add src/components/reality-check/OverrunSignalBanner.tsx \
        src/components/reality-check/OverrunSignalModal.tsx
git -c commit.gpgsign=false commit -m "$(cat <<'EOF'
feat(reality-check): overrun signal banner + modal

Banner mirrors CloseBlockNudgeBanner's amber styling; shows avgOverrunMinutes
inline. Dismiss writes a minimal pending-notes marker. Update opens the
modal which embeds RealityCheckForm with a per-session evidence header
above the form.
EOF
)"
```

---

## Task 9: Wire signal banner into dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 9.1: Read current dashboard structure**

```bash
cat src/app/dashboard/page.tsx
```

Locate where `CloseBlockNudgeBanner` is rendered. The new `OverrunSignalBanner` slots into the same area, conditional on the signal firing.

- [ ] **Step 9.2: Add imports + signal evaluation + conditional render**

In `src/app/dashboard/page.tsx`:

**Add imports** (after existing imports):

```ts
import { evaluateOverrunSignal } from '@/lib/analytics/overrun-signal'
import { OverrunSignalBanner } from '@/components/reality-check/OverrunSignalBanner'
import { createClient } from '@/lib/supabase/server'
```

(If `createClient` is already imported, skip that.)

**Add signal evaluation** AFTER the existing `if (!data.currentMesocycle) { return ... }` early-return and AFTER the `endPassed`/`allResolved`/`hasAnyCompleted` lines added in T8 of sub-project A:

```ts
  // Evaluate overrun signal for the mid-block reality-check banner.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const overrunSignal = user
    ? await evaluateOverrunSignal(user.id)
    : { shouldFire: false, evidence: null as any }
  const overrunDefaults = {
    daysPerWeek: data.currentMesocycle.available_days
      ?? 5,
    sessionMinutes: data.currentMesocycle.session_duration_minutes
      ?? 60,
    warmupMinutes: 0,
    cooldownMinutes: 0,
  }
```

> Note: `available_days` and `session_duration_minutes` live on `profiles`, not `mesocycles`. The dashboard already has access to `data.athleteName` etc. from the profile query — pass `available_days` and `session_duration_minutes` through `getDashboardData` to avoid a new query here. If they're not yet exposed by `getDashboardData`, fetch them here:
> ```ts
> const { data: profileForDefaults } = await supabase
>   .from('profiles')
>   .select('available_days, session_duration_minutes')
>   .eq('id', user!.id)
>   .maybeSingle()
> const overrunDefaults = {
>   daysPerWeek: profileForDefaults?.available_days ?? 5,
>   sessionMinutes: profileForDefaults?.session_duration_minutes ?? 60,
>   warmupMinutes: 0,
>   cooldownMinutes: 0,
> }
> ```

**Render the banner** in the JSX, immediately AFTER the existing `CloseBlockNudgeBanner` render block (or in the same conditional area):

```tsx
{overrunSignal.shouldFire && (
  <OverrunSignalBanner
    evidence={overrunSignal.evidence}
    defaults={overrunDefaults}
  />
)}
```

- [ ] **Step 9.3: Verify build + tests**

```bash
npx tsc --noEmit 2>&1 | grep -v "Cannot find module '@react-pdf\|Cannot find module 'garmin-connect\|Cannot find module '@playwright" | grep -v "data-overview.spec\|doctor-report.spec\|workout-start-rebind\|.next/dev/types/validator" | tail -10
npm test 2>&1 | tail -10
```

Expected: zero NEW type errors. All existing tests still pass plus the new sub-project B tests (15 total: 6 signal + 9 actions).

- [ ] **Step 9.4: Commit**

```bash
git add src/app/dashboard/page.tsx
git -c commit.gpgsign=false commit -m "feat(dashboard): render OverrunSignalBanner when signal fires

Calls evaluateOverrunSignal() on dashboard render. When shouldFire=true,
renders the banner with the per-session evidence. Banner Dismiss / Update
both result in suppression for the rest of the block via pending-notes
write."
```

---

## Task 10: Playwright spec (committed not runnable)

**Files:**
- Create: `tests/e2e/reality-check.spec.ts`

- [ ] **Step 10.1: Write the spec**

Create `tests/e2e/reality-check.spec.ts`:

```ts
// Adherence honesty E2E spec.
// COMMITTED BUT NOT RUNNABLE: Playwright infrastructure is not configured
// in this repo. Spec lives here so it runs once @playwright/test +
// playwright.config.ts land. Same convention as Plan 2 / Plan 3 / sub-project A.

import { test, expect } from '@playwright/test'

test.describe('Reality-check boundary flow (post-close)', () => {
  test('close → reality-check → save → retrospective', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /close & review/i }).click()
    await page.getByRole('button', { name: /close & generate retrospective/i }).click()
    // Land on reality-check page (NOT directly on retrospective).
    await page.waitForURL(/\/data\/blocks\/.+\/reality-check$/)
    await expect(page.getByRole('heading', { name: /quick reality check/i })).toBeVisible()
    // Change a value to enable Save.
    await page.getByLabel(/days you actually trained/i).fill('5')
    await page.getByRole('button', { name: /save & continue/i }).click()
    await page.waitForURL(/\/data\/blocks\/.+\/retrospective$/)
  })

  test('skip path redirects to retrospective without writing', async ({ page }) => {
    await page.goto('/data/blocks/test-meso-id/reality-check')
    await page.getByRole('button', { name: /skip — no changes/i }).click()
    await page.waitForURL(/\/data\/blocks\/.+\/retrospective$/)
  })
})

test.describe('Mid-block overrun signal', () => {
  test.beforeEach(async ({ page }) => {
    // Test fixture would seed 3 over-budget completed workouts here.
    await page.goto('/dashboard')
  })

  test('banner appears, modal opens, save closes banner', async ({ page }) => {
    await expect(page.getByText(/ran .* min over budget/i)).toBeVisible()
    await page.getByRole('button', { name: /update/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await expect(modal.getByText(/last .* sessions/i)).toBeVisible()
    await modal.getByLabel(/warm-up overhead/i).fill('20')
    await modal.getByRole('button', { name: /save & continue/i }).click()
    await expect(page.getByText(/ran .* min over budget/i)).not.toBeVisible()
  })

  test('dismiss closes banner and writes dismiss-marker', async ({ page }) => {
    await page.getByRole('button', { name: /^dismiss$/i }).click()
    await expect(page.getByText(/ran .* min over budget/i)).not.toBeVisible()
  })
})
```

- [ ] **Step 10.2: Commit**

```bash
git add tests/e2e/reality-check.spec.ts
git -c commit.gpgsign=false commit -m "test(e2e): reality-check + overrun signal spec (not runnable, no playwright infra)"
```

---

## Task 11: Real-data verification gate

**Files:** none (operational).

- [ ] **Step 11.1: Run the full test suite**

```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
npm test 2>&1 | tail -10
```

Expected: existing 276 + 1 todo + 15 new (6 signal + 9 actions) = 291 + 1 todo. The pre-existing `garmin-sync.test.ts` failure (missing `garmin-connect` package) is unrelated.

- [ ] **Step 11.2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "Cannot find module '@react-pdf\|Cannot find module 'garmin-connect\|Cannot find module '@playwright" | grep -v "data-overview.spec\|doctor-report.spec\|workout-start-rebind\|.next/dev/types/validator" | tail -10
```

Expected: no new errors.

- [ ] **Step 11.3: Verify migration applied to live**

Use Supabase MCP `execute_sql` against project `kuqgtholljrxnbxtmrnz`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles' AND column_name='pending_planner_notes';
```

Expected: one row, `pending_planner_notes | jsonb | YES`.

- [ ] **Step 11.4: Walk the boundary flow against Block 1**

Block 1 is already closed, so we manually navigate to test the page (instead of going through the close-block flow which won't fire on a closed block).

```bash
npm run dev
```

Then in a browser at `http://localhost:3001/data/blocks/50ccb2aa-61e8-470c-8404-966064c31cef/reality-check`:

1. Confirm the page renders with retrospective-grounded copy showing 21/51 (41%) above the form.
2. Pre-fill values come from current profile (e.g., 7 days × 60 min).
3. Change values to your honest assessment (e.g., 5 days × 50 min, warm-up 15 min, cooldown 5 min, free-text "Mid-block reload chaos was real").
4. Click "Save & continue."
5. Land on `/data/blocks/50ccb2aa-61e8-470c-8404-966064c31cef/retrospective`.

- [ ] **Step 11.5: Verify the write against live DB**

```sql
SELECT pending_planner_notes
FROM profiles
WHERE id = (SELECT id FROM auth.users WHERE email = 'incubatepro@gmail.com');
```

Expected: JSON with `schemaVersion=1, source='block_close', capturedAt`, `availability` matching what you entered, `freeText` if entered.

- [ ] **Step 11.6: Verify merge**

Re-navigate to the reality-check page. Confirm the form pre-fills with the values you just submitted. Change one field (e.g., warm-up to 20 min). Save again. Re-query:

```sql
SELECT pending_planner_notes
FROM profiles
WHERE id = (SELECT id FROM auth.users WHERE email = 'incubatepro@gmail.com');
```

Expected: `availability.warmupMinutes` is the new value (20); other availability fields unchanged from previous write. `capturedAt` updated. `freeText` either appended (if you entered new text) or unchanged (if you didn't).

- [ ] **Step 11.7: Take a screenshot**

Screenshot the populated reality-check page (showing the form with the live pre-fill). Save as `docs/superpowers/specs/2026-05-05-reality-check-screenshot.png`.

```bash
git add docs/superpowers/specs/2026-05-05-reality-check-screenshot.png
git -c commit.gpgsign=false commit -m "docs: add screenshot of reality-check page (B verification gate)"
```

- [ ] **Step 11.8: Push branch (if not already pushed) + comment on PR**

```bash
git push origin feat/block-retrospective
```

The PR (#6) is sub-project A's; sub-project B's commits sit on top of it. Either:
- Comment on PR #6 noting that B's spec + implementation also live here, and we're merging both together
- Wait for A to merge (via squash), then open a follow-up PR for B's commits

Decision deferred until merge time per the simplification we agreed on.

---

## Self-review checklist (run before handing off)

- [x] Every spec section maps to a task: data model → T1+T2; signal engine → T3; carryover actions → T4; boundary prompt UI → T5+T6; close-flow integration → T7; mid-block UI → T8+T9; tests → within T3+T4 + T10; real-data gate → T11.
- [x] No placeholder text. All code blocks are complete and self-contained.
- [x] Type / function names consistent: `PendingPlannerNotes`, `submitRealityCheck`, `dismissOverrunSignal`, `getPendingPlannerNotes`, `clearPendingPlannerNotes`, `evaluateOverrunSignal`, `RealityCheckForm`, `OverrunSignalBanner`, `OverrunSignalModal`.
- [x] Migration number 020 (next sequential after A's 019).
- [x] No component snapshot tests (vitest config doesn't pick them up — same constraint as A).
- [x] Real-data verification adapted for the no-active-block constraint (B1 is closed; banner visual deferred to D's window).
