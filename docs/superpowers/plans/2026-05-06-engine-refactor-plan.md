# Engine Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `programming.actions.ts` (1641 LOC) + `coaching.actions.ts` (722 LOC) + `orchestrator.ts` (1105 LOC) into a focused `src/lib/engine/` tree organized by training lifecycle level. Move per-coach metadata onto coach configs so the orchestrator becomes fully generic. Fix single-user-isms in-place during each move.

**Architecture:** Lifecycle-level layout — `engine/mesocycle/`, `engine/microcycle/`, `engine/session/`, `engine/scheduling/`, with shared helpers in `engine/_shared/`. A new `ProgrammingMeta` type lives on each `CoachConfig` and replaces the orchestrator's hardcoded `getDomainMeta()` map. One snapshot test guards the metadata transcription.

**Tech Stack:** Next.js 16 App Router, TypeScript 5, Vitest 4, Supabase. Package manager: npm.

**Spec:** `docs/superpowers/specs/2026-05-06-engine-refactor-design.md`

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/lib/engine/types.ts` | Shared engine result types (`MesocycleGenerationResult`, `WeeklyAdjustmentResult`) and `ProgrammingMeta` |
| `src/lib/engine/_shared/skill-execution.ts` | `buildSkillInput`, `executeAssignedSkills`, `buildPreComputedAddendum` |
| `src/lib/engine/_shared/domain-prompt-args.ts` | `buildDomainUserPromptArgs`, `buildModSessions` |
| `src/lib/engine/_shared/methodology-context.ts` | `buildMethodologyContext` |
| `src/lib/engine/mesocycle/generate.ts` | PUBLIC `generateMesocycleProgram` action (merged from `coaching.actions` wrapper + `orchestrator` pipeline) |
| `src/lib/engine/mesocycle/strategy.ts` | `extractWeekBrief`, `hasCoach` |
| `src/lib/engine/microcycle/generate-pool.ts` | PUBLIC `generateSessionPool`, `generateNextWeekPool`, `regenerateCurrentWeekPool` |
| `src/lib/engine/microcycle/adjust.ts` | PUBLIC `runWeeklyRecoveryCheck` (merged) |
| `src/lib/engine/microcycle/persistence.ts` | `insertLiftingSets`, `insertEnduranceTarget`, `buildCoachNotes`, `mapModality`, `deduplicateBenchmarks` |
| `src/lib/engine/session/regenerate.ts` | PUBLIC `regenerateSingleSession` |
| `src/lib/engine/scheduling/allocate.ts` | PUBLIC `allocateSessionDates` |
| `src/lib/engine/scheduling/deallocate.ts` | PUBLIC `deallocateAllSessions` |
| `src/lib/coaches/__tests__/programming-meta.snapshot.test.ts` | Shape-equality safety net |

### Modified files

| Path | Change |
|---|---|
| `src/lib/coaches/types.ts` | Add `ProgrammingMeta` type + extend `CoachConfig` with optional `programming` field |
| `src/lib/coaches/configs/strength.ts` | Add `programming` block |
| `src/lib/coaches/configs/endurance.ts` | Add `programming` block |
| `src/lib/coaches/configs/hypertrophy.ts` | Add `programming` block |
| `src/lib/coaches/configs/conditioning.ts` | Add `programming` block |
| `src/lib/coaches/configs/mobility.ts` | Add `programming` block |
| `src/components/dashboard/SessionPoolClient.tsx` | Update import paths |
| `src/components/dashboard/SessionRegenDrawer.tsx` | Update import paths |
| `src/lib/scheduling/auto-assign.ts` | Update import paths |
| `src/lib/actions/inventory.actions.ts` | Update import paths |
| `src/lib/actions/inventory-generation.actions.ts` | Update import paths |
| Onboarding flow callsite of `generateMesocycleWithCoaches` (resolved during execution) | Update import path |

### Deleted files (Task 14)

- `src/lib/actions/programming.actions.ts`
- `src/lib/actions/coaching.actions.ts`
- `src/lib/ai/orchestrator.ts`

---

## Task 1: Snapshot safety net + shared types

**Files:**
- Create: `src/lib/engine/types.ts`
- Create: `src/lib/coaches/__tests__/programming-meta.snapshot.test.ts`
- Modify: `src/lib/ai/orchestrator.ts` (export `getDomainMeta`, import shared types)

- [ ] **Step 1: Create `src/lib/engine/types.ts`**

```ts
import type { ZodType } from 'zod'
import type {
    StrengthProgramValidated,
    EnduranceProgramValidated,
    HypertrophyProgramValidated,
    ConditioningProgramValidated,
    MobilityProgramValidated,
    RecoveryAssessmentValidated,
    AdjustmentDirectiveValidated,
    MesocycleStrategyValidated,
} from '@/lib/ai/schemas/week-brief'

export interface MesocycleGenerationResult {
    strategy: MesocycleStrategyValidated
    strengthProgram?: StrengthProgramValidated
    enduranceProgram?: EnduranceProgramValidated
    hypertrophyProgram?: HypertrophyProgramValidated
    conditioningProgram?: ConditioningProgramValidated
    mobilityProgram?: MobilityProgramValidated
}

export interface WeeklyAdjustmentResult {
    recovery: RecoveryAssessmentValidated
    directive?: AdjustmentDirectiveValidated
    modifiedStrengthSessions?: StrengthProgramValidated
    modifiedEnduranceSessions?: EnduranceProgramValidated
    modifiedHypertrophySessions?: HypertrophyProgramValidated
    modifiedConditioningSessions?: ConditioningProgramValidated
    modifiedMobilitySessions?: MobilityProgramValidated
}

export interface ProgrammingMeta {
    schema: ZodType
    buildSystemPrompt: () => string
    buildUserPrompt: (...args: unknown[]) => string
    buildModSystemPrompt: () => string
    buildModUserPrompt: (...args: unknown[]) => string
    resultKey: keyof MesocycleGenerationResult
    modifiedKey: keyof WeeklyAdjustmentResult
    maxTokens: number
    temperature: number
    modTemperature: number
    logLabel: string
    logSummary: (data: unknown) => string
}
```

- [ ] **Step 2: Update `src/lib/ai/orchestrator.ts` to import shared types and export `getDomainMeta`**

Locate the current `interface DomainCoachMeta` (line ~130) and the `MesocycleGenerationResult` / `WeeklyAdjustmentResult` interfaces (line ~108–126). Replace with imports from `@/lib/engine/types`:

```ts
// Replace the local interfaces with these imports:
import type {
    MesocycleGenerationResult,
    WeeklyAdjustmentResult,
    ProgrammingMeta,
} from '@/lib/engine/types'
```

Remove the local declarations of `MesocycleGenerationResult`, `WeeklyAdjustmentResult`, and `interface DomainCoachMeta`. The `MesocycleGenerationResult` and `WeeklyAdjustmentResult` exports stay (re-export from `@/lib/engine/types` so external callers don't break):

```ts
export type { MesocycleGenerationResult, WeeklyAdjustmentResult } from '@/lib/engine/types'
```

Update `getDomainMeta`'s return type to `Record<string, ProgrammingMeta>`. Export it:

```ts
export function getDomainMeta(): Record<string, ProgrammingMeta> {
    // ...existing body unchanged
}
```

- [ ] **Step 3: Run tsc to verify the type swap is clean**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 4: Create the snapshot test**

Create `src/lib/coaches/__tests__/programming-meta.snapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getDomainMeta } from '@/lib/ai/orchestrator'

describe('coach programming metadata', () => {
    it('matches captured shape', () => {
        const meta = getDomainMeta()
        expect(serializeProgrammingMeta(meta)).toMatchSnapshot()
    })
})

function serializeProgrammingMeta(meta: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(meta).map(([domain, m]) => {
            const entry = m as Record<string, unknown>
            return [domain, {
                schemaName: (entry.schema as { _def?: { typeName?: string } })._def?.typeName,
                buildSystemPromptName: (entry.buildSystemPrompt as { name: string }).name,
                buildUserPromptName: (entry.buildUserPrompt as { name: string }).name,
                buildModSystemPromptName: (entry.buildModSystemPrompt as { name: string }).name,
                buildModUserPromptName: (entry.buildModUserPrompt as { name: string }).name,
                resultKey: entry.resultKey,
                modifiedKey: entry.modifiedKey,
                maxTokens: entry.maxTokens,
                temperature: entry.temperature,
                modTemperature: entry.modTemperature,
                logLabel: entry.logLabel,
            }]
        })
    )
}
```

- [ ] **Step 5: Run the snapshot test to capture baseline**

Run: `npx vitest run src/lib/coaches/__tests__/programming-meta.snapshot.test.ts`
Expected: PASS — first run creates the snapshot file `__snapshots__/programming-meta.snapshot.test.ts.snap`.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: PASS (all tests including the new snapshot test).

- [ ] **Step 7: Commit**

```bash
git add src/lib/engine/types.ts \
    src/lib/coaches/__tests__/programming-meta.snapshot.test.ts \
    src/lib/coaches/__tests__/__snapshots__/programming-meta.snapshot.test.ts.snap \
    src/lib/ai/orchestrator.ts
git commit -m "test(safety-net): capture getDomainMeta snapshot + shared engine types

Phase-1 of engine refactor (sub-project C). Captures the current
coach metadata shape so the post-refactor configs can be verified
against the same snapshot. Extracts MesocycleGenerationResult,
WeeklyAdjustmentResult, and the renamed ProgrammingMeta type into
src/lib/engine/types.ts as the shared engine type surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Extend `CoachConfig` + populate strength

**Files:**
- Modify: `src/lib/coaches/types.ts`
- Modify: `src/lib/coaches/configs/strength.ts`

- [ ] **Step 1: Add `programming` field to `CoachConfig`**

Edit `src/lib/coaches/types.ts`. Add the import at the top:

```ts
import type { ProgrammingMeta } from '@/lib/engine/types'
```

Add the optional field at the bottom of `CoachConfig` (after `alwaysActive: boolean`):

```ts
  alwaysActive: boolean
  programming?: ProgrammingMeta
}
```

- [ ] **Step 2: Add the `programming` block to `strengthCoachConfig`**

Edit `src/lib/coaches/configs/strength.ts`. Add imports at the top:

```ts
import { StrengthProgramSchema } from '@/lib/ai/schemas/week-brief'
import type { StrengthProgramValidated } from '@/lib/ai/schemas/week-brief'
import {
    buildStrengthProgramSystemPrompt,
    buildStrengthProgramUserPrompt,
    buildStrengthModificationSystemPrompt,
    buildStrengthModificationUserPrompt,
} from '@/lib/ai/prompts/strength-coach'
```

Append `programming` to the config object. Find the closing brace of `strengthCoachConfig` and insert before it:

```ts
  programming: {
      schema: StrengthProgramSchema,
      buildSystemPrompt: buildStrengthProgramSystemPrompt,
      buildUserPrompt: buildStrengthProgramUserPrompt as (...args: unknown[]) => string,
      buildModSystemPrompt: buildStrengthModificationSystemPrompt,
      buildModUserPrompt: buildStrengthModificationUserPrompt as (...args: unknown[]) => string,
      resultKey: 'strengthProgram',
      modifiedKey: 'modifiedStrengthSessions',
      maxTokens: 8192,
      temperature: 0.7,
      modTemperature: 0.4,
      logLabel: 'Strength',
      logSummary: (d: unknown) => {
          const data = d as StrengthProgramValidated
          return `${data.splitDesign}, ${data.weeks.length} weeks`
      },
  },
```

Values must match `getDomainMeta().strength` in `orchestrator.ts` exactly. Cross-check before committing.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run the snapshot test (must still pass — orchestrator unchanged)**

Run: `npx vitest run src/lib/coaches/__tests__/programming-meta.snapshot.test.ts`
Expected: PASS (snapshot still matches; orchestrator's `getDomainMeta()` is unchanged).

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/coaches/types.ts src/lib/coaches/configs/strength.ts
git commit -m "feat(coaches): ProgrammingMeta type + populate strength config

Phase-2 of engine refactor. Adds programming block to strength
config. Orchestrator still uses its own getDomainMeta — snapshot
test still passes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Populate endurance config

**Files:**
- Modify: `src/lib/coaches/configs/endurance.ts`

- [ ] **Step 1: Add imports + `programming` block**

Mirror Task 2 Step 2's pattern. Imports:

```ts
import { EnduranceProgramSchema } from '@/lib/ai/schemas/week-brief'
import type { EnduranceProgramValidated } from '@/lib/ai/schemas/week-brief'
import {
    buildEnduranceProgramSystemPrompt,
    buildEnduranceProgramUserPrompt,
    buildEnduranceModificationSystemPrompt,
    buildEnduranceModificationUserPrompt,
} from '@/lib/ai/prompts/endurance-coach'
```

`programming` block (values come from `getDomainMeta().endurance` in orchestrator):

```ts
  programming: {
      schema: EnduranceProgramSchema,
      buildSystemPrompt: buildEnduranceProgramSystemPrompt,
      buildUserPrompt: buildEnduranceProgramUserPrompt as (...args: unknown[]) => string,
      buildModSystemPrompt: buildEnduranceModificationSystemPrompt,
      buildModUserPrompt: buildEnduranceModificationUserPrompt as (...args: unknown[]) => string,
      resultKey: 'enduranceProgram',
      modifiedKey: 'modifiedEnduranceSessions',
      maxTokens: 8192,
      temperature: 0.7,
      modTemperature: 0.4,
      logLabel: 'Endurance',
      logSummary: (d: unknown) => {
          const data = d as EnduranceProgramValidated
          return `${data.modalitySummary}, ${data.weeks.length} weeks`
      },
  },
```

- [ ] **Step 2: Run tsc + snapshot test + full suite**

```bash
npx tsc --noEmit && \
npx vitest run src/lib/coaches/__tests__/programming-meta.snapshot.test.ts && \
npm test
```
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/coaches/configs/endurance.ts
git commit -m "feat(coaches): populate endurance programming block

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Populate hypertrophy config

**Files:**
- Modify: `src/lib/coaches/configs/hypertrophy.ts`

- [ ] **Step 1: Add imports + `programming` block**

Imports:

```ts
import { HypertrophyProgramSchema } from '@/lib/ai/schemas/week-brief'
import type { HypertrophyProgramValidated } from '@/lib/ai/schemas/week-brief'
import {
    buildHypertrophyProgramSystemPrompt,
    buildHypertrophyProgramUserPrompt,
    buildHypertrophyModificationSystemPrompt,
    buildHypertrophyModificationUserPrompt,
} from '@/lib/ai/prompts/hypertrophy-coach'
```

`programming` block:

```ts
  programming: {
      schema: HypertrophyProgramSchema,
      buildSystemPrompt: buildHypertrophyProgramSystemPrompt,
      buildUserPrompt: buildHypertrophyProgramUserPrompt as (...args: unknown[]) => string,
      buildModSystemPrompt: buildHypertrophyModificationSystemPrompt,
      buildModUserPrompt: buildHypertrophyModificationUserPrompt as (...args: unknown[]) => string,
      resultKey: 'hypertrophyProgram',
      modifiedKey: 'modifiedHypertrophySessions',
      maxTokens: 8192,
      temperature: 0.7,
      modTemperature: 0.4,
      logLabel: 'Hypertrophy',
      logSummary: (d: unknown) => {
          const data = d as HypertrophyProgramValidated
          return `${data.splitDesign}, ${data.weeks.length} weeks`
      },
  },
```

- [ ] **Step 2: Run tsc + snapshot test + full suite**

Same as Task 3 Step 2.

- [ ] **Step 3: Commit**

```bash
git add src/lib/coaches/configs/hypertrophy.ts
git commit -m "feat(coaches): populate hypertrophy programming block

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Populate conditioning config

**Files:**
- Modify: `src/lib/coaches/configs/conditioning.ts`

- [ ] **Step 1: Add imports + `programming` block**

Imports:

```ts
import { ConditioningProgramSchema } from '@/lib/ai/schemas/week-brief'
import type { ConditioningProgramValidated } from '@/lib/ai/schemas/week-brief'
import {
    buildConditioningProgramSystemPrompt,
    buildConditioningProgramUserPrompt,
    buildConditioningModificationSystemPrompt,
    buildConditioningModificationUserPrompt,
} from '@/lib/ai/prompts/conditioning-coach'
```

`programming` block (note: temperature is **0.8** for conditioning, not 0.7):

```ts
  programming: {
      schema: ConditioningProgramSchema,
      buildSystemPrompt: buildConditioningProgramSystemPrompt,
      buildUserPrompt: buildConditioningProgramUserPrompt as (...args: unknown[]) => string,
      buildModSystemPrompt: buildConditioningModificationSystemPrompt,
      buildModUserPrompt: buildConditioningModificationUserPrompt as (...args: unknown[]) => string,
      resultKey: 'conditioningProgram',
      modifiedKey: 'modifiedConditioningSessions',
      maxTokens: 8192,
      temperature: 0.8,
      modTemperature: 0.4,
      logLabel: 'Conditioning',
      logSummary: (d: unknown) => {
          const data = d as ConditioningProgramValidated
          return `${data.methodologyUsed}, ${data.weeks.length} weeks`
      },
  },
```

- [ ] **Step 2: Run tsc + snapshot test + full suite**

- [ ] **Step 3: Commit**

```bash
git add src/lib/coaches/configs/conditioning.ts
git commit -m "feat(coaches): populate conditioning programming block

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Populate mobility config

**Files:**
- Modify: `src/lib/coaches/configs/mobility.ts`

- [ ] **Step 1: Add imports + `programming` block**

Imports:

```ts
import { MobilityProgramSchema } from '@/lib/ai/schemas/week-brief'
import type { MobilityProgramValidated } from '@/lib/ai/schemas/week-brief'
import {
    buildMobilityProgramSystemPrompt,
    buildMobilityProgramUserPrompt,
    buildMobilityModificationSystemPrompt,
    buildMobilityModificationUserPrompt,
} from '@/lib/ai/prompts/mobility-coach'
```

`programming` block (temperature **0.6** for mobility):

```ts
  programming: {
      schema: MobilityProgramSchema,
      buildSystemPrompt: buildMobilityProgramSystemPrompt,
      buildUserPrompt: buildMobilityProgramUserPrompt as (...args: unknown[]) => string,
      buildModSystemPrompt: buildMobilityModificationSystemPrompt,
      buildModUserPrompt: buildMobilityModificationUserPrompt as (...args: unknown[]) => string,
      resultKey: 'mobilityProgram',
      modifiedKey: 'modifiedMobilitySessions',
      maxTokens: 8192,
      temperature: 0.6,
      modTemperature: 0.4,
      logLabel: 'Mobility',
      logSummary: (d: unknown) => {
          const data = d as MobilityProgramValidated
          return `${data.methodologyUsed}, ${data.weeks.length} weeks`
      },
  },
```

- [ ] **Step 2: Run tsc + snapshot test + full suite**

- [ ] **Step 3: Commit**

```bash
git add src/lib/coaches/configs/mobility.ts
git commit -m "feat(coaches): populate mobility programming block

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Switch orchestrator to read from coach configs

**Files:**
- Modify: `src/lib/ai/orchestrator.ts`

- [ ] **Step 1: Rewrite `getDomainMeta` body to read from `coachRegistry`**

Find the function (line ~149). Replace its body with:

```ts
export function getDomainMeta(): Record<string, ProgrammingMeta> {
    const domains = ['strength', 'endurance', 'hypertrophy', 'conditioning', 'mobility'] as const
    const result: Record<string, ProgrammingMeta> = {}
    for (const domain of domains) {
        const meta = coachRegistry.getCoach(domain).programming
        if (!meta) {
            throw new Error(`Coach config '${domain}' is missing programming metadata. Populate ProgrammingMeta in src/lib/coaches/configs/${domain}.ts.`)
        }
        result[domain] = meta
    }
    return result
}
```

The `import { coachRegistry } from '@/lib/coaches'` already exists at the top of the file — no change needed.

The block of per-coach prompt-builder imports (lines ~60–95) remains for now; it'll be cleaned up in Task 11 when the file is deleted.

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run snapshot test**

Run: `npx vitest run src/lib/coaches/__tests__/programming-meta.snapshot.test.ts`
Expected: PASS — same shape, different source. **If this fails, a config has a typo or value mismatch from Tasks 2-6. Fix the config, do not update the snapshot.**

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/orchestrator.ts
git commit -m "refactor(engine): switch getDomainMeta to read coach configs

Phase-7 of engine refactor. getDomainMeta now reads programming
blocks from coachRegistry instead of holding the data inline.
Snapshot still matches — same shape, different source.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Delete `getDomainMeta` + retarget snapshot test

**Files:**
- Modify: `src/lib/ai/orchestrator.ts` (delete `getDomainMeta`, remove unused per-coach prompt-builder imports)
- Modify: `src/lib/coaches/__tests__/programming-meta.snapshot.test.ts` (read from registry directly)

- [ ] **Step 1: Update the snapshot test to read from `coachRegistry`**

Replace the test body in `src/lib/coaches/__tests__/programming-meta.snapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { coachRegistry } from '@/lib/coaches'

describe('coach programming metadata', () => {
    it('matches captured shape', () => {
        const domains = ['strength', 'endurance', 'hypertrophy', 'conditioning', 'mobility'] as const
        const meta = Object.fromEntries(
            domains.map(d => [d, coachRegistry.getCoach(d).programming])
        )
        expect(serializeProgrammingMeta(meta as Record<string, unknown>)).toMatchSnapshot()
    })
})

function serializeProgrammingMeta(meta: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(meta).map(([domain, m]) => {
            const entry = m as Record<string, unknown>
            return [domain, {
                schemaName: (entry.schema as { _def?: { typeName?: string } })._def?.typeName,
                buildSystemPromptName: (entry.buildSystemPrompt as { name: string }).name,
                buildUserPromptName: (entry.buildUserPrompt as { name: string }).name,
                buildModSystemPromptName: (entry.buildModSystemPrompt as { name: string }).name,
                buildModUserPromptName: (entry.buildModUserPrompt as { name: string }).name,
                resultKey: entry.resultKey,
                modifiedKey: entry.modifiedKey,
                maxTokens: entry.maxTokens,
                temperature: entry.temperature,
                modTemperature: entry.modTemperature,
                logLabel: entry.logLabel,
            }]
        })
    )
}
```

- [ ] **Step 2: Run snapshot test (still pre-deletion)**

Run: `npx vitest run src/lib/coaches/__tests__/programming-meta.snapshot.test.ts`
Expected: PASS — snapshot file unchanged.

- [ ] **Step 3: Locate and audit callers of `getDomainMeta` in `orchestrator.ts`**

Run:
```bash
grep -n "getDomainMeta\|domainMeta" src/lib/ai/orchestrator.ts
```

Replace each `getDomainMeta()[coach.id]` lookup with `coachRegistry.getCoach(coach.id).programming`. Each call site becomes:

```ts
const meta = coachRegistry.getCoach(coach.id).programming
if (!meta) continue   // not a programming-pipeline coach
// ...use meta
```

- [ ] **Step 4: Delete the `getDomainMeta` function**

Remove lines that define `function getDomainMeta()` (now unreferenced inside orchestrator). The export stays only if anything outside orchestrator imports it — verify with:

```bash
grep -rn "getDomainMeta" --include="*.ts" --include="*.tsx" src/
```

Expected: hits only inside `orchestrator.ts`. If the snapshot test still references it, that means Step 1 wasn't applied — fix and recheck.

- [ ] **Step 5: Run tsc + tests**

```bash
npx tsc --noEmit && npm test
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/orchestrator.ts src/lib/coaches/__tests__/programming-meta.snapshot.test.ts
git commit -m "refactor(engine): delete getDomainMeta, snapshot reads registry

Phase-8. Orchestrator now exclusively reads programming metadata
from coach configs via coachRegistry. Snapshot test rewritten to
read from the same source. Snapshot file unchanged — same shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Delete dead actions

**Files:**
- Modify: `src/lib/actions/programming.actions.ts` (delete `generateMesocyclePlan`, `generateFirstWeekPool`, and any helpers/imports that drop to zero callers)

- [ ] **Step 1: Confirm zero external callers**

Run:
```bash
grep -rn "generateMesocyclePlan\|generateFirstWeekPool" --include="*.ts" --include="*.tsx" src/
```
Expected: hits only inside `src/lib/actions/programming.actions.ts`. If hits appear elsewhere, **stop** — investigate and fix the caller before proceeding.

- [ ] **Step 2: Delete `generateMesocyclePlan`**

Remove the entire function body in `src/lib/actions/programming.actions.ts` starting at line ~501 (`export async function generateMesocyclePlan`) through its closing brace.

- [ ] **Step 3: Delete `generateFirstWeekPool`**

Remove the entire function body starting at line ~606 (`export async function generateFirstWeekPool`) through its closing brace.

- [ ] **Step 4: Audit imports for orphans**

Open the imports block at the top of `programming.actions.ts`. For each imported symbol, run:

```bash
grep -n "<symbol>" src/lib/actions/programming.actions.ts
```

Specifically check:
- `MesocycleOverviewPlan`, `MesocycleOverviewPlanSchema`
- Any prompt builders that referenced the dead actions only

Remove imports with zero remaining usage.

- [ ] **Step 5: Audit prompt builders for orphans**

Run:
```bash
grep -rn "buildMesocycleOverview\|MesocycleOverviewPlan" --include="*.ts" src/
```

If hits return only inside the prompts directory itself (no callers post-deletion), delete the corresponding prompt builders and schema entries in `src/lib/ai/prompts/programming.ts` and `src/lib/ai/schemas/programming.ts`.

- [ ] **Step 6: Run tsc + tests**

```bash
npx tsc --noEmit && npm test
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -u
git commit -m "refactor(engine): delete dead actions generateMesocyclePlan + generateFirstWeekPool

Both unreferenced across src/. generateMesocyclePlan was the legacy
single-AI-call mesocycle generator superseded by orchestrator's
generateMesocycleProgram. generateFirstWeekPool had no callers
since metrics dashboard work landed.

Also retired: any helpers, schema entries, and prompt builders that
dropped to zero references after these deletions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Move shared helpers to `engine/_shared/` + audit-fix

**Files:**
- Create: `src/lib/engine/_shared/skill-execution.ts`
- Create: `src/lib/engine/_shared/domain-prompt-args.ts`
- Create: `src/lib/engine/_shared/methodology-context.ts`
- Modify: `src/lib/ai/orchestrator.ts` (re-export from new locations)
- Modify: `src/lib/actions/programming.actions.ts` (re-export `buildMethodologyContext` from new location)
- Modify: `docs/superpowers/specs/2026-05-06-engine-refactor-design.md` (append audit findings)

- [ ] **Step 1: Create `engine/_shared/skill-execution.ts`**

Move `buildSkillInput`, `executeAssignedSkills`, `buildPreComputedAddendum` from `src/lib/ai/orchestrator.ts` to a new file. Top of file:

```ts
import { skillRegistry, SkillInputError } from '@/lib/skills'
import type { CoachDomain } from '@/lib/skills/types'
import type {
    AthleteContextPacket,
} from '@/lib/types/coach-context'
import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'

export async function buildSkillInput(/* original signature */) { /* original body */ }
export async function executeAssignedSkills(/* original signature */) { /* original body */ }
export function buildPreComputedAddendum(/* original signature */) { /* original body */ }
```

Copy bodies verbatim from `orchestrator.ts:292`, `orchestrator.ts:424`, `orchestrator.ts:475`. Update internal cross-references between the three to point to the new local symbols.

- [ ] **Step 2: Create `engine/_shared/domain-prompt-args.ts`**

Move `buildDomainUserPromptArgs` (orchestrator.ts:584) and `buildModSessions` (orchestrator.ts:625). Copy bodies verbatim. Add necessary type imports from `@/lib/types/coach-context` and `@/lib/ai/schemas/week-brief`.

- [ ] **Step 3: Create `engine/_shared/methodology-context.ts`**

Move `buildMethodologyContext` (programming.actions.ts:1558). The function builds a `MethodologyContext` object from training-max + benchmark data — copy verbatim. The function also exports the `MethodologyContext` type (currently re-imported from `@/lib/ai/prompts/programming`); preserve that import path.

- [ ] **Step 4: Update orchestrator imports + re-exports**

Edit `src/lib/ai/orchestrator.ts`:
- Remove the three function bodies just relocated.
- Add imports at the top:
  ```ts
  import {
      buildSkillInput,
      executeAssignedSkills,
      buildPreComputedAddendum,
  } from '@/lib/engine/_shared/skill-execution'
  import {
      buildDomainUserPromptArgs,
      buildModSessions,
  } from '@/lib/engine/_shared/domain-prompt-args'
  ```

- [ ] **Step 5: Update programming.actions.ts imports**

Edit `src/lib/actions/programming.actions.ts`:
- Remove the `buildMethodologyContext` function body.
- Add the import:
  ```ts
  import { buildMethodologyContext } from '@/lib/engine/_shared/methodology-context'
  ```

- [ ] **Step 6: Audit each relocated helper for single-user-isms**

For each of the 6 relocated functions (`buildSkillInput`, `executeAssignedSkills`, `buildPreComputedAddendum`, `buildDomainUserPromptArgs`, `buildModSessions`, `buildMethodologyContext`), grep within the new file for the patterns from Section 5 of the spec:

```bash
grep -nE "let [a-zA-Z]+ =|auth\.getUser|user_id|LIMIT 1|\.limit\(1\)" src/lib/engine/_shared/*.ts
```

Most of these helpers take pre-resolved data and don't query Supabase directly, so findings will be rare. For each finding, apply the default fix from the spec table or log `DEFER:` with reason. Append findings to `docs/superpowers/specs/2026-05-06-engine-refactor-design.md` under `## Audit findings`.

- [ ] **Step 7: Run tsc + tests**

```bash
npx tsc --noEmit && npm test
```
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/engine/_shared/ \
    src/lib/ai/orchestrator.ts \
    src/lib/actions/programming.actions.ts \
    docs/superpowers/specs/2026-05-06-engine-refactor-design.md
git commit -m "refactor(engine): create engine/_shared/ helpers + audit-fix

Phase-10. Relocates buildSkillInput, executeAssignedSkills,
buildPreComputedAddendum, buildDomainUserPromptArgs, buildModSessions,
and buildMethodologyContext from orchestrator.ts and
programming.actions.ts into engine/_shared/. Audit findings appended
to spec.

Behavior-preserving for single user: pure helpers without direct
DB access; no logic changes, only relocations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Move mesocycle code + audit-fix

**Files:**
- Create: `src/lib/engine/mesocycle/generate.ts`
- Create: `src/lib/engine/mesocycle/strategy.ts`
- Modify: `src/lib/actions/coaching.actions.ts` (delete `generateMesocycleWithCoaches`)
- Modify: `src/lib/ai/orchestrator.ts` (delete `generateMesocycleProgram` body, `extractWeekBrief`, `hasCoach`)
- Modify: caller of `generateMesocycleWithCoaches` (resolve via grep)
- Modify: `docs/superpowers/specs/2026-05-06-engine-refactor-design.md` (append audit findings)

- [ ] **Step 1: Create `src/lib/engine/mesocycle/strategy.ts`**

Move `extractWeekBrief` (orchestrator.ts:245) and `hasCoach` (orchestrator.ts:280) verbatim. Top of file:

```ts
import type { CoachingTeamEntry, WeekBrief } from '@/lib/types/coach-context'
import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'

export function extractWeekBrief(/* original signature + body */) { /* ... */ }
export function hasCoach(/* original */) { /* ... */ }
```

- [ ] **Step 2: Create `src/lib/engine/mesocycle/generate.ts`**

This is the most complex move. The new file MERGES the public `generateMesocycleWithCoaches` (caller wrapper from `coaching.actions.ts:308`) with the orchestrator-internal `generateMesocycleProgram` (orchestrator.ts:696). Header:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { coachRegistry } from '@/lib/coaches'
import {
    buildMesocycleStrategySystemPrompt,
    buildMesocycleStrategyUserPrompt,
} from '@/lib/ai/prompts/head-coach'
import { generateStructuredResponse } from '@/lib/ai/client'
import { MesocycleStrategySchema } from '@/lib/ai/schemas/week-brief'
import {
    executeAssignedSkills,
    buildPreComputedAddendum,
} from '@/lib/engine/_shared/skill-execution'
import { buildDomainUserPromptArgs } from '@/lib/engine/_shared/domain-prompt-args'
import { extractWeekBrief, hasCoach } from '@/lib/engine/mesocycle/strategy'
import type { ActionResult } from '@/lib/types/training.types'
import type {
    MesocycleGenerationResult,
    ProgrammingMeta,
} from '@/lib/engine/types'
// + any additional imports the merged body requires; resolve from
//   coaching.actions.ts:1-50 and orchestrator.ts:1-105
```

Body construction:

1. Take the body of `coaching.actions.generateMesocycleWithCoaches` as the outer shell. It owns: auth check, mesocycle DB lookup, microcycle creation, audit logging, return-to-caller wrapping.
2. At the inner point where it currently calls `generateMesocycleProgram(...)` (search for the call), inline the body of `orchestrator.generateMesocycleProgram` directly — replacing the call with the per-coach loop that:
   - Iterates `coachRegistry.getCoaches()` filtered by `programming` presence.
   - Calls `executeAssignedSkills` per coach.
   - Builds prompt args via `buildDomainUserPromptArgs` and the per-coach `programming.buildSystemPrompt` / `buildUserPrompt`.
   - Calls `generateStructuredResponse` with the schema.
   - Stores result under `meta.resultKey`.
3. Export the merged function as `generateMesocycleProgram` (single canonical name post-refactor — see spec naming reconciliation).

Key invariant: every line of the original two function bodies must appear in the merged function, except for the call boundary itself. No behavior change.

- [ ] **Step 3: Update caller import path**

Find the (single) external caller of `generateMesocycleWithCoaches`:

```bash
grep -rn "generateMesocycleWithCoaches" --include="*.ts" --include="*.tsx" src/
```

Edit each caller — typically the onboarding flow or a dashboard action — replacing:

```ts
import { generateMesocycleWithCoaches } from '@/lib/actions/coaching.actions'
// ...
await generateMesocycleWithCoaches(args)
```

with:

```ts
import { generateMesocycleProgram } from '@/lib/engine/mesocycle/generate'
// ...
await generateMesocycleProgram(args)
```

- [ ] **Step 4: Delete the old function bodies**

In `src/lib/actions/coaching.actions.ts`: delete `generateMesocycleWithCoaches` and any of its imports that drop to zero callers.

In `src/lib/ai/orchestrator.ts`: delete `generateMesocycleProgram`, `extractWeekBrief` (now in strategy.ts), `hasCoach` (now in strategy.ts), and any prompt-builder imports that referenced them only.

- [ ] **Step 5: Audit relocated mesocycle code for single-user-isms**

For each function in the new mesocycle/ files, grep for spec patterns. Likely findings:

```bash
grep -nE "auth\.getUser|user_id|\.eq\('is_active'|\.limit\(1\)|let [a-z]" \
    src/lib/engine/mesocycle/*.ts
```

For mesocycle queries, verify:
- Every query for the active mesocycle includes `.eq('is_active', true)`.
- Every query is scoped by the authed `user.id`.
- No module-scope mutable state.

Apply default fixes from the spec table for any finding. Append findings to `docs/superpowers/specs/2026-05-06-engine-refactor-design.md` under `## Audit findings` with the format:

```
- src/lib/engine/mesocycle/generate.ts:142 — `LIMIT 1` on mesocycles without `is_active=true` — fix-applied
```

- [ ] **Step 6: Run tsc + snapshot test + full suite**

```bash
npx tsc --noEmit && \
npx vitest run src/lib/coaches/__tests__/programming-meta.snapshot.test.ts && \
npm test
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/engine/mesocycle/ \
    src/lib/actions/coaching.actions.ts \
    src/lib/ai/orchestrator.ts \
    docs/superpowers/specs/2026-05-06-engine-refactor-design.md \
    <caller-files-modified>
git commit -m "refactor(engine): create engine/mesocycle/ + audit-fix

Phase-11. Merges the coaching.actions.generateMesocycleWithCoaches
caller wrapper with the orchestrator.generateMesocycleProgram
pipeline into a single engine/mesocycle/generate.ts. extractWeekBrief
and hasCoach move to engine/mesocycle/strategy.ts. Caller import
paths updated to the new single canonical name
generateMesocycleProgram.

Audit findings:
<list applied fixes from Step 5, e.g.>
- engine/mesocycle/generate.ts:142 — added is_active=true predicate
  to mesocycle lookup. Behavior-preserving for single user (Steven
  has one active mesocycle at any time).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Move microcycle code + audit-fix

**Files:**
- Create: `src/lib/engine/microcycle/generate-pool.ts`
- Create: `src/lib/engine/microcycle/adjust.ts`
- Create: `src/lib/engine/microcycle/persistence.ts`
- Modify: `src/lib/actions/programming.actions.ts` (delete moved functions)
- Modify: `src/lib/actions/coaching.actions.ts` (delete `runWeeklyRecoveryCheck`)
- Modify: `src/lib/ai/orchestrator.ts` (delete `runWeeklyAdjustment`, `runAdjustmentPipeline`)
- Modify: `src/components/dashboard/SessionPoolClient.tsx` (update imports)
- Modify: any other callers of microcycle actions (resolve via grep)
- Modify: `docs/superpowers/specs/2026-05-06-engine-refactor-design.md` (audit findings)

- [ ] **Step 1: Create `engine/microcycle/persistence.ts`**

Move from `programming.actions.ts`:
- `mapModality` (line ~1355)
- `buildCoachNotes` (line ~1368)
- `insertLiftingSets` (line ~1459)
- `insertEnduranceTarget` (line ~1507)
- `deduplicateBenchmarks` (line ~1540)

Copy bodies verbatim. Add necessary type imports from `@/lib/types/database.types` and `@/lib/ai/schemas/programming`. None of these touch auth — they're pure persistence helpers — so most exports stay private (no `export` keyword) unless needed by other engine files.

For helpers used by multiple engine files (e.g., `mapModality` used by both generate-pool and regenerate), export them. Use grep to determine which:

```bash
grep -rn "mapModality\|buildCoachNotes\|insertLiftingSets\|insertEnduranceTarget\|deduplicateBenchmarks" --include="*.ts" src/lib/
```

- [ ] **Step 2: Create `engine/microcycle/generate-pool.ts`**

Move from `programming.actions.ts`:
- `generateSessionPool` (line ~42)
- `generateNextWeekPool` (line ~641)
- `regenerateCurrentWeekPool` (line ~691)

Header:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateStructuredResponse } from '@/lib/ai/client'
import {
    WeeklySessionPoolSchema,
    createValidatedSessionPoolSchema,
} from '@/lib/ai/schemas/programming'
import {
    buildProgrammingSystemPrompt,
    buildProgrammingUserPrompt,
} from '@/lib/ai/prompts/programming'
import { computeWeeklyLoadSummary } from '@/lib/scheduling/load-scoring'
import { buildMethodologyContext } from '@/lib/engine/_shared/methodology-context'
import {
    insertLiftingSets,
    insertEnduranceTarget,
    buildCoachNotes,
    mapModality,
    deduplicateBenchmarks,
} from '@/lib/engine/microcycle/persistence'
import type { ActionResult, WorkoutWithSets } from '@/lib/types/training.types'
import type { Workout } from '@/lib/types/database.types'
// + remaining imports from programming.actions.ts:1-25 that the
//   three relocated functions actually use
```

Copy bodies verbatim.

- [ ] **Step 3: Create `engine/microcycle/adjust.ts`**

This file merges three layers:
- `coaching.actions.runWeeklyRecoveryCheck` (line ~401) — public wrapper
- `orchestrator.runWeeklyAdjustment` (line ~855) — orchestrator pipeline
- `orchestrator.runAdjustmentPipeline` (line ~1010) — internal helper

Mirror the merge pattern from Task 11 Step 2: the public wrapper's body is the outer shell; the orchestrator's pipeline functions inline at the call boundary; the merged function is exported as `runWeeklyRecoveryCheck`. Imports include shared engine helpers:

```ts
import {
    executeAssignedSkills,
    buildPreComputedAddendum,
} from '@/lib/engine/_shared/skill-execution'
import { buildModSessions } from '@/lib/engine/_shared/domain-prompt-args'
import { coachRegistry } from '@/lib/coaches'
import { RecoveryAssessmentSchema, AdjustmentDirectiveSchema } from '@/lib/ai/schemas/week-brief'
import {
    buildAdjustmentDirectiveSystemPrompt,
    buildAdjustmentDirectiveUserPrompt,
} from '@/lib/ai/prompts/head-coach'
// + remaining imports the merged body requires
```

- [ ] **Step 4: Update caller imports**

Find every caller of the microcycle actions:

```bash
grep -rn "generateSessionPool\|generateNextWeekPool\|regenerateCurrentWeekPool\|runWeeklyRecoveryCheck" \
    --include="*.ts" --include="*.tsx" src/ | \
    grep -v "src/lib/actions/programming.actions.ts\|src/lib/actions/coaching.actions.ts\|src/lib/ai/orchestrator.ts\|src/lib/engine/microcycle/"
```

Update each caller's import path to `@/lib/engine/microcycle/generate-pool` or `@/lib/engine/microcycle/adjust`. Known callers:
- `src/components/dashboard/SessionPoolClient.tsx`
- `src/lib/actions/inventory.actions.ts`
- `src/lib/actions/inventory-generation.actions.ts`
- `src/lib/actions/coaching.actions.ts` (will be deleted in Task 14)

- [ ] **Step 5: Delete the old function bodies**

- In `src/lib/actions/programming.actions.ts`: delete `generateSessionPool`, `generateNextWeekPool`, `regenerateCurrentWeekPool`, `mapModality`, `buildCoachNotes`, `insertLiftingSets`, `insertEnduranceTarget`, `deduplicateBenchmarks`. Remove imports that drop to zero usage.
- In `src/lib/actions/coaching.actions.ts`: delete `runWeeklyRecoveryCheck`.
- In `src/lib/ai/orchestrator.ts`: delete `runWeeklyAdjustment`, `runAdjustmentPipeline`.

- [ ] **Step 6: Audit relocated microcycle code for single-user-isms**

```bash
grep -nE "auth\.getUser|user_id|\.eq\('is_active'|\.limit\(1\)|let [a-z]" \
    src/lib/engine/microcycle/*.ts
```

Apply default fixes per spec Section 5. Pay particular attention to:
- `generateSessionPool` and `regenerateCurrentWeekPool` — verify mesocycle lookup uses `is_active=true` predicate.
- `runWeeklyRecoveryCheck` — verify recovery query is user-scoped.
- Persistence helpers — verify any direct DB writes include `user_id` from a passed-in argument or auth context.

Append findings to spec.

- [ ] **Step 7: Run tsc + snapshot test + full suite**

```bash
npx tsc --noEmit && \
npx vitest run src/lib/coaches/__tests__/programming-meta.snapshot.test.ts && \
npm test
```
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/engine/microcycle/ \
    src/lib/actions/programming.actions.ts \
    src/lib/actions/coaching.actions.ts \
    src/lib/ai/orchestrator.ts \
    src/components/dashboard/SessionPoolClient.tsx \
    src/lib/actions/inventory.actions.ts \
    src/lib/actions/inventory-generation.actions.ts \
    docs/superpowers/specs/2026-05-06-engine-refactor-design.md
git commit -m "refactor(engine): create engine/microcycle/ + audit-fix

Phase-12. Relocates generateSessionPool, generateNextWeekPool,
regenerateCurrentWeekPool to engine/microcycle/generate-pool.ts.
Merges coaching.actions.runWeeklyRecoveryCheck +
orchestrator.runWeeklyAdjustment + runAdjustmentPipeline into
engine/microcycle/adjust.ts. Persistence helpers move to
engine/microcycle/persistence.ts.

Audit findings:
<list applied fixes from Step 6 with one-line behavior-preservation
justifications>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Move session + scheduling code + audit-fix

**Files:**
- Create: `src/lib/engine/session/regenerate.ts`
- Create: `src/lib/engine/scheduling/allocate.ts`
- Create: `src/lib/engine/scheduling/deallocate.ts`
- Modify: `src/lib/actions/programming.actions.ts` (delete moved functions)
- Modify: `src/components/dashboard/SessionRegenDrawer.tsx` (update imports)
- Modify: `src/lib/scheduling/auto-assign.ts` (update imports)
- Modify: `src/components/dashboard/SessionPoolClient.tsx` (update scheduling imports)
- Modify: `docs/superpowers/specs/2026-05-06-engine-refactor-design.md` (audit findings)

- [ ] **Step 1: Create `engine/session/regenerate.ts`**

Move `regenerateSingleSession` (programming.actions.ts:987) verbatim. Header:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateStructuredResponse } from '@/lib/ai/client'
import { SingleSessionResponseSchema } from '@/lib/ai/schemas/programming'
import {
    buildSingleSessionSystemPrompt,
    buildSingleSessionUserPrompt,
} from '@/lib/ai/prompts/programming'
import {
    buildTempWorkoutFromSession,
    findOptimalDayForSession,
} from '@/lib/scheduling/auto-assign'
import { buildMethodologyContext } from '@/lib/engine/_shared/methodology-context'
import {
    insertLiftingSets,
    insertEnduranceTarget,
    buildCoachNotes,
    mapModality,
} from '@/lib/engine/microcycle/persistence'
import type { ActionResult, WorkoutWithSets } from '@/lib/types/training.types'
// + remaining imports the function actually uses
```

- [ ] **Step 2: Create `engine/scheduling/allocate.ts`**

Move `allocateSessionDates` (programming.actions.ts:745) verbatim. Header:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { autoAssignSessionDates } from '@/lib/scheduling/auto-assign'
import type { ActionResult } from '@/lib/types/training.types'
```

- [ ] **Step 3: Create `engine/scheduling/deallocate.ts`**

Move `deallocateAllSessions` (programming.actions.ts:885) verbatim. Header:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types/training.types'
```

- [ ] **Step 4: Update caller imports**

Find every caller:

```bash
grep -rn "regenerateSingleSession\|allocateSessionDates\|deallocateAllSessions" \
    --include="*.ts" --include="*.tsx" src/ | \
    grep -v "src/lib/actions/programming.actions.ts\|src/lib/engine/"
```

Known callers and their new imports:
- `src/components/dashboard/SessionRegenDrawer.tsx`:
  ```ts
  import { regenerateSingleSession } from '@/lib/engine/session/regenerate'
  ```
- `src/components/dashboard/SessionPoolClient.tsx`:
  ```ts
  import { allocateSessionDates } from '@/lib/engine/scheduling/allocate'
  import { deallocateAllSessions } from '@/lib/engine/scheduling/deallocate'
  ```
- `src/lib/scheduling/auto-assign.ts`:
  ```ts
  import { regenerateSingleSession } from '@/lib/engine/session/regenerate'
  ```

- [ ] **Step 5: Delete the old function bodies**

In `src/lib/actions/programming.actions.ts`: delete `regenerateSingleSession`, `allocateSessionDates`, `deallocateAllSessions`. The file should now be empty or near-empty — that's fine; Task 14 deletes it.

- [ ] **Step 6: Audit relocated session + scheduling code for single-user-isms**

```bash
grep -nE "auth\.getUser|user_id|\.eq\('is_active'|\.limit\(1\)|let [a-z]" \
    src/lib/engine/session/*.ts src/lib/engine/scheduling/*.ts
```

Apply default fixes. Pay particular attention to:
- `regenerateSingleSession` — verify session lookup is scoped by user.
- `allocateSessionDates` / `deallocateAllSessions` — verify queries on `session_inventory` and `block_pointer` are user-scoped and filter by current active mesocycle.

Append findings to spec.

- [ ] **Step 7: Run tsc + snapshot test + full suite**

```bash
npx tsc --noEmit && \
npx vitest run src/lib/coaches/__tests__/programming-meta.snapshot.test.ts && \
npm test
```
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/engine/session/ src/lib/engine/scheduling/ \
    src/lib/actions/programming.actions.ts \
    src/components/dashboard/SessionRegenDrawer.tsx \
    src/components/dashboard/SessionPoolClient.tsx \
    src/lib/scheduling/auto-assign.ts \
    docs/superpowers/specs/2026-05-06-engine-refactor-design.md
git commit -m "refactor(engine): create engine/session/ + engine/scheduling/ + audit-fix

Phase-13. Relocates regenerateSingleSession to engine/session/,
allocateSessionDates and deallocateAllSessions to engine/scheduling/.
Caller imports updated.

Audit findings:
<list applied fixes from Step 6>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Delete now-empty source files + final sweep

**Files:**
- Delete: `src/lib/actions/programming.actions.ts`
- Delete: `src/lib/actions/coaching.actions.ts`
- Delete: `src/lib/ai/orchestrator.ts`

- [ ] **Step 1: Verify each file is fully drained**

```bash
grep -E "^export" src/lib/actions/programming.actions.ts src/lib/actions/coaching.actions.ts src/lib/ai/orchestrator.ts
```

Expected: zero exports remaining (all moved or deleted in Tasks 9-13). If any export appears, **stop** — relocate or delete it before proceeding.

- [ ] **Step 2: Hygiene grep — verify no remaining imports of the old paths**

```bash
grep -rn "from '@/lib/actions/programming.actions'\|from '@/lib/actions/coaching.actions'\|from '@/lib/ai/orchestrator'" \
    --include='*.ts' --include='*.tsx' src/
```

Expected: zero hits. If any caller still references an old path, fix it before deletion.

- [ ] **Step 3: Delete the three files**

```bash
rm src/lib/actions/programming.actions.ts \
   src/lib/actions/coaching.actions.ts \
   src/lib/ai/orchestrator.ts
```

- [ ] **Step 4: Final hygiene rule 7 sweep — eyeball file sizes**

```bash
find src/lib/engine -name '*.ts' | xargs wc -l | sort -n
```

Look for files under ~15 LOC. Any thin re-export-only file should be folded into its caller or deleted. Adjust as needed.

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Run snapshot test**

Run: `npx vitest run src/lib/coaches/__tests__/programming-meta.snapshot.test.ts`
Expected: PASS — snapshot file unchanged from Task 1.

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: PASS — all tests including the snapshot test still green.

- [ ] **Step 8: Run production build**

Run: `npm run build`
Expected: PASS — Next.js production build clean.

- [ ] **Step 9: Manual smoke gate (REQUIRED before claiming done)**

Per `~/.claude/CLAUDE.md` confidence-gates: a UI/feature change requires manual verification in a browser. Push the branch, deploy a Vercel preview, log in as Steven, navigate to the dashboard, and trigger ONE of the following actions:

- `regenerateCurrentWeekPool` (via the dashboard "regenerate" button)
- `generateSessionPool` (via the appropriate dashboard surface)
- `regenerateSingleSession` (via the SessionRegenDrawer)

Confirm:
- AI call returns a valid response (not an error).
- Sessions appear in the database with sensible content.
- No console errors in the browser.

If the smoke fails, **do not commit Step 10** — diagnose and fix, then re-smoke.

- [ ] **Step 10: Commit**

```bash
git add -u src/lib/actions/programming.actions.ts \
    src/lib/actions/coaching.actions.ts \
    src/lib/ai/orchestrator.ts
git commit -m "refactor(engine): delete drained source files

Phase-14. Removes programming.actions.ts (1641 LOC),
coaching.actions.ts (722 LOC), and orchestrator.ts (1105 LOC).
All exports relocated to src/lib/engine/ in Tasks 9-13.

Verified: zero remaining imports of the old paths across src/,
tsc clean, full test suite green, production build clean,
manual smoke against Vercel preview confirms generate/regenerate
flows work end-to-end.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Open PR

**Files:** none

- [ ] **Step 1: Push branch**

```bash
git push -u origin refactor/engine-split
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "refactor: engine split + coach-config tightening + multi-user-readiness fixes (sub-project C)" --body "$(cat <<'EOF'
## Summary

Sub-project C of the Block N → N+1 transition framework. Splits the three engine monoliths (programming.actions.ts 1641 LOC + coaching.actions.ts 722 LOC + orchestrator.ts 1105 LOC) into a focused src/lib/engine/ tree organized by training lifecycle level. Tightens the coach-config consumption boundary by moving per-domain metadata onto each coach config — orchestrator becomes fully generic. Fixes single-user-isms in-place during each move.

### What changed

- **Layout:** `engine/{mesocycle,microcycle,session,scheduling,_shared}/` replaces three monoliths.
- **Coach configs gain a `programming` block.** Each domain coach config (strength, endurance, hypertrophy, conditioning, mobility) owns its schema, prompt builders, sampling parameters, and log helpers. Adding a sixth coach is one new config file.
- **Two dead actions retired:** `generateMesocyclePlan`, `generateFirstWeekPool`.
- **Single-user-isms fixed in-place** during each file move (see audit findings appended to spec).
- **Naming:** `generateMesocycleWithCoaches` collapsed to `generateMesocycleProgram` (one canonical name).

### What didn't change

- AI prompts, DB schemas, pipeline structure — all behavior-preserving for the single live user.
- No new features, no migrations.

Spec: `docs/superpowers/specs/2026-05-06-engine-refactor-design.md`
Plan: `docs/superpowers/plans/2026-05-06-engine-refactor-plan.md`

## Test plan

- [x] `npx tsc --noEmit` clean
- [x] `npm test` green (including the new `programming-meta.snapshot.test.ts` safety net)
- [x] `npm run build` clean
- [x] Manual smoke on Vercel preview: triggered <action-name>, confirmed AI call succeeds and DB persistence is correct
- [x] Snapshot file unchanged from Task 1 capture — coach metadata transcription verified bit-for-bit

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist (run after writing the plan)

- [x] **Spec coverage:**
  - Goal 1 (split into engine/ tree) → Tasks 10-13
  - Goal 2 (coach-config tightening) → Tasks 1-8
  - Goal 3 (delete dead actions) → Task 9
  - Goal 4 (D's wizard imports from one path) → Task 11 produces `engine/mesocycle/generate.ts`
  - Goal 5 (snapshot test) → Task 1
  - Goal 6 (single-user-isms fix-as-we-go) → Tasks 10-13 each include audit-fix step
  - Hygiene rules 1-7 → Task 14 final sweep + per-task grep checks
- [x] **No placeholders:** every step has concrete commands, file paths, and code blocks. The "merged body construction" in Task 11 Step 2 and Task 12 Step 3 is described prescriptively (outer-shell + inline) rather than handwaved.
- [x] **Type consistency:** `ProgrammingMeta` defined in Task 1, used in Tasks 2-8 with the same shape. `MesocycleGenerationResult` and `WeeklyAdjustmentResult` defined in Task 1 and referenced consistently.
