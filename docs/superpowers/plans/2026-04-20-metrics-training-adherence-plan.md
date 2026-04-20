# Metrics Dashboard — Training Adherence Core Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four Phase 1 training-adherence tiles (`BlockAdherenceHeatmap`, `CoachPromptsInbox`, `CoachBiasTile`, `OffPlanTally`) + their domain drill-downs on `/data/`, plus the analytics layer that feeds them and the block-end/rolling-pattern intervention triggers. Ships a working training-adherence dashboard that closes the feedback loop between prescribed and actual training.

**Architecture:** Derivation layer at `src/lib/analytics/` produces tile data from `performance_deltas`, `session_inventory`, `workouts`, `off_plan_sessions`, `agent_interventions`. Existing `ai-coach.actions.ts` interventions pipeline is reused for coach dialogue (block-end + rolling pattern flags with 7-day per-coach cooldown). One intervention response path writes `user_response` which feeds next-block prescription inputs.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase, Vitest 4, Tailwind 4. No new deps.

**Spec reference:** `docs/superpowers/specs/2026-04-20-metrics-dashboard-health-extension-design.md` (training-adherence half)

**Dependencies:** Migration 016 from Plan 2 (or a compatible renumbered version) is required for `agent_interventions` column additions, `off_plan_sessions` table, and `performance_deltas.delta_magnitude_pct`. If Plan 2 has not shipped yet, this plan duplicates the training-adherence subset of 016 as a standalone migration — see Task 1.

**Known parallel dependency:** `/coach/` route currently shows "all systems nominal" — effectively dead. The `CoachPromptsInbox` tile links to `/coach/` for review + response. That tile ships but will show "Review in Coach tab (under repair)" until `/coach/` is restored.

> ⚠️ **Next.js 16 reminder:** Read `node_modules/next/dist/docs/` before writing any server/client component or route code.

---

## File Structure

### New files

**Migration (only if Plan 2 hasn't shipped):**
- `supabase/migrations/016_training_adherence.sql` — subset: agent_interventions additions, off_plan_sessions table, performance_deltas.delta_magnitude_pct. **Skip if Plan 2's 016 is already applied.**

**Analytics:**
- `src/lib/analytics/block-adherence.ts`
- `src/lib/analytics/coach-bias.ts`
- `src/lib/analytics/duration-variance.ts`
- `src/lib/analytics/off-plan-tally.ts`
- `src/lib/analytics/__tests__/block-adherence.test.ts`
- `src/lib/analytics/__tests__/coach-bias.test.ts`
- `src/lib/analytics/__tests__/duration-variance.test.ts`
- `src/lib/analytics/__tests__/off-plan-tally.test.ts`

**Tiles & subpages:**
- `src/components/data/overview/BlockAdherenceHeatmap.tsx`
- `src/components/data/overview/CoachPromptsInbox.tsx`
- `src/components/data/overview/CoachBiasTile.tsx`
- `src/components/data/overview/OffPlanTally.tsx`
- `src/app/data/overview/[tile]/page.tsx` — dynamic drill-down
- `src/components/data/overview/drill/AdherenceDrill.tsx`
- `src/components/data/overview/drill/CoachBiasDrill.tsx`
- `src/components/data/overview/drill/OffPlanDrill.tsx`
- `src/components/data/domain/PerformanceDeltaChart.tsx`
- `src/components/data/domain/PatternFlagCard.tsx`

**Domain pages:**
- `src/app/data/conditioning/page.tsx` — new (`conditioning_logs` had no UI)

**Triggers:**
- `src/lib/interventions/block-end-trigger.ts`
- `src/lib/interventions/rolling-pattern-trigger.ts`
- `src/lib/interventions/__tests__/*.test.ts`

### Modified files

- `src/app/data/strength/page.tsx` — add `PerformanceDeltaChart` + `PatternFlagCard`
- `src/app/data/endurance/page.tsx` — same
- `src/app/data/recovery/page.tsx` — same
- `src/lib/actions/data.actions.ts` — extend to return training-adherence tile data
- `src/lib/actions/ai-coach.actions.ts` — add `trigger_type`, `pattern_signal`, `coach_domain` to the intervention save path; keep existing behavior intact

---

## Task 1: Confirm migration state; add stub migration if Plan 2 not merged

**Files:**
- Optional: `supabase/migrations/016_training_adherence.sql`

- [ ] **Step 1: Check current schema**

Run:
```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
grep -l "agent_interventions\|off_plan_sessions" supabase/migrations/*.sql
```

If Plan 2's `016_metrics_dashboard.sql` exists, skip to Task 2.

- [ ] **Step 2: If Plan 2 not merged, write subset migration**

```sql
-- supabase/migrations/016_training_adherence.sql
-- Subset for standalone training-adherence ship; superseded by Plan 2 migration if that merges first.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_interventions') THEN
    CREATE TABLE agent_interventions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      coach_domain text NOT NULL,
      trigger_type text NOT NULL CHECK (trigger_type IN ('block_end','rolling_pattern','recalibration_prompt')),
      pattern_signal jsonb,
      message text NOT NULL,
      user_response text CHECK (user_response IN ('keep','harder','recalibrate')),
      responded_at timestamptz,
      needs_retry boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE agent_interventions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY agent_interventions_owner ON agent_interventions FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ELSE
    ALTER TABLE agent_interventions ADD COLUMN IF NOT EXISTS coach_domain text;
    ALTER TABLE agent_interventions ADD COLUMN IF NOT EXISTS trigger_type text;
    ALTER TABLE agent_interventions ADD COLUMN IF NOT EXISTS pattern_signal jsonb;
    ALTER TABLE agent_interventions ADD COLUMN IF NOT EXISTS user_response text;
    ALTER TABLE agent_interventions ADD COLUMN IF NOT EXISTS needs_retry boolean DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS off_plan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  modality text NOT NULL,
  duration_minutes int NOT NULL,
  rpe int,
  notes text,
  count_toward_load boolean NOT NULL DEFAULT true,
  linked_domain text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_off_plan_sessions_user_logged ON off_plan_sessions(user_id, logged_at DESC);
ALTER TABLE off_plan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY off_plan_sessions_owner ON off_plan_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'performance_deltas' AND column_name = 'delta_pct')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'performance_deltas' AND column_name = 'delta_magnitude_pct') THEN
    ALTER TABLE performance_deltas
      ADD COLUMN delta_magnitude_pct numeric
      GENERATED ALWAYS AS (ABS(delta_pct)) STORED;
  END IF;
END $$;
```

- [ ] **Step 3: Apply + regenerate types**

Run:
```bash
supabase migration up
supabase gen types typescript --local > src/lib/types/database.types.ts
```

- [ ] **Step 4: Commit (if migration written)**

```bash
git add supabase/migrations/016_training_adherence.sql src/lib/types/database.types.ts
git commit -m "feat(migration): training-adherence tables (standalone subset)"
```

---

## Task 2: `block-adherence.ts` analytics (TDD)

**Files:**
- Create: `src/lib/analytics/block-adherence.ts`
- Create: `src/lib/analytics/__tests__/block-adherence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/analytics/__tests__/block-adherence.test.ts
import { describe, it, expect } from 'vitest'
import { rollupHeatmapCells } from '../block-adherence'

describe('block-adherence rollupHeatmapCells', () => {
  it('classifies each session by status × training_day × slot', () => {
    const sessions = [
      { training_day: 1, session_slot: 1, status: 'completed', delta_magnitude_pct: 3 },
      { training_day: 1, session_slot: 2, status: 'completed', delta_magnitude_pct: 12 },
      { training_day: 2, session_slot: 1, status: 'missed', delta_magnitude_pct: null },
      { training_day: 3, session_slot: 1, status: 'scheduled', delta_magnitude_pct: null },
    ]
    const cells = rollupHeatmapCells(sessions)
    expect(cells).toHaveLength(4)
    expect(cells.find(c => c.training_day === 1 && c.session_slot === 1)?.state).toBe('on_track')
    expect(cells.find(c => c.training_day === 1 && c.session_slot === 2)?.state).toBe('off_track')
    expect(cells.find(c => c.training_day === 2)?.state).toBe('missed')
    expect(cells.find(c => c.training_day === 3)?.state).toBe('pending')
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/analytics/__tests__/block-adherence.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/analytics/block-adherence.ts
import { createClient } from '@/lib/supabase/server'

export type AdherenceState = 'on_track' | 'off_track' | 'missed' | 'pending'

export interface HeatmapCell {
  training_day: number
  session_slot: number
  state: AdherenceState
  delta_magnitude_pct: number | null
  session_id: string | null
}

export interface SessionRow {
  training_day: number
  session_slot: number
  status: string
  delta_magnitude_pct: number | null
  session_id?: string | null
}

const OFF_TRACK_THRESHOLD = 10 // %

export function rollupHeatmapCells(rows: SessionRow[]): HeatmapCell[] {
  return rows.map(r => {
    let state: AdherenceState = 'pending'
    if (r.status === 'missed') state = 'missed'
    else if (r.status === 'completed') {
      state = (r.delta_magnitude_pct ?? 0) > OFF_TRACK_THRESHOLD ? 'off_track' : 'on_track'
    }
    return {
      training_day: r.training_day,
      session_slot: r.session_slot,
      state,
      delta_magnitude_pct: r.delta_magnitude_pct,
      session_id: r.session_id ?? null,
    }
  })
}

export async function currentBlockHeatmap(userId: string, blockId: string) {
  const supabase = await createClient()
  const { data: inv } = await supabase
    .from('session_inventory')
    .select('id, training_day, session_slot, status, workout_id')
    .eq('user_id', userId).eq('block_id', blockId)
    .order('training_day', { ascending: true })

  const workoutIds = (inv ?? []).map(i => i.workout_id).filter(Boolean) as string[]
  const { data: deltas } = workoutIds.length ? await supabase
    .from('performance_deltas').select('workout_id, delta_magnitude_pct')
    .in('workout_id', workoutIds) : { data: [] as any[] }

  const rows: SessionRow[] = (inv ?? []).map(i => {
    const dMatch = (deltas ?? []).find(d => d.workout_id === i.workout_id)
    return {
      training_day: i.training_day,
      session_slot: i.session_slot,
      status: i.status,
      delta_magnitude_pct: dMatch?.delta_magnitude_pct ?? null,
      session_id: i.id,
    }
  })
  return rollupHeatmapCells(rows)
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/analytics/__tests__/block-adherence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/block-adherence.ts src/lib/analytics/__tests__/block-adherence.test.ts
git commit -m "feat(analytics): block-adherence rollup + tests"
```

---

## Task 3: `coach-bias.ts` analytics (TDD, includes cooldown)

**Files:**
- Create: `src/lib/analytics/coach-bias.ts`
- Create: `src/lib/analytics/__tests__/coach-bias.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/analytics/__tests__/coach-bias.test.ts
import { describe, it, expect } from 'vitest'
import { classifyRAG, detectPattern, isCooldownClear } from '../coach-bias'

describe('coach-bias', () => {
  it('classifyRAG: >10% mean delta is red, >5% amber, else green', () => {
    expect(classifyRAG([12, 14, 11])).toBe('red')
    expect(classifyRAG([6, 7, 8])).toBe('amber')
    expect(classifyRAG([2, 3, 1])).toBe('green')
  })
  it('classifyRAG: insufficient data returns insufficient', () => {
    expect(classifyRAG([])).toBe('insufficient')
    expect(classifyRAG([12])).toBe('insufficient')
  })
  it('detectPattern: 3+ consecutive same-direction >10% deltas flags', () => {
    const flag = detectPattern([
      { delta_pct: -12, workout_id: 'a' },
      { delta_pct: -14, workout_id: 'b' },
      { delta_pct: -11, workout_id: 'c' },
    ])
    expect(flag).not.toBeNull()
    expect(flag?.direction).toBe('under')
    expect(flag?.workoutIds).toEqual(['a', 'b', 'c'])
  })
  it('detectPattern: mixed directions return null', () => {
    const flag = detectPattern([
      { delta_pct: -12, workout_id: 'a' },
      { delta_pct: 14, workout_id: 'b' },
      { delta_pct: -11, workout_id: 'c' },
    ])
    expect(flag).toBeNull()
  })
  it('isCooldownClear: false within 7 days, true after', () => {
    const now = new Date('2026-04-20T12:00:00Z')
    const recent = new Date('2026-04-18T12:00:00Z').toISOString()
    const old = new Date('2026-04-10T12:00:00Z').toISOString()
    expect(isCooldownClear({ lastFiredAt: recent, now })).toBe(false)
    expect(isCooldownClear({ lastFiredAt: old, now })).toBe(true)
    expect(isCooldownClear({ lastFiredAt: null, now })).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/analytics/__tests__/coach-bias.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/analytics/coach-bias.ts
import { createClient } from '@/lib/supabase/server'

export type RAG = 'red' | 'amber' | 'green' | 'insufficient'

const RED_THRESHOLD = 10
const AMBER_THRESHOLD = 5
const MIN_SAMPLES = 3
const COOLDOWN_DAYS = 7

export function classifyRAG(deltaMagnitudesPct: number[]): RAG {
  if (deltaMagnitudesPct.length < MIN_SAMPLES) return 'insufficient'
  const mean = deltaMagnitudesPct.reduce((a, b) => a + b, 0) / deltaMagnitudesPct.length
  if (mean > RED_THRESHOLD) return 'red'
  if (mean > AMBER_THRESHOLD) return 'amber'
  return 'green'
}

export interface PatternSignal {
  direction: 'over' | 'under'
  workoutIds: string[]
  magnitudes: number[]
}

export function detectPattern(
  recentDeltas: { delta_pct: number; workout_id: string }[]
): PatternSignal | null {
  if (recentDeltas.length < 3) return null
  const last3 = recentDeltas.slice(0, 3)
  const allUnder = last3.every(d => d.delta_pct < -RED_THRESHOLD)
  const allOver = last3.every(d => d.delta_pct > RED_THRESHOLD)
  if (!allUnder && !allOver) return null
  return {
    direction: allOver ? 'over' : 'under',
    workoutIds: last3.map(d => d.workout_id),
    magnitudes: last3.map(d => Math.abs(d.delta_pct)),
  }
}

export function isCooldownClear(args: { lastFiredAt: string | null; now: Date }): boolean {
  if (!args.lastFiredAt) return true
  const elapsed = args.now.getTime() - new Date(args.lastFiredAt).getTime()
  return elapsed > COOLDOWN_DAYS * 24 * 3600 * 1000
}

export async function allCoachesRAG(userId: string) {
  const supabase = await createClient()
  const sinceIso = new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString()
  const { data } = await supabase
    .from('performance_deltas')
    .select('coach_domain, delta_magnitude_pct, created_at')
    .eq('user_id', userId).gte('created_at', sinceIso)

  const byCoach = new Map<string, number[]>()
  for (const r of data ?? []) {
    if (r.delta_magnitude_pct == null) continue
    const list = byCoach.get(r.coach_domain) ?? []
    list.push(r.delta_magnitude_pct)
    byCoach.set(r.coach_domain, list)
  }
  const result: Record<string, RAG> = {}
  for (const [coach, deltas] of byCoach) result[coach] = classifyRAG(deltas)
  return result
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/analytics/__tests__/coach-bias.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/coach-bias.ts src/lib/analytics/__tests__/coach-bias.test.ts
git commit -m "feat(analytics): coach-bias RAG + pattern + cooldown + tests"
```

---

## Task 4: `duration-variance.ts` analytics (TDD)

**Files:**
- Create: `src/lib/analytics/duration-variance.ts`
- Create: `src/lib/analytics/__tests__/duration-variance.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/analytics/__tests__/duration-variance.test.ts
import { describe, it, expect } from 'vitest'
import { aggregateDurationVariance } from '../duration-variance'

describe('aggregateDurationVariance', () => {
  it('groups by coach and computes overrun %', () => {
    const rows = [
      { coach_domain: 'strength', estimated: 60, actual: 75 },
      { coach_domain: 'strength', estimated: 45, actual: 60 },
      { coach_domain: 'endurance', estimated: 60, actual: 55 },
    ]
    const agg = aggregateDurationVariance(rows)
    expect(agg.strength.overrunPct).toBeCloseTo(28.57, 1)  // (135-105)/105
    expect(agg.endurance.overrunPct).toBeCloseTo(-8.33, 1)
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/analytics/__tests__/duration-variance.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/analytics/duration-variance.ts
import { createClient } from '@/lib/supabase/server'

export interface DurationRow {
  coach_domain: string
  estimated: number
  actual: number
}
export interface CoachVariance {
  sessions: number
  totalEstimated: number
  totalActual: number
  overrunPct: number
}

export function aggregateDurationVariance(
  rows: DurationRow[]
): Record<string, CoachVariance> {
  const result: Record<string, CoachVariance> = {}
  for (const r of rows) {
    const c = result[r.coach_domain] ??= {
      sessions: 0, totalEstimated: 0, totalActual: 0, overrunPct: 0,
    }
    c.sessions += 1
    c.totalEstimated += r.estimated
    c.totalActual += r.actual
  }
  for (const c of Object.values(result)) {
    c.overrunPct = c.totalEstimated === 0
      ? 0
      : ((c.totalActual - c.totalEstimated) / c.totalEstimated) * 100
  }
  return result
}

export async function currentBlockVariance(userId: string, blockId: string) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_block_duration_variance', {
    p_user_id: userId, p_block_id: blockId,
  }).select('*')
  // Fallback direct query if no RPC:
  if (!data) {
    const { data: inv } = await supabase
      .from('session_inventory')
      .select('coach_domain, estimated_duration_minutes, workouts!inner(actual_duration_minutes)')
      .eq('user_id', userId).eq('block_id', blockId).eq('status', 'completed')
    const rows = (inv ?? []).map((x: any) => ({
      coach_domain: x.coach_domain,
      estimated: x.estimated_duration_minutes ?? 0,
      actual: x.workouts?.actual_duration_minutes ?? 0,
    })).filter(r => r.estimated && r.actual)
    return aggregateDurationVariance(rows)
  }
  return aggregateDurationVariance(data as DurationRow[])
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/analytics/__tests__/duration-variance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/duration-variance.ts src/lib/analytics/__tests__/duration-variance.test.ts
git commit -m "feat(analytics): duration-variance aggregator + tests"
```

---

## Task 5: `off-plan-tally.ts` analytics (TDD)

**Files:**
- Create: `src/lib/analytics/off-plan-tally.ts`
- Create: `src/lib/analytics/__tests__/off-plan-tally.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/analytics/__tests__/off-plan-tally.test.ts
import { describe, it, expect } from 'vitest'
import { computeOffPlanTally, linkedDomainForModality } from '../off-plan-tally'

describe('off-plan-tally', () => {
  it('groups off-plan sessions by modality and flags count_toward_load', () => {
    const rows = [
      { modality: 'run', count_toward_load: true },
      { modality: 'run', count_toward_load: true },
      { modality: 'strength', count_toward_load: false },
      { modality: 'conditioning', count_toward_load: true },
    ]
    const t = computeOffPlanTally(rows)
    expect(t.byModality.run.count).toBe(2)
    expect(t.byModality.run.countTowardLoad).toBe(2)
    expect(t.byModality.strength.countTowardLoad).toBe(0)
    expect(t.total).toBe(4)
  })
  it('linkedDomainForModality maps modalities', () => {
    expect(linkedDomainForModality('run')).toBe('endurance')
    expect(linkedDomainForModality('ride')).toBe('endurance')
    expect(linkedDomainForModality('strength')).toBe('strength')
    expect(linkedDomainForModality('conditioning')).toBe('conditioning')
    expect(linkedDomainForModality('other')).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/analytics/__tests__/off-plan-tally.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/analytics/off-plan-tally.ts
import { createClient } from '@/lib/supabase/server'

export interface OffPlanTally {
  total: number
  byModality: Record<string, { count: number; countTowardLoad: number }>
}

export function computeOffPlanTally(
  rows: { modality: string; count_toward_load: boolean }[]
): OffPlanTally {
  const byModality: OffPlanTally['byModality'] = {}
  for (const r of rows) {
    const m = byModality[r.modality] ??= { count: 0, countTowardLoad: 0 }
    m.count += 1
    if (r.count_toward_load) m.countTowardLoad += 1
  }
  return { total: rows.length, byModality }
}

export function linkedDomainForModality(modality: string): string | null {
  switch (modality) {
    case 'run':
    case 'ride':
      return 'endurance'
    case 'strength':
      return 'strength'
    case 'conditioning':
      return 'conditioning'
    default:
      return null
  }
}

export async function currentBlockTally(userId: string, blockStart: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('off_plan_sessions')
    .select('modality, count_toward_load')
    .eq('user_id', userId).gte('logged_at', blockStart)
  return computeOffPlanTally((data ?? []) as any)
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/analytics/__tests__/off-plan-tally.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/off-plan-tally.ts src/lib/analytics/__tests__/off-plan-tally.test.ts
git commit -m "feat(analytics): off-plan-tally + modality mapping + tests"
```

---

## Task 6: Block-end + rolling-pattern intervention triggers (TDD)

**Files:**
- Create: `src/lib/interventions/block-end-trigger.ts`
- Create: `src/lib/interventions/rolling-pattern-trigger.ts`
- Create: `src/lib/interventions/__tests__/triggers.test.ts`
- Modify: `src/lib/actions/ai-coach.actions.ts` — extend save path

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/interventions/__tests__/triggers.test.ts
import { describe, it, expect, vi } from 'vitest'
import { shouldFireBlockEnd } from '../block-end-trigger'
import { shouldFireRollingPattern } from '../rolling-pattern-trigger'

describe('trigger gates', () => {
  it('shouldFireBlockEnd: true if any coach has >5% mean magnitude', () => {
    expect(shouldFireBlockEnd({ coach: 'strength', meanMagnitudePct: 7 })).toBe(true)
    expect(shouldFireBlockEnd({ coach: 'strength', meanMagnitudePct: 3 })).toBe(false)
  })
  it('shouldFireRollingPattern: false when cooldown not cleared', () => {
    const now = new Date('2026-04-20T00:00:00Z')
    const recentFiring = new Date('2026-04-18T00:00:00Z').toISOString()
    expect(shouldFireRollingPattern({
      lastFiredAt: recentFiring, now, hasPatternSignal: true,
    })).toBe(false)
    expect(shouldFireRollingPattern({
      lastFiredAt: null, now, hasPatternSignal: true,
    })).toBe(true)
    expect(shouldFireRollingPattern({
      lastFiredAt: null, now, hasPatternSignal: false,
    })).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/interventions/__tests__/triggers.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement block-end trigger**

```ts
// src/lib/interventions/block-end-trigger.ts
import { createClient } from '@/lib/supabase/server'
import { saveCoachIntervention } from '@/lib/actions/ai-coach.actions'
import { classifyRAG } from '@/lib/analytics/coach-bias'

const BLOCK_END_THRESHOLD = 5 // percent

export function shouldFireBlockEnd(
  args: { coach: string; meanMagnitudePct: number }
): boolean {
  return args.meanMagnitudePct > BLOCK_END_THRESHOLD
}

export async function fireBlockEndInterventions(userId: string, blockId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('performance_deltas')
    .select('coach_domain, delta_magnitude_pct, workout_id')
    .eq('user_id', userId).eq('block_id', blockId)

  const byCoach = new Map<string, number[]>()
  const workoutsByCoach = new Map<string, string[]>()
  for (const r of data ?? []) {
    if (r.delta_magnitude_pct == null) continue
    const list = byCoach.get(r.coach_domain) ?? []
    list.push(r.delta_magnitude_pct); byCoach.set(r.coach_domain, list)
    const wlist = workoutsByCoach.get(r.coach_domain) ?? []
    wlist.push(r.workout_id); workoutsByCoach.set(r.coach_domain, wlist)
  }

  for (const [coach, magnitudes] of byCoach) {
    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length
    if (!shouldFireBlockEnd({ coach, meanMagnitudePct: mean })) continue
    const rag = classifyRAG(magnitudes)
    await saveCoachIntervention({
      coach_domain: coach,
      trigger_type: 'block_end',
      message: `Block-end review for ${coach}: mean delta magnitude ${mean.toFixed(1)}% (${rag}).`,
      pattern_signal: {
        workoutIds: workoutsByCoach.get(coach) ?? [],
        meanMagnitudePct: mean,
        rag,
      },
    })
  }
}
```

- [ ] **Step 4: Implement rolling-pattern trigger**

```ts
// src/lib/interventions/rolling-pattern-trigger.ts
import { createClient } from '@/lib/supabase/server'
import { saveCoachIntervention } from '@/lib/actions/ai-coach.actions'
import { detectPattern, isCooldownClear } from '@/lib/analytics/coach-bias'

export function shouldFireRollingPattern(args: {
  lastFiredAt: string | null
  now: Date
  hasPatternSignal: boolean
}): boolean {
  if (!args.hasPatternSignal) return false
  return isCooldownClear({ lastFiredAt: args.lastFiredAt, now: args.now })
}

export async function evaluateAndFirePattern(userId: string, coachDomain: string) {
  const supabase = await createClient()
  const { data: deltas } = await supabase
    .from('performance_deltas')
    .select('delta_pct, workout_id, created_at')
    .eq('user_id', userId).eq('coach_domain', coachDomain)
    .order('created_at', { ascending: false }).limit(5)

  const pattern = detectPattern(
    (deltas ?? []).map(d => ({ delta_pct: d.delta_pct, workout_id: d.workout_id }))
  )

  const { data: lastInt } = await supabase
    .from('agent_interventions')
    .select('created_at')
    .eq('user_id', userId).eq('coach_domain', coachDomain)
    .eq('trigger_type', 'rolling_pattern')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  const fire = shouldFireRollingPattern({
    lastFiredAt: lastInt?.created_at ?? null,
    now: new Date(),
    hasPatternSignal: pattern !== null,
  })
  if (!fire || !pattern) return { fired: false }

  await saveCoachIntervention({
    coach_domain: coachDomain,
    trigger_type: 'rolling_pattern',
    message: `${coachDomain} coach flag: ${pattern.direction}-performance pattern across 3 sessions (${pattern.magnitudes.map(m => m.toFixed(0) + '%').join(', ')}).`,
    pattern_signal: pattern,
  })
  return { fired: true, pattern }
}
```

- [ ] **Step 5: Extend `ai-coach.actions.ts`**

Open `src/lib/actions/ai-coach.actions.ts`. Update `saveCoachIntervention` to accept new optional fields and persist them. Add to its input type:

```ts
// Add to saveCoachIntervention input:
export interface SaveCoachInterventionInput {
  coach_domain: string
  trigger_type: 'block_end' | 'rolling_pattern' | 'recalibration_prompt'
  message: string
  pattern_signal?: Record<string, unknown>
}
```

Then in the implementation, pass `coach_domain`, `trigger_type`, `pattern_signal` to the `.insert({...})` call. Keep existing call sites compatible (if the function was previously called with a different signature, update call sites accordingly — grep for usages: `grep -r "saveCoachIntervention" src/`).

- [ ] **Step 6: Run tests — expect pass**

Run: `npx vitest run src/lib/interventions/__tests__/triggers.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/interventions/ src/lib/actions/ai-coach.actions.ts
git commit -m "feat(interventions): block-end + rolling-pattern triggers + save ext"
```

---

## Task 7: Wire block-end trigger into block-completion hook

**Files:**
- Modify: `src/lib/actions/block-pointer.actions.ts` (or wherever block completion is detected)

- [ ] **Step 1: Find the hook point**

Run:
```bash
grep -nE "block.*complet|advanceBlock|finishBlock" src/lib/actions/*.ts
```
Expected: at least one call site where block completion is finalized. If none exists yet, the hook is added to `block-pointer.actions.ts` within the function that advances past the last training day.

- [ ] **Step 2: Invoke `fireBlockEndInterventions`**

At the completion point, after any existing side effects:

```ts
import { fireBlockEndInterventions } from '@/lib/interventions/block-end-trigger'
// ...
await fireBlockEndInterventions(userId, completedBlockId)
```

- [ ] **Step 3: Manual verify**

Seed a block with a few completed workouts and performance_deltas. Trigger block completion (through the app, or by calling the action directly from a script). Confirm rows appear in `agent_interventions` for coaches with mean magnitude >5%.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/block-pointer.actions.ts
git commit -m "feat(interventions): wire block-end fire into block completion"
```

---

## Task 8: Wire rolling-pattern trigger into post-workout flow

**Files:**
- Modify: `src/lib/actions/workout.actions.ts`

- [ ] **Step 1: Find the post-workout completion path**

Run:
```bash
grep -nE "completeWorkout|finishWorkout|markComplete" src/lib/actions/workout.actions.ts
```
Expected: a function that finalizes a workout (status → completed, computes deltas).

- [ ] **Step 2: After delta is written, invoke pattern eval for that coach**

```ts
import { evaluateAndFirePattern } from '@/lib/interventions/rolling-pattern-trigger'
// ...at end of completeWorkout (after performance_delta insert):
await evaluateAndFirePattern(userId, workout.coach_domain)
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/workout.actions.ts
git commit -m "feat(interventions): wire rolling-pattern eval to workout completion"
```

---

## Task 9: `BlockAdherenceHeatmap` tile + drill-down

**Files:**
- Create: `src/components/data/overview/BlockAdherenceHeatmap.tsx`
- Create: `src/components/data/overview/drill/AdherenceDrill.tsx`

- [ ] **Step 1: Tile**

```tsx
// src/components/data/overview/BlockAdherenceHeatmap.tsx
import Link from 'next/link'
import type { HeatmapCell } from '@/lib/analytics/block-adherence'

const stateColors: Record<HeatmapCell['state'], string> = {
  on_track: 'bg-emerald-900',
  off_track: 'bg-amber-700',
  missed: 'bg-red-900',
  pending: 'bg-neutral-800',
}

export function BlockAdherenceHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const maxDay = Math.max(0, ...cells.map(c => c.training_day))
  const days = Array.from({ length: maxDay }, (_, i) => i + 1)
  const slots = [1, 2] // AM, PM
  return (
    <Link href="/data/overview/adherence" className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-amber-900">
      <h3 className="text-sm font-space-grotesk text-neutral-200 mb-3">Block Adherence</h3>
      {cells.length === 0 ? (
        <div className="text-xs text-neutral-500">Complete your first session to see adherence signal.</div>
      ) : (
        <div className="space-y-1">
          {slots.map(slot => (
            <div key={slot} className="flex gap-1">
              {days.map(day => {
                const c = cells.find(x => x.training_day === day && x.session_slot === slot)
                return (
                  <div key={`${day}-${slot}`} className={`w-3 h-3 rounded-sm ${c ? stateColors[c.state] : 'bg-transparent'}`}
                    title={c ? `Day ${day} slot ${slot}: ${c.state}` : ''} />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Drill-down component**

```tsx
// src/components/data/overview/drill/AdherenceDrill.tsx
import type { HeatmapCell } from '@/lib/analytics/block-adherence'

export function AdherenceDrill({ cells }: { cells: HeatmapCell[] }) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-space-grotesk mb-4">Block adherence</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-neutral-500">
          <th className="text-left">Day</th><th>Slot</th><th>State</th><th className="text-right">Delta mag (%)</th>
        </tr></thead>
        <tbody>
          {cells.map(c => (
            <tr key={`${c.training_day}-${c.session_slot}`} className="border-t border-neutral-900">
              <td className="py-1">{c.training_day}</td>
              <td className="text-center">{c.session_slot === 1 ? 'AM' : 'PM'}</td>
              <td className="text-center">{c.state}</td>
              <td className="text-right">{c.delta_magnitude_pct?.toFixed(1) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/data/overview/BlockAdherenceHeatmap.tsx src/components/data/overview/drill/AdherenceDrill.tsx
git commit -m "feat(data): BlockAdherenceHeatmap tile + drill component"
```

---

## Task 10: `CoachPromptsInbox` tile

**Files:**
- Create: `src/components/data/overview/CoachPromptsInbox.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/data/overview/CoachPromptsInbox.tsx
import Link from 'next/link'
import { Inbox, AlertTriangle } from 'lucide-react'

type Intervention = {
  id: string
  coach_domain: string
  trigger_type: string
  message: string
  created_at: string
  needs_retry?: boolean
}

export function CoachPromptsInbox({ interventions }: { interventions: Intervention[] }) {
  const unread = interventions.length
  return (
    <Link href="/coach" className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-amber-900">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-space-grotesk text-neutral-200 flex items-center gap-2">
          <Inbox className="w-4 h-4 text-amber-600" /> Coach inbox
        </h3>
        <span className="text-xs text-neutral-500">{unread} pending</span>
      </div>
      {unread === 0 ? (
        <div className="text-xs text-neutral-500">All reviewed.</div>
      ) : (
        <ul className="space-y-1.5 text-xs text-neutral-400">
          {interventions.slice(0, 3).map(i => (
            <li key={i.id} className="flex items-start gap-1.5">
              {i.needs_retry && <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5" />}
              <span className="line-clamp-1">{i.coach_domain} · {i.message}</span>
            </li>
          ))}
          {unread > 3 && <li className="text-neutral-600">+ {unread - 3} more</li>}
        </ul>
      )}
      <div className="text-xs text-neutral-600 mt-3">Review in Coach tab (under repair)</div>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/data/overview/CoachPromptsInbox.tsx
git commit -m "feat(data): CoachPromptsInbox tile"
```

---

## Task 11: `CoachBiasTile` + drill-down

**Files:**
- Create: `src/components/data/overview/CoachBiasTile.tsx`
- Create: `src/components/data/overview/drill/CoachBiasDrill.tsx`

- [ ] **Step 1: Tile**

```tsx
// src/components/data/overview/CoachBiasTile.tsx
import Link from 'next/link'
import type { RAG } from '@/lib/analytics/coach-bias'

const ragColor: Record<RAG, string> = {
  red: 'bg-red-900', amber: 'bg-amber-700', green: 'bg-emerald-900',
  insufficient: 'bg-neutral-800',
}

export function CoachBiasTile({ ragByCoach }: { ragByCoach: Record<string, RAG> }) {
  const coaches = ['strength', 'hypertrophy', 'endurance', 'conditioning', 'mobility', 'recovery']
  return (
    <Link href="/data/overview/coach-bias" className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-amber-900">
      <h3 className="text-sm font-space-grotesk text-neutral-200 mb-3">Coach bias</h3>
      <div className="grid grid-cols-3 gap-2">
        {coaches.map(c => (
          <div key={c} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${ragColor[ragByCoach[c] ?? 'insufficient']}`} />
            <span className="text-xs text-neutral-400 capitalize">{c}</span>
          </div>
        ))}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Drill-down**

```tsx
// src/components/data/overview/drill/CoachBiasDrill.tsx
import type { RAG } from '@/lib/analytics/coach-bias'

export function CoachBiasDrill({ ragByCoach }: { ragByCoach: Record<string, RAG> }) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-space-grotesk mb-4">Coach bias — 21-day window</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-neutral-500">
          <th className="text-left">Coach</th><th className="text-center">Status</th>
        </tr></thead>
        <tbody>
          {Object.entries(ragByCoach).map(([coach, rag]) => (
            <tr key={coach} className="border-t border-neutral-900">
              <td className="py-1 capitalize">{coach}</td>
              <td className="text-center">{rag}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/data/overview/CoachBiasTile.tsx src/components/data/overview/drill/CoachBiasDrill.tsx
git commit -m "feat(data): CoachBiasTile + drill"
```

---

## Task 12: `OffPlanTally` tile + drill-down

**Files:**
- Create: `src/components/data/overview/OffPlanTally.tsx`
- Create: `src/components/data/overview/drill/OffPlanDrill.tsx`

- [ ] **Step 1: Tile**

```tsx
// src/components/data/overview/OffPlanTally.tsx
import Link from 'next/link'
import type { OffPlanTally as Tally } from '@/lib/analytics/off-plan-tally'

export function OffPlanTally({ tally }: { tally: Tally }) {
  return (
    <Link href="/data/overview/off-plan" className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-amber-900">
      <h3 className="text-sm font-space-grotesk text-neutral-200 mb-2">Off-plan sessions</h3>
      <div className="text-2xl font-space-grotesk text-amber-500">{tally.total}</div>
      <div className="text-xs text-neutral-500 mt-2">
        {Object.entries(tally.byModality).map(([m, v]) =>
          <div key={m}>{m}: {v.count} ({v.countTowardLoad} count toward load)</div>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Drill-down**

```tsx
// src/components/data/overview/drill/OffPlanDrill.tsx
export function OffPlanDrill({ rows }: { rows: {
  id: string; logged_at: string; modality: string; duration_minutes: number;
  rpe: number | null; notes: string | null; count_toward_load: boolean;
}[] }) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-space-grotesk mb-4">Off-plan sessions</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-neutral-500">
          <th className="text-left">Logged</th><th>Modality</th>
          <th>Duration</th><th>RPE</th><th>Load</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t border-neutral-900">
              <td className="py-1">{r.logged_at.slice(0, 10)}</td>
              <td className="text-center">{r.modality}</td>
              <td className="text-center">{r.duration_minutes}m</td>
              <td className="text-center">{r.rpe ?? '—'}</td>
              <td className="text-center">{r.count_toward_load ? '✓' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/data/overview/OffPlanTally.tsx src/components/data/overview/drill/OffPlanDrill.tsx
git commit -m "feat(data): OffPlanTally tile + drill"
```

---

## Task 13: Dynamic `[tile]` drill-down route

**Files:**
- Create: `src/app/data/overview/[tile]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/data/overview/[tile]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { currentBlockHeatmap } from '@/lib/analytics/block-adherence'
import { allCoachesRAG } from '@/lib/analytics/coach-bias'
import { currentBlockTally } from '@/lib/analytics/off-plan-tally'
import { AdherenceDrill } from '@/components/data/overview/drill/AdherenceDrill'
import { CoachBiasDrill } from '@/components/data/overview/drill/CoachBiasDrill'
import { OffPlanDrill } from '@/components/data/overview/drill/OffPlanDrill'

export default async function Page({ params }: { params: Promise<{ tile: string }> }) {
  const { tile } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  if (tile === 'adherence') {
    const { data: activeBlock } = await supabase
      .from('mesocycles').select('id, start_date').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    const cells = activeBlock ? await currentBlockHeatmap(user.id, activeBlock.id) : []
    return <AdherenceDrill cells={cells} />
  }
  if (tile === 'coach-bias') {
    const rag = await allCoachesRAG(user.id)
    return <CoachBiasDrill ragByCoach={rag} />
  }
  if (tile === 'off-plan') {
    const { data: activeBlock } = await supabase
      .from('mesocycles').select('start_date').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    const tally = activeBlock ? await currentBlockTally(user.id, activeBlock.start_date) : { total: 0, byModality: {} }
    const { data: rows } = await supabase
      .from('off_plan_sessions').select('*')
      .eq('user_id', user.id).order('logged_at', { ascending: false }).limit(50)
    return <OffPlanDrill rows={rows ?? []} />
  }
  // coach-prompts handled by /coach; redirect
  if (tile === 'coach-prompts') redirect('/coach')
  notFound()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/data/overview/[tile]/page.tsx
git commit -m "feat(data): dynamic drill-down route for overview tiles"
```

---

## Task 14: Wire training-adherence tiles into `/data/` overview

**Files:**
- Modify: `src/lib/actions/data.actions.ts` — add `getTrainingAdherence`
- Modify: `src/components/data/TrainingOverview.tsx` — render tiles

- [ ] **Step 1: Action**

In `src/lib/actions/data.actions.ts`, append:

```ts
import { currentBlockHeatmap } from '@/lib/analytics/block-adherence'
import { allCoachesRAG } from '@/lib/analytics/coach-bias'
import { currentBlockTally } from '@/lib/analytics/off-plan-tally'
import { getUnreviewedInterventions } from '@/lib/actions/ai-coach.actions'

export async function getTrainingAdherence() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'unauthenticated' }

  const { data: activeBlock } = await supabase
    .from('mesocycles').select('id, start_date').eq('user_id', user.id).eq('is_active', true).maybeSingle()

  const [cells, ragByCoach, tally, interventionsRes] = await Promise.all([
    activeBlock ? currentBlockHeatmap(user.id, activeBlock.id) : Promise.resolve([]),
    allCoachesRAG(user.id),
    activeBlock
      ? currentBlockTally(user.id, activeBlock.start_date)
      : Promise.resolve({ total: 0, byModality: {} as Record<string, { count: number; countTowardLoad: number }> }),
    getUnreviewedInterventions(),
  ])
  const interventions = interventionsRes.success ? interventionsRes.data : []

  return { success: true as const, data: { cells, ragByCoach, tally, interventions } }
}
```

- [ ] **Step 2: Render in TrainingOverview**

Modify `src/components/data/TrainingOverview.tsx`:

```tsx
// Accept new prop:
import { BlockAdherenceHeatmap } from './overview/BlockAdherenceHeatmap'
import { CoachPromptsInbox } from './overview/CoachPromptsInbox'
import { CoachBiasTile } from './overview/CoachBiasTile'
import { OffPlanTally } from './overview/OffPlanTally'

interface Props {
  data: /* existing */
  adherence: {
    cells: HeatmapCell[]; ragByCoach: Record<string, RAG>;
    tally: OffPlanTallyType; interventions: Intervention[];
  }
  healthTile?: React.ReactNode // already added in Plan 2
}

// In render, add a grid containing the four adherence tiles + the health tile:
<div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
  <BlockAdherenceHeatmap cells={adherence.cells} />
  <CoachPromptsInbox interventions={adherence.interventions} />
  <CoachBiasTile ragByCoach={adherence.ragByCoach} />
  <OffPlanTally tally={adherence.tally} />
  {healthTile}
</div>
```

- [ ] **Step 3: Wire into `page.tsx`**

Modify `src/app/data/page.tsx`:

```tsx
const [trainingRes, adherenceRes, healthRes] = await Promise.all([
  getTrainingOverview(),
  getTrainingAdherence(),
  getHealthSnapshot(),
])
// Pass adherenceRes.data into TrainingOverview as `adherence={...}`
```

- [ ] **Step 4: Visual check**

Run `npm run dev`. `/data` shows five tiles including the four adherence ones populated from any existing seed data.

- [ ] **Step 5: Commit**

```bash
git add src/app/data/page.tsx src/components/data/TrainingOverview.tsx src/lib/actions/data.actions.ts
git commit -m "feat(data): wire 4 training-adherence tiles into /data overview"
```

---

## Task 15: `PerformanceDeltaChart` + `PatternFlagCard` for domain pages

**Files:**
- Create: `src/components/data/domain/PerformanceDeltaChart.tsx`
- Create: `src/components/data/domain/PatternFlagCard.tsx`

- [ ] **Step 1: Chart component**

```tsx
// src/components/data/domain/PerformanceDeltaChart.tsx
'use client'
type Point = { date: string; delta_pct: number }
export function PerformanceDeltaChart({ points, title }: { points: Point[]; title: string }) {
  const w = 320, h = 100
  if (points.length === 0) {
    return <div className="p-4 border border-neutral-800 rounded text-xs text-neutral-500">{title}: no deltas yet</div>
  }
  const max = Math.max(20, ...points.map(p => Math.abs(p.delta_pct)))
  const mid = h / 2
  const dx = w / Math.max(1, points.length - 1)
  return (
    <div className="p-4 border border-neutral-800 rounded">
      <h3 className="text-sm font-space-grotesk mb-2">{title}</h3>
      <svg width={w} height={h}>
        <line x1={0} y1={mid} x2={w} y2={mid} stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
        {points.map((p, i) => {
          const x = i * dx
          const y = mid - (p.delta_pct / max) * (mid - 4)
          return <circle key={i} cx={x} cy={y} r={2.5} fill={p.delta_pct > 0 ? '#059669' : '#dc2626'} />
        })}
      </svg>
    </div>
  )
}
```

- [ ] **Step 2: Pattern flag card**

```tsx
// src/components/data/domain/PatternFlagCard.tsx
import { AlertCircle } from 'lucide-react'
import type { PatternSignal } from '@/lib/analytics/coach-bias'

export function PatternFlagCard({ flag, coach }: { flag: PatternSignal | null; coach: string }) {
  if (!flag) return null
  return (
    <div className="p-3 border border-amber-800 bg-amber-950/30 rounded flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
      <div className="text-sm text-amber-200">
        <div>Pattern flagged in {coach}</div>
        <div className="text-xs text-amber-300 mt-1">
          {flag.direction}-performance across 3 sessions · magnitudes {flag.magnitudes.map(m => `${m.toFixed(0)}%`).join(', ')}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/data/domain/
git commit -m "feat(data): PerformanceDeltaChart + PatternFlagCard"
```

---

## Task 16: Enhance existing domain pages

**Files:**
- Modify: `src/app/data/strength/page.tsx`
- Modify: `src/app/data/endurance/page.tsx`
- Modify: `src/app/data/recovery/page.tsx`

- [ ] **Step 1: For each of strength/endurance/recovery, fetch deltas + flag**

Inside each page (server component), add:

```tsx
import { createClient } from '@/lib/supabase/server'
import { PerformanceDeltaChart } from '@/components/data/domain/PerformanceDeltaChart'
import { PatternFlagCard } from '@/components/data/domain/PatternFlagCard'
import { detectPattern } from '@/lib/analytics/coach-bias'

// In the page:
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/auth/sign-in')

const coachDomain = 'strength' // or 'endurance', 'recovery' per file
const { data: deltas } = await supabase
  .from('performance_deltas')
  .select('delta_pct, workout_id, created_at')
  .eq('user_id', user.id).eq('coach_domain', coachDomain)
  .order('created_at', { ascending: false }).limit(20)

const points = (deltas ?? []).slice().reverse().map(d => ({
  date: d.created_at.slice(0, 10), delta_pct: d.delta_pct,
}))
const flag = detectPattern((deltas ?? []).map(d => ({ delta_pct: d.delta_pct, workout_id: d.workout_id })))

// Render alongside existing content:
<>
  <PatternFlagCard flag={flag} coach={coachDomain} />
  <PerformanceDeltaChart title={`${coachDomain} performance deltas`} points={points} />
  {/* existing content */}
</>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/data/strength/page.tsx src/app/data/endurance/page.tsx src/app/data/recovery/page.tsx
git commit -m "feat(data): add delta chart + pattern flag to domain pages"
```

---

## Task 17: New conditioning domain page

**Files:**
- Create: `src/app/data/conditioning/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/data/conditioning/page.tsx
import { createClient } from '@/lib/supabase/server'
import { PerformanceDeltaChart } from '@/components/data/domain/PerformanceDeltaChart'
import { PatternFlagCard } from '@/components/data/domain/PatternFlagCard'
import { detectPattern } from '@/lib/analytics/coach-bias'
import { redirect } from 'next/navigation'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const { data: logs } = await supabase
    .from('conditioning_logs').select('*')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)

  const { data: deltas } = await supabase
    .from('performance_deltas')
    .select('delta_pct, workout_id, created_at')
    .eq('user_id', user.id).eq('coach_domain', 'conditioning')
    .order('created_at', { ascending: false }).limit(20)

  const points = (deltas ?? []).slice().reverse().map(d => ({
    date: d.created_at.slice(0, 10), delta_pct: d.delta_pct,
  }))
  const flag = detectPattern((deltas ?? []).map(d => ({ delta_pct: d.delta_pct, workout_id: d.workout_id })))

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-space-grotesk">Conditioning</h1>
      <PatternFlagCard flag={flag} coach="conditioning" />
      <PerformanceDeltaChart title="Conditioning performance deltas" points={points} />
      <section>
        <h2 className="text-sm text-neutral-400 mb-2">Logs ({logs?.length ?? 0})</h2>
        {(logs ?? []).length === 0 ? (
          <div className="text-xs text-neutral-500">No conditioning_logs yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-neutral-500">
              <th className="text-left">Date</th><th>Modality</th>
              <th>Duration</th><th>RPE</th>
            </tr></thead>
            <tbody>
              {logs!.map((l: any) => (
                <tr key={l.id} className="border-t border-neutral-900">
                  <td className="py-1">{l.created_at.slice(0, 10)}</td>
                  <td className="text-center">{l.modality}</td>
                  <td className="text-center">{l.duration_minutes ?? '—'}m</td>
                  <td className="text-center">{l.rpe ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/data/conditioning/page.tsx
git commit -m "feat(data): new conditioning domain page"
```

---

## Task 18: Integration test — complete workout → intervention fires

**Files:**
- Create: `src/lib/interventions/__tests__/workout-to-intervention.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/lib/interventions/__tests__/workout-to-intervention.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/test-client'
import { evaluateAndFirePattern } from '../rolling-pattern-trigger'

describe('workout → rolling-pattern intervention', () => {
  const supabase = createClient()
  const userId = '00000000-0000-0000-0000-000000000001'
  const coach = 'endurance'

  beforeEach(async () => {
    await supabase.from('agent_interventions')
      .delete().eq('user_id', userId).eq('coach_domain', coach)
    await supabase.from('performance_deltas')
      .delete().eq('user_id', userId).eq('coach_domain', coach)
  })

  it('3 consecutive -12% deltas fire an intervention', async () => {
    for (const w of ['w1', 'w2', 'w3']) {
      await supabase.from('performance_deltas').insert({
        user_id: userId, coach_domain: coach,
        workout_id: w, delta_pct: -12, delta_magnitude_pct: 12,
      })
    }
    const res = await evaluateAndFirePattern(userId, coach)
    expect(res.fired).toBe(true)

    const { data } = await supabase.from('agent_interventions')
      .select('*').eq('user_id', userId).eq('coach_domain', coach)
    expect(data).toHaveLength(1)
    expect(data![0].trigger_type).toBe('rolling_pattern')
  })

  it('cooldown blocks second fire within 7 days', async () => {
    await supabase.from('agent_interventions').insert({
      user_id: userId, coach_domain: coach, trigger_type: 'rolling_pattern',
      message: 'existing', created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    })
    for (const w of ['w1', 'w2', 'w3']) {
      await supabase.from('performance_deltas').insert({
        user_id: userId, coach_domain: coach,
        workout_id: w, delta_pct: -12, delta_magnitude_pct: 12,
      })
    }
    const res = await evaluateAndFirePattern(userId, coach)
    expect(res.fired).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect pass**

Run: `npx vitest run src/lib/interventions/__tests__/workout-to-intervention.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/interventions/__tests__/workout-to-intervention.test.ts
git commit -m "test(interventions): workout completion → rolling-pattern fires + cooldown"
```

---

## Task 19: E2E smoke test — `/data` five-tile render

**Files:**
- Create: `tests/e2e/data-overview.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/data-overview.spec.ts
import { test, expect } from '@playwright/test'

test('data overview renders 5 tiles', async ({ page }) => {
  await page.goto('/data')
  // Five tiles — names come from the tile components:
  await expect(page.getByText('Block Adherence')).toBeVisible()
  await expect(page.getByText('Coach inbox')).toBeVisible()
  await expect(page.getByText('Coach bias')).toBeVisible()
  await expect(page.getByText('Off-plan sessions')).toBeVisible()
  await expect(page.getByText('Health')).toBeVisible()
})

test('adherence drill-down navigates from tile', async ({ page }) => {
  await page.goto('/data')
  await page.getByText('Block Adherence').click()
  await expect(page).toHaveURL(/\/data\/overview\/adherence/)
  await expect(page.getByRole('heading', { name: 'Block adherence' })).toBeVisible()
})
```

- [ ] **Step 2: Run**

Run: `npx playwright test tests/e2e/data-overview.spec.ts`
Expected: PASS (assumes Plan 2 is merged; otherwise remove the `Health` assertion).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/data-overview.spec.ts
git commit -m "test(e2e): /data 5-tile render + adherence drill smoke test"
```

---

## Task 20: Final verification + PR

- [ ] **Step 1: Full test suite**

Run:
```bash
npx vitest run
npx playwright test
npx tsc --noEmit
```
Expected: all green.

- [ ] **Step 2: Walkthrough with seed data**

`npm run dev`. Visit:
- `/data` — 5 tiles (or 4 if Plan 2 not merged) render.
- Click each of the 4 adherence tiles → drill pages load.
- Visit `/data/strength`, `/data/endurance`, `/data/recovery`, `/data/conditioning` — delta charts + pattern flags render.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/metrics-training-adherence
gh pr create --title "feat: metrics dashboard training-adherence tiles + drill-downs" --body "$(cat <<'EOF'
## Summary
- 4 training-adherence tiles on /data/: BlockAdherenceHeatmap, CoachPromptsInbox, CoachBiasTile, OffPlanTally
- Analytics layer: block-adherence, coach-bias (RAG + pattern + cooldown), duration-variance, off-plan-tally
- Intervention triggers: block-end (auto on block completion), rolling-pattern (auto on workout completion, 7-day per-coach cooldown)
- Dynamic drill-down route /data/overview/[tile]
- Domain page enhancements: strength/endurance/recovery get PerformanceDeltaChart + PatternFlagCard
- New conditioning domain page

## Test plan
- [ ] Vitest: 5 new analytics/trigger test files pass
- [ ] Integration: workout → intervention fire + cooldown test passes
- [ ] Playwright: 5-tile render + adherence drill smoke
- [ ] Manual: complete a workout in seed data, verify intervention appears in inbox

## Known dependency
Links to /coach/ inbox assume that route is restored. Tile copy notes this.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Spec coverage check (self-review)

- **4 training-adherence tiles** ✓ Tasks 9–12, 14
- **Block-adherence rollup (session × slot × status)** ✓ Task 2
- **Coach-bias RAG + pattern + cooldown** ✓ Task 3
- **Duration variance by coach** ✓ Task 4
- **Off-plan tally + modality mapping** ✓ Task 5
- **Block-end trigger fan-out** ✓ Tasks 6, 7
- **Rolling-pattern trigger post-workout** ✓ Tasks 6, 8
- **`saveCoachIntervention` extended with `coach_domain`, `trigger_type`, `pattern_signal`** ✓ Task 6
- **Dynamic `[tile]/page.tsx` drill-down** ✓ Task 13 (Health uses named `/data/health/` route per spec)
- **Strength/endurance/recovery domain page delta charts + pattern flags** ✓ Tasks 15, 16
- **New conditioning domain page** ✓ Task 17
- **Cooldown enforces 1 fire per coach per 7 days** ✓ Task 3 + Task 18 integration test
- **`/coach/` dependency flagged in tile copy** ✓ Task 10

Deferred to Plan 2: `HealthSnapshotTile` and `/data/health/` domain (complementary, landed first).
