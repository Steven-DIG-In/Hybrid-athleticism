# Engine refactor (sub-project C of Block N→N+1 transition)

**Status:** Spec
**Date:** 2026-05-06
**Sub-project:** C of four (A shipped, B shipped, C this spec, D pending)
**Mode:** Split + light cleanup (no behavior changes)

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

## Goals

1. The three monoliths become a focused `src/lib/engine/` tree organized by training lifecycle level (mesocycle / microcycle / session / scheduling), with a `_shared/` subtree for cross-cutting helpers.
2. Per-coach metadata moves from `orchestrator.ts:getDomainMeta()` onto each coach config file. Orchestrator becomes fully generic.
3. Two unreferenced server actions get retired:
   - `generateMesocyclePlan` (legacy single-AI-call mesocycle generator, superseded by the multi-coach `generateMesocycleProgram`)
   - `generateFirstWeekPool`
4. Sub-project D's wizard imports from a single path: `@/lib/engine/mesocycle/generate`.
5. A single shape-equality vitest snapshot guards the coach-metadata transcription step.
6. A read-only audit pass surfaces single-user-isms in engine code, logged in this spec, deferred to a future sub-project unless trivially fixable.

## Non-goals

- No behavioral changes to AI prompts, DB writes, schemas, or pipeline structure.
- No new features.
- No schema migrations.
- No skill-input dispatch refactor (`buildSkillInput` switch stays as-is for now).
- No test-coverage increase beyond the one safety-net snapshot.
- No work on `recalibration.actions.ts`, `inventory.actions.ts`, or other adjacent action files.
- No multi-user fixes — the audit (Section 5) only logs findings.

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

## Single-user-isms audit

Read-only pass during the refactor. Each engine file gets a 5-min skim looking for these patterns. Findings get logged in this spec under `## Audit findings` (populated during execution). Fixed only if trivial; otherwise filed as backlog notes for a future "multi-user readiness" sub-project.

### Patterns flagged

| Pattern | Why it matters |
|---|---|
| Module-scope `let` (caches, last-result memos) | Leaks state between users in serverless / Fluid Compute |
| `async function foo() { ... }` with no `auth.getUser()` and no explicit `userId` param | Implicit single-user assumption |
| Queries without `.eq('user_id', user.id)` (excluding RPC calls and registry-style reads) | RLS catches it but defense-in-depth lost |
| Hardcoded `LIMIT 1` on `.from('mesocycles')` without `is_active=true` | Works today because there's one user, breaks under multiple active mesocycles |
| `Promise` deduping or in-flight maps not keyed by user | Cross-user request blending |

### Output format

Each finding logged as: `file:line — pattern — fix-or-defer`.

### Out of scope

The audit reads, it doesn't refactor. Findings that need structural changes (e.g., a global cache that needs per-user keying) go into a backlog note for a future sub-project — not into C.

## Audit findings

*(Populated during execution. Empty in spec form.)*

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

10. refactor(engine): create engine/_shared/ helpers
    - buildSkillInput, executeAssignedSkills, buildPreComputedAddendum,
      buildDomainUserPromptArgs, buildModSessions, buildMethodologyContext
      relocate.
    - Old files import from new locations.

11. refactor(engine): create engine/mesocycle/
    - generateMesocycleWithCoaches (caller wrapper) + generateMesocycleProgram
      (orchestrator pipeline) merge into engine/mesocycle/generate.ts.
    - extractWeekBrief, hasCoach move to engine/mesocycle/strategy.ts.
    - Onboarding callsite import updated.
    - Old halves of coaching.actions.ts and orchestrator.ts removed.

12. refactor(engine): create engine/microcycle/
    - generateSessionPool, generateNextWeekPool, regenerateCurrentWeekPool move
      to engine/microcycle/generate-pool.ts.
    - runWeeklyRecoveryCheck (caller wrapper) + runWeeklyAdjustment + runAdjustmentPipeline
      merge into engine/microcycle/adjust.ts.
    - insertLiftingSets, insertEnduranceTarget, buildCoachNotes, mapModality,
      deduplicateBenchmarks move to engine/microcycle/persistence.ts.
    - Dashboard imports updated.

13. refactor(engine): create engine/session/ + engine/scheduling/
    - regenerateSingleSession → engine/session/regenerate.ts.
    - allocateSessionDates → engine/scheduling/allocate.ts.
    - deallocateAllSessions → engine/scheduling/deallocate.ts.
    - SessionRegenDrawer + auto-assign imports updated.

14. refactor(engine): delete now-empty source files
    - programming.actions.ts, coaching.actions.ts, orchestrator.ts removed.
    - Final grep sweep for orphan references (per hygiene rule 2).

15. test(audit): single-user-isms audit log + spec update
    - Read-only pass. This spec's `## Audit findings` section populated.
    - No code changes (or minimal trivial fixes).
```

Each commit independently builds and passes tests. No "broken in commit 7, fixed in commit 8" sequences. If a commit cannot be made green standalone, it splits or merges with its neighbor.

All commits use `refactor:` or `test:` prefix. No `feat:` commits — no behavior changes.

## Risks

| Risk | Mitigation |
|---|---|
| Coach-metadata transcription error (e.g. Hypertrophy gets Endurance's prompt builder) | Snapshot test fails at `npm test` |
| Caller import path missed during a move | tsc fails the commit |
| Helper relocated when it should have been deleted (hidden orphan) | Hygiene rule 7 final sweep + grep audit |
| Dead-action audit misses a runtime caller (e.g. dynamic import) | Pre-deletion grep includes `--include="*.tsx"`; manual smoke on Vercel preview |
| Single-user-ism fix snuck in beyond audit scope | Code review of commit 15 limits diff to spec doc |

## Out-of-scope items flagged for future sub-projects

- Skill-input dispatch refactor (`buildSkillInput` switch → `skill.buildInput()` interface). Filed for post-D consideration.
- Multi-user readiness fixes derived from the audit. Filed as a separate sub-project once the multi-user product motion exists.
- Test-coverage backfill on the engine actions. The shape-equality snapshot is deliberately the only safety net; broader coverage is a separate effort.

## Dependencies

- None on sub-projects A or B (independent).
- Sub-project D depends on C. D's spec must be amended (during D's brainstorm) to reference `generateMesocycleProgram` instead of the dead `generateMesocyclePlan`.
