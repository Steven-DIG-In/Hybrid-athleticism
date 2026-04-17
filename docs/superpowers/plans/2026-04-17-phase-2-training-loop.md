# Phase 2 — Training Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the fractured allocation → planner → execution loop so the training-day-model drives UI behavior; fix 5 concrete bugs; rebuild the broken off-plan logging page.

**Architecture:** Sessions are ordered `training_day` slots within a block; calendar is a visual overlay mapping the next 7 slots to real weekdays. Starting a session rebinds its `scheduled_date` to today. Missed sessions skip forward by default but are recoverable via drag-reschedule. Recalibration is tiered (<5% auto+visible, 5–10% auto+logged, >10% coach prompt). `agent_activity` table is created in this phase (first writer).

**Tech Stack:** Next.js 16.1.6, React 19.2.3, TypeScript 5, Supabase, Vitest 4.1.0, date-fns 4, Tailwind 4, framer-motion 12. Follow existing patterns — this is brownfield; `training_day` column exists in `session_inventory` from migration 013.

**Spec reference:** `docs/superpowers/specs/2026-04-17-phase-2-training-loop-design.md`

> ⚠️ **Next.js 16 reminder:** Per `AGENTS.md`, read `node_modules/next/dist/docs/` before writing any server/client component or route code — breaking changes from Next 15.

---

## File Structure

### New files
- `supabase/migrations/014_training_day_model_cleanup.sql` — block_pointer, agent_activity, session_inventory.status, workouts.completed_date
- `src/lib/actions/block-pointer.actions.ts` — initialize/advance/query block pointer
- `src/lib/actions/recalibration.actions.ts` — tiered recalibration gate + agent_activity writes
- `src/lib/actions/agent-activity.actions.ts` — `logDecision()` helper (minimal; Phase 3 extends)
- `src/components/dashboard/WeekViewClient.tsx` — 7-day calendar strip + drag + launch
- `src/app/log-session/page.tsx` — rebuilt off-plan logging page
- `src/components/dashboard/LogSessionForm.tsx` — quick-log form
- `src/lib/actions/__tests__/block-pointer.test.ts`
- `src/lib/actions/__tests__/recalibration.test.ts`
- `src/lib/actions/__tests__/workout-start-rebind.test.ts`
- `src/lib/actions/__tests__/inventory-allocation.test.ts`
- `src/lib/scheduling/__tests__/load-scoring.test.ts`

### Modified files
- `src/lib/actions/inventory.actions.ts` — allocation driven by block pointer; `rebindCalendarDate`, `rescheduleToToday`, `markMissed`
- `src/lib/actions/workout.actions.ts` — `startSession` rebinds `scheduled_date` to today
- `src/lib/scheduling/load-scoring.ts` — aggregate by calendar date, not `training_day`
- `src/lib/skills/domains/strength/training-max-estimation.ts` (and consumers) — wire output into next-session prescribed weights
- `src/components/workout/CoachNotesBanner.tsx` — surface recalibration note
- `src/components/dashboard/SessionPoolClient.tsx` — embed `WeekViewClient`; remove `/planner` link
- `src/lib/types/database.types.ts` — regenerate after migration

### Retired files (deleted at Task 12)
- `src/app/planner/page.tsx`
- `src/components/planner/PlannerClient.tsx`

---

## Task 1: Inspect existing schema and confirm migration shape

**Files:**
- Read: `supabase/migrations/013_training_day.sql`, `010_session_inventory_architecture.sql`, `011_cleanup_old_workouts.sql`
- Read: `src/lib/types/database.types.ts`

- [ ] **Step 1: List existing session_inventory columns**

Run:
```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
grep -E "ALTER TABLE session_inventory|CREATE TABLE.*session_inventory" supabase/migrations/*.sql
```
Expected: see `training_day`, `session_slot`, `is_allocated`, `scheduled_date` added across migrations.

- [ ] **Step 2: List existing workouts columns**

Run:
```bash
grep -E "ALTER TABLE workouts|CREATE TABLE.*workouts" supabase/migrations/*.sql
```
Expected: confirms `scheduled_date` exists; confirms `completed_date` does NOT yet exist.

- [ ] **Step 3: Confirm no existing `block_pointer` or `agent_activity` tables**

Run:
```bash
grep -E "block_pointer|agent_activity" supabase/migrations/*.sql
```
Expected: no matches.

- [ ] **Step 4: Document findings in migration header**

No commit yet — findings inform Task 2's migration.

---

## Task 2: Migration `014_training_day_model_cleanup.sql`

**Files:**
- Create: `supabase/migrations/014_training_day_model_cleanup.sql`

- [ ] **Step 1: Write migration**

```sql
-- =============================================================================
-- Training Day Model Cleanup (Phase 2)
-- Migration 014: Adds status enum to session_inventory, completed_date to
-- workouts, block_pointer table, agent_activity table (owned by Phase 2 —
-- first writer; Phase 3 extends).
-- =============================================================================

-- 1. session_inventory.status
DO $$ BEGIN
    CREATE TYPE session_inventory_status AS ENUM
        ('pending', 'active', 'completed', 'missed', 'off_plan');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE session_inventory
    ADD COLUMN IF NOT EXISTS status session_inventory_status NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_session_inventory_status
    ON session_inventory(user_id, mesocycle_id, status);

-- 2. workouts.completed_date (advisory scheduled_date stays as-is)
ALTER TABLE workouts
    ADD COLUMN IF NOT EXISTS completed_date DATE;

CREATE INDEX IF NOT EXISTS idx_workouts_completed_date
    ON workouts(user_id, completed_date) WHERE completed_date IS NOT NULL;

-- 3. block_pointer
CREATE TABLE IF NOT EXISTS block_pointer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mesocycle_id UUID NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    week_number SMALLINT NOT NULL,
    next_training_day SMALLINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, mesocycle_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_block_pointer_user_meso
    ON block_pointer(user_id, mesocycle_id);

ALTER TABLE block_pointer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_pointer owner select" ON block_pointer
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "block_pointer owner insert" ON block_pointer
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "block_pointer owner update" ON block_pointer
    FOR UPDATE USING (auth.uid() = user_id);

-- 4. agent_activity (Phase 2 creates; Phase 3 extends)
CREATE TABLE IF NOT EXISTS agent_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coach TEXT NOT NULL CHECK (coach IN
        ('strength','hypertrophy','endurance','conditioning','mobility','recovery','head')),
    decision_type TEXT NOT NULL CHECK (decision_type IN
        ('recalibration','intervention_fired')),
    target_entity JSONB NOT NULL,
    reasoning_structured JSONB NOT NULL,
    reasoning_text TEXT NOT NULL,
    mesocycle_id UUID REFERENCES mesocycles(id) ON DELETE SET NULL,
    week_number SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_user_created
    ON agent_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_activity_user_coach
    ON agent_activity(user_id, coach, created_at DESC);

ALTER TABLE agent_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_activity owner select" ON agent_activity
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "agent_activity owner insert" ON agent_activity
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Apply migration locally**

Run:
```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
npx supabase db push
```
Expected: migration applies cleanly.

- [ ] **Step 3: Regenerate TypeScript types**

Run:
```bash
npx supabase gen types typescript --local > src/lib/types/database.types.ts
```
Expected: `block_pointer`, `agent_activity`, `session_inventory.status`, `workouts.completed_date` appear in types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/014_training_day_model_cleanup.sql src/lib/types/database.types.ts
git commit -m "feat: migration 014 — status, block_pointer, agent_activity"
```

---

## Task 3: `block-pointer.actions.ts` initial scaffold + tests

**Files:**
- Create: `src/lib/actions/block-pointer.actions.ts`
- Create: `src/lib/actions/__tests__/block-pointer.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// src/lib/actions/__tests__/block-pointer.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initBlockPointer, advanceBlockPointer, getBlockPointer }
    from '../block-pointer.actions'

// Mock supabase client module — follow existing test patterns.
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }))
}))

describe('block-pointer', () => {
    beforeEach(() => vi.clearAllMocks())

    it('initBlockPointer creates row with next_training_day=1', async () => {
        const result = await initBlockPointer('meso-1', 1)
        expect(result.next_training_day).toBe(1)
        expect(result.week_number).toBe(1)
    })

    it('advanceBlockPointer increments next_training_day by 1', async () => {
        const before = await getBlockPointer('meso-1', 1)
        const after = await advanceBlockPointer('meso-1', 1)
        expect(after.next_training_day).toBe(before.next_training_day + 1)
    })

    it('advance idempotent when week complete (stays at max+1)', async () => {
        const final = await advanceBlockPointer('meso-1', 1, { sessionsInWeek: 6 })
        expect(final.next_training_day).toBeLessThanOrEqual(7)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
npx vitest run src/lib/actions/__tests__/block-pointer.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/actions/block-pointer.actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function initBlockPointer(mesocycleId: string, weekNumber: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const { data, error } = await supabase
        .from('block_pointer')
        .upsert(
            { user_id: user.id, mesocycle_id: mesocycleId,
              week_number: weekNumber, next_training_day: 1 },
            { onConflict: 'user_id,mesocycle_id,week_number' }
        )
        .select()
        .single()
    if (error) throw error
    return data
}

export async function getBlockPointer(mesocycleId: string, weekNumber: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const { data, error } = await supabase
        .from('block_pointer')
        .select('*')
        .eq('user_id', user.id)
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', weekNumber)
        .maybeSingle()
    if (error) throw error
    return data ?? await initBlockPointer(mesocycleId, weekNumber)
}

export async function advanceBlockPointer(
    mesocycleId: string,
    weekNumber: number,
    opts: { sessionsInWeek?: number } = {}
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const cap = (opts.sessionsInWeek ?? 7) + 1
    const pointer = await getBlockPointer(mesocycleId, weekNumber)
    const nextVal = Math.min(pointer.next_training_day + 1, cap)

    const { data, error } = await supabase
        .from('block_pointer')
        .update({ next_training_day: nextVal, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', weekNumber)
        .select()
        .single()
    if (error) throw error
    return data
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run src/lib/actions/__tests__/block-pointer.test.ts
```
Expected: 3 tests PASS. If mocks are insufficient, replace with integration test against local Supabase (follow pattern in `src/lib/actions/__tests__/` if present, else stub the supabase client module).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/block-pointer.actions.ts src/lib/actions/__tests__/block-pointer.test.ts
git commit -m "feat: block-pointer actions with init/advance/get"
```

---

## Task 4: Fix bug #4 — `startSession` rebinds `scheduled_date` to today

**Files:**
- Modify: `src/lib/actions/workout.actions.ts`
- Create: `src/lib/actions/__tests__/workout-start-rebind.test.ts`

- [ ] **Step 1: Find and read the current startSession implementation**

Run:
```bash
grep -n "startSession\|start_session\|export async function start" src/lib/actions/workout.actions.ts
```

- [ ] **Step 2: Write failing test**

```typescript
// src/lib/actions/__tests__/workout-start-rebind.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startWorkout } from '../workout.actions'

vi.mock('@/lib/supabase/server', () => {
    const updateCalls: any[] = []
    return {
        __updateCalls: updateCalls,
        createClient: vi.fn(() => ({
            from: vi.fn((table: string) => ({
                update: vi.fn((payload: any) => {
                    updateCalls.push({ table, payload })
                    return {
                        eq: vi.fn().mockReturnThis(),
                        select: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: { id: 'w1' } })
                    }
                }),
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'w1', scheduled_date: '2026-04-14', status: 'pending' }
                })
            })),
            auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
        }))
    }
})

describe('startWorkout rebinds scheduled_date to today', () => {
    beforeEach(() => vi.clearAllMocks())

    it('updates workouts.scheduled_date to today when starting on a different day', async () => {
        await startWorkout('w1')
        const mod = await import('@/lib/supabase/server')
        // @ts-expect-error — test-only export
        const calls = mod.__updateCalls
        const today = new Date().toISOString().slice(0, 10)
        const hasRebind = calls.some(
            (c: any) => c.table === 'workouts' && c.payload.scheduled_date === today
        )
        expect(hasRebind).toBe(true)
    })
})
```

- [ ] **Step 3: Run test — expect FAIL**

Run:
```bash
npx vitest run src/lib/actions/__tests__/workout-start-rebind.test.ts
```
Expected: FAIL — current `startWorkout` does not write `scheduled_date` on start.

- [ ] **Step 4: Add rebind to `startWorkout`**

In `src/lib/actions/workout.actions.ts`, locate `startWorkout` (or equivalent). Add inside the action, before returning:

```typescript
const today = new Date().toISOString().slice(0, 10)
await supabase
    .from('workouts')
    .update({ scheduled_date: today })
    .eq('id', workoutId)
    .eq('user_id', user.id)

// Also transition session_inventory row to 'active' if linked
await supabase
    .from('session_inventory')
    .update({ status: 'active' })
    .eq('workout_id', workoutId)
    .eq('user_id', user.id)
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run src/lib/actions/__tests__/workout-start-rebind.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/workout.actions.ts src/lib/actions/__tests__/workout-start-rebind.test.ts
git commit -m "fix: startWorkout rebinds scheduled_date to today (bug #4)"
```

---

## Task 5: Fix bug #5 — load-scoring aggregates by calendar date

**Files:**
- Modify: `src/lib/scheduling/load-scoring.ts`
- Create: `src/lib/scheduling/__tests__/load-scoring.test.ts`

- [ ] **Step 1: Read current `load-scoring.ts`**

Run:
```bash
cat src/lib/scheduling/load-scoring.ts | head -120
```
Identify the function(s) that aggregate load per day. If aggregation is keyed on `training_day`, it's the bug.

- [ ] **Step 2: Write failing test — two sessions same calendar date**

```typescript
// src/lib/scheduling/__tests__/load-scoring.test.ts
import { describe, it, expect } from 'vitest'
import { computeDayLoad } from '../load-scoring'

describe('load-scoring by calendar date', () => {
    it('sums load for two sessions sharing a scheduled_date even if training_day differs', () => {
        const sessions = [
            { scheduled_date: '2026-04-14', training_day: 1, cns_load: 8, muscular_load: 6 },
            { scheduled_date: '2026-04-14', training_day: 2, cns_load: 4, muscular_load: 5 }
        ]
        const result = computeDayLoad(sessions)
        expect(result['2026-04-14']).toEqual({ cns: 12, muscular: 11 })
    })

    it('does NOT merge sessions from same training_day on different dates', () => {
        const sessions = [
            { scheduled_date: '2026-04-14', training_day: 1, cns_load: 8, muscular_load: 6 },
            { scheduled_date: '2026-04-15', training_day: 1, cns_load: 4, muscular_load: 5 }
        ]
        const result = computeDayLoad(sessions)
        expect(result['2026-04-14']).toEqual({ cns: 8, muscular: 6 })
        expect(result['2026-04-15']).toEqual({ cns: 4, muscular: 5 })
    })
})
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
npx vitest run src/lib/scheduling/__tests__/load-scoring.test.ts
```

- [ ] **Step 4: Add/refactor `computeDayLoad` keyed by `scheduled_date`**

Add (or refactor existing) in `src/lib/scheduling/load-scoring.ts`:

```typescript
export interface DayLoadInput {
    scheduled_date: string
    training_day: number
    cns_load: number
    muscular_load: number
}

export function computeDayLoad(
    sessions: DayLoadInput[]
): Record<string, { cns: number; muscular: number }> {
    const out: Record<string, { cns: number; muscular: number }> = {}
    for (const s of sessions) {
        if (!s.scheduled_date) continue
        const key = s.scheduled_date
        if (!out[key]) out[key] = { cns: 0, muscular: 0 }
        out[key].cns += s.cns_load ?? 0
        out[key].muscular += s.muscular_load ?? 0
    }
    return out
}
```

If there are existing consumers of a training_day-keyed version, update them to use the new signature; check via:
```bash
grep -rn "computeDayLoad\|day-load\|dayLoad" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run src/lib/scheduling/__tests__/load-scoring.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/scheduling/load-scoring.ts src/lib/scheduling/__tests__/load-scoring.test.ts
git commit -m "fix: load-scoring aggregates by calendar date (bug #5)"
```

---

## Task 6: `agent-activity.actions.ts` — `logDecision` helper

**Files:**
- Create: `src/lib/actions/agent-activity.actions.ts`
- Create: `src/lib/actions/__tests__/agent-activity.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/actions/__tests__/agent-activity.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logDecision } from '../agent-activity.actions'

const inserts: any[] = []
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            insert: vi.fn((row) => {
                inserts.push(row)
                return { select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { ...row, id: 'a1' } })
                }) }
            })
        })),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }))
}))

describe('agent-activity logDecision', () => {
    beforeEach(() => { inserts.length = 0; vi.clearAllMocks() })

    it('writes row with all required fields', async () => {
        await logDecision({
            coach: 'strength',
            decisionType: 'recalibration',
            targetEntity: { type: 'training_max', lift: 'squat' },
            reasoningStructured: { previousMax: 140, newMax: 132 },
            reasoningText: 'Training max 140→132kg'
        })
        expect(inserts[0].coach).toBe('strength')
        expect(inserts[0].decision_type).toBe('recalibration')
        expect(inserts[0].reasoning_text).toBe('Training max 140→132kg')
    })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/lib/actions/__tests__/agent-activity.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// src/lib/actions/agent-activity.actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'

export type AgentCoach =
    'strength' | 'hypertrophy' | 'endurance' | 'conditioning'
    | 'mobility' | 'recovery' | 'head'

export type AgentDecisionType = 'recalibration' | 'intervention_fired'

export interface LogDecisionInput {
    coach: AgentCoach
    decisionType: AgentDecisionType
    targetEntity: Record<string, unknown>
    reasoningStructured: Record<string, unknown>
    reasoningText: string
    mesocycleId?: string
    weekNumber?: number
}

export async function logDecision(input: LogDecisionInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const { data, error } = await supabase
        .from('agent_activity')
        .insert({
            user_id: user.id,
            coach: input.coach,
            decision_type: input.decisionType,
            target_entity: input.targetEntity,
            reasoning_structured: input.reasoningStructured,
            reasoning_text: input.reasoningText,
            mesocycle_id: input.mesocycleId,
            week_number: input.weekNumber
        })
        .select()
        .single()
    if (error) throw error
    return data
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run src/lib/actions/__tests__/agent-activity.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/agent-activity.actions.ts src/lib/actions/__tests__/agent-activity.test.ts
git commit -m "feat: agent-activity logDecision helper (Phase 2 writes only)"
```

---

## Task 7: Tiered recalibration gate

**Files:**
- Create: `src/lib/actions/recalibration.actions.ts`
- Create: `src/lib/actions/__tests__/recalibration.test.ts`

- [ ] **Step 1: Write failing tests for three tiers**

```typescript
// src/lib/actions/__tests__/recalibration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const decisionLog: any[] = []
const interventions: any[] = []

vi.mock('../agent-activity.actions', () => ({
    logDecision: vi.fn(async (i) => { decisionLog.push(i); return { id: 'a1' } })
}))
vi.mock('../ai-coach.actions', () => ({
    createIntervention: vi.fn(async (i) => { interventions.push(i); return { id: 'i1' } })
}))

import { evaluateRecalibration } from '../recalibration.actions'

describe('recalibration tiered gate', () => {
    beforeEach(() => {
        decisionLog.length = 0
        interventions.length = 0
        vi.clearAllMocks()
    })

    it('drift < 5%: applies, logs decision, no intervention', async () => {
        const res = await evaluateRecalibration({
            coach: 'strength',
            previousMax: 100,
            observedMax: 97,
            evidence: { sessionIds: ['s1'] }
        })
        expect(res.tier).toBe('visible')
        expect(res.applied).toBe(true)
        expect(decisionLog).toHaveLength(1)
        expect(interventions).toHaveLength(0)
    })

    it('drift 5–10%: applies, logs decision, no intervention', async () => {
        const res = await evaluateRecalibration({
            coach: 'strength',
            previousMax: 100,
            observedMax: 93,
            evidence: { sessionIds: ['s1'] }
        })
        expect(res.tier).toBe('logged')
        expect(res.applied).toBe(true)
        expect(decisionLog).toHaveLength(1)
        expect(interventions).toHaveLength(0)
    })

    it('drift > 10%: does NOT apply, creates intervention, logs intervention_fired', async () => {
        const res = await evaluateRecalibration({
            coach: 'strength',
            previousMax: 100,
            observedMax: 85,
            evidence: { sessionIds: ['s1','s2','s3'] }
        })
        expect(res.tier).toBe('intervention')
        expect(res.applied).toBe(false)
        expect(interventions).toHaveLength(1)
        expect(decisionLog[0].decisionType).toBe('intervention_fired')
    })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/lib/actions/__tests__/recalibration.test.ts
```

- [ ] **Step 3: Implement tiered gate**

```typescript
// src/lib/actions/recalibration.actions.ts
'use server'

import { logDecision, type AgentCoach } from './agent-activity.actions'
import { createIntervention } from './ai-coach.actions'

export interface RecalibrationInput {
    coach: AgentCoach
    previousMax: number
    observedMax: number
    evidence: { sessionIds: string[]; [k: string]: unknown }
    targetEntity?: Record<string, unknown>
    mesocycleId?: string
    weekNumber?: number
}

export type RecalibrationTier = 'visible' | 'logged' | 'intervention'

export interface RecalibrationResult {
    tier: RecalibrationTier
    applied: boolean
    newMax: number
    driftPct: number
}

export async function evaluateRecalibration(
    input: RecalibrationInput
): Promise<RecalibrationResult> {
    const drift = (input.observedMax - input.previousMax) / input.previousMax
    const absDriftPct = Math.abs(drift) * 100

    const base = {
        coach: input.coach,
        targetEntity: input.targetEntity ?? { type: 'training_max' },
        mesocycleId: input.mesocycleId,
        weekNumber: input.weekNumber
    }

    if (absDriftPct < 5) {
        await logDecision({
            ...base,
            decisionType: 'recalibration',
            reasoningStructured: {
                previousMax: input.previousMax,
                newMax: input.observedMax,
                driftPct: Number(drift.toFixed(4)),
                tier: 'visible',
                evidence: input.evidence
            },
            reasoningText:
                `Training max: ${input.previousMax}→${input.observedMax}kg ` +
                `(${(drift * 100).toFixed(1)}%)`
        })
        return { tier: 'visible', applied: true,
                 newMax: input.observedMax, driftPct: drift }
    }

    if (absDriftPct <= 10) {
        await logDecision({
            ...base,
            decisionType: 'recalibration',
            reasoningStructured: {
                previousMax: input.previousMax,
                newMax: input.observedMax,
                driftPct: Number(drift.toFixed(4)),
                tier: 'logged',
                evidence: input.evidence
            },
            reasoningText:
                `Training max recalibrated ${input.previousMax}→${input.observedMax}kg ` +
                `based on last sessions`
        })
        return { tier: 'logged', applied: true,
                 newMax: input.observedMax, driftPct: drift }
    }

    // > 10%: create intervention, do not auto-apply
    const intervention = await createIntervention({
        coach: input.coach,
        triggerType: 'recalibration_prompt',
        patternSignal: {
            previousMax: input.previousMax,
            observedMax: input.observedMax,
            driftPct: Number(drift.toFixed(4)),
            evidence: input.evidence
        }
    })
    await logDecision({
        ...base,
        decisionType: 'intervention_fired',
        targetEntity: { type: 'intervention', id: intervention.id },
        reasoningStructured: {
            previousMax: input.previousMax,
            observedMax: input.observedMax,
            driftPct: Number(drift.toFixed(4)),
            tier: 'intervention',
            interventionId: intervention.id,
            evidence: input.evidence
        },
        reasoningText:
            `Large drift (${(drift * 100).toFixed(1)}%) — coach asked to decide`
    })
    return { tier: 'intervention', applied: false,
             newMax: input.previousMax, driftPct: drift }
}
```

- [ ] **Step 4: Check `createIntervention` exists in `ai-coach.actions.ts`**

Run:
```bash
grep -n "createIntervention\|create_intervention" src/lib/actions/ai-coach.actions.ts
```
If missing, add a minimal stub here so tests pass; full implementation stays in Phase 1. Stub:

```typescript
// If absent in ai-coach.actions.ts, add:
export interface CreateInterventionInput {
    coach: string
    triggerType: string
    patternSignal: Record<string, unknown>
}
export async function createIntervention(input: CreateInterventionInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')
    const { data, error } = await supabase
        .from('ai_coach_interventions')
        .insert({
            user_id: user.id,
            coach: input.coach,
            trigger_type: input.triggerType,
            pattern_signal: input.patternSignal,
            reviewed: false
        })
        .select().single()
    if (error) throw error
    return data
}
```

Inspect the existing `ai_coach_interventions` table shape first — if column names differ, match them. If the table doesn't exist, it will need to be added in Phase 1's migration; for Phase 2 the stub can target an existing table or be a no-op returning a fake id (document the TODO).

- [ ] **Step 5: Run — expect PASS**

```bash
npx vitest run src/lib/actions/__tests__/recalibration.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/recalibration.actions.ts src/lib/actions/__tests__/recalibration.test.ts src/lib/actions/ai-coach.actions.ts
git commit -m "feat: tiered recalibration gate (<5%/5-10%/>10%)"
```

---

## Task 8: Wire recalibration into workout completion

**Files:**
- Modify: `src/lib/actions/workout.actions.ts`

- [ ] **Step 1: Find the workout completion handler**

Run:
```bash
grep -n "completeWorkout\|complete_workout\|markComplete\|status.*completed" src/lib/actions/workout.actions.ts
```

- [ ] **Step 2: Write failing integration-style test**

```typescript
// src/lib/actions/__tests__/workout-complete-recalibration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const recalibrationCalls: any[] = []
vi.mock('../recalibration.actions', () => ({
    evaluateRecalibration: vi.fn(async (i) => {
        recalibrationCalls.push(i)
        return { tier: 'logged', applied: true, newMax: i.observedMax, driftPct: -0.07 }
    })
}))

vi.mock('../performance-deltas.actions', () => ({
    computeDeltas: vi.fn(async () => [{ exercise: 'squat', driftPct: -0.07,
        previousMax: 140, observedMax: 130 }])
}))

import { completeWorkout } from '../workout.actions'

describe('completeWorkout wires recalibration', () => {
    beforeEach(() => { recalibrationCalls.length = 0; vi.clearAllMocks() })

    it('invokes evaluateRecalibration for each delta with trainingMax drift', async () => {
        await completeWorkout('w1')
        expect(recalibrationCalls.length).toBeGreaterThan(0)
        expect(recalibrationCalls[0].coach).toBeDefined()
    })
})
```

(Note: the mock for `@/lib/supabase/server` from Task 4 should also be present; copy that block or import a shared test helper.)

- [ ] **Step 3: Run — expect FAIL**

```bash
npx vitest run src/lib/actions/__tests__/workout-complete-recalibration.test.ts
```

- [ ] **Step 4: Modify `completeWorkout` to call recalibration**

Add after the deltas computation, inside `completeWorkout`:

```typescript
import { computeDeltas } from './performance-deltas.actions'
import { evaluateRecalibration } from './recalibration.actions'
import { advanceBlockPointer } from './block-pointer.actions'
import { computeDayLoad } from '@/lib/scheduling/load-scoring'

// ... inside completeWorkout after marking workout completed:
const today = new Date().toISOString().slice(0, 10)
await supabase.from('workouts')
    .update({ completed_date: today, status: 'completed' })
    .eq('id', workoutId).eq('user_id', user.id)

await supabase.from('session_inventory')
    .update({ status: 'completed' })
    .eq('workout_id', workoutId).eq('user_id', user.id)

const deltas = await computeDeltas(workoutId)
for (const d of deltas) {
    if (d.previousMax && d.observedMax) {
        await evaluateRecalibration({
            coach: d.coach ?? 'strength',
            previousMax: d.previousMax,
            observedMax: d.observedMax,
            evidence: { sessionIds: [workoutId], exercise: d.exercise },
            mesocycleId: workout.mesocycle_id,
            weekNumber: workout.week_number
        })
    }
}

if (workout.mesocycle_id && workout.week_number) {
    await advanceBlockPointer(workout.mesocycle_id, workout.week_number)
}
```

Inspect `computeDeltas` return shape first via:
```bash
grep -n "export.*computeDeltas\|return" src/lib/actions/performance-deltas.actions.ts | head -20
```
Match the field names exactly. If `previousMax`/`observedMax` aren't returned today, either enhance `computeDeltas` to derive them from `exercise_sets` (target vs actual top-set weight) or compute here using `training-max-estimation` skill.

- [ ] **Step 5: Run — expect PASS**

```bash
npx vitest run src/lib/actions/__tests__/workout-complete-recalibration.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/workout.actions.ts src/lib/actions/__tests__/workout-complete-recalibration.test.ts
git commit -m "feat: completeWorkout wires recalibration + advances pointer"
```

---

## Task 9: Training-max feed into next-session prescribed weights

**Files:**
- Modify: `src/lib/skills/domains/strength/training-max-estimation.ts`
- Modify: consumer (inspect `src/lib/actions/inventory-generation.actions.ts` or `programming.actions.ts`)

- [ ] **Step 1: Read the skill and find consumers**

Run:
```bash
cat src/lib/skills/domains/strength/training-max-estimation.ts
grep -rn "training-max-estimation\|training_max\|trainingMax" src/lib/ --include="*.ts" | head -20
```

- [ ] **Step 2: Write failing test**

```typescript
// src/lib/skills/__tests__/training-max-feedback.test.ts
import { describe, it, expect } from 'vitest'
import { trainingMaxEstimationSkill } from '../domains/strength/training-max-estimation'

describe('training-max-estimation consumed by prescriber', () => {
    it('given under-performed last session, returns reduced training max', () => {
        const result = trainingMaxEstimationSkill.execute({
            previousTrainingMaxKg: 140,
            topSetWeightKg: 125,
            topSetRepsPrescribed: 5,
            topSetRepsActual: 4,
            topSetRpeActual: 10
        })
        expect(result.recommendedTrainingMaxKg).toBeLessThan(140)
    })
})
```

- [ ] **Step 3: Run — FAIL (skill may accept different input keys)**

```bash
npx vitest run src/lib/skills/__tests__/training-max-feedback.test.ts
```

- [ ] **Step 4: Align skill input/output with the test (update skill if needed)**

Read the skill, confirm or add the `recommendedTrainingMaxKg` output. If present with different names, update the test to match. If absent, implement it.

- [ ] **Step 5: Wire into prescription generation**

In the file that generates prescribed weights for next session (likely `programming.actions.ts` or `inventory-generation.actions.ts`), replace the stale training-max lookup with a call to the skill using last-session data. Example:

```typescript
// before:
const trainingMax = athlete.starting_training_max_kg  // stale!

// after:
const { data: lastTop } = await supabase
    .from('exercise_sets')
    .select('target_weight_kg, actual_weight_kg, target_reps, actual_reps, rpe_actual')
    .eq('user_id', user.id).eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

const trainingMax = lastTop
    ? trainingMaxEstimationSkill.execute({
        previousTrainingMaxKg: athlete.starting_training_max_kg,
        topSetWeightKg: lastTop.actual_weight_kg ?? lastTop.target_weight_kg,
        topSetRepsPrescribed: lastTop.target_reps,
        topSetRepsActual: lastTop.actual_reps ?? lastTop.target_reps,
        topSetRpeActual: lastTop.rpe_actual ?? 8
    }).recommendedTrainingMaxKg
    : athlete.starting_training_max_kg
```

- [ ] **Step 6: Run existing skill tests + new test — expect PASS**

```bash
npx vitest run src/lib/skills/__tests__/training-max-estimation.test.ts src/lib/skills/__tests__/training-max-feedback.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/skills/domains/strength/training-max-estimation.ts src/lib/skills/__tests__/training-max-feedback.test.ts src/lib/actions/programming.actions.ts src/lib/actions/inventory-generation.actions.ts
git commit -m "feat: wire training-max estimation into next-session prescription"
```

---

## Task 10: `rebindCalendarDate` + `rescheduleToToday` + `markMissed`

**Files:**
- Modify: `src/lib/actions/inventory.actions.ts`
- Create: `src/lib/actions/__tests__/inventory-reschedule.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/actions/__tests__/inventory-reschedule.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const updates: any[] = []
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            update: vi.fn((p) => {
                updates.push(p)
                return { eq: vi.fn().mockReturnThis(),
                         select: vi.fn().mockReturnThis(),
                         single: vi.fn().mockResolvedValue({ data: { id: 'x' } }) }
            }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 's1', training_day: 3, scheduled_date: '2026-04-14',
                        workout_id: 'w1' }
            })
        })),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }))
}))

import { rebindCalendarDate, rescheduleToToday, markMissed }
    from '../inventory.actions'

describe('inventory reschedule actions', () => {
    beforeEach(() => { updates.length = 0; vi.clearAllMocks() })

    it('rebindCalendarDate updates scheduled_date, NOT training_day', async () => {
        await rebindCalendarDate('s1', '2026-04-16')
        const anyTrainingDayChange = updates.some(u => 'training_day' in u)
        expect(anyTrainingDayChange).toBe(false)
        const hasDateUpdate = updates.some(u => u.scheduled_date === '2026-04-16')
        expect(hasDateUpdate).toBe(true)
    })

    it('rescheduleToToday sets scheduled_date to today', async () => {
        await rescheduleToToday('s1')
        const today = new Date().toISOString().slice(0, 10)
        const hasToday = updates.some(u => u.scheduled_date === today)
        expect(hasToday).toBe(true)
    })

    it('markMissed transitions status to missed', async () => {
        await markMissed('s1')
        const hasMissed = updates.some(u => u.status === 'missed')
        expect(hasMissed).toBe(true)
    })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/lib/actions/__tests__/inventory-reschedule.test.ts
```

- [ ] **Step 3: Add the three actions to `inventory.actions.ts`**

Append to `src/lib/actions/inventory.actions.ts`:

```typescript
export async function rebindCalendarDate(sessionId: string, newDate: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const { data: session, error: readErr } = await supabase
        .from('session_inventory')
        .select('id, workout_id, user_id')
        .eq('id', sessionId).eq('user_id', user.id).maybeSingle()
    if (readErr) throw readErr
    if (!session) throw new Error('session not found')

    await supabase.from('session_inventory')
        .update({ scheduled_date: newDate })
        .eq('id', sessionId).eq('user_id', user.id)

    if (session.workout_id) {
        await supabase.from('workouts')
            .update({ scheduled_date: newDate })
            .eq('id', session.workout_id).eq('user_id', user.id)
    }
    return { success: true }
}

export async function rescheduleToToday(sessionId: string) {
    const today = new Date().toISOString().slice(0, 10)
    return rebindCalendarDate(sessionId, today)
}

export async function markMissed(sessionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const { error } = await supabase.from('session_inventory')
        .update({ status: 'missed' })
        .eq('id', sessionId).eq('user_id', user.id)
    if (error) throw error
    return { success: true }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run src/lib/actions/__tests__/inventory-reschedule.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/inventory.actions.ts src/lib/actions/__tests__/inventory-reschedule.test.ts
git commit -m "feat: rebindCalendarDate, rescheduleToToday, markMissed"
```

---

## Task 11: `allocateWeek` rewrite around `block_pointer`

**Files:**
- Modify: `src/lib/actions/inventory.actions.ts` (replace existing `allocateWeek`)
- Create: `src/lib/actions/__tests__/inventory-allocation.test.ts`

- [ ] **Step 1: Read the current `allocateWeek` implementation**

Run:
```bash
grep -n "allocateWeek\|allocate_week" src/lib/actions/inventory.actions.ts
```
Understand the shape before replacing it.

- [ ] **Step 2: Write failing test — allocateWeek takes next 7 from pointer and fills weekdays from today**

```typescript
// src/lib/actions/__tests__/inventory-allocation.test.ts
import { describe, it, expect, vi } from 'vitest'
import { addDays, format } from 'date-fns'

const updates: any[] = []
const pointerState = { next_training_day: 1 }

vi.mock('../block-pointer.actions', () => ({
    getBlockPointer: vi.fn(async () => pointerState)
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: Array.from({ length: 7 }).map((_, i) => ({
                    id: `s${i+1}`, training_day: i+1, scheduled_date: null,
                    modality: 'strength'
                }))
            }),
            update: vi.fn((p) => {
                updates.push(p)
                return { eq: vi.fn().mockReturnThis(),
                         in: vi.fn().mockResolvedValue({ data: null, error: null }) }
            })
        })),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }))
}))

import { allocateWeek } from '../inventory.actions'

describe('allocateWeek driven by block_pointer', () => {
    it('assigns scheduled_date to next 7 consecutive days starting today', async () => {
        const res = await allocateWeek('meso-1', 1)
        expect(res.allocated).toHaveLength(7)
        const today = new Date()
        const expectedDates = Array.from({ length: 7 })
            .map((_, i) => format(addDays(today, i), 'yyyy-MM-dd'))
        const actualDates = res.allocated.map((a: any) => a.scheduledDate)
        expect(actualDates).toEqual(expectedDates)
    })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
npx vitest run src/lib/actions/__tests__/inventory-allocation.test.ts
```

- [ ] **Step 4: Rewrite `allocateWeek` in `inventory.actions.ts`**

Keep the existing function signature if callers rely on it; replace the body:

```typescript
import { addDays, format } from 'date-fns'
import { getBlockPointer } from './block-pointer.actions'

export async function allocateWeek(mesocycleId: string, weekNumber: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const pointer = await getBlockPointer(mesocycleId, weekNumber)

    // Take the next 7 pending sessions from training_day = pointer.next_training_day onwards
    const { data: sessions, error } = await supabase
        .from('session_inventory')
        .select('id, training_day, session_slot, modality')
        .eq('user_id', user.id)
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', weekNumber)
        .eq('status', 'pending')
        .gte('training_day', pointer.next_training_day)
        .order('training_day', { ascending: true })
        .limit(7)
    if (error) throw error
    if (!sessions || sessions.length === 0) return { allocated: [] }

    const today = new Date()
    const allocations: { sessionId: string; scheduledDate: string }[] = []

    for (let i = 0; i < sessions.length; i++) {
        const scheduledDate = format(addDays(today, i), 'yyyy-MM-dd')
        allocations.push({ sessionId: sessions[i].id, scheduledDate })

        await supabase.from('session_inventory')
            .update({ scheduled_date: scheduledDate, is_allocated: true })
            .eq('id', sessions[i].id).eq('user_id', user.id)

        // Keep workouts.scheduled_date in sync if a workout row exists
        await supabase.from('workouts')
            .update({ scheduled_date: scheduledDate })
            .eq('user_id', user.id)
            .eq('session_inventory_id', sessions[i].id)
    }

    return { allocated: allocations }
}
```

Check the actual FK name linking `workouts` to `session_inventory` (might be `inventory_id` or `session_id`) and match it:
```bash
grep -E "session_inventory_id|inventory_id" supabase/migrations/*.sql | head -10
```

- [ ] **Step 5: Run — expect PASS**

```bash
npx vitest run src/lib/actions/__tests__/inventory-allocation.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/inventory.actions.ts src/lib/actions/__tests__/inventory-allocation.test.ts
git commit -m "feat: allocateWeek driven by block_pointer, fills next 7 days"
```

---

## Task 12: `WeekViewClient` component

**Files:**
- Create: `src/components/dashboard/WeekViewClient.tsx`
- Reference: `src/components/planner/PlannerClient.tsx` (extracting drag + launch behavior)

- [ ] **Step 1: Read `PlannerClient.tsx`**

```bash
wc -l src/components/planner/PlannerClient.tsx
cat src/components/planner/PlannerClient.tsx | head -80
```

- [ ] **Step 2: Create `WeekViewClient.tsx`**

```typescript
// src/components/dashboard/WeekViewClient.tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addDays, format, startOfWeek } from 'date-fns'
import { rebindCalendarDate } from '@/lib/actions/inventory.actions'
import { startWorkout } from '@/lib/actions/workout.actions'

interface SessionInWeek {
    id: string
    training_day: number
    scheduled_date: string | null
    status: 'pending' | 'active' | 'completed' | 'missed' | 'off_plan'
    modality: string
    workout_id: string | null
    display_name: string
    estimated_duration_minutes: number | null
}

interface Props {
    sessions: SessionInWeek[]
    weekStart?: Date   // defaults to startOfWeek(today)
}

export function WeekViewClient({ sessions, weekStart }: Props) {
    const [isPending, startTransition] = useTransition()
    const [dragSessionId, setDragSessionId] = useState<string | null>(null)
    const router = useRouter()

    const start = weekStart ?? startOfWeek(new Date(), { weekStartsOn: 1 })
    const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i))

    const sessionsByDate = sessions.reduce<Record<string, SessionInWeek[]>>((acc, s) => {
        if (!s.scheduled_date) return acc
        acc[s.scheduled_date] = [...(acc[s.scheduled_date] ?? []), s]
        return acc
    }, {})

    function onDragStart(sessionId: string) {
        setDragSessionId(sessionId)
    }

    function onDrop(targetDate: string) {
        if (!dragSessionId) return
        startTransition(async () => {
            await rebindCalendarDate(dragSessionId, targetDate)
            setDragSessionId(null)
            router.refresh()
        })
    }

    async function onLaunch(session: SessionInWeek) {
        if (!session.workout_id) return
        startTransition(async () => {
            await startWorkout(session.workout_id!)
            router.push(`/workout/${session.workout_id}`)
        })
    }

    return (
        <div className="grid grid-cols-7 gap-2 text-sm">
            {days.map(day => {
                const key = format(day, 'yyyy-MM-dd')
                const list = sessionsByDate[key] ?? []
                return (
                    <div
                        key={key}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => onDrop(key)}
                        className="min-h-40 rounded-md border border-white/10 bg-neutral-950 p-2"
                    >
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                            {format(day, 'EEE d')}
                        </div>
                        <div className="mt-2 space-y-2">
                            {list.map(s => (
                                <div
                                    key={s.id}
                                    draggable
                                    onDragStart={() => onDragStart(s.id)}
                                    className="rounded border border-white/10 bg-neutral-900 p-2"
                                >
                                    <div className="font-medium">{s.display_name}</div>
                                    <div className="text-[10px] text-neutral-500">
                                        Day {s.training_day} · {s.modality}
                                        {s.estimated_duration_minutes
                                            ? ` · ${s.estimated_duration_minutes}m` : ''}
                                    </div>
                                    {s.workout_id && s.status !== 'completed' ? (
                                        <button
                                            onClick={() => onLaunch(s)}
                                            disabled={isPending}
                                            className="mt-2 text-xs text-amber-400 underline"
                                        >
                                            Start
                                        </button>
                                    ) : s.status === 'missed' ? (
                                        <span className="mt-2 inline-block text-xs text-red-400">
                                            Missed — drag to reschedule
                                        </span>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
```

- [ ] **Step 3: Smoke-render via temporary fixture (no test required; Playwright in Task 16)**

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/WeekViewClient.tsx
git commit -m "feat: WeekViewClient — 7-day strip with drag + launch"
```

---

## Task 13: Embed `WeekViewClient` in dashboard, retire `/planner`

**Files:**
- Modify: `src/components/dashboard/SessionPoolClient.tsx`
- Modify: `src/app/dashboard/page.tsx` (or wherever the week data is fetched)
- Delete: `src/app/planner/page.tsx`, `src/components/planner/PlannerClient.tsx`

- [ ] **Step 1: Identify the dashboard data-fetch**

```bash
grep -n "SessionPoolClient\|session_inventory" src/app/dashboard/ -r
```

- [ ] **Step 2: Fetch week sessions alongside inventory and render `WeekViewClient`**

In the dashboard page or SessionPoolClient's parent:

```typescript
// Fetch the current week's sessions for the WeekView
const { data: weekSessions } = await supabase
    .from('session_inventory')
    .select(`
        id, training_day, scheduled_date, status, modality,
        estimated_duration_minutes,
        workout:workouts(id),
        display_name
    `)
    .eq('user_id', user.id)
    .eq('mesocycle_id', activeMesocycleId)
    .eq('week_number', activeWeek)

// pass weekSessions into <WeekViewClient sessions={weekSessions} />
```

Flatten the `workout` join into `workout_id` as the component expects, and compute `display_name` if not stored (fall back to modality-based label).

- [ ] **Step 3: Remove planner link from SessionPoolClient**

```bash
grep -n "planner\|Open Full Planner" src/components/dashboard/SessionPoolClient.tsx
```
Delete any button/link that navigates to `/planner`. Replace with the `WeekViewClient` embedded directly.

- [ ] **Step 4: Delete retired files**

```bash
git rm src/app/planner/page.tsx src/components/planner/PlannerClient.tsx
```

- [ ] **Step 5: Check no other code references the removed route**

```bash
grep -rn "/planner" src/ --include="*.ts" --include="*.tsx"
```
Remove any stragglers.

- [ ] **Step 6: Smoke-run the dev server**

```bash
npm run dev
```
Open `http://localhost:3001/dashboard` — confirm: (a) WeekView renders with sessions; (b) no links to `/planner`; (c) `/planner` returns 404.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/SessionPoolClient.tsx src/app/dashboard/
git rm src/app/planner/page.tsx src/components/planner/PlannerClient.tsx
git commit -m "refactor: embed WeekViewClient in dashboard, retire /planner (bugs #1, #2, #3)"
```

---

## Task 14: `CoachNotesBanner` surfaces recalibration note

**Files:**
- Modify: `src/components/workout/CoachNotesBanner.tsx`

- [ ] **Step 1: Read the current banner**

```bash
cat src/components/workout/CoachNotesBanner.tsx
```

- [ ] **Step 2: Add recalibration-note fetch**

In the banner's parent (or within the banner if it's a Server Component), query the most recent `agent_activity` row with `decision_type='recalibration'` for this workout's exercise set and render a line like:

```tsx
{recalibration ? (
    <div className="mt-2 rounded bg-amber-900/40 p-2 text-xs">
        <span className="font-medium">Coach adjusted: </span>
        {recalibration.reasoning_text}
    </div>
) : null}
```

Fetch (Server Component preferred):

```typescript
const { data: recalibration } = await supabase
    .from('agent_activity')
    .select('reasoning_text, reasoning_structured')
    .eq('user_id', user.id)
    .eq('decision_type', 'recalibration')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
```

(Phase 3 will filter by `target_entity` matching the current session; this Phase 2 surface just shows the most-recent.)

- [ ] **Step 3: Visual smoke-test**

```bash
npm run dev
```
Complete a workout with a non-trivial delta, then start another session — confirm banner renders the note.

- [ ] **Step 4: Commit**

```bash
git add src/components/workout/CoachNotesBanner.tsx
git commit -m "feat: CoachNotesBanner surfaces recalibration note"
```

---

## Task 15: Rebuild `/log-session` off-plan logging page

**Files:**
- Check for existing `/log-session` path first:
```bash
grep -rn "log-session\|log_session\|logAdHoc" src/app/ src/components/ src/lib/actions/
```
Reuse the existing route if present; otherwise create.
- Create: `src/app/log-session/page.tsx`
- Create: `src/components/dashboard/LogSessionForm.tsx`
- Modify: `src/lib/actions/logging.actions.ts` (or appropriate action file)

- [ ] **Step 1: Verify `off_plan_sessions` table exists (it does NOT yet — created in Phase 1's migration)**

For Phase 2, temporarily use the existing logging path. Add a minimal `off_plan_sessions` table to migration 014 so Phase 2 can land the rebuilt page without waiting on Phase 1:

Append to `supabase/migrations/014_training_day_model_cleanup.sql`:

```sql
CREATE TABLE IF NOT EXISTS off_plan_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    modality TEXT NOT NULL,
    duration_minutes INT NOT NULL,
    rpe SMALLINT,
    notes TEXT,
    count_toward_load BOOLEAN NOT NULL DEFAULT TRUE,
    linked_domain TEXT
);
CREATE INDEX IF NOT EXISTS idx_off_plan_sessions_user_date
    ON off_plan_sessions(user_id, logged_at DESC);
ALTER TABLE off_plan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "off_plan_sessions owner all" ON off_plan_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Re-run migration:
```bash
npx supabase db push
npx supabase gen types typescript --local > src/lib/types/database.types.ts
```

Amend the earlier commit or add a new migration file. Prefer a new commit for clarity:
```bash
git add supabase/migrations/014_training_day_model_cleanup.sql src/lib/types/database.types.ts
git commit -m "feat: off_plan_sessions table in migration 014"
```

- [ ] **Step 2: Create the server action `logOffPlanSession`**

```typescript
// in src/lib/actions/logging.actions.ts (or a new off-plan.actions.ts)
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface LogOffPlanInput {
    modality: string
    durationMinutes: number
    rpe?: number
    notes?: string
    countTowardLoad?: boolean
}

const DOMAIN_BY_MODALITY: Record<string, string> = {
    run: 'endurance', ride: 'endurance',
    strength: 'strength', hypertrophy: 'hypertrophy',
    conditioning: 'conditioning', mobility: 'mobility'
}
const DEFAULT_COUNT_BY_MODALITY: Record<string, boolean> = {
    run: true, ride: true, strength: true, hypertrophy: true,
    conditioning: true, mobility: false, other: false
}

export async function logOffPlanSession(input: LogOffPlanInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const countToward = input.countTowardLoad
        ?? DEFAULT_COUNT_BY_MODALITY[input.modality]
        ?? false
    const linkedDomain = DOMAIN_BY_MODALITY[input.modality] ?? null

    const { data, error } = await supabase.from('off_plan_sessions')
        .insert({
            user_id: user.id,
            modality: input.modality,
            duration_minutes: input.durationMinutes,
            rpe: input.rpe,
            notes: input.notes,
            count_toward_load: countToward,
            linked_domain: linkedDomain
        })
        .select().single()
    if (error) throw error

    revalidatePath('/dashboard')
    revalidatePath('/log-session')
    return data
}
```

- [ ] **Step 3: Create the form component**

```typescript
// src/components/dashboard/LogSessionForm.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logOffPlanSession } from '@/lib/actions/logging.actions'

const MODALITIES = ['run', 'ride', 'strength', 'conditioning', 'mobility', 'other']

export function LogSessionForm() {
    const [modality, setModality] = useState('run')
    const [duration, setDuration] = useState(30)
    const [rpe, setRpe] = useState<number | ''>('')
    const [notes, setNotes] = useState('')
    const [countToward, setCountToward] = useState(true)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    function submit() {
        startTransition(async () => {
            await logOffPlanSession({
                modality,
                durationMinutes: duration,
                rpe: typeof rpe === 'number' ? rpe : undefined,
                notes: notes || undefined,
                countTowardLoad: countToward
            })
            router.push('/dashboard')
        })
    }

    return (
        <form
            onSubmit={e => { e.preventDefault(); submit() }}
            className="space-y-4 max-w-md"
        >
            <label className="block">
                <span className="text-xs uppercase tracking-widest">Modality</span>
                <select value={modality}
                    onChange={e => setModality(e.target.value)}
                    className="mt-1 w-full rounded bg-neutral-900 border border-white/10 p-2">
                    {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </label>
            <label className="block">
                <span className="text-xs uppercase tracking-widest">Duration (min)</span>
                <input type="number" min={1} value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    className="mt-1 w-full rounded bg-neutral-900 border border-white/10 p-2" />
            </label>
            <label className="block">
                <span className="text-xs uppercase tracking-widest">RPE (1-10, optional)</span>
                <input type="number" min={1} max={10} value={rpe}
                    onChange={e => setRpe(e.target.value ? Number(e.target.value) : '')}
                    className="mt-1 w-full rounded bg-neutral-900 border border-white/10 p-2" />
            </label>
            <label className="block">
                <span className="text-xs uppercase tracking-widest">Notes (optional)</span>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    className="mt-1 w-full rounded bg-neutral-900 border border-white/10 p-2" />
            </label>
            <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={countToward}
                    onChange={e => setCountToward(e.target.checked)} />
                Count toward training load
            </label>
            <button type="submit" disabled={isPending}
                className="rounded bg-amber-500 text-black px-4 py-2 font-medium">
                {isPending ? 'Logging…' : 'Log Session'}
            </button>
        </form>
    )
}
```

- [ ] **Step 4: Create the page**

```typescript
// src/app/log-session/page.tsx
import { LogSessionForm } from '@/components/dashboard/LogSessionForm'
import { BottomNav } from '@/components/ui/bottom-nav'

export default function LogSessionPage() {
    return (
        <div className="min-h-screen bg-[#020202] text-white pb-24">
            <div className="max-w-md mx-auto p-6">
                <h1 className="text-lg font-medium mb-4">Log off-plan session</h1>
                <LogSessionForm />
            </div>
            <BottomNav />
        </div>
    )
}
```

(Check `BottomNav` import path matches existing usage in other pages.)

- [ ] **Step 5: Smoke-test**

```bash
npm run dev
```
Open `http://localhost:3001/log-session` — confirm form renders, submit creates a row, navigates back.

- [ ] **Step 6: Commit**

```bash
git add src/app/log-session/page.tsx src/components/dashboard/LogSessionForm.tsx src/lib/actions/logging.actions.ts
git commit -m "feat: rebuild /log-session off-plan logging page"
```

---

## Task 16: Integration regression test for the full training loop

**Files:**
- Create: `src/lib/actions/__tests__/training-loop.integration.test.ts`

- [ ] **Step 1: Write the integration test**

```typescript
// src/lib/actions/__tests__/training-loop.integration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration-style: exercises allocate → start (rebind) → complete
 * → recalibration → pointer advance. Uses stubbed supabase responses
 * that simulate a 6-session week.
 */

// ... (mock block: a shared in-memory supabase double with:
//   - session_inventory rows 1..6 pending at training_day 1..6
//   - block_pointer starting at next_training_day = 1
//   - workouts rows linked to each session
// Pattern: build a tiny in-memory store object, return it via from() factory.
// Because the real loop already has separate unit tests, this integration
// can be coarse: assert pointer advances + scheduled_date updates happen
// in order after sequential allocate → start → complete.)

describe('training loop integration', () => {
    it('allocate → start rebinds to today → complete advances pointer', async () => {
        // Detailed fixture setup omitted for brevity in this plan;
        // implement by composing mocks from Tasks 3,4,8,10,11.
        // Expected assertions:
        // 1. After allocateWeek: all 6 sessions have scheduled_date set, earliest = today
        // 2. After startWorkout(session1.workout_id) on a different day:
        //    workouts.scheduled_date = today
        //    session_inventory.status = 'active'
        // 3. After completeWorkout(workout1):
        //    session_inventory.status = 'completed'
        //    block_pointer.next_training_day = 2
        //    evaluateRecalibration was called
        expect(true).toBe(true) // placeholder until fixture is wired
    })
})
```

- [ ] **Step 2: Flesh out the fixture to run the asserted chain**

Compose mocks from the prior tests. Keep this test coarse — its job is regression coverage for the loop, not a substitute for per-task unit tests.

- [ ] **Step 3: Run — expect PASS**

```bash
npx vitest run src/lib/actions/__tests__/training-loop.integration.test.ts
```

- [ ] **Step 4: Run full suite**

```bash
npx vitest run
```
Expected: all tests pass (135 existing + ~12 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/__tests__/training-loop.integration.test.ts
git commit -m "test: training loop integration regression"
```

---

## Task 17: Manual regression pass on all 5 bugs

**Files:** none — UI verification.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Bug #1 check — allocated sessions appear on week view**

Navigate to `/dashboard`. Click "Allocate Week" for an unallocated week. Confirm sessions appear in the `WeekViewClient` grid on the right, one per weekday starting today.

- [ ] **Step 3: Bug #2 check — session launch works from week view**

Click "Start" on a session card in the week view. Confirm: (a) page navigates to `/workout/[id]`, (b) the workout loads with prescribed exercises, (c) `/planner` returns 404.

- [ ] **Step 4: Bug #3 check — drag sessions between days**

Drag a session card to another weekday. Confirm: (a) card moves, (b) underlying `session_inventory.scheduled_date` updates (verify in Supabase dashboard or via query), (c) `training_day` stays unchanged.

- [ ] **Step 5: Bug #4 check — start on wrong day rebinds**

Start a session that was scheduled for tomorrow today. Confirm `workouts.scheduled_date` updates to today (check via database query), and the session status transitions to `active`.

- [ ] **Step 6: Bug #5 check — same-day overreach detection**

Allocate two sessions onto the same date (drag them both to today). Confirm the load-indicator chip on that day shows the aggregated load (high / overloaded), not the individual load of one session. Reassign load to separate days and confirm the chip updates.

- [ ] **Step 7: Document in commit**

No code changes; this is a verification pass. Note any defects and add follow-up tasks before marking Phase 2 complete.

---

## Self-Review

After writing this plan, rechecked against the Phase 2 spec:

**Spec coverage:**
- ✅ Architecture invariants (ordered training_day, pointer, start-rebinds-to-today, miss skips forward) — Tasks 3, 4, 10, 11
- ✅ Retire `/planner`, evolve `SessionPoolClient`, move PlannerClient → WeekViewClient — Tasks 12, 13
- ✅ Tiered recalibration (<5%/5-10%/>10%) — Task 7
- ✅ `agent_activity` table created here (Phase 2 owns) — Task 2
- ✅ `block_pointer` table — Task 2; actions — Task 3
- ✅ `training-max-estimation` wired into prescriptions — Task 9
- ✅ `CoachNotesBanner` surfaces recalibration — Task 14
- ✅ `/log-session` rebuilt — Task 15
- ✅ Load-scoring aggregates by calendar date — Task 5
- ✅ `rebindCalendarDate`, `rescheduleToToday`, `markMissed` — Task 10
- ✅ All 5 bugs mapped to tasks — Task 17 regression

**Placeholder scan:** Task 16's integration test body is marked "flesh out fixture" — this is acceptable because the individual units are fully tested in Tasks 3, 4, 5, 7, 8, 10, 11. Engineer composes existing mocks; no new logic is implied.

**Type consistency:** `training_day` used throughout (matches existing DB column). `mesocycle_id` + `week_number` passed consistently to `block-pointer` and `agent-activity` helpers. `evaluateRecalibration` signature consistent across Tasks 7 and 8.

**Cross-phase:** `agent_activity` table minimal shape (decision_type enum: `recalibration`, `intervention_fired`) is a subset of Phase 3's extended enum — Phase 3 will `ALTER TABLE` to expand. Documented in spec.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-phase-2-training-loop.md`.

Next: Phase 1 and Phase 3 plans to be written after Phase 2 execution (or concurrently if Steven prefers).
