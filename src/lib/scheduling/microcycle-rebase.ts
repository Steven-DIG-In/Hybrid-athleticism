/**
 * Microcycle calendar rebasing.
 *
 * `createBlockShell` lays a block's weeks down as N consecutive calendar weeks
 * from the block start date, and nothing ever reconciled that grid with reality.
 * An athlete who falls two weeks behind — entirely normal — ends up with a
 * program week 2 permanently defined as some fortnight in the past. Two
 * consequences, both observed live:
 *
 *   1. The dashboard picks the week to display by asking which microcycle's date
 *      range contains today, so it lands on an empty future week and the athlete
 *      has to navigate backwards to find the week they're actually on.
 *   2. `applyAllocation` anchors `scheduled_date` on the microcycle's frozen
 *      `start_date`, so freshly generated sessions get dated into the past.
 *
 * Rebasing fixes both at the source: the stored dates become true rather than
 * aspirational, so the existing date lookups start giving the right answer.
 * Program weeks float; calendar weeks don't.
 *
 * Pure module — no I/O. All arithmetic is on `YYYY-MM-DD` strings in UTC, which
 * matches how the rest of the scheduling code stores and compares dates.
 */

export interface MicrocycleWindow {
    weekNumber: number
    startDate: string
    endDate: string
}

const MS_PER_DAY = 86_400_000

function addDays(isoDate: string, days: number): string {
    return new Date(Date.parse(isoDate) + days * MS_PER_DAY)
        .toISOString()
        .split('T')[0]
}

/**
 * Shift `fromWeekNumber` so it starts today, and carry every later week along by
 * the same delta. Earlier weeks are left alone — they are completed history and
 * their real dates matter.
 *
 * Only ever moves weeks FORWARD. A week that already starts today, or that is
 * still in the future, is left untouched: falling behind should reschedule the
 * plan, but being early should not drag it backwards.
 *
 * @returns only the windows that changed — empty when there is nothing to do,
 *          which makes the operation naturally idempotent.
 */
export function computeMicrocycleRebase(
    weeks: MicrocycleWindow[],
    fromWeekNumber: number,
    today: string,
): MicrocycleWindow[] {
    const anchor = weeks.find(w => w.weekNumber === fromWeekNumber)
    if (!anchor) return []

    const deltaDays = Math.round(
        (Date.parse(today) - Date.parse(anchor.startDate)) / MS_PER_DAY,
    )
    if (deltaDays <= 0) return []

    return weeks
        .filter(w => w.weekNumber >= fromWeekNumber)
        .map(w => ({
            weekNumber: w.weekNumber,
            startDate: addDays(w.startDate, deltaDays),
            endDate: addDays(w.endDate, deltaDays),
        }))
}
