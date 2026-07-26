# Backdated Workout Completion — Design

**Date:** 2026-07-26
**Status:** Shipped same day (small feature, design + implementation in one session)

## Problem

Steven sometimes does a session but forgets to log it, then completes it in the
app a day or more later. Completion always stamped "now", so the workout landed
on the wrong calendar day (and, before today's `effectiveCalendarDate` fix,
nowhere useful at all).

## Requirement (verbatim)

> "I might miss logging it but I did it. So need to either enter the date as
> today or select a day and time I actually completed it."

## Design

**Default unchanged:** completing a session with no extra input behaves exactly
as before — stamped at the current moment.

**Opt-in backdate:** both completion surfaces gain a `CompletedWhenPicker`:

- Lifting: inside the "End Workout?" confirmation modal.
- Metcon/cardio: in the results form above the Complete button.

The control shows "Just now" with an "I did this earlier" button; toggling
reveals a `datetime-local` input (max = now) plus a "Now" reset.

**API:** `completeWorkout(workoutId, duration, conditioningResult?, completedAt?)`
where `completedAt = { iso, localDate }`:

- `iso` — full timestamp of the picked moment.
- `localDate` — the athlete's local calendar day for that moment. Passed
  explicitly because only the client knows the timezone; the server never
  derives a date from the timestamp.

Server validation: reject timestamps in the future (5-minute clock-skew slack).

**Writes:** `workouts.completed_at`, `workouts.completed_date`,
`session_inventory.completed_at`, and `conditioning_logs.logged_at` all use the
picked moment, so a backdated completion is indistinguishable from one logged
live. Combined with `effectiveCalendarDate()` (shipped earlier today), the
workout renders greyed-out on the day picked.

## Alternatives considered

- **Post-hoc edit** of completion date from the dashboard card — more flexible
  (fixes mistakes after the fact) but a larger surface; deferred as a possible
  follow-up.
- **Date-only picker** — rejected; the requirement names day *and* time, and
  `completed_at` is a timestamp consumed by analytics.

## Testing

- `workout-completion-state.test.ts`: backdated `completedAt` propagates to
  workout + inventory payloads; future timestamps rejected.
- Existing default-path tests unchanged and passing (no-param behavior intact).
