# Block creation wizard (sub-project D of Block N→N+1 transition)

**Status:** Spec
**Date:** 2026-05-06
**Sub-project:** D of four (A shipped, B shipped, C shipped, D this spec)

## Why

D is the unlock for Block 2 actually starting. It's also the moment three earlier sub-projects pay off:

- A's `block_retrospectives` snapshot finally has a consumer beyond the read-only retrospective view.
- B's `pending_planner_notes` finally feeds the planner that B was named for.
- C's clean `engine/mesocycle/` surface gets its first new entry point.

Block 1's adherence (21/51 = 41%) had a simple cause per Steven's reality-check: stale inputs. The plan was right; the budget assumed onboarding-time availability that didn't survive contact with reality. D fixes the inputs by routing carryover through every block-creation event.

D also activates a piece of architecture that has been dormant since Phase 2: the head coach as cross-domain load arbiter. Block 1 generated weeks in isolation — five domain coaches each prescribed their full ideal week, and the athlete ran out of time. With D, the head coach runs first, sets per-domain weekly load budgets, and per-week generation respects them.

Finally, D establishes the canonical "create a block" surface. Onboarding's silent block creation gets refactored to route through the same wizard. No more two paths.

## Goals

1. Ship a single `<BlockCreationWizard>` component used by both onboarding (Block 1) and post-block-close (Block 2+).
2. Activate the head-coach strategy step: a single AI call at block start that produces per-domain weekly load budgets, persists to `mesocycle.ai_context_json`, and is consumed by per-week session generation.
3. Wire `getLatestBlockRetrospective()` and `getPendingPlannerNotes()` into the wizard so the head coach sees the athlete's stated reality + last block's actuals.
4. Athlete control surface: archetype picker (Hypertrophy / Strength / Endurance Event / Conditioning / Hybrid / Custom), with custom session-count steppers as escape hatch.
5. Two-step flow: single-page review → AI plan preview → approve. Preview shows the head-coach strategy + week 1 actual session pool. Weeks 2-N generate lazily.
6. Refactor `completeOnboarding` so onboarding's last step redirects to `/data/blocks/new`.
7. On approve, call `clearPendingPlannerNotes()` to consume the carryover.

## Non-goals

- No mid-block re-strategy. Once the block is approved, the strategy is fixed for its duration. Weekly recovery check still adjusts sessions, but doesn't rewrite load budgets.
- No deterministic programs-to-inventory translator (option (c) from brainstorm). Per-week `generateSessionPool` stays as the inventory writer.
- No retirement of the dormant `generateMesocycleProgram`. We extract just its head-coach-strategy step into a new dedicated action; the rest stays for a future sub-project.
- No editing of generated sessions before approve. Approve = commit.
- No manual session editor (change movement / rep scheme without calling AI). Filed as future sub-project.
- No multi-block planning UI.
- No regenerate-individual-coach controls. Regenerate is whole-block.

## Approach

### Engine path (option b from brainstorm)

Head coach strategy comes first as a single dedicated AI call. Strategy persists to `mesocycle.ai_context_json`. Per-week `generateSessionPool` reads the strategy and passes the relevant `weekBrief` (the per-week slice of `domainAllocations` + `weeklyEmphasis`) into per-coach prompts.

The dormant `generateMesocycleProgram` orchestrator stays dormant. We don't run it end-to-end; we extract the strategy step. The full multi-coach orchestrator could be activated later as a separate sub-project ("Block 3 architecture") if the strategy approach proves load-bearing.

### Generation timing (option b2 from brainstorm)

Strategy + week 1 generated at approve time. Weeks 2-6 generate lazily on previous-week-completion (via existing `generateNextWeekPool` or `runWeeklyRecoveryCheck` pathways). Athlete sees concrete week 1 sessions in the preview before committing; future weeks remain responsive to recovery state.

### Coach weighting (option A primary + C escape)

Archetype picker is the primary control. Selecting an archetype populates the head-coach prompt's "athlete's requested emphasis" section with a default per-coach session-count distribution. Selecting "Custom" reveals per-coach session-count steppers (no two-a-day cap; the head coach can flag absurd inputs).

The athlete's distribution is a *hint* to the head coach — soft constraint with permission to bias ±1 session per coach if recovery/load math demands it. Hard constraints feel coercive when the head coach is supposed to be a coach, not a mailbox.

### Wizard layout (single-page step 1)

Step 1 has all decisions stacked on one scrolling page. Sections (top to bottom): header (live-updates with archetype + duration) → retrospective summary tile (post-block mode only) → carryover summary or availability form (mode-conditional) → archetype picker → duration selector → Generate Plan CTA.

Step 2 is a separate render of the same component (state-driven, no route change): generation progress while AI runs, then strategy summary + week 1 session pool with Edit/Regenerate/Approve buttons.

## Routes & entry surface

**Route:** `/data/blocks/new` — server component page that loads `getLatestBlockRetrospective()` + `getPendingPlannerNotes()` server-side, hands them to the wizard client component as props.

**Entry surfaces:**

| Surface | Trigger | Mode |
|---|---|---|
| Dashboard empty state | Replace "BLOCK 2 WIZARD SHIPS NEXT" copy with a button → `/data/blocks/new` | post-block |
| Onboarding flow | Last onboarding step's "Finish" redirects to `/data/blocks/new` (after `completeOnboarding` does profile-only update) | first-block |
| Post-close redirect | After reality-check submit at `/data/blocks/[id]/reality-check`, redirect to `/data/blocks/new` instead of dashboard | post-block |
| Direct URL | Land on wizard | mode auto-detected |

**Mode detection:** `mode = retrospective ? 'post-block' : 'first-block'`. Wizard sections show/hide accordingly.

## Wizard component

`<BlockCreationWizard>` — single client component, conditional sections by mode.

### State shape

```ts
interface WizardState {
    mode: 'first-block' | 'post-block'
    archetype: 'hypertrophy' | 'strength' | 'endurance_event' | 'conditioning' | 'hybrid' | 'custom'
    customCounts?: Record<CoachDomain, number>
    durationWeeks: 4 | 6 | 8
    carryover: {
        daysPerWeek: number
        sessionMinutes: number
        warmupMinutes: number
        cooldownMinutes: number
        freeText: string
    }
    step: 'review' | 'preview'
    mesocycleId?: string
    previewResult?: {
        strategy: MesocycleStrategyValidated
        week1Pool: SessionInventory[]
    }
}
```

### Step 1 sections

| Section | Component | Visible | Source data |
|---|---|---|---|
| Header | `<WizardHeader>` | always | live from `archetype + durationWeeks` |
| Retrospective tile | `<RetrospectiveSummaryTile>` | post-block | `getLatestBlockRetrospective()` |
| Carryover summary (read-only) | `<CarryoverSummary>` | post-block | `getPendingPlannerNotes()` |
| Carryover edit modal | reuses `<RealityCheckForm>` from sub-project B | on click "Edit" | same |
| Availability form | `<AvailabilityForm>` | first-block | profile data + reasonable defaults |
| Archetype picker | `<ArchetypePicker>` | always | local state |
| Custom session-count steppers | `<SessionCountSteppers>` | only when `archetype === 'custom'` | `customCounts` |
| Duration selector | `<DurationSelector>` | always | local state |
| Generate Plan CTA | `<GeneratePlanButton>` | always | calls `createBlockShell` then `runHeadCoachStrategy` then `generateSessionPool` |

### Archetype defaults map

```ts
const ARCHETYPE_DEFAULTS: Record<Archetype, Record<CoachDomain, number>> = {
    hypertrophy:     { hypertrophy: 3, strength: 2, conditioning: 1, endurance: 0, mobility: 2 },
    strength:        { hypertrophy: 1, strength: 4, conditioning: 1, endurance: 0, mobility: 2 },
    endurance_event: { hypertrophy: 0, strength: 2, conditioning: 1, endurance: 4, mobility: 2 },
    conditioning:    { hypertrophy: 1, strength: 2, conditioning: 4, endurance: 1, mobility: 2 },
    hybrid:          { hypertrophy: 2, strength: 2, conditioning: 2, endurance: 1, mobility: 2 },
    custom:          { /* athlete-specified via SessionCountSteppers */ },
}
```

These are hints. The head coach receives the requested distribution + the athlete's load budget and produces final `domainAllocations` (may bias ±1 per coach).

### Step 2 plan preview

```
┌─────────────────────────────────────────────────────────────┐
│  Block 2: Hypertrophy · 6 weeks                             │
│  ← Edit plan        [ Regenerate ]    [ Approve & start ]   │
├─────────────────────────────────────────────────────────────┤
│  HEAD COACH STRATEGY                                        │
│  Per-coach session count bars (Hypertrophy 3, Strength 2…)  │
│  Weekly arc table (Wk1-2 accumulation, Wk3-4 intens, …)     │
│  Head coach narrative quoting carryover & retrospective     │
├─────────────────────────────────────────────────────────────┤
│  WEEK 1 — ACCUMULATION                                      │
│  Day-by-day session list with title, duration, RIR/RPE      │
│  Footer: "Weeks 2-6 generate as you progress"               │
└─────────────────────────────────────────────────────────────┘
```

### Step transitions

| Trigger | Effect |
|---|---|
| Generate Plan (step 1) | `createBlockShell` → `runHeadCoachStrategy` → `generateSessionPool(week1MicrocycleId)` → step 2 |
| Edit plan ← (step 2) | Discard strategy + week 1 inventory; back to step 1 with state preserved |
| Regenerate (step 2) | `regenerateBlockPlan(mesocycleId)` (clears strategy + week 1, reruns); stays on step 2 with new result |
| Approve & start (step 2) | `approveBlockPlan(mesocycleId)` (sets `is_active=true`, sets `block_pointer`, calls `clearPendingPlannerNotes`); redirect to `/dashboard` |

If generation fails at either AI call: wizard returns to step 1 with the error visible and all input preserved.

## Backend changes

### New server actions

| Action | Location | Purpose |
|---|---|---|
| `runHeadCoachStrategy(mesocycleId)` | `src/lib/engine/mesocycle/strategy-generation.ts` | Auth check; loads `buildAthleteContext` (now retrospective-aware); builds head-coach prompt; calls `generateStructuredResponse(MesocycleStrategySchema)`; persists strategy to `mesocycle.ai_context_json`. Returns the validated strategy. |
| `createBlockShell(input)` | `src/lib/engine/mesocycle/create-shell.ts` | Auth check; inserts `mesocycles` row (`is_active=false, is_complete=false`) with name `${archetype.toUpperCase()} Block ${blockNumber}` where blockNumber = (count of mesocycles for user) + 1; scaffolds 6 microcycles; returns `{ mesocycleId }`. Also writes `archetype` + `customCounts` + `carryover` into `ai_context_json` for prompt construction. |
| `approveBlockPlan(mesocycleId)` | `src/lib/engine/mesocycle/approve.ts` | Auth check; flips `is_active=true`; sets `block_pointer.next_training_day` to (week 1, day 1); calls `clearPendingPlannerNotes()`; revalidates `/dashboard`. |
| `regenerateBlockPlan(mesocycleId)` | `src/lib/engine/mesocycle/regenerate.ts` | Auth check; clears `mesocycle.ai_context_json.strategy`; deletes week 1 `session_inventory` rows; re-runs `runHeadCoachStrategy` + `generateSessionPool`. |

### Extended action

`buildAthleteContext(userId, mesocycleId, weekNumber)` in `src/lib/engine/mesocycle/context.ts` — extended to load `block_retrospectives` (latest by `created_at` desc, `user_id` matches) and `profiles.pending_planner_notes`. Both surface in the returned `AthleteContextPacket` as new optional fields:

```ts
interface AthleteContextPacket {
    // ...existing fields...
    latestBlockRetrospective?: BlockRetrospectiveSnapshot | null
    pendingPlannerNotes?: PendingPlannerNotes | null
}
```

### Head-coach prompt extension

`buildMesocycleStrategySystemPrompt` and `buildMesocycleStrategyUserPrompt` (in `src/lib/ai/prompts/head-coach.ts`) extend to render four new sections in the user prompt:

1. **"Last block's actuals"** (post-block only): adherence overall + by-coach-domain, top recalibrations (count + sample), top interventions (count + sample), missed-session count. Instruction: "Use this to inform domain emphasis and load — what worked, what didn't."

2. **"Athlete's stated reality"** (post-block only): days/week, session minutes, warm-up minutes, cooldown minutes, free text. Instruction: "Treat these as authoritative. Effective working time per session is `sessionMinutes − warmupMinutes − cooldownMinutes`. Total weekly load budget is `daysPerWeek × effectiveTime`. Plan within this budget."

3. **"Athlete's availability"** (first-block only): same fields as #2, sourced from the wizard's availability form. Same instructions.

4. **"Athlete's requested emphasis"** (always): per-coach session counts from `ARCHETYPE_DEFAULTS[archetype]` or `customCounts`. Instruction: "The athlete is requesting this distribution. Use it as a hint; you may bias up or down by ±1 session per coach if recovery/load math demands it, but prefer the athlete's expressed intent."

### Per-week generation extension

`generateSessionPool(microcycleId)` in `src/lib/engine/microcycle/generate-pool.ts` — extends to read `mesocycle.ai_context_json.strategy` for the parent mesocycle. Calls `extractWeekBrief(strategy, coachType, weekNumber)` (already exists in `engine/mesocycle/strategy.ts`) and passes the relevant `weekBrief` into each per-coach prompt as additional context.

This is the load-bearing change to existing engine code: per-week generation stops generating in isolation. Each week's domain coaches see the head-coach's budget for that week.

If `mesocycle.ai_context_json.strategy` is null (legacy block created before D shipped — Block 1), `generateSessionPool` falls back to its current behavior (no weekBrief context). Backward-compatible.

## Onboarding refactor

Today, `completeOnboarding(benchmarkPath)` does five things:
1. Profile update + `onboarding_completed_at` timestamp
2. Mesocycle insert
3. Microcycle scaffold
4. Fire-and-forget `generateMesocycleInventory`
5. Redirect to `/dashboard`

Refactored:
1. Profile update + `onboarding_completed_at` timestamp
2. Return `{ success: true }`

Steps 2-4 move into the wizard's actions. Step 5 changes: onboarding page's "Finish" handler now does `await completeOnboarding(benchmarkPath)` then `router.push('/data/blocks/new')`.

The first-time user goes through the wizard with `mode='first-block'`. They see the archetype picker for the first time and pick their first block goal.

### Mesocycle name template change

Today: `${goal} Block 1` where goal = `HYBRID_PEAKING` etc. (mapped from `goal_archetype`).
After D: `${archetype.toUpperCase()} Block ${blockNumber}` where archetype is the wizard pick and blockNumber is per-user mesocycle count + 1.

Block 1's existing row stays at its existing name (no migration). New rows use the new template.

## Orphan-block lifecycle

`createBlockShell` writes a `mesocycles` row before the AI pipeline runs. If the athlete abandons mid-flight:

| Event | Action |
|---|---|
| Tab closed during generation | Row stays `is_active=false, is_complete=false`. Resume detection at next `/data/blocks/new` visit prompts: "you started planning Block N on \<date\>, continue or start fresh?" |
| Edit plan ← clicked | Strategy + week 1 inventory cleared via `regenerateBlockPlan` cleanup helpers (without immediately re-running). Mesocycle row stays. Same row reused on next Generate. |
| Regenerate clicked | Same cleanup, then immediately re-runs strategy + week 1. |
| Approve clicked | Row becomes active; flow ends. |

`createBlockShell` is called once per wizard session. The wizard tracks `mesocycleId` in client state; subsequent operations (regenerate, approve) operate on the existing row.

No cron cleanup. Orphans persist until resumed or discarded. Single-user practical limit ≈ 1-2 orphans ever; acceptable.

## Testing

### Unit tests (vitest, mocked Supabase)

| Test file | Coverage |
|---|---|
| `src/lib/engine/mesocycle/__tests__/strategy-generation.test.ts` | `runHeadCoachStrategy` — auth check; passes retrospective + carryover into prompt; persists strategy to mesocycle row; surfaces AI errors |
| `src/lib/engine/mesocycle/__tests__/create-shell.test.ts` | `createBlockShell` — auth check; writes mesocycle + 6 microcycles; correct `start_date` (next Monday); name template; archetype + customCounts persisted to `ai_context_json` |
| `src/lib/engine/mesocycle/__tests__/approve.test.ts` | `approveBlockPlan` — auth check; flips `is_active=true`; calls `clearPendingPlannerNotes`; sets `block_pointer.next_training_day = (week 1, day 1)` |
| `src/lib/engine/mesocycle/__tests__/regenerate.test.ts` | `regenerateBlockPlan` — auth check; clears `ai_context_json` strategy; deletes week 1 inventory; re-runs strategy + week 1 |
| `src/lib/engine/mesocycle/__tests__/build-athlete-context.test.ts` (extension to existing) | Extended `buildAthleteContext` reads `block_retrospectives` + `pending_planner_notes`; includes them in returned packet |
| `src/components/__tests__/BlockCreationWizard.test.tsx` | Component-level: mode detection (first-block vs post-block); archetype selection updates state; custom mode unlocks steppers; Generate button calls server actions in order; Edit/Regenerate/Approve transitions |

All tests use the existing `vi.hoisted` + `vi.mock('@/lib/supabase/server')` pattern.

### Integration tests

None. Per project memory, never run destructive integration tests against the live user.

### Playwright e2e (committed but not runnable)

`tests/e2e/block-creation-wizard.spec.ts` — three scenarios:
1. First-block flow: onboarding finish → wizard `mode='first-block'` → archetype hypertrophy → 6 wk → generate → approve → dashboard active.
2. Post-block flow: dashboard CTA → wizard with retrospective + carryover → archetype + duration → generate → preview shows head-coach narrative referencing reality-check inputs → approve → `pending_planner_notes` cleared.
3. Resume flow: create shell, abandon, reopen wizard → resume prompt → discard → new shell.

Same convention as Plan 2 / Plan 3 / sub-projects A & B.

### Verification gates

- `npx tsc --noEmit` no NEW errors after every commit.
- `npm test` all tests passing.
- `npm run build` clean (Vercel preview build, given local-package gaps).
- **Manual smoke (REQUIRED before claiming done):**
  1. Open preview → click "Start Block 2" from dashboard.
  2. Confirm retrospective tile shows Block 1 actuals (21/51 = 41%).
  3. Confirm carryover read-only shows your reality-check answers (6 days, 75 min, 20 warm-up, 0 cooldown).
  4. Pick **Hypertrophy**, leave 6 weeks default.
  5. Click Generate Plan; confirm progress label transitions strategy → week 1.
  6. Confirm preview shows: per-coach session bars, weekly arc, head-coach narrative, week 1 session list with actual sessions.
  7. Confirm narrative explicitly references reality-check answers ("75-min budget" / "20-min warm-up" or similar).
  8. Click Approve & start; land on dashboard with Block 2 active.
  9. Verify in DB: new `mesocycles` row with `is_active=true, ai_context_json.strategy` populated; 6 `microcycles` rows; `session_inventory` rows for week 1 only; `block_pointer` updated; `profiles.pending_planner_notes` is null.

This manual smoke is also the AI-action smoke deferred from sub-project C — D's first run exercises `generateSessionPool` end-to-end.

## Risks

| Risk | Mitigation |
|---|---|
| Head-coach AI ignores athlete's archetype hint | Prompt instructs "honor athlete intent within ±1 session per coach." If routinely violated, tighten prompt or add post-hoc validator warning. |
| `MesocycleStrategySchema` field shapes don't fit UI cleanly | Schema returns structured `domainAllocations[]` and `weeklyEmphasis[]` — direct fits for preview. `programRationale` exists for narrative. Reassess during execution if mismatch surfaces. |
| Athlete in Custom mode sets total session count > weekly budget | Stepper UI shows running total vs budget; CTA disables with "Total exceeds budget" hint. |
| Generation takes >40 sec and athlete refreshes | `runHeadCoachStrategy` is idempotent at the strategy layer (skip if `ai_context_json.strategy` exists). Week 1 generation is also resumable (skip if `session_inventory` rows exist for week 1). |
| Onboarding refactor breaks first-time-user flow | First-block mode is mode-detected by absence of retrospective. New tests cover both modes. |
| Block 1's existing mesocycle name no longer matches new template | Names diverge (`HYBRID_PEAKING Block 1` vs new `HYPERTROPHY Block 2`). Acceptable — no migration. |
| Per-week generation breaks for legacy Block 1 (no strategy in `ai_context_json`) | `generateSessionPool` falls back to no-weekBrief behavior when strategy is null. Backward-compatible. |

## Open questions (resolved during execution if non-blocking)

1. **`MesocycleStrategySchema` minor shape adjustments.** If during execution the head-coach output isn't quite the right shape for UI consumption (e.g., `weeklyEmphasis[].emphasis` is too verbose to render in a grid), schema adjustments may be needed. Scope into D as a single migration if so.

2. **Onboarding's `availability` form fields source.** Profile may not currently store `session_minutes_target` etc. reliably. Wizard's availability form will write these values to `pending_planner_notes` (or a new field?) so they're available for next block. Confirm during execution; if no profile fields exist, the wizard becomes the canonical source going forward.

3. **`ARCHETYPE_DEFAULTS` calibration.** The default per-coach distributions per archetype are starting values. May get tuned post-Block-2 based on actual head-coach output.

4. **Resume detection edge cases.** If a user has multiple inactive incomplete mesocycles, prompt only resumes the most recent. Older ones are silently abandoned.

## Dependencies

- Sub-project A (shipped) — provides `getLatestBlockRetrospective`, `block_retrospectives` table.
- Sub-project B (shipped) — provides `getPendingPlannerNotes`, `clearPendingPlannerNotes`, `pending_planner_notes` field, `<RealityCheckForm>` component.
- Sub-project C (shipped) — provides clean `engine/mesocycle/` surface, `extractWeekBrief` helper, head-coach prompt builders.

## Out-of-scope items flagged for future sub-projects

- **Manual session editor** — change a session's movement / rep scheme without re-calling AI. Steven flagged this during D's brainstorm as a future capability that would reduce regenerate frequency. Filed for post-D.
- **Full multi-coach orchestrator** — option (c) from the brainstorm: deterministic programs-to-inventory translator, all 6 weeks generated up front. Would activate the full dormant `generateMesocycleProgram` pipeline. Filed as candidate "Block 3 architecture" sub-project once the head-coach strategy approach proves out across one block.
- **Multi-block planning** — wizard for chaining 2+ blocks ahead. Out of scope.
- **Block 1's name backfill** — leave the existing row's name as-is. No migration.
