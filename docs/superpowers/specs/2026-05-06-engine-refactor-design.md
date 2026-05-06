# Engine refactor (sub-project C of Block N→N+1 transition)

**Status:** Spec
**Date:** 2026-05-06
**Sub-project:** C of four (A shipped, B shipped, C this spec, D pending)
**Mode:** Split + light cleanup + multi-user-readiness fixes

## Why

Three files concentrate the entire programming + orchestration surface:

| File | LOC | Exports |
|---|---|---|
| `src/lib/actions/programming.actions.ts` | 1641 | 9 (2 dead) |
| `src/lib/actions/coaching.actions.ts` | 722 | 2 |
| `src/lib/ai/orchestrator.ts` | 1105 | 2 + 1 helper |

The 1641-LOC and 1105-LOC files predate the multi-coach pipeline; the 722-LOC `coaching.actions.ts` is a thin wrapper that grew during the Phase 2 training loop work. The three files mix mesocycle, microcycle, session, and scheduling concerns in a way that obscures the call graph.

Sub-project D (Block 2 wizard) needs to call into one obvious mesocycle-generation entry point with the retrospective snapshot + pending planner notes as inputs. Today it would inherit a fragmented surface: the public action lives in `coaching.actions.ts`, the pipeline in `orchestrator.ts`, and shared helpers in `programming.actions.ts`. C exists so D inherits a clean shape.

A second motivation: the orchestrator advertises itself as "config-driven" but is only half so. It iterates the `coachRegistry` registry, then reaches into a 90-line hardcoded `getDomainMeta()` map for everything that actually defines a coach (its schema, prompts, sampling parameters). That parallel map duplicates information the coach config files should own. C closes that gap.

A third motivation: the engine is multi-user-architected but single-user-tested. Onboarding routes through these same actions, so the moment a second athlete onboards, any latent single-user-ism in the engine surfaces. Since the refactor reads every line of these files anyway, fixing single-user-isms in-place is cheaper than logging them now and revisiting later.

## Goals

1. The three monoliths become a focused `src/lib/engine/` tree organized by training lifecycle level (mesocycle / microcycle / session / scheduling), with a `_shared/` subtree for cross-cutting helpers.
2. Per-coach metadata moves from `orchestrator.ts:getDomainMeta()` onto each coach config file. Orchestrator becomes fully generic.
3. Two unreferenced server actions get retired:
   - `generateMesocyclePlan` (legacy single-AI-call mesocycle generator, superseded by the multi-coach `generateMesocycleProgram`)
   - `generateFirstWeekPool`
4. Sub-project D's wizard imports from a single path: `@/lib/engine/mesocycle/generate`.
5. A single shape-equality vitest snapshot guards the coach-metadata transcription step.
6. Single-user-isms in engine code get fixed in-place during each file move. Findings still logged for transparency, but the default disposition is *fix* not *defer*.

## Non-goals

- No behavioral changes to AI prompts, DB writes, schemas, or pipeline structure for the live single-user case. Multi-user-readiness fixes are explicitly behavior-preserving for the current single user (e.g. adding `is_active=true` predicates, per-user-keying caches, adding missing `auth.getUser()` calls — none change what Steven sees).
- No new features.
- No schema migrations.
- No skill-input dispatch refactor (`buildSkillInput` switch stays as-is for now).
- No test-coverage increase beyond the one safety-net snapshot.
- No work on `recalibration.actions.ts`, `inventory.actions.ts`, or other adjacent action files.
- Multi-user-readiness fixes are scoped to engine files being touched by the refactor. Fixes that require structural changes spanning files outside the refactor's scope get logged and deferred (not silently expanded).

## Scope

| File | Disposition |
|---|---|
| `src/lib/actions/programming.actions.ts` | Split + delete |
| `src/lib/actions/coaching.actions.ts` | Split + delete |
| `src/lib/ai/orchestrator.ts` | Split + delete |
| `src/lib/coaches/configs/{strength,endurance,hypertrophy,conditioning,mobility}.ts` | Each gains a `programming: ProgrammingMeta` field |
| `src/lib/coaches/types.ts` | Adds `ProgrammingMeta` type, extends `CoachConfig` |
| All callers of the deleted files | Imports rewritten only — no signature changes |

## Approach: split axis

By **lifecycle level** (mesocycle → microcycle → session → scheduling). Each level owns its actions, helpers, and persistence. Selected over by-concern (which cuts across actions awkwardly) and by-caller-surface (which doesn't shrink the big files).

## Approach: coach-config tightening

`getDomainMeta()` deletes. Each domain coach config grows a `programming` field of shape `ProgrammingMeta`:

```ts
export interface ProgrammingMeta {
    schema: ZodSchema<unknown>
    buildSystemPrompt: (...args: unknown[]) => string
    buildUserPrompt: (...args: unknown[]) => string
    buildModSystemPrompt: (...args: unknown[]) => string
    buildModUserPrompt: (...args: unknown[]) => string
    resultKey: string
    modifiedKey: string
    maxTokens: number
    temperature: number
    modTemperature: number
    logLabel: string
    logSummary: (data: unknown) => string
}
```

`CoachConfig.programming` is optional — head and recovery coaches don't run the program-generation pipeline and leave it undefined. Engine code reads `coachRegistry.getCoach(domain).programming` and skips coaches without it.

After the move, adding a sixth domain coach is one new config file plus a registry entry. Zero engine edits.

## Target file layout

```
src/lib/engine/
├── _shared/
│   ├── skill-execution.ts        ← buildSkillInput, executeAssignedSkills,
│   │                                buildPreComputedAddendum
│   ├── domain-prompt-args.ts     ← buildDomainUserPromptArgs, buildModSessions
│   └── methodology-context.ts    ← buildMethodologyContext
│
├── mesocycle/
│   ├── generate.ts               ← PUBLIC: generateMesocycleProgram
│   │                                (merge: coaching.generateMesocycleWithCoaches +
│   │                                 orchestrator.generateMesocycleProgram)
│   └── strategy.ts               ← extractWeekBrief, hasCoach
│
├── microcycle/
│   ├── generate-pool.ts          ← PUBLIC: generateSessionPool, generateNextWeekPool,
│   │                                regenerateCurrentWeekPool
│   ├── adjust.ts                 ← PUBLIC: runWeeklyRecoveryCheck
│   │                                (merge: coaching.runWeeklyRecoveryCheck +
│   │                                 orchestrator.runWeeklyAdjustment +
│   │                                 runAdjustmentPipeline)
│   └── persistence.ts            ← insertLiftingSets, insertEnduranceTarget,
│                                    buildCoachNotes, mapModality, deduplicateBenchmarks
│
├── session/
│   └── regenerate.ts             ← PUBLIC: regenerateSingleSession
│
└── scheduling/
    ├── allocate.ts               ← PUBLIC: allocateSessionDates
    └── deallocate.ts             ← PUBLIC: deallocateAllSessions
```

### Public surface (post-refactor)

| Path | Action |
|---|---|
| `engine/mesocycle/generate.ts` | `generateMesocycleProgram` |
| `engine/microcycle/generate-pool.ts` | `generateSessionPool`, `generateNextWeekPool`, `regenerateCurrentWeekPool` |
| `engine/microcycle/adjust.ts` | `runWeeklyRecoveryCheck` |
| `engine/session/regenerate.ts` | `regenerateSingleSession` |
| `engine/scheduling/allocate.ts` | `allocateSessionDates` |
| `engine/scheduling/deallocate.ts` | `deallocateAllSessions` |

### Naming reconciliation

- `generateMesocycleWithCoaches` (caller-side wrapper name in `coaching.actions.ts`) is renamed to `generateMesocycleProgram`. They were always the same thing logically — the wrapper layer needed a distinct identifier only because the orchestrator owned the `generateMesocycleProgram` symbol. Post-refactor there is one name.
- `runWeeklyRecoveryCheck` keeps its caller-facing name. The orchestrator's internal `runWeeklyAdjustment` becomes a private helper inside `engine/microcycle/adjust.ts`.

### Deleted files

- `src/lib/actions/programming.actions.ts`
- `src/lib/actions/coaching.actions.ts`
- `src/lib/ai/orchestrator.ts`

### Callers updated (import path only — no signature changes)

- `src/components/dashboard/SessionPoolClient.tsx`
- `src/components/dashboard/SessionRegenDrawer.tsx`
- `src/lib/scheduling/auto-assign.ts`
- `src/lib/actions/inventory.actions.ts`
- `src/lib/actions/inventory-generation.actions.ts`
- The onboarding flow callsite of `generateMesocycleWithCoaches` (resolved during execution).

## Dead code retirement

Confirmed dead via `grep -rn` across `src/`:

| Symbol | Defined at | References outside its file |
|---|---|---|
| `generateMesocyclePlan` | `programming.actions.ts:501` | 0 |
| `generateFirstWeekPool` | `programming.actions.ts:606` | 0 |

Both delete. Not relocated, not stub-aliased, not commented. Bodies and any helpers / schemas / prompt-builders that drop to zero callers as a result also delete in the same commit (per hygiene rule below).

### `generateMesocyclePlan` vs `generateMesocycleProgram` reconciliation

The dead `generateMesocyclePlan` is the legacy single-AI-call mesocycle generator from before the multi-coach pipeline existed. The live `generateMesocycleProgram` (currently `orchestrator.ts`, post-refactor `engine/mesocycle/generate.ts`) is the multi-coach successor. **Sub-project D's plan must reference `generateMesocycleProgram`, not `generateMesocyclePlan`.** D's spec/plan amendment is out of scope for this spec but flagged here so D's planner doesn't search for the dead symbol.

### Pre-deletion grep checklist

```bash
grep -rn "generateMesocyclePlan\|generateFirstWeekPool" --include="*.ts" --include="*.tsx" src/
# Expected: zero hits outside programming.actions.ts itself
```

### Helpers exclusively used by dead actions

Audited during execution. Candidates to check:

- `MesocycleOverviewPlanSchema` import in `programming.actions.ts:9` (only the dead `generateMesocyclePlan` consumes it).
- Any `buildMesocycleOverview*` prompt builders.
- Other private helpers reachable only from the two dead actions.

Hygiene rule applies: zero callers post-action-deletion → delete in the same commit.

## Hygiene rules

1. **No orphan files.** Every file deletion happens in the same commit as the last reference removal. After each commit, `git status` shows no untracked stragglers and no zero-export files.
2. **No orphan exports.** When a function moves, every importer updates in the same commit. Pre-deletion check for old paths:
   ```bash
   grep -rn "from '@/lib/actions/programming.actions'\|from '@/lib/actions/coaching.actions'\|from '@/lib/ai/orchestrator'" --include='*.ts' --include='*.tsx' src/
   # Expected zero hits before the old file is deleted.
   ```
3. **No orphan helpers.** If a private helper has zero references after the move, it deletes (not relocates). Plan step explicitly: grep helper → 0 callers → delete; ≥1 → relocate to caller's new home.
4. **No orphan types.** Any `type` / `interface` exported only for a dead/relocated function gets the same treatment.
5. **No commented-out code.** Removed = removed. Git history is the archive.
6. **`tsc --noEmit` passes after each commit.** If a move breaks types, the same commit fixes them.
7. **Final-pass sweep.** Last commit lists every file under `src/lib/engine/` with line counts. Any file under ~15 LOC that is just a re-export gets folded or deleted.

## Single-user-isms — fix-as-we-go

Each engine file gets read closely during its move commit. Single-user-isms found inside an engine file get **fixed in the same commit as the move**. Findings (and their resolutions) log in `## Audit findings` below for review-time visibility.

### Patterns and default fixes

| Pattern | Default fix |
|---|---|
| Module-scope `let` cache / last-result memo | Delete the cache, or convert to a `Map<userId, T>` with explicit eviction. Default lean: delete unless there's clear evidence it matters for performance. |
| Action body without `auth.getUser()` or explicit `userId` param | Add `auth.getUser()` at the top; return `{ success: false, error: 'Not authenticated' }` on failure (matches the existing `ActionResult` pattern). |
| Queries without `.eq('user_id', user.id)` (non-RPC, non-registry reads) | Add the predicate. Defense-in-depth even with RLS. |
| `LIMIT 1` on `.from('mesocycles')` without `is_active=true` | Add `.eq('is_active', true)` so the query is correct under multiple historical mesocycles per user. |
| `LIMIT 1` on `.from('microcycles')` without explicit ordering | Add `.order('week_number', ascending: ...)` matching the call's intent. |
| `Promise` deduping / in-flight map not keyed by user | Per-user-key it, or remove if unused. |
| Hardcoded route assumptions in `revalidatePath` | Leave as-is unless the route itself is user-scoped (these are global cache invalidations and acceptable). |

### Default = fix. Escape hatch = defer.

If a finding requires structural rework that spills outside the engine file being touched (e.g., a shared helper in `src/lib/scheduling/` would need to change too, or a database query pattern repeats across non-engine actions), the fix gets **deferred** — logged with a `DEFER:` marker and a one-line reason. Deferring is rare; the default disposition is fix.

### Verification of fixes

Each multi-user fix is behavior-preserving for Steven (the single live user). The snapshot test does not catch these (it only guards coach metadata), so the gates are:

- `tsc --noEmit` (catches missing-arg / type drift if a function signature changes).
- `npm test` (existing tests must still pass — many indirectly exercise the modified code paths).
- Commit-level review of the fix list — every fix must include a one-line *why this is behavior-preserving for one user* note in the commit body.
- Manual smoke on Vercel preview at end of refactor (Steven runs one generate-pool action).

### Output format

Each finding logged as: `file:line — pattern — fix-applied | DEFER: <one-line reason>`.

## Audit findings

### Task 10 — engine/_shared/

No single-user-isms found in pure helpers; functions take pre-resolved arguments and don't query Supabase directly.

- `src/lib/engine/_shared/skill-execution.ts:46,48` — `let dayOffset = 0` / `for (let i = 0; ...)` — function-local loop variables, NOT module-scope caches. No fix needed.
- `src/lib/engine/_shared/domain-prompt-args.ts:51` — `for (let i = 0; ...)` — function-local loop variable. No fix needed.
- `src/lib/engine/_shared/methodology-context.ts` — calls `resolveTrainingMaxForExercise`, which itself reads via the authenticated supabase client; no direct DB access from this file. Profile + benchmarks arrive as caller-resolved arguments. No fix needed at this layer.

### Task 11 — engine/mesocycle/

No single-user-isms requiring fixes. The relocated action operates on a caller-supplied `mesocycleId` (primary key) and always pairs `.eq('id', mesocycleId)` with `.eq('user_id', user.id)`; the context loader does the same on `profiles`, `mesocycles`, `microcycles`, `athlete_injuries`, `athlete_benchmarks`, `recent_training_activity`, `workouts`, `exercise_sets`. No `LIMIT 1` on `mesocycles` without an `is_active=true` predicate is present because the lookup is by primary key, not "the active mesocycle".

- `src/lib/engine/mesocycle/generate.ts:62` — `auth.getUser()` present at action entry. No fix needed.
- `src/lib/engine/mesocycle/generate.ts:238-263` — `UPDATE mesocycles ... .eq('id', mesocycleId).eq('user_id', user.id)`. No fix needed.
- `src/lib/engine/mesocycle/context.ts:97` — `SELECT mesocycles ... .eq('id', mesocycleId).eq('user_id', userId)`. No fix needed.
- `src/lib/engine/mesocycle/context.ts:112-114` — injuries / benchmarks / recent_training all filtered by user_id (and `is_active=true` on injuries). No fix needed.
- `src/lib/engine/mesocycle/context.ts:129,172` — microcycles lookup by composite `(mesocycle_id, week_number, user_id)` then `.single()`; the row is unique by construction. No `is_active` flag exists on microcycles. No fix needed.
- `src/lib/engine/mesocycle/context.ts:267` — `let loadSummary` is function-local, not module-scope cache. No fix needed.
- `src/lib/engine/mesocycle/strategy.ts` — pure helper, no I/O. No findings.

## Verification

### Safety-net snapshot

One vitest snapshot, run in two phases.

**Phase 1 — capture (commit 1, before any other refactor commit):**

`src/lib/coaches/__tests__/programming-meta.snapshot.test.ts`

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

`getDomainMeta` must be exported from `orchestrator.ts` for this commit (it currently is not). The export is added in commit 1 and removed in commit 8.

**Phase 2 — assert post-refactor (commit 8):**

```ts
import { coachRegistry } from '@/lib/coaches'

describe('coach programming metadata', () => {
    it('matches captured shape', () => {
        const domains = ['strength', 'endurance', 'hypertrophy', 'conditioning', 'mobility'] as const
        const meta = Object.fromEntries(
            domains.map(d => [d, coachRegistry.getCoach(d).programming])
        )
        expect(serializeProgrammingMeta(meta)).toMatchSnapshot()
    })
})
```

Snapshot file (`__snapshots__/programming-meta.snapshot.test.ts.snap`) does not change. A transcription bug that swaps Strength's prompt builder onto Hypertrophy fails the snapshot at `npm test`.

### Other gates

- `npx tsc --noEmit` passes after every commit.
- `npm test` passes after every commit.
- `npm run build` (Next.js production build) passes at end of refactor.
- Vercel preview deployment from the refactor branch — Steven manually triggers one dashboard generate-pool action to confirm a real AI call still produces output (cannot be claimed done without this manual gate per `~/.claude/CLAUDE.md` confidence-gates).
- Final commit confirms `src/lib/engine/` tree contains exactly the files listed in *Target file layout*; no extras.

## Migration strategy

Commit ordering is constrained by the snapshot dance.

```
1. test(safety-net): capture getDomainMeta snapshot
   - Phase-1 snapshot test added.
   - getDomainMeta exported from orchestrator.ts (was previously private).
   - Snapshot file committed.

2. feat(coaches): add ProgrammingMeta type + populate strength config
   - ProgrammingMeta type added to src/lib/coaches/types.ts.
   - strengthCoach config gains `programming` block.
   - Orchestrator unchanged (still uses getDomainMeta).
   - Snapshot still matches.

3-6. feat(coaches): populate {endurance,hypertrophy,conditioning,mobility}
   - Four small commits, one per coach. Same pattern as commit 2.

7. refactor(engine): switch orchestrator to read from coach configs
   - getDomainMeta() body changed to read from coachRegistry.
   - Snapshot still matches (same shape, different source).

8. refactor(engine): delete getDomainMeta + update snapshot test source
   - Test rewritten to read from coachRegistry directly.
   - getDomainMeta deleted.
   - Snapshot still matches.

9. refactor(engine): delete dead actions
   - generateMesocyclePlan, generateFirstWeekPool deleted.
   - Helpers/schemas/prompt-builders that drop to zero callers also delete (hygiene rule 3).

10. refactor(engine): create engine/_shared/ helpers + audit-fix
    - buildSkillInput, executeAssignedSkills, buildPreComputedAddendum,
      buildDomainUserPromptArgs, buildModSessions, buildMethodologyContext
      relocate.
    - Each relocated helper read for single-user-isms; fixes applied in same commit.
    - Spec `## Audit findings` updated.
    - Old files import from new locations.

11. refactor(engine): create engine/mesocycle/ + audit-fix
    - generateMesocycleWithCoaches (caller wrapper) + generateMesocycleProgram
      (orchestrator pipeline) merge into engine/mesocycle/generate.ts.
    - extractWeekBrief, hasCoach move to engine/mesocycle/strategy.ts.
    - Single-user-ism audit on each moved function; fixes applied in same commit.
    - Spec `## Audit findings` updated.
    - Onboarding callsite import updated.
    - Old halves of coaching.actions.ts and orchestrator.ts removed.

12. refactor(engine): create engine/microcycle/ + audit-fix
    - generateSessionPool, generateNextWeekPool, regenerateCurrentWeekPool move
      to engine/microcycle/generate-pool.ts.
    - runWeeklyRecoveryCheck (caller wrapper) + runWeeklyAdjustment + runAdjustmentPipeline
      merge into engine/microcycle/adjust.ts.
    - insertLiftingSets, insertEnduranceTarget, buildCoachNotes, mapModality,
      deduplicateBenchmarks move to engine/microcycle/persistence.ts.
    - Single-user-ism audit on each moved function; fixes applied in same commit.
    - Spec `## Audit findings` updated.
    - Dashboard imports updated.

13. refactor(engine): create engine/session/ + engine/scheduling/ + audit-fix
    - regenerateSingleSession → engine/session/regenerate.ts.
    - allocateSessionDates → engine/scheduling/allocate.ts.
    - deallocateAllSessions → engine/scheduling/deallocate.ts.
    - Single-user-ism audit on each moved function; fixes applied in same commit.
    - Spec `## Audit findings` updated.
    - SessionRegenDrawer + auto-assign imports updated.

14. refactor(engine): delete now-empty source files
    - programming.actions.ts, coaching.actions.ts, orchestrator.ts removed.
    - Final grep sweep for orphan references (per hygiene rule 2).
    - Final hygiene rule 7 sweep (file-size eyeball).
```

Each commit independently builds and passes tests. No "broken in commit 7, fixed in commit 8" sequences. If a commit cannot be made green standalone, it splits or merges with its neighbor.

Commits use `refactor:` or `test:` prefix. The audit-fix portions are batched inside the relocation commit they belong to — keeping the fix next to the move it accompanies makes the diff easier to review than a trailing audit-only commit. Each affected commit body lists the audit findings it resolved.

## Risks

| Risk | Mitigation |
|---|---|
| Coach-metadata transcription error (e.g. Hypertrophy gets Endurance's prompt builder) | Snapshot test fails at `npm test` |
| Caller import path missed during a move | tsc fails the commit |
| Helper relocated when it should have been deleted (hidden orphan) | Hygiene rule 7 final sweep + grep audit |
| Dead-action audit misses a runtime caller (e.g. dynamic import) | Pre-deletion grep includes `--include="*.tsx"`; manual smoke on Vercel preview |
| Single-user-ism fix accidentally changes single-user behavior | Each fix's commit body must include a one-line "behavior-preserving for single user because…" note; existing test suite must stay green; manual smoke at end |
| Audit-fix scope creep into files outside the refactor | Findings that span outside engine files get logged with `DEFER:` marker, not silently expanded |

## Out-of-scope items flagged for future sub-projects

- Skill-input dispatch refactor (`buildSkillInput` switch → `skill.buildInput()` interface). Filed for post-D consideration.
- Multi-user readiness fixes outside engine files. The in-engine fixes happen here; anything spanning outside engine files gets logged with `DEFER:` and filed as a separate sub-project.
- Test-coverage backfill on the engine actions. The shape-equality snapshot is deliberately the only safety net; broader coverage is a separate effort.

## Dependencies

- None on sub-projects A or B (independent).
- Sub-project D depends on C. D's spec must be amended (during D's brainstorm) to reference `generateMesocycleProgram` instead of the dead `generateMesocyclePlan`.
