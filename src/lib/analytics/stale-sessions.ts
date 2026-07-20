/**
 * Stale-session selection.
 *
 * `session_inventory.status` has always had a `missed` value that the app could
 * not produce: the only writer was the `close_mesocycle` RPC, which sweeps every
 * remaining pending row at block close. So a session the athlete abandoned in
 * week 1 stayed `pending` for the rest of the block, and mid-block adherence —
 * the heatmap, coach-bias, the retrospective — counted it as still to come.
 *
 * This is the rule that decides which sessions get surfaced for triage. It is
 * deliberately keyed on `week_number` rather than on dates: a week is the
 * athlete's unit of work, and coupling this to `scheduled_date` would inherit
 * the frozen-calendar bug class fixed on 2026-07-19.
 */

export interface StaleCandidate {
    id: string
    name: string
    modality: string
    weekNumber: number
    trainingDay: number | null
    status: string
}

/**
 * Pending sessions left behind in program weeks the athlete has already moved
 * past, ordered chronologically (week, then training day, unallocated last).
 *
 * The current week is never included — the athlete has until they move on.
 */
export function selectStaleSessions(
    sessions: StaleCandidate[],
    currentWeekNumber: number,
): StaleCandidate[] {
    return sessions
        .filter(s => s.status === 'pending' && s.weekNumber < currentWeekNumber)
        .slice()
        .sort((a, b) => {
            if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber
            // Unallocated sessions have no place in the week — list them last.
            const dayA = a.trainingDay ?? Number.MAX_SAFE_INTEGER
            const dayB = b.trainingDay ?? Number.MAX_SAFE_INTEGER
            return dayA - dayB
        })
}
