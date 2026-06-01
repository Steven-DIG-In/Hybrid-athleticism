# Layer 1 — Athlete & State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single canonical `AthleteState` read model — backed by a new `athlete_capabilities` store that ends the three-way "current strength" split — that generation and execution both consume.

**Architecture:** Add an additive `athlete_capabilities` table (one canonical row per `(user_id, capability_key)`). A controlled key registry maps free-text benchmark/exercise names → stable keys. Two write-through hooks (`setTrainingMax`, the onboarding benchmark insert) keep it current; a backfill seeds it from existing data. `getAthleteState()` assembles identity + constraints + distinct-typed strength/endurance capabilities + optional readiness. `buildAthleteContext()` is refactored to delegate, so existing generation paths keep working while we migrate.

**Tech Stack:** Next.js 16 (App Router, server actions), Supabase (Postgres + RLS), TypeScript, Vitest, Zod.

**Specs:** [design](../specs/2026-06-01-layer1-athlete-state-design.md) · [discovery](../specs/2026-06-01-layer1-athlete-state-discovery.md) · [master](../specs/2026-06-01-hybrid-core-rebuild-design.md)

**Conventions to follow (verified in this codebase):**
- Tests live in `__tests__/*.test.ts` next to the code; run with `npm test`. Supabase is mocked via `vi.mock('@/lib/supabase/server', ...)` returning `{ createClient: vi.fn(async () => client) }` with a chainable `from()` and `auth.getUser()` (see `src/lib/actions/__tests__/agent-activity.test.ts`).
- Server actions start with `'use server'` and `createClient()` from `@/lib/supabase/server`; they read the user via `supabase.auth.getUser()` and `throw new Error('unauthenticated')` when absent (see `training-maxes.actions.ts`).
- Pure helper modules (registries, assemblers imported by both actions and engine) do **not** carry `'use server'` (see `context.ts` header note).
- `Date.now()`/`new Date()` are fine in app code (used in `training-maxes.actions.ts:53`).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/021_athlete_capabilities.sql` | Create the canonical `athlete_capabilities` table + RLS. |
| `supabase/migrations/022_backfill_athlete_capabilities.sql` | One-time non-destructive backfill from benchmarks + `training_maxes`. |
| `src/lib/types/athlete-state.types.ts` | `AthleteState`, `StrengthCapability`, `EnduranceCapability`, `Readiness`, capability enums. |
| `src/lib/athlete/capability-registry.ts` | Controlled map: free-text name → `{ key, family, unit, label }` (+ normalization/aliases). |
| `src/lib/athlete/capabilities.actions.ts` | `recordCapability()` (the single writer) + `getCapabilities()` (reader). |
| `src/lib/athlete/get-athlete-state.ts` | `getAthleteState(userId)` — assembles the snapshot. |
| `src/lib/athlete/readiness.ts` | `getReadiness(userId)` — optional, never-fabricated readiness (UNKNOWN today). |
| `src/lib/actions/training-maxes.actions.ts` | **Modify**: write-through to `recordCapability` after `setTrainingMax`. |
| `src/lib/actions/onboarding.actions.ts` | **Modify**: write-through to `recordCapability` at the benchmark insert. |
| `src/lib/engine/mesocycle/context.ts` | **Modify**: `buildAthleteContext` delegates capability resolution to `getAthleteState`. |
| `src/lib/athlete/__tests__/*.test.ts` | Unit tests per module. |

---

## Task 1: Create the `athlete_capabilities` table

**Files:**
- Create: `supabase/migrations/021_athlete_capabilities.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/021_athlete_capabilities.sql
-- =============================================================================
-- Layer 1 (Athlete & State): canonical current-capability store.
-- Ends the three-way "current strength" split (athlete_benchmarks append-only
-- dupes + profiles.training_maxes JSON + agent_activity recalibration log).
-- One row per (user_id, capability_key) is the single source of truth for
-- "what can this athlete do right now." Benchmarks + recalibration are inputs.
-- Additive + non-destructive: source tables are untouched.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.athlete_capabilities (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    capability_key text NOT NULL,
    family        text NOT NULL CHECK (family IN ('strength', 'endurance')),
    current_value numeric NOT NULL,
    unit          text NOT NULL,
    source        text NOT NULL CHECK (source IN ('onboarding', 'recalibration', 'manual', 'test')),
    evidence      jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, capability_key)
);

COMMENT ON TABLE public.athlete_capabilities IS
    'Canonical current capability per athlete. One row per (user_id, capability_key). Written via recordCapability(); read via getCapabilities()/getAthleteState().';

ALTER TABLE public.athlete_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_capabilities_owner_all"
    ON public.athlete_capabilities
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS athlete_capabilities_user_idx
    ON public.athlete_capabilities (user_id);
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP `apply_migration` tool (name `021_athlete_capabilities`) against project `kuqgtholljrxnbxtmrnz`, or `supabase db push` if using the CLI.
Expected: table created, no error.

- [ ] **Step 3: Verify it exists**

Run this SQL (MCP `execute_sql` or `psql`):
```sql
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='athlete_capabilities' order by ordinal_position;
```
Expected: 9 columns (id, user_id, capability_key, family, current_value, unit, source, evidence, updated_at).

- [ ] **Step 4: Regenerate DB types**

Run: `npx supabase gen types typescript --project-id kuqgtholljrxnbxtmrnz > src/lib/types/database.types.ts`
(Or the project's existing type-gen command.) Confirm `athlete_capabilities` appears in `database.types.ts`.
Expected: `AthleteCapability` row type available via `Tables<'athlete_capabilities'>`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/021_athlete_capabilities.sql src/lib/types/database.types.ts
git commit -m "feat(layer1): add athlete_capabilities canonical store"
```

---

## Task 2: Capability key registry

**Files:**
- Create: `src/lib/athlete/capability-registry.ts`
- Test: `src/lib/athlete/__tests__/capability-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/athlete/__tests__/capability-registry.test.ts
import { describe, it, expect } from 'vitest'
import { resolveCapabilityKey, CAPABILITY_REGISTRY } from '../capability-registry'

describe('capability registry', () => {
  it('maps known benchmark names to stable keys', () => {
    expect(resolveCapabilityKey('Back Squat')).toEqual({ key: 'back_squat', family: 'strength', unit: 'kg', label: 'Back Squat' })
    expect(resolveCapabilityKey('Run 5km')).toEqual({ key: 'run_5k', family: 'endurance', unit: 'seconds', label: 'Run 5km' })
    expect(resolveCapabilityKey('Row 2000m')).toEqual({ key: 'row_2000m', family: 'endurance', unit: 'seconds', label: 'Row 2000m' })
  })

  it('is case- and whitespace-insensitive', () => {
    expect(resolveCapabilityKey('  back squat ')?.key).toBe('back_squat')
    expect(resolveCapabilityKey('BENCH PRESS')?.key).toBe('bench_press')
  })

  it('resolves training-max aliases (Squat → back_squat, Bench → bench_press)', () => {
    expect(resolveCapabilityKey('Squat')?.key).toBe('back_squat')
    expect(resolveCapabilityKey('Bench')?.key).toBe('bench_press')
    expect(resolveCapabilityKey('OHP')?.key).toBe('overhead_press')
  })

  it('returns null for unknown names', () => {
    expect(resolveCapabilityKey('Sled Drag')).toBeNull()
  })

  it('every registry entry has a consistent family/unit', () => {
    for (const entry of Object.values(CAPABILITY_REGISTRY)) {
      expect(['strength', 'endurance']).toContain(entry.family)
      expect(entry.unit).toBe(entry.family === 'strength' ? 'kg' : 'seconds')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- capability-registry`
Expected: FAIL — cannot find module `../capability-registry`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/athlete/capability-registry.ts
// Controlled vocabulary: free-text benchmark/exercise names → stable capability keys.
// Resolves "benchmark identity is free text" (discovery Tension C) so domains can
// deterministically look up state.capabilities.strength['back_squat'].

export type CapabilityFamily = 'strength' | 'endurance'

export interface CapabilityDescriptor {
  key: string
  family: CapabilityFamily
  unit: 'kg' | 'seconds'
  label: string
}

// Canonical descriptors, keyed by stable key.
export const CAPABILITY_REGISTRY: Record<string, CapabilityDescriptor> = {
  back_squat:     { key: 'back_squat',     family: 'strength',  unit: 'kg',      label: 'Back Squat' },
  bench_press:    { key: 'bench_press',    family: 'strength',  unit: 'kg',      label: 'Bench Press' },
  deadlift:       { key: 'deadlift',       family: 'strength',  unit: 'kg',      label: 'Deadlift' },
  overhead_press: { key: 'overhead_press', family: 'strength',  unit: 'kg',      label: 'Overhead Press' },
  run_5k:         { key: 'run_5k',         family: 'endurance', unit: 'seconds', label: 'Run 5km' },
  row_2000m:      { key: 'row_2000m',      family: 'endurance', unit: 'seconds', label: 'Row 2000m' },
  swim_1k:        { key: 'swim_1k',        family: 'endurance', unit: 'seconds', label: 'Swim 1km' },
}

// Aliases: any free-text name (normalized) → canonical key. Includes the
// training_maxes exercise names (Squat/Bench/OHP) which differ from benchmark names.
const ALIASES: Record<string, string> = {
  'back squat': 'back_squat',
  'squat': 'back_squat',
  'bench press': 'bench_press',
  'bench': 'bench_press',
  'deadlift': 'deadlift',
  'overhead press': 'overhead_press',
  'ohp': 'overhead_press',
  'run 5km': 'run_5k',
  'run 5k': 'run_5k',
  '5k': 'run_5k',
  'row 2000m': 'row_2000m',
  'row 2km': 'row_2000m',
  'swim 1km': 'swim_1k',
  'swim 1k': 'swim_1k',
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function resolveCapabilityKey(name: string): CapabilityDescriptor | null {
  const key = ALIASES[normalize(name)]
  return key ? CAPABILITY_REGISTRY[key] : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- capability-registry`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/athlete/capability-registry.ts src/lib/athlete/__tests__/capability-registry.test.ts
git commit -m "feat(layer1): capability key registry"
```

---

## Task 3: Capability store actions (`recordCapability`, `getCapabilities`)

**Files:**
- Create: `src/lib/athlete/capabilities.actions.ts`
- Test: `src/lib/athlete/__tests__/capabilities.actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/athlete/__tests__/capabilities.actions.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { upsertsLog, selectRows } = vi.hoisted(() => ({
  upsertsLog: [] as any[],
  selectRows: [] as any[],
}))

vi.mock('@/lib/supabase/server', () => {
  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'athlete_capabilities') throw new Error(`unexpected table ${table}`)
      return {
        upsert: vi.fn((row: any) => { upsertsLog.push(row); return { error: null } }),
        select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: selectRows, error: null })) })),
      }
    }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  }
  return { createClient: vi.fn(async () => client) }
})

import { recordCapability, getCapabilities } from '../capabilities.actions'

describe('capabilities.actions', () => {
  beforeEach(() => { upsertsLog.length = 0; selectRows.length = 0; vi.clearAllMocks() })

  it('recordCapability upserts a canonical row with resolved key/family/unit', async () => {
    await recordCapability({ name: 'Squat', value: 132.5, source: 'recalibration', evidence: { driftPct: -0.05 } })
    expect(upsertsLog).toHaveLength(1)
    expect(upsertsLog[0]).toMatchObject({
      user_id: 'u1',
      capability_key: 'back_squat',
      family: 'strength',
      current_value: 132.5,
      unit: 'kg',
      source: 'recalibration',
      evidence: { driftPct: -0.05 },
    })
  })

  it('recordCapability is a no-op for unknown names (does not throw)', async () => {
    await recordCapability({ name: 'Sled Drag', value: 50, source: 'manual' })
    expect(upsertsLog).toHaveLength(0)
  })

  it('getCapabilities splits rows into strength + endurance families', async () => {
    selectRows.push(
      { capability_key: 'back_squat', family: 'strength', current_value: 120, unit: 'kg', source: 'onboarding', updated_at: 't1', evidence: {} },
      { capability_key: 'run_5k', family: 'endurance', current_value: 1500, unit: 'seconds', source: 'onboarding', updated_at: 't2', evidence: {} },
    )
    const caps = await getCapabilities('u1')
    expect(caps.strength).toHaveLength(1)
    expect(caps.strength[0]).toMatchObject({ key: 'back_squat', currentValueKg: 120, label: 'Back Squat' })
    expect(caps.endurance).toHaveLength(1)
    expect(caps.endurance[0]).toMatchObject({ key: 'run_5k', currentValueSeconds: 1500, label: 'Run 5km' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- capabilities.actions`
Expected: FAIL — cannot find module `../capabilities.actions`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/athlete/capabilities.actions.ts
'use server'

// The single writer + reader for the canonical athlete_capabilities store.
// recordCapability() is the ONLY path that mutates the table; benchmark + recalibration
// flows call it as a write-through. Unknown names are skipped (logged), never dropped silently.

import { createClient } from '@/lib/supabase/server'
import { resolveCapabilityKey } from './capability-registry'
import type { StrengthCapability, EnduranceCapability } from '@/lib/types/athlete-state.types'

export type CapabilitySource = 'onboarding' | 'recalibration' | 'manual' | 'test'

export interface RecordCapabilityInput {
  name: string                  // free-text benchmark/exercise name; resolved via registry
  value: number                 // kg (strength) or seconds (endurance)
  source: CapabilitySource
  evidence?: Record<string, unknown>
}

export async function recordCapability(input: RecordCapabilityInput): Promise<void> {
  const descriptor = resolveCapabilityKey(input.name)
  if (!descriptor) {
    console.warn(`[recordCapability] unmapped capability name skipped: "${input.name}"`)
    return
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthenticated')

  const { error } = await supabase
    .from('athlete_capabilities')
    .upsert({
      user_id: user.id,
      capability_key: descriptor.key,
      family: descriptor.family,
      current_value: input.value,
      unit: descriptor.unit,
      source: input.source,
      evidence: input.evidence ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,capability_key' })

  if (error) throw error
}

export interface AthleteCapabilities {
  strength: StrengthCapability[]
  endurance: EnduranceCapability[]
}

export async function getCapabilities(userId: string): Promise<AthleteCapabilities> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_capabilities')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error

  const rows = data ?? []
  const strength: StrengthCapability[] = []
  const endurance: EnduranceCapability[] = []

  for (const r of rows as Array<Record<string, any>>) {
    const descriptor = resolveCapabilityKey(r.capability_key) // key is already canonical; returns its own descriptor
    const label = descriptor?.label ?? r.capability_key
    if (r.family === 'strength') {
      strength.push({ key: r.capability_key, label, currentValueKg: Number(r.current_value), source: r.source, updatedAt: r.updated_at, evidence: r.evidence ?? {} })
    } else {
      endurance.push({ key: r.capability_key, label, currentValueSeconds: Number(r.current_value), source: r.source, updatedAt: r.updated_at, evidence: r.evidence ?? {} })
    }
  }
  return { strength, endurance }
}
```

Note: `resolveCapabilityKey` accepts a canonical key directly because every key appears in `ALIASES`? It does not — add canonical keys to lookups. Adjust `getCapabilities` to look up `CAPABILITY_REGISTRY[r.capability_key]` directly instead:

```ts
import { CAPABILITY_REGISTRY } from './capability-registry'
// ...
const label = CAPABILITY_REGISTRY[r.capability_key]?.label ?? r.capability_key
```
Use this `CAPABILITY_REGISTRY[...]` form (not `resolveCapabilityKey`) inside `getCapabilities`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- capabilities.actions`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/athlete/capabilities.actions.ts src/lib/athlete/__tests__/capabilities.actions.test.ts
git commit -m "feat(layer1): capability store recordCapability + getCapabilities"
```

---

## Task 4: AthleteState types

**Files:**
- Create: `src/lib/types/athlete-state.types.ts`

- [ ] **Step 1: Write the types (no test — pure type module)**

```ts
// src/lib/types/athlete-state.types.ts
// The canonical read model for Layer 1 (Athlete & State).
// Capability families are DISTINCT types, mirroring the prescription-family split.

import type { AthleteInjury } from './database.types'

export type CapabilitySource = 'onboarding' | 'recalibration' | 'manual' | 'test'

export interface StrengthCapability {
  key: string                 // e.g. 'back_squat'
  label: string               // e.g. 'Back Squat'
  currentValueKg: number
  source: CapabilitySource
  updatedAt: string
  evidence: Record<string, unknown>
}

export interface EnduranceCapability {
  key: string                 // e.g. 'run_5k'
  label: string
  currentValueSeconds: number
  source: CapabilitySource
  updatedAt: string
  evidence: Record<string, unknown>
}

export interface Readiness {
  status: 'GREEN' | 'YELLOW' | 'RED'
  score: number               // 0-1
  rationale: string
}

export interface AthleteState {
  identity: {
    age: number | null
    sex: string | null
    bodyweightKg: number | null
    goalArchetype: string | null
    primaryGoal: string | null
    experienceByModality: Record<string, string | null>
  }
  constraints: {
    injuries: AthleteInjury[]            // active only
    movementsToAvoid: string[]
    equipmentList: string[]
    environment: string | null
    availableDays: number | null
    sessionDurationMinutes: number | null
  }
  capabilities: {
    strength: StrengthCapability[]
    endurance: EnduranceCapability[]
  }
  readiness: Readiness | { status: 'UNKNOWN' }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/athlete-state.types.ts
git commit -m "feat(layer1): AthleteState read-model types"
```

---

## Task 5: Readiness producer (optional, never fabricated)

**Files:**
- Create: `src/lib/athlete/readiness.ts`
- Test: `src/lib/athlete/__tests__/readiness.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/athlete/__tests__/readiness.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { selfReportRows } = vi.hoisted(() => ({ selfReportRows: [] as any[] }))

vi.mock('@/lib/supabase/server', () => {
  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'athlete_self_reports') throw new Error(`unexpected table ${table}`)
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: selfReportRows, error: null })),
            })),
          })),
        })),
      }
    }),
  }
  return { createClient: vi.fn(async () => client) }
})

import { getReadiness } from '../readiness'

describe('getReadiness', () => {
  beforeEach(() => { selfReportRows.length = 0; vi.clearAllMocks() })

  it('returns UNKNOWN when there is no self-report data (today\'s reality)', async () => {
    const r = await getReadiness('u1')
    expect(r).toEqual({ status: 'UNKNOWN' })
  })

  it('returns a concrete status when a self-report exists', async () => {
    selfReportRows.push({ sleep_quality: 4, energy_level: 4, stress_level: 2, motivation: 4, soreness: {} })
    const r = await getReadiness('u1')
    expect(['GREEN', 'YELLOW', 'RED']).toContain((r as any).status)
    expect((r as any).score).toBeGreaterThanOrEqual(0)
    expect((r as any).score).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- readiness`
Expected: FAIL — cannot find module `../readiness`.

- [ ] **Step 3: Read the recovery-scorer skill to get its exact input/output shape**

Run: `sed -n '1,120p' src/lib/skills/domains/recovery/recovery-scorer.ts`
Note the exported skill name, its `inputSchema` fields, and the `execute()` return (`{ score, status, signals }`). You will map the latest self-report into that input.

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/athlete/readiness.ts
// Optional, never-fabricated readiness. Today the wearable + self-report tables are
// empty (see discovery Tension B), so this returns { status: 'UNKNOWN' } unless a
// self-report exists. When one does, it delegates to the existing recovery-scorer skill.

import { createClient } from '@/lib/supabase/server'
import { recoveryScorerSkill } from '@/lib/skills/domains/recovery/recovery-scorer'
import type { Readiness } from '@/lib/types/athlete-state.types'

export async function getReadiness(userId: string): Promise<Readiness | { status: 'UNKNOWN' }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_self_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error

  const latest = (data ?? [])[0]
  if (!latest) return { status: 'UNKNOWN' }

  // Map the latest self-report into the recovery-scorer input. Signal weights mirror
  // the recovery coach config defaults; completion/RIR signals are neutral here because
  // Layer 1 has no session context — those are layered in by the Coordinator later.
  const result = recoveryScorerSkill.execute({
    avgRpeDeviation: 0,
    avgRirDeviation: 0,
    completionRate: 1,
    missedSessions: 0,
    earlyCompletion: false,
    selfReport: {
      sleepQuality: latest.sleep_quality ?? 3,
      energyLevel: latest.energy_level ?? 3,
      stressLevel: latest.stress_level ?? 3,
      motivation: latest.motivation ?? 3,
      avgSoreness: 3,
    },
    signalWeights: {
      rirDeviation: 0.95, rpeDeviation: 0.9, missedSessions: 0.9, completionRate: 0.85,
      selfReportSleep: 0.8, selfReportEnergy: 0.8, selfReportSoreness: 0.85,
      selfReportStress: 0.75, selfReportMotivation: 0.7, earlyCompletion: 0.7,
    },
  })

  return { status: result.status, score: result.score, rationale: 'Derived from latest self-report.' }
}
```

If Step 3 reveals the skill's exported name or input field names differ, adjust the import and the `execute({...})` object to match exactly — do not invent fields. If the skill's input shape diverges materially, keep the UNKNOWN branch (the only path exercised by today's data) and wrap the populated branch in a try/catch that falls back to `{ status: 'UNKNOWN' }`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- readiness`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/athlete/readiness.ts src/lib/athlete/__tests__/readiness.test.ts
git commit -m "feat(layer1): optional never-fabricated readiness"
```

---

## Task 6: `getAthleteState()` assembler

**Files:**
- Create: `src/lib/athlete/get-athlete-state.ts`
- Test: `src/lib/athlete/__tests__/get-athlete-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/athlete/__tests__/get-athlete-state.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../capabilities.actions', () => ({
  getCapabilities: vi.fn(async () => ({
    strength: [{ key: 'back_squat', label: 'Back Squat', currentValueKg: 120, source: 'onboarding', updatedAt: 't', evidence: {} }],
    endurance: [{ key: 'run_5k', label: 'Run 5km', currentValueSeconds: 1500, source: 'onboarding', updatedAt: 't', evidence: {} }],
  })),
}))
vi.mock('../readiness', () => ({ getReadiness: vi.fn(async () => ({ status: 'UNKNOWN' })) }))

vi.mock('@/lib/supabase/server', () => {
  const profile = {
    id: 'u1', age: 34, sex: 'MALE', bodyweight_kg: 82, goal_archetype: 'hybrid_fitness',
    primary_goal: 'general', lifting_experience: 'intermediate', running_experience: 'beginner',
    movements_to_avoid: ['behind_neck_press'], equipment_list: ['barbell'], primary_training_environment: 'home_gym',
    available_days: 5, session_duration_minutes: 60,
  }
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'profiles') return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: profile, error: null })) })) })) }
      if (table === 'athlete_injuries') return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [], error: null })) })) })) }
      throw new Error(`unexpected table ${table}`)
    }),
  }
  return { createClient: vi.fn(async () => client) }
})

import { getAthleteState } from '../get-athlete-state'

describe('getAthleteState', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assembles identity, constraints, distinct-typed capabilities, and optional readiness', async () => {
    const state = await getAthleteState('u1')
    expect(state.identity).toMatchObject({ age: 34, sex: 'MALE', bodyweightKg: 82, goalArchetype: 'hybrid_fitness' })
    expect(state.identity.experienceByModality.lifting).toBe('intermediate')
    expect(state.constraints.movementsToAvoid).toContain('behind_neck_press')
    expect(state.constraints.injuries).toEqual([])
    expect(state.capabilities.strength[0].currentValueKg).toBe(120)
    expect(state.capabilities.endurance[0].currentValueSeconds).toBe(1500)
    expect(state.readiness).toEqual({ status: 'UNKNOWN' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- get-athlete-state`
Expected: FAIL — cannot find module `../get-athlete-state`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/athlete/get-athlete-state.ts
// The single entry point for Layer 1. Assembles the canonical AthleteState snapshot
// consumed identically by generation and execution. Pure helper (no 'use server') so it
// can be imported by both the engine and server actions.

import { createClient } from '@/lib/supabase/server'
import { getCapabilities } from './capabilities.actions'
import { getReadiness } from './readiness'
import type { AthleteState } from '@/lib/types/athlete-state.types'

export async function getAthleteState(userId: string): Promise<AthleteState> {
  const supabase = await createClient()

  const [profileRes, injuriesRes, capabilities, readiness] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('athlete_injuries').select('*').eq('user_id', userId).eq('is_active', true),
    getCapabilities(userId),
    getReadiness(userId),
  ])

  if (profileRes.error || !profileRes.data) throw new Error('Could not load athlete profile')
  const p = profileRes.data as Record<string, any>

  return {
    identity: {
      age: p.age ?? null,
      sex: p.sex ?? null,
      bodyweightKg: p.bodyweight_kg ?? null,
      goalArchetype: p.goal_archetype ?? null,
      primaryGoal: p.primary_goal ?? null,
      experienceByModality: {
        lifting: p.lifting_experience ?? null,
        running: p.running_experience ?? null,
        rucking: p.rucking_experience ?? null,
        rowing: p.rowing_experience ?? null,
        swimming: p.swimming_experience ?? null,
        cycling: p.cycling_experience ?? null,
        conditioning: p.conditioning_experience ?? null,
      },
    },
    constraints: {
      injuries: injuriesRes.data ?? [],
      movementsToAvoid: p.movements_to_avoid ?? [],
      equipmentList: p.equipment_list ?? [],
      environment: p.primary_training_environment ?? null,
      availableDays: p.available_days ?? null,
      sessionDurationMinutes: p.session_duration_minutes ?? null,
    },
    capabilities,
    readiness,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- get-athlete-state`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/athlete/get-athlete-state.ts src/lib/athlete/__tests__/get-athlete-state.test.ts
git commit -m "feat(layer1): getAthleteState assembler"
```

---

## Task 7: Write-through hook in `setTrainingMax` (recalibration path)

**Files:**
- Modify: `src/lib/actions/training-maxes.actions.ts:45-74`
- Test: `src/lib/actions/__tests__/training-maxes.test.ts` (extend)

- [ ] **Step 1: Write the failing test (extend existing file)**

Add to `src/lib/actions/__tests__/training-maxes.test.ts`. The existing mock only handles `profiles`; extend it to also accept `athlete_capabilities`, then assert the write-through fires.

```ts
// Add near the top of the existing describe block:
import { recordCapability } from '@/lib/athlete/capabilities.actions'
vi.mock('@/lib/athlete/capabilities.actions', () => ({
  recordCapability: vi.fn(async () => {}),
}))

// New test:
it('setTrainingMax writes through to recordCapability', async () => {
  await setTrainingMax({ exercise: 'Squat', trainingMaxKg: 132.5, source: 'recalibration' })
  expect(recordCapability).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Squat', value: 132.5, source: 'recalibration' })
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- training-maxes`
Expected: FAIL — `recordCapability` not called (write-through not yet added).

- [ ] **Step 3: Add the write-through to `setTrainingMax`**

In `src/lib/actions/training-maxes.actions.ts`, add the import at the top:
```ts
import { recordCapability } from '@/lib/athlete/capabilities.actions'
```
Then, just before `return entry` (after the successful `update`), add:
```ts
  // Write-through to the canonical capability store. Source maps recalibration/onboarding/
  // intervention_response → recordCapability's source. Failures must not break the max write.
  try {
    await recordCapability({
      name: input.exercise,
      value: entry.trainingMaxKg,
      source: input.source === 'intervention_response' ? 'recalibration' : input.source,
      evidence: { from: 'training_max', source: input.source },
    })
  } catch (err) {
    console.error('[setTrainingMax] capability write-through failed', err)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- training-maxes`
Expected: PASS (existing tests + the new write-through test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/training-maxes.actions.ts src/lib/actions/__tests__/training-maxes.test.ts
git commit -m "feat(layer1): write-through capability on setTrainingMax (recalibration)"
```

---

## Task 8: Write-through hook at the onboarding benchmark insert

**Files:**
- Modify: `src/lib/actions/onboarding.actions.ts` (around the `.from('athlete_benchmarks')` insert near line 281)

- [ ] **Step 1: Read the insert site**

Run: `sed -n '255,310p' src/lib/actions/onboarding.actions.ts`
Identify the benchmark insert (`.from('athlete_benchmarks').insert(...)`) and the in-scope variable holding each benchmark's `{ benchmark_name, value }`.

- [ ] **Step 2: Add the write-through after a successful benchmark insert**

Add the import at the top of `onboarding.actions.ts`:
```ts
import { recordCapability } from '@/lib/athlete/capabilities.actions'
```
After the benchmark insert succeeds, loop the inserted benchmarks and record each capability (unknown names are skipped inside `recordCapability`):
```ts
  // Write-through: seed canonical capabilities from onboarding benchmarks.
  for (const b of benchmarksToInsert) {
    try {
      await recordCapability({ name: b.benchmark_name, value: Number(b.value), source: 'onboarding', evidence: { from: 'onboarding_benchmark' } })
    } catch (err) {
      console.error('[onboarding] capability write-through failed', err)
    }
  }
```
Use the actual variable name for the inserted benchmark array found in Step 1 (e.g. `benchmarksToInsert` / `rows`); match it exactly.

- [ ] **Step 3: Typecheck + run the onboarding tests if present**

Run: `npx tsc --noEmit && npm test -- onboarding`
Expected: no type errors; onboarding tests (if any) pass. If there are no onboarding tests, rely on tsc.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/onboarding.actions.ts
git commit -m "feat(layer1): write-through capability on onboarding benchmark insert"
```

---

## Task 9: Backfill existing data into `athlete_capabilities`

**Files:**
- Create: `supabase/migrations/022_backfill_athlete_capabilities.sql`

- [ ] **Step 1: Write the backfill migration**

This seeds canonical rows from the latest benchmark per name and from `profiles.training_maxes`, with recalibrated training maxes taking precedence (later `updated_at`). Non-destructive. Capability-key mapping is inlined as a CASE to match the registry.

```sql
-- supabase/migrations/022_backfill_athlete_capabilities.sql
-- One-time, non-destructive backfill of athlete_capabilities from existing sources.
-- Mirrors src/lib/athlete/capability-registry.ts. Latest benchmark per key wins;
-- profiles.training_maxes (recalibrated strength) overrides benchmark-derived rows.

-- 1) From latest benchmark per (user, mapped key).
WITH mapped AS (
  SELECT
    b.user_id,
    CASE lower(btrim(b.benchmark_name))
      WHEN 'back squat' THEN 'back_squat'
      WHEN 'bench press' THEN 'bench_press'
      WHEN 'deadlift' THEN 'deadlift'
      WHEN 'overhead press' THEN 'overhead_press'
      WHEN 'run 5km' THEN 'run_5k'
      WHEN 'run 5k' THEN 'run_5k'
      WHEN 'row 2000m' THEN 'row_2000m'
      WHEN 'swim 1km' THEN 'swim_1k'
      ELSE NULL
    END AS capability_key,
    b.value,
    b.created_at
  FROM public.athlete_benchmarks b
),
latest AS (
  SELECT DISTINCT ON (user_id, capability_key)
    user_id, capability_key, value
  FROM mapped
  WHERE capability_key IS NOT NULL
  ORDER BY user_id, capability_key, created_at DESC
)
INSERT INTO public.athlete_capabilities (user_id, capability_key, family, current_value, unit, source, evidence)
SELECT
  l.user_id,
  l.capability_key,
  CASE WHEN l.capability_key IN ('back_squat','bench_press','deadlift','overhead_press') THEN 'strength' ELSE 'endurance' END,
  l.value,
  CASE WHEN l.capability_key IN ('back_squat','bench_press','deadlift','overhead_press') THEN 'kg' ELSE 'seconds' END,
  'onboarding',
  jsonb_build_object('backfill', 'benchmark')
FROM latest l
ON CONFLICT (user_id, capability_key) DO NOTHING;

-- 2) From profiles.training_maxes JSON (strength only). Overrides benchmark rows.
WITH tm AS (
  SELECT
    p.id AS user_id,
    CASE lower(btrim(kv.key))
      WHEN 'squat' THEN 'back_squat'
      WHEN 'back squat' THEN 'back_squat'
      WHEN 'bench' THEN 'bench_press'
      WHEN 'bench press' THEN 'bench_press'
      WHEN 'deadlift' THEN 'deadlift'
      WHEN 'overhead press' THEN 'overhead_press'
      WHEN 'ohp' THEN 'overhead_press'
      ELSE NULL
    END AS capability_key,
    (kv.value->>'trainingMaxKg')::numeric AS value
  FROM public.profiles p,
       LATERAL jsonb_each(COALESCE(p.training_maxes, '{}'::jsonb)) AS kv
)
INSERT INTO public.athlete_capabilities (user_id, capability_key, family, current_value, unit, source, evidence)
SELECT user_id, capability_key, 'strength', value, 'kg', 'recalibration', jsonb_build_object('backfill', 'training_max')
FROM tm
WHERE capability_key IS NOT NULL AND value IS NOT NULL
ON CONFLICT (user_id, capability_key)
DO UPDATE SET current_value = EXCLUDED.current_value, source = EXCLUDED.source, evidence = EXCLUDED.evidence, updated_at = now();
```

- [ ] **Step 2: Apply the migration**

Apply via MCP `apply_migration` (name `022_backfill_athlete_capabilities`) or `supabase db push`.

- [ ] **Step 3: Verify the backfill reproduces today's effective maxes**

Run:
```sql
select capability_key, family, current_value, unit, source from public.athlete_capabilities order by family, capability_key;
```
Expected (spot-check against discovery): `back_squat` resolves to the recalibrated/latest value (not a stale 102/105 duplicate); `run_5k` = 1500 seconds; `row_2000m` = 470; one row per key — no duplicates.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/022_backfill_athlete_capabilities.sql
git commit -m "feat(layer1): non-destructive backfill of athlete_capabilities"
```

---

## Task 10: Seam — `buildAthleteContext` delegates to `getAthleteState`

**Files:**
- Modify: `src/lib/engine/mesocycle/context.ts:86-185` and `:320` (`deduplicateBenchmarks`)
- Test: `src/lib/engine/mesocycle/__tests__/build-athlete-context-extended.test.ts` (existing — must still pass)

This task makes the existing packet read capabilities from the canonical store **without changing the packet's external shape** (generation paths keep working). We attach the resolved `AthleteState` alongside the existing fields so consumers can migrate incrementally.

- [ ] **Step 1: Extend the packet type (additive, optional)**

In `src/lib/types/coach-context.ts`, add to `AthleteContextPacket` (after line 64):
```ts
    // Layer 1 canonical state (additive seam — consumers migrate onto this).
    athleteState?: import('./athlete-state.types').AthleteState
```

- [ ] **Step 2: Write the failing test**

Add to `src/lib/engine/mesocycle/__tests__/build-athlete-context-extended.test.ts` a case asserting the packet now carries `athleteState` with canonical capabilities. Mock `getAthleteState`:
```ts
vi.mock('@/lib/athlete/get-athlete-state', () => ({
  getAthleteState: vi.fn(async () => ({
    identity: { age: 34, sex: 'MALE', bodyweightKg: 82, goalArchetype: 'hybrid_fitness', primaryGoal: null, experienceByModality: {} },
    constraints: { injuries: [], movementsToAvoid: [], equipmentList: [], environment: null, availableDays: null, sessionDurationMinutes: null },
    capabilities: { strength: [{ key: 'back_squat', label: 'Back Squat', currentValueKg: 120, source: 'onboarding', updatedAt: 't', evidence: {} }], endurance: [] },
    readiness: { status: 'UNKNOWN' },
  })),
}))

it('attaches canonical athleteState to the packet', async () => {
  // ...build context per the existing test's harness...
  expect(result.data?.athleteState?.capabilities.strength[0].currentValueKg).toBe(120)
})
```
Match the existing test's setup/harness for invoking `buildAthleteContext` (reuse its mock scaffolding).

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- build-athlete-context-extended`
Expected: FAIL — `athleteState` is undefined.

- [ ] **Step 4: Wire the delegation**

In `context.ts`, add the import:
```ts
import { getAthleteState } from '@/lib/athlete/get-athlete-state'
```
Inside `buildAthleteContext`, add `getAthleteState(userId)` to the parallel load (alongside injuries/benchmarks at line 113), then set `athleteState` on the returned `ctx` object (line 159-173):
```ts
    const athleteState = await getAthleteState(userId)
    // ...
    const ctx: AthleteContextPacket = {
      // ...existing fields unchanged...
      athleteState,
    }
```
Leave `benchmarks` / `deduplicateBenchmarks` in place for now — they remain the source for un-migrated consumers. (Their removal is Task 11, after downstream domains read `athleteState`.)

- [ ] **Step 5: Run tests**

Run: `npm test -- build-athlete-context-extended && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/coach-context.ts src/lib/engine/mesocycle/context.ts src/lib/engine/mesocycle/__tests__/build-athlete-context-extended.test.ts
git commit -m "feat(layer1): buildAthleteContext attaches canonical athleteState seam"
```

---

## Task 11: Full suite green + cleanup note

**Files:**
- (No new files.) Verification + a tracking note.

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all tests pass (new Layer 1 tests + all pre-existing tests). If any pre-existing test broke, fix the seam — do not weaken the test.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Record the deferred cleanup**

The following are intentionally NOT removed in this plan — they are removed once the Strength/Endurance domain layers read `athleteState.capabilities` directly (Layer 2/3 work):
- `deduplicateBenchmarks()` (`context.ts:320`)
- `resolveTrainingMaxForExercise()` (`training/methodology-helpers.ts:78`)
- `AthleteContextPacket.benchmarks` (kept until no consumer reads it)

Add this list to `docs/superpowers/specs/2026-06-01-hybrid-core-rebuild-design.md` §10 (Open Questions) under a new "Deferred cleanups" line, or leave as-is here for the Layer 2 plan to pick up.

- [ ] **Step 4: Final commit**

```bash
git commit --allow-empty -m "chore(layer1): athlete & state layer complete — suite green"
```

---

## Self-Review (completed)

**Spec coverage:**
- Canonical store (design §2) → Tasks 1, 3. ✓
- Capability keys (§3) → Task 2. ✓
- Typed read model (§4) → Tasks 4, 6. ✓
- Optional readiness (§5) → Task 5. ✓
- Immutability property (§6) → structural; no generation changes here, write-through only updates capability (Tasks 7-8). ✓
- The seam (§7) → Task 10. ✓
- Backfill (§8) → Task 9. ✓
- Non-goals (§9): no Garmin rework, no recovery-scoring changes (reused as-is in Task 5), no re-prescribe flow, no destructive migration. ✓

**Type consistency:** `recordCapability({ name, value, source, evidence })`, `getCapabilities → { strength: StrengthCapability[], endurance: EnduranceCapability[] }`, `StrengthCapability.currentValueKg` / `EnduranceCapability.currentValueSeconds`, `Readiness | { status: 'UNKNOWN' }`, `getAthleteState → AthleteState` — consistent across Tasks 3, 4, 5, 6, 10.

**Placeholder scan:** Tasks 5 and 8 contain "read the real file first" steps with concrete `sed` commands (not vague TODOs) because the recovery-scorer input shape and onboarding insert variable name must be matched exactly to existing code; both include an explicit fallback instruction. All code steps show complete code.
