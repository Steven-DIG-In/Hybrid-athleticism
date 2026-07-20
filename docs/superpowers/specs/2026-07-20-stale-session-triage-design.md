# Stale Session Triage — Design

**Date:** 2026-07-20
**Status:** Approved (design approved without spec review at athlete's request)

## Problem

`session_inventory.status` has a `missed` value that the application cannot produce. The
only writer is the `close_mesocycle` RPC (`018_block_retrospectives.sql:80`), which sweeps
every remaining `pending` row to `missed` at block close. Mid-block there is no path.

`markMissed` (`inventory.actions.ts:1395`) and `rescheduleToToday` (`:1382`) were both
written and tested for exactly this, and neither has ever had a caller. The week-view card
already renders a missed state — greyed, with the copy *"Missed — drag to reschedule"*
(`WeekViewClient.tsx:133, :168`) — so the interaction was designed and then left
unreachable.

**Consequence.** Every consumer that classifies by status reads a value the app can't set:
`block-adherence.ts`, `off-plan-tally.ts`, `coach-bias.ts`, `BlockAdherenceHeatmap.tsx`,
`MissedSessionsList.tsx` and the block retrospective. Abandoned sessions stay `pending`
forever, so mid-block adherence is systematically optimistic and only becomes truthful at
block close, retroactively.

Yesterday's microcycle-rebase fix made this more visible: falling behind is normal, and
every week left behind strands another handful of permanently-pending sessions. The live
block has 5 such sessions in week 1.

## Scope

Give the athlete a way to mark stale sessions missed, and surface them so the backlog is
visible rather than silently inflating adherence.

### Explicitly out of scope

- **Cross-week moves.** `rescheduleToToday` cannot be wired as written — it only stamps
  `scheduled_date`, which is NULL on all 98 live rows and is not what places a session
  (`training_day` is). Making it real would mean a new week-number-changing operation.
  The athlete's stated behaviour is that a two-week-old session will not be carried into
  an already-populated week, so this machinery has no user. Within-week moves already
  work via `moveSessionToDay`, wired to the ⇄ control on session cards.
- "Did it but didn't log it" as a disposition — would need a new column and every
  downstream consumer taught to handle a completed-but-empty session.
- Retro-logging a past session.
- Automatic marking on any date or week rule. Nothing is ever marked without the athlete
  saying so.
- The close-block nudge firing early after a rebase (tracked separately).

## Definition of stale

A session is stale when **all** hold:

- it belongs to the active mesocycle
- `status = 'pending'`
- `week_number < currentWeekNumber`

The current week is never surfaced: a week is the athlete's unit of work, and they have
until they move on. Deliberately keyed on `week_number`, not on dates — coupling this to
`scheduled_date` would inherit the class of bug fixed on 2026-07-19.

Evaluated at dashboard render as a pure read. No cron, no background job — the same
approach as `evaluateOverrunSignal`.

## Components

### `selectStaleSessions` — pure

`src/lib/analytics/stale-sessions.ts`

```ts
export interface StaleCandidate {
    id: string
    name: string
    modality: string
    weekNumber: number
    trainingDay: number | null
    status: string
}

export function selectStaleSessions(
    sessions: StaleCandidate[],
    currentWeekNumber: number,
): StaleCandidate[]
```

Filters to `status === 'pending' && weekNumber < currentWeekNumber`, sorted by
`weekNumber` then `trainingDay` (nulls last) so the modal reads chronologically. Returns
`[]` when `currentWeekNumber <= 1`. Pure and fully unit-tested — this is the rule that
decides what the athlete is nagged about.

### `markSessionsMissed` — server action

`src/lib/actions/inventory.actions.ts`

```ts
export async function markSessionsMissed(
    sessionInventoryIds: string[],
): Promise<ActionResult<{ marked: number }>>
```

One `update ... in (...)` for both the single and bulk case. Replaces the single-id
`markMissed`, which is deleted rather than left as a second path to the same state.

Ownership is enforced with `.eq('user_id', user.id)` alongside the `.in()`. The result's
`error` is destructured and surfaced — no silent partial writes.

**The linked `workouts` row is deliberately kept.** Missed is recoverable: the week view
renders a missed card greyed with "drag to reschedule", and deleting the workout would
destroy the prescription behind it.

Empty array returns `{ marked: 0 }` without touching the database.

### `StaleSessionsBanner` — client component

`src/components/dashboard/StaleSessionsBanner.tsx`

Amber, positioned above the week view, following the convention set by
`CloseBlockNudgeBanner` and `OverrunSignalBanner`. Renders a count and a `[Review]`
control that opens the modal.

**No dismiss control.** The backlog is a real signal; a dismissal that hides it while it
persists is a lie. The banner disappears when the last stale session is dispositioned.
(`OverrunSignalBanner` dismisses to component-local `useState`, so it reappears on every
remount — that pattern is not copied here.)

### `StaleSessionsModal` — client component

`src/components/dashboard/StaleSessionsModal.tsx`

Sessions grouped by week, each row showing name, modality and the day it was scheduled
for. Actions:

- `[Missed]` per session
- `[Mark all N missed]`
- `[Leave for now]` — closes the modal, changes nothing

Uses `useTransition` + `router.refresh()`, matching `MoveSessionMenu`. Errors surface in
the modal rather than `console.error` — the athlete must know if the write failed.

## Data flow

```
dashboard/page.tsx
  └─ getDashboardData()            → sessions for the active block + currentWeekNumber
       └─ selectStaleSessions()    → StaleCandidate[]
            └─ <StaleSessionsBanner count>
                 └─ <StaleSessionsModal>
                      └─ markSessionsMissed(ids)
                           └─ session_inventory.status = 'missed'
                                └─ router.refresh() → banner recomputes, clears when empty
```

`getDashboardData` already loads the active mesocycle and resolves the current week. It
gains one query for pending sessions in earlier weeks of that block, returned on
`DashboardData` as `staleSessions`.

## Error handling

- `markSessionsMissed` destructures and returns the Supabase `error`. Nothing is reported
  as marked unless the write succeeded.
- The modal renders the error inline and leaves the sessions listed.
- A failed stale-session query on the dashboard degrades to no banner rather than breaking
  the page — but it is logged, and the query is checked rather than `?? []`-defaulted,
  so a failure cannot masquerade as an empty backlog.

## Testing

- `selectStaleSessions` — unit tests: earlier weeks only, current and future excluded,
  non-pending excluded, ordering, week 1 edge case, empty input.
- `markSessionsMissed` — `vi.mock` + `vi.hoisted` in-memory Supabase (pattern from
  `log-off-plan.test.ts`): single id, multiple ids, empty array is a no-op, DB error is
  surfaced, `user_id` scoping is applied.

No destructive tests against live rows: the single production athlete is actively
training and his data is production data.

## What this unblocks

`missed` becomes reachable outside block close, so `block-adherence`, `off-plan-tally`,
`coach-bias`, `BlockAdherenceHeatmap` and the block retrospective begin classifying against
a status the app can actually produce. Mid-block adherence stops being systematically
optimistic.
