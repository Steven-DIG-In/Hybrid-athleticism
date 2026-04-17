# Phase 3 — Agent Activity Log

**Date:** 2026-04-17
**Status:** Approved design, implementation pending
**Implementation order:** Third of three phases (Phase 2 → Phase 1 → **Phase 3**)
**Depends on:** Phase 2's `recalibration.actions.ts` and `agent_activity` write points; Phase 1's `coach-bias.ts` pattern detector.

> ⚠️ **Next.js 16 reminder:** Read `node_modules/next/dist/docs/` before writing code — breaking changes from prior versions.

---

## Purpose

Make the six AI coaches' work visible. Today they run silently — performance_deltas are written, recalibrations happen (Phase 2), interventions fire (Phase 1) — but the athlete has no unified place to see what each coach *did* and *why*.

Visibility builds trust in agent decisions and gives the athlete a place to audit the system when something feels off ("why is my metcon target suddenly easier this week?").

---

## Architecture

Hybrid surfacing (Q13, D): **unified feed + inline surfacing**.

- Unified feed at `/coach/activity` with three tabs:
  - **Inbox** — unreviewed interventions (evolved from current `/coach/` Weekly Review page).
  - **Decisions** — reverse-chronological log of every prescription-affecting or surfaced agent decision, with reasoning.
  - **Journals** — block-end coach-voice narratives, one per coach per completed block.
- **Inline surfacing** — decisions appear where they're relevant: `CoachNotesBanner` shows the most recent decision affecting the current session; `/data/` overview surfaces recent decisions beneath the tile grid.

Content model (Q12, C+D): **decisions with structured reasoning + block-end coach-voice journals**. Routine delta writes are deliberately silent — they're inputs to decisions, not decisions themselves, and they're already surfaced via Phase 1's adherence heatmap and domain delta charts.

---

## Components

### New

- `src/app/coach/activity/page.tsx` — tabbed surface (Inbox / Decisions / Journals). Query param `?tab=inbox` etc. for deep links.
- `src/components/coach/activity/`:
  - `ActivityFeed.tsx` — Decisions tab. Filterable by coach, date range, `trigger_type`. Each row: coach icon + one-line summary + expandable reasoning pane.
  - `JournalShelf.tsx` — Journals tab. One card per (coach × block). Coach-voice narrative body + link-out to the underlying decisions referenced.
  - `ActivityRow.tsx` — single decision row. Reused inline elsewhere.

### Evolved

- `src/app/coach/page.tsx` — current Weekly Review becomes the **Inbox tab** of `/coach/activity`. Either redirect `/coach` → `/coach/activity?tab=inbox` or collapse into one tabbed page. Recommend redirect to preserve bookmarks.
- `src/components/workout/CoachNotesBanner.tsx` — shows the most recent decision affecting this session inline (e.g., "Strength Coach: training max 140→132kg — tap to see why"). Tap opens an `ActivityRow` drawer.
- `src/app/data/page.tsx` (Phase 1's overview) — add a "Recent Decisions" mini-feed (last 3 decisions) beneath the tile grid. Low surface-area way to keep agent work visible on the main page.

### New server actions

`src/lib/actions/agent-activity.actions.ts`:

- `logDecision(coach, decisionType, targetEntity, reasoningStructured, reasoningText)` — called from recalibration, programming, check-in, pattern detection, inventory generation.
- `writeJournalEntry(coach, userId, blockId)` — fires on block completion via fan-out. Makes an LLM call to the coach with that block's decisions + deltas, writes narrative.
- `getActivityFeed({ userId, coach?, dateRange?, triggerType?, limit })` — paginated query.
- `getJournals({ userId, blockId? })` — returns journals for a block or all completed blocks.

### Write points (who calls `logDecision`)

- Phase 2's `recalibration.actions.ts` — on every tiered recalibration (<5%, 5–10%, >10%).
- Phase 1's `coach-bias.ts` pattern detector — when an intervention is fired.
- Existing `check-in.actions.ts` — when a check-in fires.
- `src/lib/actions/programming.actions.ts` — when next-block programming runs and makes coach-level decisions.
- `src/lib/actions/inventory-generation.actions.ts` — when session pool decisions are made that affect prescriptions (not routine inventory, only programming choices).

Routine delta writes are **not** logged — they're the input material. If the athlete wants to audit source deltas, Phase 1's heatmap and per-domain delta charts are the surface for that.

---

## Data model

**Migration:** `supabase/migrations/014_agent_activity.sql`

`agent_activity` is created in Phase 2's `012_training_day_model_cleanup.sql` (Phase 2 is the first writer). Phase 3 **extends** the table if needed and adds `coach_journals`.

```sql
-- agent_activity: already created in migration 012 (Phase 2). Confirm shape
-- matches Phase 3 usage; extend with any additional check constraints needed
-- for the full set of decision_type values Phase 3 consumers write.

-- Expected agent_activity shape (for reference; owned by Phase 2):
--   id uuid, user_id uuid, coach text, decision_type text,
--   target_entity jsonb, reasoning_structured jsonb, reasoning_text text,
--   block_id uuid, created_at timestamptz
-- with indexes on (user_id, created_at desc) and (user_id, coach, created_at desc).

-- Phase 3 may ALTER TABLE agent_activity to expand the decision_type check
-- constraint if Phase 2 didn't include all values:
--   ('recalibration','prescription_change','intervention_fired',
--    'check_in_triggered','block_programming','pool_adjustment')

create table coach_journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  coach text not null check (coach in
    ('strength','hypertrophy','endurance','conditioning','mobility','recovery','head')),
  block_id uuid not null references mesocycle_blocks(id),
  narrative text not null,
  decisions_referenced uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, coach, block_id)
);

create index agent_activity_block_idx on agent_activity(block_id) where block_id is not null;
```

**Decision: `block_pointer` vs pure denormalization.** `block_id` is denormalized onto `agent_activity` so block-scoped queries (e.g., "all decisions in the block this journal covers") don't require joining back through `target_entity`.

---

## Runtime flows

### Decision logging (example: recalibration)

```
recalibration.actions.ts (Phase 2) detects 5-10% drift:
  applyRecalibration(user, trainingMaxOld, trainingMaxNew)
  → agent-activity.actions.ts:logDecision({
      coach: 'strength',
      decisionType: 'recalibration',
      targetEntity: { type: 'training_max', lift: 'squat' },
      reasoningStructured: {
        previousMax: 140,
        newMax: 132,
        driftPct: 5.7,
        basedOnSessions: [sessionId1, sessionId2, sessionId3],
        threshold: '5-10%'
      },
      reasoningText: 'Training max: 140→132kg based on last 3 sessions (−5.7%)',
      blockId: currentBlockId
    })
```

### Journal writing (block completion)

```
Block completion hook:
  for each coach in [strength, hypertrophy, endurance, conditioning, mobility, recovery]:
    agent-activity.actions.ts:writeJournalEntry(coach, userId, blockId)
      → fetch decisions from agent_activity where coach=? and block_id=?
      → fetch block performance_deltas summary
      → LLM call (Claude Sonnet) with coach's persona + decisions + deltas
      → INSERT coach_journals row with narrative + decisions_referenced

6 coaches × 1 block every 4-6 weeks = ~60-80 LLM calls/year. Negligible cost.

Head coach gets a consolidated journal that references the other six.
```

### Activity feed load

```
/coach/activity?tab=decisions (Server Component)
  getActivityFeed({ userId, limit: 50 })
  render ActivityFeed with filter bar (coach, date range, trigger type)
  row click → expand reasoning pane (client-side state)
```

### Inline surfacing on workout

```
WorkoutLogger loads:
  → getActivityFeed({ userId, targetEntity: { type: 'workout', id: thisWorkoutId }, limit: 3 })
  → CoachNotesBanner shows latest decision ("Training max 140→132kg — tap to see why")
  → tap opens ActivityRow in drawer
```

### Inline on overview

```
/data/page.tsx (Phase 1):
  below tile grid:
    getActivityFeed({ userId, limit: 3 })
    render 3 most recent decisions as compact cards with "See all" link to /coach/activity
```

---

## Error handling

- **LLM failure during journal write**: row stays absent, UI shows "Journal pending — retry" button. Manual retry triggers another LLM call. Never auto-retry silently (could double-write).
- **`decisions_referenced` drift**: if a decision is deleted (shouldn't happen in practice, but) after a journal references it, `decisions_referenced` just fails to resolve on render; UI shows "Referenced decision unavailable."
- **Missing coach persona**: if a coach config changes mid-block, journal uses current persona. Historical journals stay as written.
- **Inbox auto-archive**: interventions older than one completed block are moved to history but not deleted. History view is part of the Inbox tab (collapsible "Archived" section).

---

## Testing

### Vitest units
- `logDecision` writes with all required fields; rejects invalid `coach` or `decision_type`.
- `getActivityFeed` filters (coach, date range, trigger type) return correct rows.
- `writeJournalEntry` idempotency: re-running for same (user, coach, block) respects UNIQUE constraint (updates or errors cleanly).
- Inline surfacing query (`targetEntity` filter) returns only decisions for that entity.

### Integration
- Phase 2 recalibration → `agent_activity` row written → visible in feed.
- Phase 1 pattern intervention → `agent_activity` row written → linked to intervention.
- Block completion → all 6 coaches get journal entries → head coach journal references others.
- Inline `CoachNotesBanner` shows latest decision for the current session only.

### E2E (Playwright, light)
- `/coach/activity` loads with three tabs; tab switching works.
- Decision row expand shows reasoning pane.
- Journal card renders narrative + decision links.

---

## Out of scope

- Multi-user activity (team coach viewing athlete activity).
- Export/share of activity history.
- LLM-based summarization of the feed ("what changed this week?") — deferred to a future phase.
- Routine delta writes in the feed — deliberately silent (covered by Phase 1's delta surfaces).
