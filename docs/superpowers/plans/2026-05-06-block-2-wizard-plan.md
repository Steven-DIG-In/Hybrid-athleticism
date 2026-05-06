# Block Creation Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a canonical block-creation wizard at `/data/blocks/new` used by both onboarding (Block 1) and post-block-close (Block 2+). Activate the dormant head-coach strategy step. Wire sub-project A's retrospective + sub-project B's pending_planner_notes into the planner prompt.

**Architecture:** Two-step wizard (review → AI plan preview → approve). Step 1 is a single scrolling page with retrospective tile + carryover summary + archetype picker + duration selector (sections conditionally shown by mode). Approve calls `createBlockShell` → `runHeadCoachStrategy` → `generateSessionPool(week1)`. Per-week `generateSessionPool` extends to read the persisted strategy and pass weekBrief into per-coach prompts. Onboarding refactors to redirect to the wizard instead of silently generating Block 1.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase (Postgres 17, RLS), `@anthropic-ai/sdk`, Vitest 4, Tailwind 4. Package manager: npm.

**Spec:** `docs/superpowers/specs/2026-05-06-block-2-wizard-design.md`

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/lib/engine/mesocycle/strategy-generation.ts` | `runHeadCoachStrategy` server action |
| `src/lib/engine/mesocycle/create-shell.ts` | `createBlockShell` server action |
| `src/lib/engine/mesocycle/approve.ts` | `approveBlockPlan` server action |
| `src/lib/engine/mesocycle/regenerate.ts` | `regenerateBlockPlan` server action |
| `src/lib/engine/mesocycle/__tests__/strategy-generation.test.ts` | Unit tests |
| `src/lib/engine/mesocycle/__tests__/create-shell.test.ts` | Unit tests |
| `src/lib/engine/mesocycle/__tests__/approve.test.ts` | Unit tests |
| `src/lib/engine/mesocycle/__tests__/regenerate.test.ts` | Unit tests |
| `src/lib/engine/mesocycle/__tests__/build-athlete-context-extended.test.ts` | Unit tests for the carryover read extension |
| `src/lib/wizard/archetypes.ts` | `ARCHETYPE_DEFAULTS` map + `Archetype` type |
| `src/components/wizard/BlockCreationWizard.tsx` | Top-level wizard client component |
| `src/components/wizard/RetrospectiveSummaryTile.tsx` | Step 1 retrospective tile |
| `src/components/wizard/CarryoverSummary.tsx` | Step 1 carryover read-only display + edit modal trigger |
| `src/components/wizard/AvailabilityForm.tsx` | Step 1 availability form (first-block mode) |
| `src/components/wizard/ArchetypePicker.tsx` | Step 1 6-cell archetype picker |
| `src/components/wizard/SessionCountSteppers.tsx` | Step 1 custom-mode steppers |
| `src/components/wizard/DurationSelector.tsx` | Step 1 4/6/8 selector |
| `src/components/wizard/GenerationProgress.tsx` | Step 2 loading/progress indicator |
| `src/components/wizard/StrategySummaryTile.tsx` | Step 2 strategy summary (bars + arc + narrative) |
| `src/components/wizard/WeekSessionPoolPreview.tsx` | Step 2 week 1 session list |
| `src/components/wizard/__tests__/BlockCreationWizard.test.tsx` | Wizard component tests |
| `src/app/data/blocks/new/page.tsx` | Server route for the wizard |
| `tests/e2e/block-creation-wizard.spec.ts` | Playwright spec (committed not runnable) |

### Modified files

| Path | Change |
|---|---|
| `src/lib/types/coach-context.ts` | Extend `AthleteContextPacket` with `latestBlockRetrospective?` and `pendingPlannerNotes?` fields |
| `src/lib/engine/mesocycle/context.ts` | Extend `buildAthleteContext` to load retrospective + pending notes |
| `src/lib/ai/prompts/head-coach.ts` | Extend `buildMesocycleStrategyUserPrompt` with 4 new sections (retrospective, reality, availability, requested emphasis) |
| `src/lib/engine/microcycle/generate-pool.ts` | Read persisted strategy; pass `weekBrief` into per-coach prompts |
| `src/lib/actions/onboarding.actions.ts` | Strip mesocycle/microcycle/inventory creation from `completeOnboarding` |
| `src/app/onboarding/page.tsx` | Change "Finish" handler redirect from `/dashboard` to `/data/blocks/new` |
| `src/components/dashboard/DashboardNoActiveBlockEmpty.tsx` | Replace "BLOCK 2 WIZARD SHIPS NEXT" copy with a Link button |
| `src/app/data/blocks/[mesocycleId]/reality-check/page.tsx` | After form submit, redirect to `/data/blocks/new` instead of `/dashboard` |

---

## Task 1: Extend `buildAthleteContext` to load retrospective + pending notes

**Files:**
- Modify: `src/lib/types/coach-context.ts`
- Modify: `src/lib/engine/mesocycle/context.ts`
- Create: `src/lib/engine/mesocycle/__tests__/build-athlete-context-extended.test.ts`

- [ ] **Step 1: Extend `AthleteContextPacket` type**

Edit `src/lib/types/coach-context.ts`. Find the `AthleteContextPacket` interface; add imports + two optional fields at the bottom:

```ts
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'
import type { PendingPlannerNotes } from '@/lib/types/pending-planner-notes.types'

export interface AthleteContextPacket {
    // ...existing fields unchanged...
    latestBlockRetrospective?: BlockRetrospectiveSnapshot | null
    pendingPlannerNotes?: PendingPlannerNotes | null
}
```

- [ ] **Step 2: Write failing test**

Create `src/lib/engine/mesocycle/__tests__/build-athlete-context-extended.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const state: { retrospective: any; pendingNotes: any } = { retrospective: null, pendingNotes: null }

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
        from: vi.fn((table: string) => {
            const select = vi.fn(() => ({
                eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(async () => ({ data: minimalRow(table), error: null })),
                        order: vi.fn(() => ({ limit: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: state.retrospective, error: null })) })) })),
                    })),
                    single: vi.fn(async () => ({ data: minimalRow(table), error: null })),
                    order: vi.fn(() => ({ limit: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: state.retrospective, error: null })) })) })),
                })),
            }))
            return { select }
        }),
    })),
}))

function minimalRow(table: string) {
    if (table === 'profiles') return { id: 'user-1', pending_planner_notes: state.pendingNotes }
    if (table === 'mesocycles') return { id: 'meso-1', user_id: 'user-1', goal: 'HYBRID_PEAKING', week_count: 6 }
    if (table === 'microcycles') return { id: 'micro-1', is_deload: false, target_rir: 2 }
    return null
}

import { buildAthleteContext } from '@/lib/engine/mesocycle/context'

describe('buildAthleteContext — carryover extension', () => {
    beforeEach(() => {
        state.retrospective = null
        state.pendingNotes = null
    })

    it('returns retrospective when present', async () => {
        state.retrospective = { schemaVersion: '1.0', block: { id: 'b1', name: 'Test' }, adherence: { overall: { completed: 21, prescribed: 51, pct: 41 }, byCoachDomain: [], byWeek: [] }, executionQuality: [], recalibrations: [], interventions: [], missedSessions: [], generatedAt: new Date().toISOString() }
        const r = await buildAthleteContext('user-1', 'meso-1', 1)
        expect(r.success).toBe(true)
        expect(r.success && r.data.latestBlockRetrospective?.adherence.overall.pct).toBe(41)
    })

    it('returns pending planner notes when present', async () => {
        state.pendingNotes = { schemaVersion: '1.0', daysPerWeek: 6, sessionMinutes: 75, warmupMinutes: 20, cooldownMinutes: 0, freeText: 'test', updatedAt: new Date().toISOString() }
        const r = await buildAthleteContext('user-1', 'meso-1', 1)
        expect(r.success).toBe(true)
        expect(r.success && r.data.pendingPlannerNotes?.daysPerWeek).toBe(6)
    })

    it('returns null carryover when neither exists', async () => {
        const r = await buildAthleteContext('user-1', 'meso-1', 1)
        expect(r.success).toBe(true)
        expect(r.success && r.data.latestBlockRetrospective).toBeNull()
        expect(r.success && r.data.pendingPlannerNotes).toBeNull()
    })
})
```

- [ ] **Step 3: Run test — must fail**

Run: `npx vitest run src/lib/engine/mesocycle/__tests__/build-athlete-context-extended.test.ts`
Expected: FAIL — `latestBlockRetrospective` undefined.

- [ ] **Step 4: Implement extension**

Edit `src/lib/engine/mesocycle/context.ts`. Inside `buildAthleteContext`, after the existing parallel loads (around line 115), add two more queries:

```ts
// Load retrospective + pending notes in parallel (carryover for head coach)
const [retroResult, profileNotesResult] = await Promise.all([
    supabase
        .from('block_retrospectives')
        .select('snapshot_json')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    supabase
        .from('profiles')
        .select('pending_planner_notes')
        .eq('id', userId)
        .single(),
])

const latestBlockRetrospective = (retroResult.data?.snapshot_json as BlockRetrospectiveSnapshot) ?? null
const pendingPlannerNotes = (profileNotesResult.data?.pending_planner_notes as PendingPlannerNotes) ?? null
```

Add the imports at top of file:
```ts
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'
import type { PendingPlannerNotes } from '@/lib/types/pending-planner-notes.types'
```

In the `ctx: AthleteContextPacket = { ... }` literal (around line 136), append:
```ts
    latestBlockRetrospective,
    pendingPlannerNotes,
```

- [ ] **Step 5: Run test — must pass**

Run: `npx vitest run src/lib/engine/mesocycle/__tests__/build-athlete-context-extended.test.ts`
Expected: PASS (3/3).

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: PASS overall (existing `garmin-sync.test.ts` pre-existing failure acceptable).

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/coach-context.ts \
    src/lib/engine/mesocycle/context.ts \
    src/lib/engine/mesocycle/__tests__/build-athlete-context-extended.test.ts
git commit -m "feat(engine): buildAthleteContext reads retrospective + pending notes

Sub-project D phase 1. Extended AthleteContextPacket with two
optional fields. buildAthleteContext now loads the latest
block_retrospectives snapshot and the user's pending_planner_notes
in parallel with the existing context loads. Backward-compatible:
both fields null when no prior block exists.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `createBlockShell` server action

**Files:**
- Create: `src/lib/engine/mesocycle/create-shell.ts`
- Create: `src/lib/engine/mesocycle/__tests__/create-shell.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/engine/mesocycle/__tests__/create-shell.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const state: any = { mesoCount: 0, insertedMesos: [] as any[], insertedMicros: [] as any[] }

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
        from: vi.fn((table: string) => {
            if (table === 'mesocycles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({ count: 'exact', head: true, then: undefined })),
                    })),
                    insert: vi.fn((row: any) => ({
                        select: vi.fn(() => ({
                            single: vi.fn(async () => {
                                state.insertedMesos.push(row)
                                return { data: { ...row, id: 'meso-new' }, error: null }
                            }),
                        })),
                    })),
                }
            }
            if (table === 'microcycles') {
                return {
                    insert: vi.fn(async (rows: any[]) => {
                        state.insertedMicros.push(...rows)
                        return { error: null }
                    }),
                }
            }
            return {}
        }),
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createBlockShell } from '@/lib/engine/mesocycle/create-shell'

describe('createBlockShell', () => {
    beforeEach(() => {
        state.mesoCount = 0
        state.insertedMesos = []
        state.insertedMicros = []
    })

    it('inserts mesocycle with name based on archetype + block number', async () => {
        const r = await createBlockShell({
            mode: 'post-block',
            archetype: 'hypertrophy',
            durationWeeks: 6,
            customCounts: undefined,
            carryover: { daysPerWeek: 6, sessionMinutes: 75, warmupMinutes: 20, cooldownMinutes: 0, freeText: '' },
        }, /* blockNumberOverride for test */ 2)
        expect(r.success).toBe(true)
        expect(state.insertedMesos[0].name).toBe('HYPERTROPHY Block 2')
        expect(state.insertedMesos[0].is_active).toBe(false)
        expect(state.insertedMesos[0].is_complete).toBe(false)
        expect(state.insertedMesos[0].week_count).toBe(6)
    })

    it('scaffolds 6 microcycles when durationWeeks is 6', async () => {
        await createBlockShell({
            mode: 'post-block',
            archetype: 'strength',
            durationWeeks: 6,
            carryover: { daysPerWeek: 5, sessionMinutes: 60, warmupMinutes: 10, cooldownMinutes: 0, freeText: '' },
        }, 1)
        expect(state.insertedMicros).toHaveLength(6)
        expect(state.insertedMicros[5].is_deload).toBe(true)
    })

    it('persists carryover + archetype + customCounts in ai_context_json', async () => {
        await createBlockShell({
            mode: 'post-block',
            archetype: 'custom',
            durationWeeks: 4,
            customCounts: { hypertrophy: 2, strength: 3, conditioning: 1, endurance: 0, mobility: 1 },
            carryover: { daysPerWeek: 4, sessionMinutes: 90, warmupMinutes: 15, cooldownMinutes: 5, freeText: 'note' },
        }, 3)
        expect(state.insertedMesos[0].ai_context_json.archetype).toBe('custom')
        expect(state.insertedMesos[0].ai_context_json.customCounts.strength).toBe(3)
        expect(state.insertedMesos[0].ai_context_json.carryover.daysPerWeek).toBe(4)
    })
})
```

- [ ] **Step 2: Run test — must fail**

Run: `npx vitest run src/lib/engine/mesocycle/__tests__/create-shell.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/engine/mesocycle/create-shell.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types/training.types'
import type { CoachDomain } from '@/lib/skills/types'

export type Archetype =
    | 'hypertrophy'
    | 'strength'
    | 'endurance_event'
    | 'conditioning'
    | 'hybrid'
    | 'custom'

export interface CreateBlockShellInput {
    mode: 'first-block' | 'post-block'
    archetype: Archetype
    durationWeeks: 4 | 6 | 8
    customCounts?: Record<CoachDomain, number>
    carryover: {
        daysPerWeek: number
        sessionMinutes: number
        warmupMinutes: number
        cooldownMinutes: number
        freeText: string
    }
}

function getNextMonday(from: Date): Date {
    const d = new Date(from)
    const day = d.getDay()
    const offset = day === 0 ? 1 : (8 - day) % 7 || 7
    d.setDate(d.getDate() + offset)
    return d
}

export async function createBlockShell(
    input: CreateBlockShellInput,
    blockNumberOverride?: number,
): Promise<ActionResult<{ mesocycleId: string }>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    // Determine block number
    let blockNumber = blockNumberOverride
    if (blockNumber === undefined) {
        const { count } = await supabase
            .from('mesocycles')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
        blockNumber = (count ?? 0) + 1
    }

    const startDate = getNextMonday(new Date())
    const name = `${input.archetype.toUpperCase()} Block ${blockNumber}`

    const { data: meso, error: mesoErr } = await supabase
        .from('mesocycles')
        .insert({
            user_id: user.id,
            name,
            goal: input.archetype.toUpperCase(),
            week_count: input.durationWeeks,
            start_date: startDate.toISOString().split('T')[0],
            is_active: false,
            is_complete: false,
            ai_context_json: {
                archetype: input.archetype,
                customCounts: input.customCounts ?? null,
                carryover: input.carryover,
                mode: input.mode,
                strategy: null,
            },
        })
        .select()
        .single()

    if (mesoErr || !meso) return { success: false, error: mesoErr?.message ?? 'Mesocycle insert failed' }

    // Scaffold microcycles
    const microcycles = []
    for (let week = 1; week <= input.durationWeeks; week++) {
        const weekStart = new Date(startDate)
        weekStart.setDate(weekStart.getDate() + (week - 1) * 7)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)

        const isDeload = week === input.durationWeeks
        const targetRir = isDeload ? 4 : Math.max(0, 3 - (week - 1) * 0.5)

        microcycles.push({
            mesocycle_id: meso.id,
            user_id: user.id,
            week_number: week,
            start_date: weekStart.toISOString().split('T')[0],
            end_date: weekEnd.toISOString().split('T')[0],
            target_rir: targetRir,
            is_deload: isDeload,
        })
    }

    const { error: microErr } = await supabase.from('microcycles').insert(microcycles)
    if (microErr) return { success: false, error: `Microcycle scaffold failed: ${microErr.message}` }

    revalidatePath('/data/blocks/new')
    return { success: true, data: { mesocycleId: meso.id } }
}
```

- [ ] **Step 4: Run test — must pass**

Run: `npx vitest run src/lib/engine/mesocycle/__tests__/create-shell.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: tsc + full suite**

```bash
npx tsc --noEmit && npm test
```
Expected: tsc no NEW errors. Tests pass overall.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/mesocycle/create-shell.ts \
    src/lib/engine/mesocycle/__tests__/create-shell.test.ts
git commit -m "feat(engine): createBlockShell action

Inserts mesocycle row + scaffolds microcycles. Used by the new
block-creation wizard. Mesocycle name follows the new template
'\${ARCHETYPE} Block \${blockNumber}'. is_active=false until approve.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `runHeadCoachStrategy` server action + prompt extension

**Files:**
- Modify: `src/lib/ai/prompts/head-coach.ts`
- Create: `src/lib/engine/mesocycle/strategy-generation.ts`
- Create: `src/lib/engine/mesocycle/__tests__/strategy-generation.test.ts`

- [ ] **Step 1: Extend `buildMesocycleStrategyUserPrompt`**

Edit `src/lib/ai/prompts/head-coach.ts`. Find `buildMesocycleStrategyUserPrompt(ctx: AthleteContextPacket)` (around line 88). After the existing prompt body but before its return, append four new sections:

```ts
// Last block's actuals (post-block carryover)
if (ctx.latestBlockRetrospective) {
    const r = ctx.latestBlockRetrospective
    sections.push(`## Last Block's Actuals
Name: ${r.block.name}
Adherence: ${r.adherence.overall.completed}/${r.adherence.overall.prescribed} (${r.adherence.overall.pct}%)
By coach domain:
${r.adherence.byCoachDomain.map(d => `  - ${d.coachDomain}: ${d.completed}/${d.prescribed} (${d.pct}%)`).join('\n')}
Recalibrations: ${r.recalibrations.length}
Interventions: ${r.interventions.length}
Missed sessions: ${r.missedSessions.length}

Use this to inform domain emphasis and load — what worked, what didn't.`)
}

// Athlete's stated reality (post-block carryover from reality-check)
if (ctx.pendingPlannerNotes) {
    const n = ctx.pendingPlannerNotes
    const effectiveMin = n.sessionMinutes - n.warmupMinutes - n.cooldownMinutes
    sections.push(`## Athlete's Stated Reality
Days/week: ${n.daysPerWeek}
Session length: ${n.sessionMinutes} min (warmup ${n.warmupMinutes}, cooldown ${n.cooldownMinutes})
Effective work time per session: ${effectiveMin} min
Free text: ${n.freeText || '(none)'}

Treat these as authoritative. Total weekly load budget is ${n.daysPerWeek * effectiveMin} effective minutes. Plan within this budget.`)
}

// Athlete's availability (first-block, surfaced via mesocycle.ai_context_json.carryover)
const aiCtx = (ctx as any).aiContextJson as { carryover?: any; archetype?: string; customCounts?: Record<string, number>; mode?: string } | undefined
if (aiCtx?.mode === 'first-block' && aiCtx.carryover) {
    const c = aiCtx.carryover
    const effectiveMin = c.sessionMinutes - c.warmupMinutes - c.cooldownMinutes
    sections.push(`## Athlete's Availability
Days/week: ${c.daysPerWeek}
Session length: ${c.sessionMinutes} min (warmup ${c.warmupMinutes}, cooldown ${c.cooldownMinutes})
Effective work time per session: ${effectiveMin} min
Free text: ${c.freeText || '(none)'}

Treat these as authoritative. Total weekly load budget is ${c.daysPerWeek * effectiveMin} effective minutes. Plan within this budget.`)
}

// Athlete's requested emphasis (always — from archetype + customCounts)
if (aiCtx?.archetype) {
    const counts = aiCtx.customCounts ?? ARCHETYPE_DEFAULTS[aiCtx.archetype as keyof typeof ARCHETYPE_DEFAULTS]
    if (counts) {
        sections.push(`## Athlete's Requested Emphasis
Archetype: ${aiCtx.archetype}
Per-coach session count request:
${Object.entries(counts).map(([coach, n]) => `  - ${coach}: ${n} sessions/week`).join('\n')}

Use this as a hint; you may bias up or down by ±1 session per coach if recovery/load math demands it, but prefer the athlete's expressed intent.`)
    }
}
```

The reference to `ARCHETYPE_DEFAULTS` requires importing from the new wizard module (Task 8 will create it). For now, add this temporary import:

```ts
import { ARCHETYPE_DEFAULTS } from '@/lib/wizard/archetypes'
```

(Task 8 creates this. If you're executing tasks in order, do Task 8 before this step or skip the emphasis section temporarily and add in Task 8.)

The four sections gate themselves on data presence, so the prompt remains valid for legacy contexts that don't have the new fields.

- [ ] **Step 2: Write failing test**

Create `src/lib/engine/mesocycle/__tests__/strategy-generation.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const state: any = {
    user: { id: 'user-1' },
    contextResult: null as any,
    aiResponse: null as any,
    updatedMeso: null as any,
}

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
        from: vi.fn((table: string) => ({
            update: vi.fn((patch: any) => ({
                eq: vi.fn(() => ({
                    eq: vi.fn(async () => {
                        state.updatedMeso = patch
                        return { error: null }
                    }),
                })),
            })),
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(async () => ({ data: { ai_context_json: { archetype: 'hypertrophy', customCounts: null, carryover: { daysPerWeek: 6, sessionMinutes: 75, warmupMinutes: 20, cooldownMinutes: 0, freeText: '' }, mode: 'post-block' } }, error: null })),
                    })),
                })),
            })),
        })),
    })),
}))

vi.mock('@/lib/engine/mesocycle/context', () => ({
    buildAthleteContext: vi.fn(async () => ({
        success: true,
        data: state.contextResult,
    })),
}))

vi.mock('@/lib/ai/client', () => ({
    generateStructuredResponse: vi.fn(async () => state.aiResponse),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { runHeadCoachStrategy } from '@/lib/engine/mesocycle/strategy-generation'

describe('runHeadCoachStrategy', () => {
    beforeEach(() => {
        state.contextResult = {
            profile: { id: 'user-1' },
            coachingTeam: [{ coach: 'strength', priority: 1 }],
            injuries: [], benchmarks: [], recentTraining: [],
            mesocycleId: 'meso-1', mesocycleGoal: 'HYPERTROPHY', weekNumber: 1, totalWeeks: 6,
            isDeload: false, targetRir: 2,
            latestBlockRetrospective: null, pendingPlannerNotes: null,
        }
        state.aiResponse = {
            blockName: 'Hyp Block 2', blockEmphasis: 'test', totalWeeks: 6, deloadWeek: 6,
            domainAllocations: [{ coach: 'hypertrophy', sessionsPerWeek: 3, loadBudgetPerSession: 6, weeklyFatigueBudget: 40, constraints: [], methodologyDirective: 'test' }],
            weeklyEmphasis: [
                { weekNumber: 1, volumePercent: 80, emphasis: 'accumulation', isDeload: false },
                { weekNumber: 2, volumePercent: 90, emphasis: 'accumulation', isDeload: false },
                { weekNumber: 3, volumePercent: 100, emphasis: 'intensification', isDeload: false },
                { weekNumber: 4, volumePercent: 100, emphasis: 'intensification', isDeload: false },
                { weekNumber: 5, volumePercent: 95, emphasis: 'peak', isDeload: false },
                { weekNumber: 6, volumePercent: 60, emphasis: 'deload', isDeload: true },
            ],
            strategyRationale: 'Test rationale based on Block 1 actuals.',
            keyProgressions: ['progression A', 'progression B'],
            interferenceNotes: 'spacing notes',
        }
        state.updatedMeso = null
    })

    it('rejects unauthenticated callers', async () => {
        const sb = await (await import('@/lib/supabase/server')).createClient()
        ;(sb.auth.getUser as any).mockResolvedValueOnce({ data: { user: null }, error: null })
        const r = await runHeadCoachStrategy('meso-1')
        expect(r.success).toBe(false)
    })

    it('persists strategy to mesocycle.ai_context_json', async () => {
        const r = await runHeadCoachStrategy('meso-1')
        expect(r.success).toBe(true)
        expect(state.updatedMeso.ai_context_json.strategy).toBeTruthy()
        expect(state.updatedMeso.ai_context_json.strategy.weeklyEmphasis).toHaveLength(6)
    })

    it('returns the validated strategy', async () => {
        const r = await runHeadCoachStrategy('meso-1')
        expect(r.success && r.data.strategyRationale).toContain('Block 1 actuals')
    })
})
```

- [ ] **Step 3: Run test — must fail**

Run: `npx vitest run src/lib/engine/mesocycle/__tests__/strategy-generation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `runHeadCoachStrategy`**

Create `src/lib/engine/mesocycle/strategy-generation.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateStructuredResponse } from '@/lib/ai/client'
import { MesocycleStrategySchema, type MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'
import { buildMesocycleStrategySystemPrompt, buildMesocycleStrategyUserPrompt } from '@/lib/ai/prompts/head-coach'
import { buildAthleteContext } from '@/lib/engine/mesocycle/context'
import type { ActionResult } from '@/lib/types/training.types'

export async function runHeadCoachStrategy(
    mesocycleId: string,
): Promise<ActionResult<MesocycleStrategyValidated>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    // Read the wizard's input from ai_context_json (written by createBlockShell)
    const { data: mesoRow } = await supabase
        .from('mesocycles')
        .select('ai_context_json')
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
        .single()

    const aiCtx = (mesoRow?.ai_context_json ?? {}) as Record<string, unknown>

    // Build athlete context (now retrospective + pending-notes aware)
    const ctxResult = await buildAthleteContext(user.id, mesocycleId, 1)
    if (!ctxResult.success) return { success: false, error: ctxResult.error }

    // Splice the wizard input onto the context so the prompt sees it
    const ctx = { ...ctxResult.data, aiContextJson: aiCtx } as typeof ctxResult.data & { aiContextJson: Record<string, unknown> }

    const systemPrompt = buildMesocycleStrategySystemPrompt()
    const userPrompt = buildMesocycleStrategyUserPrompt(ctx)

    let strategy: MesocycleStrategyValidated
    try {
        strategy = await generateStructuredResponse({
            systemPrompt,
            userPrompt,
            schema: MesocycleStrategySchema,
            maxTokens: 8192,
            temperature: 0.6,
        })
    } catch (err) {
        return { success: false, error: `Head coach failed: ${err instanceof Error ? err.message : String(err)}` }
    }

    // Persist strategy onto ai_context_json (preserve other fields)
    const { error: updateErr } = await supabase
        .from('mesocycles')
        .update({
            ai_context_json: {
                ...aiCtx,
                strategy,
            },
        })
        .eq('id', mesocycleId)
        .eq('user_id', user.id)

    if (updateErr) return { success: false, error: `Strategy persist failed: ${updateErr.message}` }

    revalidatePath('/data/blocks/new')
    return { success: true, data: strategy }
}
```

- [ ] **Step 5: Run test + tsc + suite**

```bash
npx vitest run src/lib/engine/mesocycle/__tests__/strategy-generation.test.ts && \
npx tsc --noEmit && npm test
```
Expected: PASS, no NEW tsc errors, suite green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/prompts/head-coach.ts \
    src/lib/engine/mesocycle/strategy-generation.ts \
    src/lib/engine/mesocycle/__tests__/strategy-generation.test.ts
git commit -m "feat(engine): runHeadCoachStrategy + extended head-coach prompt

Single AI call at block start. Reads athlete context (now retrospective
+ pending_planner_notes aware) plus the wizard's archetype/customCounts/
carryover from ai_context_json. Generates strategy via head-coach prompt
extended with four new sections: Last Block's Actuals, Athlete's Stated
Reality, Athlete's Availability, Athlete's Requested Emphasis. Persists
strategy back to mesocycle.ai_context_json.strategy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `regenerateBlockPlan` server action

**Files:**
- Create: `src/lib/engine/mesocycle/regenerate.ts`
- Create: `src/lib/engine/mesocycle/__tests__/regenerate.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/engine/mesocycle/__tests__/regenerate.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const state: any = { strategyClearedFor: null, week1InventoryDeleted: false }

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
        from: vi.fn((table: string) => {
            if (table === 'mesocycles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { ai_context_json: { strategy: { foo: 'bar' }, archetype: 'hypertrophy' } }, error: null })) })) })),
                    })),
                    update: vi.fn((patch: any) => ({
                        eq: vi.fn(() => ({ eq: vi.fn(async () => {
                            state.strategyClearedFor = patch.ai_context_json
                            return { error: null }
                        }) })),
                    })),
                }
            }
            if (table === 'microcycles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'micro-1' }, error: null })) })) })) })),
                    })),
                }
            }
            if (table === 'session_inventory') {
                return {
                    delete: vi.fn(() => ({ eq: vi.fn(async () => {
                        state.week1InventoryDeleted = true
                        return { error: null }
                    }) })),
                }
            }
            return {}
        }),
    })),
}))

vi.mock('@/lib/engine/mesocycle/strategy-generation', () => ({
    runHeadCoachStrategy: vi.fn(async () => ({ success: true, data: { strategyRationale: 'rerun' } })),
}))

vi.mock('@/lib/engine/microcycle/generate-pool', () => ({
    generateSessionPool: vi.fn(async () => ({ success: true, data: { workouts: [], sessionPool: {} } })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { regenerateBlockPlan } from '@/lib/engine/mesocycle/regenerate'

describe('regenerateBlockPlan', () => {
    beforeEach(() => {
        state.strategyClearedFor = null
        state.week1InventoryDeleted = false
    })

    it('clears strategy from ai_context_json before rerunning', async () => {
        await regenerateBlockPlan('meso-1')
        expect(state.strategyClearedFor.strategy).toBeNull()
        expect(state.strategyClearedFor.archetype).toBe('hypertrophy')
    })

    it('deletes week 1 session inventory', async () => {
        await regenerateBlockPlan('meso-1')
        expect(state.week1InventoryDeleted).toBe(true)
    })
})
```

- [ ] **Step 2: Run test — must fail**

Run: `npx vitest run src/lib/engine/mesocycle/__tests__/regenerate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/engine/mesocycle/regenerate.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { runHeadCoachStrategy } from '@/lib/engine/mesocycle/strategy-generation'
import { generateSessionPool } from '@/lib/engine/microcycle/generate-pool'
import { MesocycleStrategySchema, type MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'
import type { ActionResult } from '@/lib/types/training.types'

export async function regenerateBlockPlan(
    mesocycleId: string,
): Promise<ActionResult<{ strategy: MesocycleStrategyValidated }>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    // Read existing ai_context_json so we preserve archetype/customCounts/carryover
    const { data: mesoRow, error: mesoErr } = await supabase
        .from('mesocycles')
        .select('ai_context_json')
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
        .single()

    if (mesoErr || !mesoRow) return { success: false, error: mesoErr?.message ?? 'Mesocycle not found' }

    const aiCtx = (mesoRow.ai_context_json ?? {}) as Record<string, unknown>

    // Clear strategy
    const { error: clearErr } = await supabase
        .from('mesocycles')
        .update({ ai_context_json: { ...aiCtx, strategy: null } })
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
    if (clearErr) return { success: false, error: `Strategy clear failed: ${clearErr.message}` }

    // Find week 1 microcycle
    const { data: week1Micro } = await supabase
        .from('microcycles')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', 1)
        .eq('user_id', user.id)
        .single()

    // Delete week 1 inventory if present
    if (week1Micro) {
        await supabase
            .from('session_inventory')
            .delete()
            .eq('microcycle_id', week1Micro.id)
    }

    // Re-run strategy
    const stratResult = await runHeadCoachStrategy(mesocycleId)
    if (!stratResult.success) return { success: false, error: stratResult.error }

    // Re-run week 1 generation
    if (week1Micro) {
        const poolResult = await generateSessionPool(week1Micro.id)
        if (!poolResult.success) return { success: false, error: `Week 1 regen failed: ${poolResult.error}` }
    }

    revalidatePath('/data/blocks/new')
    return { success: true, data: { strategy: stratResult.data } }
}
```

- [ ] **Step 4: Run test + tsc + suite**

```bash
npx vitest run src/lib/engine/mesocycle/__tests__/regenerate.test.ts && \
npx tsc --noEmit && npm test
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/mesocycle/regenerate.ts \
    src/lib/engine/mesocycle/__tests__/regenerate.test.ts
git commit -m "feat(engine): regenerateBlockPlan action

Clears strategy from mesocycle.ai_context_json + deletes week 1
session_inventory, then reruns runHeadCoachStrategy + generateSessionPool.
Used by the wizard's Regenerate button.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `approveBlockPlan` server action

**Files:**
- Create: `src/lib/engine/mesocycle/approve.ts`
- Create: `src/lib/engine/mesocycle/__tests__/approve.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/engine/mesocycle/__tests__/approve.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const state: any = { mesoUpdated: null, pointerInserted: null, notesCleared: false }

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
        from: vi.fn((table: string) => {
            if (table === 'mesocycles') {
                return {
                    update: vi.fn((patch: any) => ({
                        eq: vi.fn(() => ({ eq: vi.fn(async () => { state.mesoUpdated = patch; return { error: null } }) })),
                    })),
                    select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'meso-1' }, error: null })) })) })) })),
                }
            }
            if (table === 'microcycles') {
                return {
                    select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'micro-1' }, error: null })) })) })) })) })),
                }
            }
            if (table === 'block_pointer') {
                return {
                    upsert: vi.fn(async (row: any) => { state.pointerInserted = row; return { error: null } }),
                }
            }
            return {}
        }),
    })),
}))

vi.mock('@/lib/actions/pending-notes.actions', () => ({
    clearPendingPlannerNotes: vi.fn(async () => { state.notesCleared = true; return { success: true } }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { approveBlockPlan } from '@/lib/engine/mesocycle/approve'

describe('approveBlockPlan', () => {
    beforeEach(() => {
        state.mesoUpdated = null
        state.pointerInserted = null
        state.notesCleared = false
    })

    it('flips mesocycle.is_active to true', async () => {
        await approveBlockPlan('meso-1')
        expect(state.mesoUpdated.is_active).toBe(true)
    })

    it('sets block_pointer to (week 1, day 1)', async () => {
        await approveBlockPlan('meso-1')
        expect(state.pointerInserted.user_id).toBe('user-1')
        expect(state.pointerInserted.mesocycle_id).toBe('meso-1')
        expect(state.pointerInserted.week_number).toBe(1)
        expect(state.pointerInserted.next_training_day).toBe(1)
    })

    it('clears pending_planner_notes', async () => {
        await approveBlockPlan('meso-1')
        expect(state.notesCleared).toBe(true)
    })
})
```

- [ ] **Step 2: Run test — must fail**

Run: `npx vitest run src/lib/engine/mesocycle/__tests__/approve.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/engine/mesocycle/approve.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { clearPendingPlannerNotes } from '@/lib/actions/pending-notes.actions'
import type { ActionResult } from '@/lib/types/training.types'

export async function approveBlockPlan(
    mesocycleId: string,
): Promise<ActionResult<void>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    // Flip mesocycle.is_active = true
    const { error: mesoErr } = await supabase
        .from('mesocycles')
        .update({ is_active: true })
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
    if (mesoErr) return { success: false, error: mesoErr.message }

    // Find week 1 microcycle
    const { data: week1Micro, error: microErr } = await supabase
        .from('microcycles')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', 1)
        .eq('user_id', user.id)
        .single()
    if (microErr || !week1Micro) return { success: false, error: 'Week 1 microcycle missing' }

    // Set block_pointer to (week 1, day 1)
    const { error: pointerErr } = await supabase
        .from('block_pointer')
        .upsert({
            user_id: user.id,
            mesocycle_id: mesocycleId,
            week_number: 1,
            next_training_day: 1,
        })
    if (pointerErr) return { success: false, error: `Block pointer failed: ${pointerErr.message}` }

    // Clear pending_planner_notes (consumed)
    await clearPendingPlannerNotes()

    revalidatePath('/dashboard')
    return { success: true, data: undefined }
}
```

- [ ] **Step 4: Run test + tsc + suite**

```bash
npx vitest run src/lib/engine/mesocycle/__tests__/approve.test.ts && \
npx tsc --noEmit && npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/mesocycle/approve.ts \
    src/lib/engine/mesocycle/__tests__/approve.test.ts
git commit -m "feat(engine): approveBlockPlan action

Flips is_active=true, sets block_pointer to (week 1, day 1),
clears pending_planner_notes (carryover consumed). Final wizard
step in the new block-creation flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire `weekBrief` into per-week generation

**Files:**
- Modify: `src/lib/engine/microcycle/generate-pool.ts`

- [ ] **Step 1: Read existing `generateSessionPool`**

Inspect the body. Find where it builds `ProgrammingContext` for `buildProgrammingUserPrompt`. We're going to splice strategy data into that context.

- [ ] **Step 2: Modify `generateSessionPool` to read parent mesocycle's strategy**

Edit `src/lib/engine/microcycle/generate-pool.ts`. Add imports near the top:

```ts
import { extractWeekBrief } from '@/lib/engine/mesocycle/strategy'
import { MesocycleStrategySchema, type MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'
```

Inside `generateSessionPool`, after the existing microcycle + mesocycle loads but before AI prompt construction, add:

```ts
// Read head-coach strategy from mesocycle.ai_context_json (set by D's wizard)
let strategy: MesocycleStrategyValidated | null = null
const aiCtx = (mesocycle?.ai_context_json ?? {}) as Record<string, unknown>
const rawStrategy = aiCtx.strategy
if (rawStrategy) {
    const parsed = MesocycleStrategySchema.safeParse(rawStrategy)
    if (parsed.success) strategy = parsed.data
}

// If strategy is present, extract this week's per-coach briefs and pass into the prompt
const weekBriefs = strategy
    ? coachingTeam
        .map(t => ({ coach: t.coach, brief: extractWeekBrief(strategy!, t.coach, microcycle.week_number) }))
        .filter(x => x.brief !== null)
    : []
```

Then in the prompt construction, splice `weekBriefs` into the user prompt as additional context:

```ts
// In buildProgrammingUserPrompt's input object, add a new section:
const extraContext = weekBriefs.length > 0
    ? `\n\n## Head Coach's brief for this week\n${weekBriefs.map(({ coach, brief }) => `### ${coach}\nSessions this week: ${brief!.sessionsToGenerate}\nLoad budget per session: ${brief!.loadBudget}\nWeek emphasis: ${brief!.weekEmphasis}\nVolume: ${brief!.volumePercent}% of MRV\n${brief!.isDeload ? '(deload week)' : ''}\nMethodology directive: ${brief!.methodologyDirective}\nConstraints: ${brief!.constraints.join('; ') || '(none)'}`).join('\n\n')}`
    : ''
```

Then concatenate `extraContext` onto the existing user prompt string before passing to `generateStructuredResponse`.

If the existing `generateSessionPool` body is structured around `ProgrammingContext` (a typed object), thread `weekBriefs` through that type instead — find the existing pattern in the file and follow it.

If `mesocycle.ai_context_json.strategy` is missing or malformed, `weekBriefs` is `[]` and the prompt falls back to today's behavior. Backward-compatible for Block 1.

- [ ] **Step 3: tsc + suite**

```bash
npx tsc --noEmit && npm test
```
Expected: tsc no NEW errors. All tests still pass (existing tests don't exercise the new branch since they use mocks without strategy).

- [ ] **Step 4: Commit**

```bash
git add src/lib/engine/microcycle/generate-pool.ts
git commit -m "feat(engine): generateSessionPool reads head-coach strategy

Per-week generation now reads mesocycle.ai_context_json.strategy
(set by D's wizard) and passes per-coach weekBrief into the
programming user prompt. Backward-compatible: if no strategy,
falls back to today's per-week independent generation (Block 1).

This is the load-bearing change that lets per-week generation honor
the head coach's cross-domain load budget.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `ARCHETYPE_DEFAULTS` map + types

**Files:**
- Create: `src/lib/wizard/archetypes.ts`

- [ ] **Step 1: Create the module**

Create `src/lib/wizard/archetypes.ts`:

```ts
import type { CoachDomain } from '@/lib/skills/types'

export type Archetype =
    | 'hypertrophy'
    | 'strength'
    | 'endurance_event'
    | 'conditioning'
    | 'hybrid'
    | 'custom'

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
    hypertrophy: 'Hypertrophy',
    strength: 'Strength',
    endurance_event: 'Endurance Event',
    conditioning: 'Conditioning',
    hybrid: 'Hybrid',
    custom: 'Custom',
}

export const ARCHETYPE_DESCRIPTIONS: Record<Archetype, string> = {
    hypertrophy: 'Build muscle. Strength gains carry as accessory load.',
    strength: 'Heavy compounds. New TM each cycle.',
    endurance_event: 'Race-prep periodization toward a date.',
    conditioning: 'AMRAPs, intervals, mixed-modal.',
    hybrid: 'Balanced across all domains.',
    custom: 'Set per-coach session counts directly.',
}

export const ARCHETYPE_DEFAULTS: Record<Exclude<Archetype, 'custom'>, Record<CoachDomain, number>> = {
    hypertrophy:     { hypertrophy: 3, strength: 2, conditioning: 1, endurance: 0, mobility: 2, recovery: 0 },
    strength:        { hypertrophy: 1, strength: 4, conditioning: 1, endurance: 0, mobility: 2, recovery: 0 },
    endurance_event: { hypertrophy: 0, strength: 2, conditioning: 1, endurance: 4, mobility: 2, recovery: 0 },
    conditioning:    { hypertrophy: 1, strength: 2, conditioning: 4, endurance: 1, mobility: 2, recovery: 0 },
    hybrid:          { hypertrophy: 2, strength: 2, conditioning: 2, endurance: 1, mobility: 2, recovery: 0 },
}

export function defaultsFor(archetype: Archetype, customCounts?: Record<CoachDomain, number>): Record<CoachDomain, number> {
    if (archetype === 'custom') return customCounts ?? { hypertrophy: 0, strength: 0, conditioning: 0, endurance: 0, mobility: 0, recovery: 0 }
    return ARCHETYPE_DEFAULTS[archetype]
}
```

The `recovery: 0` entry is needed if `CoachDomain` includes recovery. If it doesn't, remove the field. Verify with: `grep "type CoachDomain" src/lib/skills/types.ts`.

- [ ] **Step 2: tsc**

```bash
npx tsc --noEmit
```
Expected: no NEW errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wizard/archetypes.ts
git commit -m "feat(wizard): archetype defaults + types

ARCHETYPE_DEFAULTS maps each non-custom archetype to a per-coach
session-count distribution. Used by the wizard to prepopulate
defaults and by the head-coach prompt to render the athlete's
requested emphasis section.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Step 1 leaf components

**Files:**
- Create: `src/components/wizard/RetrospectiveSummaryTile.tsx`
- Create: `src/components/wizard/CarryoverSummary.tsx`
- Create: `src/components/wizard/AvailabilityForm.tsx`
- Create: `src/components/wizard/ArchetypePicker.tsx`
- Create: `src/components/wizard/SessionCountSteppers.tsx`
- Create: `src/components/wizard/DurationSelector.tsx`

Each is a small client component with focused responsibility. Implement per the spec (Section 3 — Step 1 sections). All use 2-space indent (match existing components in `src/components/dashboard/`).

- [ ] **Step 1: `RetrospectiveSummaryTile.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'

export function RetrospectiveSummaryTile({ retrospective }: { retrospective: BlockRetrospectiveSnapshot }) {
  const { adherence, recalibrations } = retrospective
  return (
    <section className="border-b border-neutral-800 px-6 py-5">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-2">From Block {/* TODO: read block number from retrospective if available, else fall back to label only */}</div>
      <div className="text-[12px] font-inter text-neutral-300">
        {adherence.overall.completed}/{adherence.overall.prescribed} sessions · {adherence.overall.pct}% adherence · {recalibrations.length} recalibrations
      </div>
      <div className="text-[11px] font-inter text-neutral-500 mt-1">
        {adherence.byCoachDomain.map(d => `${d.coachDomain} ${d.pct}%`).join(' · ')}
      </div>
      <Link href={`/data/blocks/${retrospective.block.id}/retrospective`} className="inline-flex items-center gap-1 mt-2 text-[11px] font-mono text-amber-500 hover:text-amber-400 uppercase tracking-wider">
        Review <ArrowRight className="w-3 h-3" />
      </Link>
    </section>
  )
}
```

(Replace the TODO comment with `retrospective.block.name` directly — the block name is already in the snapshot.)

- [ ] **Step 2: `CarryoverSummary.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { PendingPlannerNotes } from '@/lib/types/pending-planner-notes.types'
import { RealityCheckForm } from '@/components/reality-check/RealityCheckForm'

export interface CarryoverSummaryProps {
  notes: PendingPlannerNotes
  onChange: (next: PendingPlannerNotes) => void
}

export function CarryoverSummary({ notes, onChange }: CarryoverSummaryProps) {
  const [editing, setEditing] = useState(false)
  return (
    <section className="border-b border-neutral-800 px-6 py-5">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">Your reality (from reality-check)</div>
      <div className="grid grid-cols-2 gap-2 text-[11px] font-inter">
        <div className="flex justify-between"><span className="text-neutral-500">Days/week</span><span className="text-neutral-200">{notes.daysPerWeek}</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">Session</span><span className="text-neutral-200">{notes.sessionMinutes} min</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">Warm-up</span><span className="text-neutral-200">{notes.warmupMinutes} min</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">Cool-down</span><span className="text-neutral-200">{notes.cooldownMinutes} min</span></div>
      </div>
      {notes.freeText && <div className="text-[11px] font-inter text-neutral-400 mt-2 italic">"{notes.freeText}"</div>}
      <button type="button" onClick={() => setEditing(true)} className="text-[10px] font-mono text-amber-500 hover:text-amber-400 uppercase tracking-wider mt-3">
        Edit →
      </button>
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div className="bg-neutral-950 border border-neutral-800 max-w-md w-full p-6">
            <RealityCheckForm
              initialValues={notes}
              onSubmit={(updated) => { onChange(updated); setEditing(false) }}
              onCancel={() => setEditing(false)}
            />
          </div>
        </div>
      )}
    </section>
  )
}
```

(Adapt to actual `RealityCheckForm` props — verify by reading `src/components/reality-check/RealityCheckForm.tsx`. If the component doesn't expose `initialValues`/`onCancel` props yet, extend it to accept them. The form is reusable; the wizard is the second consumer.)

- [ ] **Step 3: `AvailabilityForm.tsx`**

For first-block mode. Same fields as `CarryoverSummary` but always-editable (not behind a modal). Implement as a minimal form component that takes `value: PendingPlannerNotes`-shape and `onChange: (next) => void`. Default values: `{ daysPerWeek: 5, sessionMinutes: 60, warmupMinutes: 10, cooldownMinutes: 0, freeText: '' }`.

```tsx
'use client'

import type { PendingPlannerNotes } from '@/lib/types/pending-planner-notes.types'

export interface AvailabilityFormProps {
  value: Pick<PendingPlannerNotes, 'daysPerWeek' | 'sessionMinutes' | 'warmupMinutes' | 'cooldownMinutes' | 'freeText'>
  onChange: (next: AvailabilityFormProps['value']) => void
}

export function AvailabilityForm({ value, onChange }: AvailabilityFormProps) {
  return (
    <section className="border-b border-neutral-800 px-6 py-5 space-y-3">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Your availability</div>
      <div className="grid grid-cols-2 gap-3 text-[12px] font-inter">
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Days/week</span>
          <input type="number" min={1} max={7} value={value.daysPerWeek} onChange={e => onChange({ ...value, daysPerWeek: Number(e.target.value) })} className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Session min</span>
          <input type="number" min={20} max={180} value={value.sessionMinutes} onChange={e => onChange({ ...value, sessionMinutes: Number(e.target.value) })} className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Warm-up min</span>
          <input type="number" min={0} max={60} value={value.warmupMinutes} onChange={e => onChange({ ...value, warmupMinutes: Number(e.target.value) })} className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Cool-down min</span>
          <input type="number" min={0} max={60} value={value.cooldownMinutes} onChange={e => onChange({ ...value, cooldownMinutes: Number(e.target.value) })} className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-neutral-500 text-[10px] font-mono uppercase">Notes (optional)</span>
        <textarea value={value.freeText} onChange={e => onChange({ ...value, freeText: e.target.value })} className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200 text-[12px] resize-none" rows={2} />
      </label>
    </section>
  )
}
```

- [ ] **Step 4: `ArchetypePicker.tsx`**

3×2 grid of archetype cards. Highlight selected one with amber border.

```tsx
'use client'

import { ARCHETYPE_LABELS, ARCHETYPE_DESCRIPTIONS, type Archetype } from '@/lib/wizard/archetypes'

const ORDER: Archetype[] = ['hypertrophy', 'strength', 'endurance_event', 'conditioning', 'hybrid', 'custom']

export interface ArchetypePickerProps {
  value: Archetype
  onChange: (next: Archetype) => void
}

export function ArchetypePicker({ value, onChange }: ArchetypePickerProps) {
  return (
    <section className="border-b border-neutral-800 px-6 py-5">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">Block goal</div>
      <div className="grid grid-cols-3 gap-2">
        {ORDER.map(a => {
          const selected = a === value
          return (
            <button
              key={a}
              type="button"
              onClick={() => onChange(a)}
              className={`px-3 py-3 border text-left ${selected ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-800 hover:border-neutral-700'}`}
            >
              <div className={`text-[11px] font-mono uppercase tracking-wider ${selected ? 'text-amber-500' : 'text-neutral-300'}`}>{ARCHETYPE_LABELS[a]}</div>
              <div className="text-[10px] font-inter text-neutral-500 mt-1 line-clamp-2">{ARCHETYPE_DESCRIPTIONS[a]}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: `SessionCountSteppers.tsx`**

Visible only when archetype = custom. Per-coach +/- steppers with running total + budget tracking.

```tsx
'use client'

import { Minus, Plus } from 'lucide-react'
import type { CoachDomain } from '@/lib/skills/types'

const COACHES: CoachDomain[] = ['hypertrophy', 'strength', 'conditioning', 'endurance', 'mobility']

export interface SessionCountSteppersProps {
  value: Record<CoachDomain, number>
  daysPerWeekBudget: number
  onChange: (next: Record<CoachDomain, number>) => void
}

export function SessionCountSteppers({ value, daysPerWeekBudget, onChange }: SessionCountSteppersProps) {
  const total = COACHES.reduce((sum, c) => sum + (value[c] ?? 0), 0)
  const overBudget = total > daysPerWeekBudget * 2 // allow up to 2x days for two-a-days

  return (
    <section className="border-b border-neutral-800 px-6 py-5 space-y-2">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-2">Custom session counts</div>
      {COACHES.map(c => {
        const n = value[c] ?? 0
        return (
          <div key={c} className="flex justify-between items-center py-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-300">{c}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onChange({ ...value, [c]: Math.max(0, n - 1) })} className="w-6 h-6 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-neutral-400">
                <Minus className="w-3 h-3" />
              </button>
              <span className={`min-w-[24px] text-center text-[12px] font-mono ${n > 0 ? 'text-amber-500' : 'text-neutral-500'}`}>{n}</span>
              <button type="button" onClick={() => onChange({ ...value, [c]: n + 1 })} className="w-6 h-6 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-neutral-400">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        )
      })}
      <div className={`flex justify-between text-[11px] font-mono pt-3 mt-3 border-t border-neutral-800 ${overBudget ? 'text-red-500' : 'text-neutral-400'}`}>
        <span>TOTAL / WEEK</span>
        <span>{total} sessions {overBudget && '(exceeds 2× days budget)'}</span>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: `DurationSelector.tsx`**

Three-button row.

```tsx
'use client'

const OPTIONS: Array<4 | 6 | 8> = [4, 6, 8]

export interface DurationSelectorProps {
  value: 4 | 6 | 8
  onChange: (next: 4 | 6 | 8) => void
}

export function DurationSelector({ value, onChange }: DurationSelectorProps) {
  return (
    <section className="border-b border-neutral-800 px-6 py-5">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">Duration</div>
      <div className="flex gap-2">
        {OPTIONS.map(n => {
          const selected = n === value
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`px-4 py-2 border text-[11px] font-mono uppercase tracking-wider ${selected ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-neutral-800 text-neutral-300 hover:border-neutral-700'}`}
            >
              {n} weeks
            </button>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 7: tsc**

```bash
npx tsc --noEmit
```
Expected: no NEW errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/wizard/
git commit -m "feat(wizard): step 1 leaf components

Six focused client components for step 1 of the block-creation
wizard: RetrospectiveSummaryTile (post-block), CarryoverSummary
(post-block, with edit modal embedding RealityCheckForm),
AvailabilityForm (first-block), ArchetypePicker, SessionCountSteppers
(custom mode), DurationSelector. Each handles one decision; wizard
composition lands in the next task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Step 2 leaf components

**Files:**
- Create: `src/components/wizard/GenerationProgress.tsx`
- Create: `src/components/wizard/StrategySummaryTile.tsx`
- Create: `src/components/wizard/WeekSessionPoolPreview.tsx`

- [ ] **Step 1: `GenerationProgress.tsx`**

```tsx
'use client'

export interface GenerationProgressProps {
  stage: 'strategy' | 'week1'
  onCancel?: () => void
}

const LABEL: Record<GenerationProgressProps['stage'], string> = {
  strategy: 'Head coach strategy…',
  week1: 'Generating week 1 sessions…',
}

const PROGRESS: Record<GenerationProgressProps['stage'], number> = {
  strategy: 30,
  week1: 75,
}

export function GenerationProgress({ stage, onCancel }: GenerationProgressProps) {
  return (
    <div className="px-6 py-12 text-center space-y-4">
      <div className="text-[14px] font-space-grotesk text-neutral-200">Generating Block…</div>
      <div className="max-w-sm mx-auto h-1 bg-neutral-900 rounded-full overflow-hidden">
        <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${PROGRESS[stage]}%` }} />
      </div>
      <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">{LABEL[stage]}</div>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 uppercase tracking-wider mt-4">
          Cancel and edit plan
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `StrategySummaryTile.tsx`**

Renders per-coach session bars + weekly arc table + head-coach narrative.

```tsx
'use client'

import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'

export interface StrategySummaryTileProps {
  strategy: MesocycleStrategyValidated
}

export function StrategySummaryTile({ strategy }: StrategySummaryTileProps) {
  const maxSessions = Math.max(...strategy.domainAllocations.map(d => d.sessionsPerWeek), 1)
  return (
    <section className="border-b border-neutral-800 px-6 py-6 space-y-5">
      <div>
        <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">Head coach strategy</div>
        <div className="text-[12px] font-inter text-neutral-400 mb-1">Per week:</div>
        <div className="space-y-1.5">
          {strategy.domainAllocations.map(d => (
            <div key={d.coach} className="flex items-center gap-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-300 w-28">{d.coach}</span>
              <div className="flex-1 h-3 bg-neutral-900 relative">
                <div className="absolute left-0 top-0 h-full bg-amber-500/60" style={{ width: `${(d.sessionsPerWeek / maxSessions) * 100}%` }} />
              </div>
              <span className="text-[11px] font-mono text-neutral-300 w-16 text-right">{d.sessionsPerWeek}/wk</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[12px] font-inter text-neutral-400 mb-2">Weekly arc:</div>
        <div className="space-y-1 text-[11px] font-mono">
          {strategy.weeklyEmphasis.map(w => (
            <div key={w.weekNumber} className="flex justify-between border-b border-neutral-900 py-1">
              <span className="text-neutral-500">Wk {w.weekNumber}</span>
              <span className="text-neutral-300 flex-1 ml-3">{w.emphasis}</span>
              <span className="text-neutral-500">{w.volumePercent}% vol{w.isDeload ? ' (deload)' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      <blockquote className="border-l-2 border-amber-500/50 pl-4 text-[12px] font-inter text-neutral-300 italic">
        {strategy.strategyRationale}
        <div className="text-[10px] font-mono text-neutral-500 mt-2 not-italic">— Head Coach</div>
      </blockquote>
    </section>
  )
}
```

- [ ] **Step 3: `WeekSessionPoolPreview.tsx`**

Renders the week 1 session pool as a list.

```tsx
'use client'

import type { Workout } from '@/lib/types/database.types'

export interface WeekSessionPoolPreviewProps {
  weekNumber: number
  emphasis: string
  workouts: Workout[]
}

export function WeekSessionPoolPreview({ weekNumber, emphasis, workouts }: WeekSessionPoolPreviewProps) {
  return (
    <section className="border-b border-neutral-800 px-6 py-6">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">Week {weekNumber} — {emphasis}</div>
      <div className="text-[11px] font-inter text-neutral-400 mb-3">{workouts.length} sessions</div>
      <div className="space-y-1">
        {workouts.map(w => (
          <div key={w.id} className="flex justify-between text-[11px] font-inter py-1.5 border-b border-neutral-900">
            <span className="text-neutral-200">{w.name}</span>
            <span className="text-neutral-500 font-mono">{w.duration_minutes ?? '—'} min · {w.modality}</span>
          </div>
        ))}
      </div>
      <div className="text-[10px] font-mono text-neutral-600 italic mt-4">
        Weeks 2-N will generate as you progress. Week N+1 reads the strategy + your recovery from week N.
      </div>
    </section>
  )
}
```

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
git add src/components/wizard/GenerationProgress.tsx \
    src/components/wizard/StrategySummaryTile.tsx \
    src/components/wizard/WeekSessionPoolPreview.tsx
git commit -m "feat(wizard): step 2 leaf components

GenerationProgress (loading state with stage label),
StrategySummaryTile (per-coach session bars + weekly arc + head
coach narrative quote), WeekSessionPoolPreview (week 1 session
list).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `BlockCreationWizard` composition

**Files:**
- Create: `src/components/wizard/BlockCreationWizard.tsx`
- Create: `src/components/wizard/__tests__/BlockCreationWizard.test.tsx`

- [ ] **Step 1: Implement the wizard**

Create `src/components/wizard/BlockCreationWizard.tsx`. This composes the 9 leaf components from Tasks 8-9 plus state machine + server-action calls.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'
import type { PendingPlannerNotes } from '@/lib/types/pending-planner-notes.types'
import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'
import type { Workout } from '@/lib/types/database.types'
import type { CoachDomain } from '@/lib/skills/types'
import { type Archetype, defaultsFor, ARCHETYPE_LABELS } from '@/lib/wizard/archetypes'
import { createBlockShell } from '@/lib/engine/mesocycle/create-shell'
import { runHeadCoachStrategy } from '@/lib/engine/mesocycle/strategy-generation'
import { generateSessionPool } from '@/lib/engine/microcycle/generate-pool'
import { regenerateBlockPlan } from '@/lib/engine/mesocycle/regenerate'
import { approveBlockPlan } from '@/lib/engine/mesocycle/approve'

import { RetrospectiveSummaryTile } from './RetrospectiveSummaryTile'
import { CarryoverSummary } from './CarryoverSummary'
import { AvailabilityForm } from './AvailabilityForm'
import { ArchetypePicker } from './ArchetypePicker'
import { SessionCountSteppers } from './SessionCountSteppers'
import { DurationSelector } from './DurationSelector'
import { GenerationProgress } from './GenerationProgress'
import { StrategySummaryTile } from './StrategySummaryTile'
import { WeekSessionPoolPreview } from './WeekSessionPoolPreview'

export interface BlockCreationWizardProps {
  retrospective: BlockRetrospectiveSnapshot | null
  pendingNotes: PendingPlannerNotes | null
}

type WizardStep = 'review' | 'generating' | 'preview'
type GenStage = 'strategy' | 'week1'

interface CarryoverState {
  daysPerWeek: number
  sessionMinutes: number
  warmupMinutes: number
  cooldownMinutes: number
  freeText: string
}

const FIRST_BLOCK_DEFAULTS: CarryoverState = {
  daysPerWeek: 5, sessionMinutes: 60, warmupMinutes: 10, cooldownMinutes: 0, freeText: '',
}

export function BlockCreationWizard({ retrospective, pendingNotes }: BlockCreationWizardProps) {
  const router = useRouter()
  const mode: 'first-block' | 'post-block' = retrospective ? 'post-block' : 'first-block'

  // Core wizard state
  const [step, setStep] = useState<WizardStep>('review')
  const [genStage, setGenStage] = useState<GenStage>('strategy')
  const [error, setError] = useState<string | null>(null)
  const [mesocycleId, setMesocycleId] = useState<string | null>(null)
  const [strategy, setStrategy] = useState<MesocycleStrategyValidated | null>(null)
  const [week1Workouts, setWeek1Workouts] = useState<Workout[]>([])

  // Form state
  const [archetype, setArchetype] = useState<Archetype>('hypertrophy')
  const [customCounts, setCustomCounts] = useState<Record<CoachDomain, number>>({
    hypertrophy: 2, strength: 2, conditioning: 1, endurance: 0, mobility: 2, recovery: 0,
  } as Record<CoachDomain, number>)
  const [durationWeeks, setDurationWeeks] = useState<4 | 6 | 8>(6)
  const [carryover, setCarryover] = useState<CarryoverState>(
    pendingNotes
      ? {
          daysPerWeek: pendingNotes.daysPerWeek,
          sessionMinutes: pendingNotes.sessionMinutes,
          warmupMinutes: pendingNotes.warmupMinutes,
          cooldownMinutes: pendingNotes.cooldownMinutes,
          freeText: pendingNotes.freeText,
        }
      : FIRST_BLOCK_DEFAULTS,
  )

  async function handleGenerate() {
    setError(null)
    setStep('generating')
    setGenStage('strategy')

    // 1) createBlockShell (only if not yet created — idempotent for resume)
    let mid = mesocycleId
    if (!mid) {
      const shellResult = await createBlockShell({
        mode,
        archetype,
        customCounts: archetype === 'custom' ? customCounts : undefined,
        durationWeeks,
        carryover,
      })
      if (!shellResult.success) { setError(shellResult.error); setStep('review'); return }
      mid = shellResult.data.mesocycleId
      setMesocycleId(mid)
    }

    // 2) runHeadCoachStrategy
    const stratResult = await runHeadCoachStrategy(mid)
    if (!stratResult.success) { setError(stratResult.error); setStep('review'); return }
    setStrategy(stratResult.data)

    // 3) generate week 1 pool — find week 1 microcycle id via the strategy result + mid
    setGenStage('week1')
    const week1Pool = await fetchWeek1AndGenerate(mid)
    if (!week1Pool.success) { setError(week1Pool.error); setStep('review'); return }
    setWeek1Workouts(week1Pool.data.workouts)

    setStep('preview')
  }

  async function handleRegenerate() {
    if (!mesocycleId) return
    setError(null)
    setStep('generating')
    setGenStage('strategy')
    const r = await regenerateBlockPlan(mesocycleId)
    if (!r.success) { setError(r.error); setStep('preview'); return }
    setStrategy(r.data.strategy)
    // Refetch week 1 inventory after regen
    setGenStage('week1')
    const w1 = await fetchWeek1AndGenerate(mesocycleId)
    if (w1.success) setWeek1Workouts(w1.data.workouts)
    setStep('preview')
  }

  async function handleApprove() {
    if (!mesocycleId) return
    setError(null)
    const r = await approveBlockPlan(mesocycleId)
    if (!r.success) { setError(r.error); return }
    router.push('/dashboard')
  }

  function handleEditPlan() {
    setStep('review')
    setStrategy(null)
    setWeek1Workouts([])
    // Strategy + week 1 inventory remain in DB; will be cleared on next handleGenerate via createBlockShell idempotent path or regenerate
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  if (step === 'generating') {
    return <GenerationProgress stage={genStage} onCancel={handleEditPlan} />
  }

  if (step === 'preview' && strategy) {
    return (
      <div className="max-w-2xl mx-auto">
        <header className="px-6 py-5 border-b border-neutral-800 flex justify-between items-center">
          <div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Block plan</div>
            <h1 className="text-[18px] font-space-grotesk font-bold text-white">{strategy.blockName}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleEditPlan} className="px-3 py-2 border border-neutral-800 hover:border-neutral-700 text-[11px] font-mono text-neutral-300 uppercase tracking-wider">← Edit plan</button>
            <button onClick={handleRegenerate} className="px-3 py-2 border border-neutral-800 hover:border-neutral-700 text-[11px] font-mono text-neutral-300 uppercase tracking-wider">Regenerate</button>
            <button onClick={handleApprove} className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-mono font-bold uppercase tracking-wider">Approve & start</button>
          </div>
        </header>

        <StrategySummaryTile strategy={strategy} />

        {week1Workouts.length > 0 && (
          <WeekSessionPoolPreview
            weekNumber={1}
            emphasis={strategy.weeklyEmphasis[0]?.emphasis ?? ''}
            workouts={week1Workouts}
          />
        )}

        {error && <div className="text-red-500 text-[12px] px-6 py-3">{error}</div>}
      </div>
    )
  }

  // step === 'review'
  return (
    <div className="max-w-2xl mx-auto">
      <header className="px-6 py-6 border-b border-neutral-800">
        <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">{mode === 'first-block' ? 'Set up your first block' : 'Plan next block'}</div>
        <h1 className="text-[20px] font-space-grotesk font-bold text-white mt-1">{ARCHETYPE_LABELS[archetype]} · {durationWeeks} weeks</h1>
      </header>

      {mode === 'post-block' && retrospective && <RetrospectiveSummaryTile retrospective={retrospective} />}
      {mode === 'post-block' && pendingNotes && (
        <CarryoverSummary
          notes={{ ...pendingNotes, ...carryover, schemaVersion: pendingNotes.schemaVersion, updatedAt: pendingNotes.updatedAt } as PendingPlannerNotes}
          onChange={(updated) => setCarryover({
            daysPerWeek: updated.daysPerWeek,
            sessionMinutes: updated.sessionMinutes,
            warmupMinutes: updated.warmupMinutes,
            cooldownMinutes: updated.cooldownMinutes,
            freeText: updated.freeText,
          })}
        />
      )}
      {mode === 'first-block' && <AvailabilityForm value={carryover} onChange={setCarryover} />}

      <ArchetypePicker value={archetype} onChange={setArchetype} />
      {archetype === 'custom' && (
        <SessionCountSteppers value={customCounts} daysPerWeekBudget={carryover.daysPerWeek} onChange={setCustomCounts} />
      )}
      <DurationSelector value={durationWeeks} onChange={setDurationWeeks} />

      {error && <div className="text-red-500 text-[12px] px-6 py-3">{error}</div>}

      <div className="px-6 py-6">
        <button onClick={handleGenerate} className="w-full bg-amber-500 hover:bg-amber-400 text-black py-3 text-[12px] font-mono font-bold uppercase tracking-wider">
          Generate plan →
        </button>
      </div>
    </div>
  )
}

// Helper: server-action wrapper for week 1 generation
async function fetchWeek1AndGenerate(mesocycleId: string) {
  // Find week 1 microcycle id via a thin query helper; or use a server action that wraps it.
  // For this plan: assume the wizard calls a small new RPC `findWeek1MicrocycleId(mesocycleId)`
  // OR generateSessionPool internally finds it. The simplest is to expose a server action that
  // takes (mesocycleId, weekNumber) and resolves the microcycle then calls generateSessionPool.
  //
  // Workaround for now: import a tiny server action helper. If not available, add one in this task.
  const { findWeek1MicrocycleId } = await import('@/lib/engine/mesocycle/find-microcycle')
  const idResult = await findWeek1MicrocycleId(mesocycleId)
  if (!idResult.success) return idResult
  return await generateSessionPool(idResult.data.microcycleId)
}
```

The component needs a thin `findWeek1MicrocycleId(mesocycleId)` server action — create it as part of this task in `src/lib/engine/mesocycle/find-microcycle.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types/training.types'

export async function findWeek1MicrocycleId(
  mesocycleId: string,
): Promise<ActionResult<{ microcycleId: string }>> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { success: false, error: 'Not authenticated' }
  const { data, error } = await supabase
    .from('microcycles')
    .select('id')
    .eq('mesocycle_id', mesocycleId)
    .eq('week_number', 1)
    .eq('user_id', user.id)
    .single()
  if (error || !data) return { success: false, error: 'Week 1 microcycle not found' }
  return { success: true, data: { microcycleId: data.id } }
}
```

- [ ] **Step 2: Component test**

Create `src/components/wizard/__tests__/BlockCreationWizard.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockCreationWizard } from '../BlockCreationWizard'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/engine/mesocycle/create-shell', () => ({ createBlockShell: vi.fn(async () => ({ success: true, data: { mesocycleId: 'm1' } })) }))
vi.mock('@/lib/engine/mesocycle/strategy-generation', () => ({ runHeadCoachStrategy: vi.fn(async () => ({ success: true, data: { blockName: 'Test', blockEmphasis: '', totalWeeks: 6, deloadWeek: 6, domainAllocations: [], weeklyEmphasis: [], strategyRationale: 'r', keyProgressions: [], interferenceNotes: '' } })) }))
vi.mock('@/lib/engine/microcycle/generate-pool', () => ({ generateSessionPool: vi.fn(async () => ({ success: true, data: { workouts: [], sessionPool: {} } })) }))
vi.mock('@/lib/engine/mesocycle/regenerate', () => ({ regenerateBlockPlan: vi.fn() }))
vi.mock('@/lib/engine/mesocycle/approve', () => ({ approveBlockPlan: vi.fn() }))
vi.mock('@/lib/engine/mesocycle/find-microcycle', () => ({ findWeek1MicrocycleId: vi.fn(async () => ({ success: true, data: { microcycleId: 'mc1' } })) }))

describe('BlockCreationWizard', () => {
  it('renders post-block mode when retrospective is provided', () => {
    render(<BlockCreationWizard retrospective={makeRetro()} pendingNotes={makeNotes()} />)
    expect(screen.getByText(/Plan next block/)).toBeTruthy()
    expect(screen.getByText(/Your reality/i)).toBeTruthy()
  })

  it('renders first-block mode when retrospective is null', () => {
    render(<BlockCreationWizard retrospective={null} pendingNotes={null} />)
    expect(screen.getByText(/Set up your first block/)).toBeTruthy()
    expect(screen.getByText(/Your availability/i)).toBeTruthy()
  })

  it('shows custom session-count steppers when custom archetype selected', () => {
    render(<BlockCreationWizard retrospective={null} pendingNotes={null} />)
    fireEvent.click(screen.getByText(/Custom/i))
    expect(screen.getByText(/Custom session counts/i)).toBeTruthy()
  })

  it('clicking Generate triggers createBlockShell + runHeadCoachStrategy', async () => {
    const { createBlockShell } = await import('@/lib/engine/mesocycle/create-shell')
    render(<BlockCreationWizard retrospective={null} pendingNotes={null} />)
    fireEvent.click(screen.getByText(/Generate plan/i))
    // wait microtask
    await new Promise(r => setTimeout(r, 0))
    expect(createBlockShell).toHaveBeenCalled()
  })
})

function makeRetro() {
  return {
    schemaVersion: '1.0',
    block: { id: 'b1', name: 'Block 1', mesocycleId: 'meso-1' },
    adherence: { overall: { completed: 21, prescribed: 51, pct: 41 }, byCoachDomain: [], byWeek: [] },
    executionQuality: [], recalibrations: [], interventions: [], missedSessions: [],
    generatedAt: new Date().toISOString(),
  } as any
}

function makeNotes() {
  return {
    schemaVersion: '1.0',
    daysPerWeek: 6, sessionMinutes: 75, warmupMinutes: 20, cooldownMinutes: 0, freeText: 'note',
    updatedAt: new Date().toISOString(),
  } as any
}
```

(Adapt to existing `BlockRetrospectiveSnapshot` and `PendingPlannerNotes` shapes — verify by reading the type files.)

- [ ] **Step 3: Run tests + tsc**

```bash
npx vitest run src/components/wizard/__tests__/BlockCreationWizard.test.tsx && npx tsc --noEmit
```

If `@testing-library/react` isn't installed, install it: `npm install -D @testing-library/react @testing-library/dom`. Note this in the commit body.

- [ ] **Step 4: Commit**

```bash
git add src/components/wizard/BlockCreationWizard.tsx \
    src/components/wizard/__tests__/BlockCreationWizard.test.tsx \
    src/lib/engine/mesocycle/find-microcycle.ts
git commit -m "feat(wizard): BlockCreationWizard composition

Top-level wizard client component. Composes the 9 leaf components
into a 2-step state machine (review → generating → preview).
Handles createBlockShell → runHeadCoachStrategy → generateSessionPool
sequence on Generate. Regenerate and Approve wired. Mode auto-detected
from retrospective presence.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Server route `/data/blocks/new`

**Files:**
- Create: `src/app/data/blocks/new/page.tsx`

- [ ] **Step 1: Create the route**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLatestBlockRetrospective } from '@/lib/actions/block-retrospective.actions'
import { getPendingPlannerNotes } from '@/lib/actions/pending-notes.actions'
import { BlockCreationWizard } from '@/components/wizard/BlockCreationWizard'

export const dynamic = 'force-dynamic'

export default async function NewBlockPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [retroResult, notesResult] = await Promise.all([
    getLatestBlockRetrospective(),
    getPendingPlannerNotes(),
  ])

  const retrospective = retroResult.success ? retroResult.data : null
  const pendingNotes = notesResult.success ? notesResult.data : null

  return (
    <div className="min-h-screen bg-neutral-950 py-10">
      <BlockCreationWizard retrospective={retrospective} pendingNotes={pendingNotes} />
    </div>
  )
}
```

- [ ] **Step 2: tsc + suite + commit**

```bash
npx tsc --noEmit && npm test
git add src/app/data/blocks/new/page.tsx
git commit -m "feat(wizard): /data/blocks/new server route

Loads retrospective + pending_planner_notes server-side and hands
them to the BlockCreationWizard component.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Dashboard CTA + post-close redirect + onboarding refactor

**Files:**
- Modify: `src/components/dashboard/DashboardNoActiveBlockEmpty.tsx`
- Modify: `src/app/data/blocks/[mesocycleId]/reality-check/page.tsx`
- Modify: `src/lib/actions/onboarding.actions.ts`
- Modify: `src/app/onboarding/page.tsx`

- [ ] **Step 1: Dashboard CTA**

Edit `src/components/dashboard/DashboardNoActiveBlockEmpty.tsx`. Replace the `<p>` with `Block 2 wizard ships next` with a Link button:

```tsx
<Link
  href="/data/blocks/new"
  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[12px] font-mono font-bold uppercase tracking-wider"
>
  Start next block
  <ArrowRight className="w-3 h-3" />
</Link>
```

- [ ] **Step 2: Post-close reality-check redirect**

Edit `src/app/data/blocks/[mesocycleId]/reality-check/page.tsx`. Find the form's submit handler / redirect logic (it currently goes to `/dashboard`). Change the destination to `/data/blocks/new`.

- [ ] **Step 3: Strip block-creation logic from `completeOnboarding`**

Edit `src/lib/actions/onboarding.actions.ts`. Find `completeOnboarding`. Delete steps 2-5 (mesocycle insert, microcycle scaffold, generateMesocycleInventory call, redirect path).

After editing, `completeOnboarding` is just:

```ts
export async function completeOnboarding(
    benchmarkPath: string = 'ai_estimated'
): Promise<ActionResult<{ ok: true }>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('goal_archetype, primary_goal')
        .eq('id', user.id)
        .maybeSingle()

    if (profileError || !profile) return { success: false, error: 'Could not fetch profile.' }

    const goalMap: Record<string, string> = {
        hybrid_fitness: 'HYBRID_PEAKING',
        strength_focus: 'STRENGTH',
        endurance_focus: 'ENDURANCE',
        conditioning_focus: 'HYBRID_PEAKING',
        longevity: 'HYBRID_PEAKING',
    }
    const mesocycleGoal = goalMap[profile.goal_archetype ?? ''] ?? profile.primary_goal ?? 'HYBRID_PEAKING'

    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            onboarding_completed_at: new Date().toISOString(),
            benchmark_discovery_status: benchmarkPath === 'discovery' ? 'pending' : 'complete',
            benchmark_week_complete: true,
            primary_goal: mesocycleGoal,
        })
        .eq('id', user.id)

    if (updateError) return { success: false, error: updateError.message }

    revalidatePath('/onboarding')
    revalidatePath('/dashboard')
    return { success: true, data: { ok: true } }
}
```

Remove the now-unused import of `generateMesocycleInventory` from this file. Verify with `grep "generateMesocycleInventory" src/lib/actions/onboarding.actions.ts` → zero hits.

- [ ] **Step 4: Onboarding page redirect**

Edit `src/app/onboarding/page.tsx`. Find the call to `completeOnboarding` and the subsequent `router.push('/dashboard')`. Change to `router.push('/data/blocks/new')`.

- [ ] **Step 5: Run all tests + tsc + build**

```bash
npx tsc --noEmit && npm test
```
Expected: tsc no NEW errors. Existing onboarding tests need updating if they assert the old `completeOnboarding` behavior. Update them to match the new lighter contract — they now expect just profile updates, no mesocycle insertion side effect.

Specifically: search for tests that mock `generateMesocycleInventory` in onboarding tests and remove those assertions. Search: `grep -rn "completeOnboarding\|generateMesocycleInventory" src/lib/actions/__tests__/`

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/DashboardNoActiveBlockEmpty.tsx \
    src/app/data/blocks/[mesocycleId]/reality-check/page.tsx \
    src/lib/actions/onboarding.actions.ts \
    src/app/onboarding/page.tsx
git commit -m "feat(wizard): wire entry surfaces — dashboard CTA, reality-check redirect, onboarding refactor

Dashboard empty state now has 'Start next block' button to
/data/blocks/new. Post-close reality-check submit redirects to the
wizard instead of the dashboard. completeOnboarding stripped down
to profile-update only — block creation moves entirely into the
wizard. Onboarding page's 'Finish' redirects to /data/blocks/new.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Resume detection (orphan blocks)

**Files:**
- Modify: `src/app/data/blocks/new/page.tsx`
- Create: `src/lib/engine/mesocycle/find-orphan.ts`

- [ ] **Step 1: Server action to find orphan**

Create `src/lib/engine/mesocycle/find-orphan.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types/training.types'

export interface OrphanBlock {
  mesocycleId: string
  name: string
  createdAt: string
  hasStrategy: boolean
}

export async function findOrphanBlock(): Promise<ActionResult<OrphanBlock | null>> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('mesocycles')
    .select('id, name, created_at, ai_context_json')
    .eq('user_id', user.id)
    .eq('is_active', false)
    .eq('is_complete', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: true, data: null }

  const aiCtx = (data.ai_context_json ?? {}) as Record<string, unknown>
  return {
    success: true,
    data: {
      mesocycleId: data.id,
      name: data.name,
      createdAt: data.created_at,
      hasStrategy: aiCtx.strategy != null,
    },
  }
}
```

- [ ] **Step 2: Server action to discard orphan**

Add to the same file:

```ts
export async function discardOrphanBlock(mesocycleId: string): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { success: false, error: 'Not authenticated' }

  // Delete microcycles + session_inventory cascading (assumes FK cascades; otherwise delete manually)
  const { error: micErr } = await supabase.from('microcycles').delete().eq('mesocycle_id', mesocycleId).eq('user_id', user.id)
  if (micErr) return { success: false, error: micErr.message }

  const { error: mesoErr } = await supabase.from('mesocycles').delete().eq('id', mesocycleId).eq('user_id', user.id).eq('is_complete', false)
  if (mesoErr) return { success: false, error: mesoErr.message }

  return { success: true, data: undefined }
}
```

Verify FK cascade: `select * from information_schema.table_constraints where table_name in ('microcycles', 'session_inventory') and constraint_type = 'FOREIGN KEY';` — if `session_inventory` has cascade-on-delete via microcycle FK, deleting microcycles is enough. If not, delete `session_inventory` rows first explicitly.

- [ ] **Step 3: Wire into wizard page**

Edit `src/app/data/blocks/new/page.tsx`. Add orphan detection:

```tsx
const orphanResult = await findOrphanBlock()
const orphan = orphanResult.success ? orphanResult.data : null

return (
  <div className="min-h-screen bg-neutral-950 py-10">
    <BlockCreationWizard
      retrospective={retrospective}
      pendingNotes={pendingNotes}
      orphan={orphan}
    />
  </div>
)
```

Add `orphan?: OrphanBlock | null` to `BlockCreationWizardProps`. In the wizard component, if `orphan` is present and `step === 'review'` and `mesocycleId === null`, render a resume prompt above all other sections:

```tsx
{orphan && !mesocycleId && (
  <section className="px-6 py-5 bg-amber-500/10 border-b border-amber-500/30">
    <div className="text-[11px] font-inter text-neutral-200 mb-3">
      You started planning <strong>{orphan.name}</strong> on {new Date(orphan.createdAt).toLocaleDateString()}. Continue or start fresh?
    </div>
    <div className="flex gap-2">
      <button onClick={() => setMesocycleId(orphan.mesocycleId)} className="px-3 py-1.5 bg-amber-500 text-black text-[10px] font-mono font-bold uppercase tracking-wider">
        Continue this one
      </button>
      <button onClick={async () => { await discardOrphanBlock(orphan.mesocycleId); router.refresh() }} className="px-3 py-1.5 border border-neutral-700 text-neutral-300 text-[10px] font-mono uppercase tracking-wider">
        Discard and start fresh
      </button>
    </div>
  </section>
)}
```

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
git add src/lib/engine/mesocycle/find-orphan.ts \
    src/app/data/blocks/new/page.tsx \
    src/components/wizard/BlockCreationWizard.tsx
git commit -m "feat(wizard): orphan-block resume detection

When the user opens /data/blocks/new with an existing inactive
incomplete mesocycle, prompt to continue or discard it. Prevents
silent orphan accumulation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Playwright e2e spec (committed not runnable)

**Files:**
- Create: `tests/e2e/block-creation-wizard.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/block-creation-wizard.spec.ts` covering three scenarios per the spec's testing section. The file is committed but not runnable — Playwright infra isn't configured in this repo (same convention as Plan 2 / Plan 3 / sub-projects A & B).

```ts
import { test, expect } from '@playwright/test'

// NOTE: Not runnable until Playwright infra is configured. Committed as scaffolding.

test.describe('Block creation wizard', () => {
  test('first-block flow from onboarding', async ({ page }) => {
    // Complete onboarding, expect redirect to /data/blocks/new
    // Pick hypertrophy + 6 weeks
    // Generate plan
    // Approve
    // Expect dashboard with active Block 1
    await page.goto('/onboarding')
    // ... onboarding flow ...
    await expect(page).toHaveURL('/data/blocks/new')
    await page.click('text=Hypertrophy')
    await page.click('text=Generate plan')
    await page.waitForSelector('text=Head coach strategy')
    await page.click('text=Approve & start')
    await expect(page).toHaveURL('/dashboard')
  })

  test('post-block flow from dashboard CTA', async ({ page }) => {
    await page.goto('/dashboard')
    await page.click('text=Start next block')
    await expect(page).toHaveURL('/data/blocks/new')
    // Confirm retrospective tile visible
    await expect(page.locator('text=From Block')).toBeVisible()
    // Confirm carryover summary visible with reality-check values
    await expect(page.locator('text=Your reality')).toBeVisible()
    await page.click('text=Hypertrophy')
    await page.click('text=Generate plan')
    await page.waitForSelector('text=Head coach strategy', { timeout: 60000 })
    // Confirm narrative references reality-check values
    const narrative = await page.locator('blockquote').textContent()
    expect(narrative).toContain('75')  // session minutes from carryover
    await page.click('text=Approve & start')
    await expect(page).toHaveURL('/dashboard')
  })

  test('resume flow', async ({ page }) => {
    // Create a shell, abandon, return
    await page.goto('/data/blocks/new')
    await page.click('text=Hypertrophy')
    await page.click('text=Generate plan')
    // Cancel mid-generation
    await page.click('text=Cancel and edit plan')
    // Navigate away and back
    await page.goto('/dashboard')
    await page.click('text=Start next block')
    // Resume prompt should appear
    await expect(page.locator('text=Continue or start fresh')).toBeVisible()
    await page.click('text=Discard and start fresh')
    // Confirm fresh wizard state
    await expect(page.locator('text=Your reality')).toBeVisible()
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/block-creation-wizard.spec.ts
git commit -m "test(e2e): block creation wizard spec (not runnable, no playwright infra)

Three scenarios covering first-block, post-block, and resume flows.
Committed as scaffolding for when Playwright lands.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Final gates + open PR

**Files:** none (verification + PR creation)

- [ ] **Step 1: Final gates**

```bash
npx tsc --noEmit
npm test
npm run build
```

Expected: tsc no NEW errors, all unit tests passing (same `garmin-sync.test.ts` pre-existing failure acceptable), production build passes on Vercel preview (local build may have pre-existing missing-package errors as noted in C — that's the same baseline).

- [ ] **Step 2: Manual smoke (REQUIRED before claiming done)**

Per `~/.claude/CLAUDE.md` confidence-gates and the spec's Verification section:

1. Push the branch, deploy Vercel preview.
2. Open preview → `/dashboard` → click "Start next block".
3. Confirm retrospective tile shows Block 1 actuals (21/51 = 41%).
4. Confirm carryover read-only shows reality-check values (6 days, 75 min, 20 warm-up, 0 cooldown).
5. Pick Hypertrophy, leave 6 weeks default.
6. Click Generate Plan; confirm progress label transitions strategy → week 1.
7. Confirm preview shows: per-coach session bars, weekly arc, head-coach narrative, week 1 session list with actual sessions.
8. Confirm narrative explicitly references reality-check answers (e.g., "75-min budget" or "20-min warm-up").
9. Click Approve & start; land on `/dashboard` with Block 2 active.
10. Verify in DB:
    - New `mesocycles` row: `is_active=true, is_complete=false, ai_context_json.strategy` populated.
    - 6 `microcycles` rows for the new mesocycle.
    - `session_inventory` rows for week 1 only (weeks 2-6 empty).
    - `block_pointer` updated.
    - `profiles.pending_planner_notes` is null.

- [ ] **Step 3: Open PR**

```bash
git push -u origin feat/block-2-wizard
gh pr create --title "feat: block creation wizard (sub-project D of Block N→N+1)" --body "$(cat <<'EOF'
## Summary

Sub-project D — the unlock for Block 2 actually starting. Three earlier sub-projects pay off here:
- A's `block_retrospectives` snapshot finally feeds the planner.
- B's `pending_planner_notes` finally is consumed.
- C's clean `engine/mesocycle/` surface gets its first new entry point.

### What changed

- **New canonical wizard** at `/data/blocks/new` used by both onboarding (Block 1) and post-block-close (Block 2+). Replaces onboarding's silent block creation.
- **Head-coach strategy step activated.** Single AI call at block start produces per-domain weekly load budgets via `runHeadCoachStrategy`, persisted to `mesocycle.ai_context_json.strategy`.
- **Per-week generation now strategy-aware.** `generateSessionPool` reads the strategy and passes per-coach `weekBrief` (sessions, load budget, week emphasis, methodology directive) into per-coach prompts. Block 1 backward-compatible (no strategy → fallback to today's behavior).
- **Carryover wired into the head-coach prompt.** Four new sections: Last Block's Actuals, Athlete's Stated Reality, Athlete's Availability, Athlete's Requested Emphasis.
- **Archetype picker** as primary control (Hypertrophy / Strength / Endurance Event / Conditioning / Hybrid / Custom). Custom mode unlocks per-coach session-count steppers.
- **Two-step flow** (review → AI plan preview → approve). Preview shows strategy summary + week 1 session pool. Weeks 2-N generate lazily on previous-week-completion.
- **Orphan-block resume detection.** Inactive incomplete mesocycles trigger a "continue or discard" prompt at wizard entry.
- **`completeOnboarding` slimmed** to profile-only update; block creation lives entirely in the wizard.

### What didn't change

- Existing per-week regeneration paths (`regenerateCurrentWeekPool`, `generateNextWeekPool`, `regenerateSingleSession`).
- Recovery loop (`runWeeklyRecoveryCheck`) — still adjusts sessions when YELLOW/RED.
- Block 1's existing mesocycle row — no migration.

Spec: `docs/superpowers/specs/2026-05-06-block-2-wizard-design.md`
Plan: `docs/superpowers/plans/2026-05-06-block-2-wizard-plan.md`

## Test plan

- [x] `npx tsc --noEmit` no NEW errors
- [x] `npm test` all tests passing (existing pre-existing failures unchanged)
- [x] `npm run build` clean on Vercel preview
- [x] Manual smoke against Vercel preview: created Block 2 via wizard, head-coach narrative referenced reality-check values, week 1 inventory persisted, `pending_planner_notes` cleared, dashboard shows Block 2 active
- [ ] Playwright spec committed but not runnable (no infra)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist (run after writing the plan)

- [x] **Spec coverage:**
  - Goal 1 (canonical wizard) → Tasks 8, 9, 10, 11
  - Goal 2 (head-coach strategy step) → Task 3
  - Goal 3 (retrospective + pending_notes wiring) → Task 1, Task 3 (prompt extension)
  - Goal 4 (archetype picker + custom escape) → Tasks 7, 8
  - Goal 5 (two-step flow with strategy + week 1) → Task 10
  - Goal 6 (onboarding refactor) → Task 12
  - Goal 7 (clear pending_notes on approve) → Task 5
  - Per-week strategy consumption → Task 6
  - Routes & entry surfaces → Tasks 11, 12
  - Orphan-block lifecycle → Task 13
  - Testing → unit tests in Tasks 1-5, component test in Task 10, e2e in Task 14
- [x] **No placeholders:** every step has concrete commands, file paths, and code blocks. The component implementations show full code; one TODO comment in `RetrospectiveSummaryTile` flagged with explicit replacement instruction.
- [x] **Type consistency:** `Archetype` defined in Task 7, used consistently in Tasks 2, 8, 10. `BlockRetrospectiveSnapshot` and `PendingPlannerNotes` types from existing files. `MesocycleStrategyValidated` from `@/lib/ai/schemas/week-brief`. `CoachDomain` from `@/lib/skills/types`.
