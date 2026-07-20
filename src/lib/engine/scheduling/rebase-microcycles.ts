/**
 * Applies `computeMicrocycleRebase` to the database.
 *
 * Non-action helper (no 'use server') — takes a caller-supplied authenticated
 * client, in the style of `engine/microcycle/persistence.ts`.
 *
 * Called before a week is generated or allocated so the week the athlete is
 * actually about to train is anchored to today rather than to whatever calendar
 * fortnight the block shell assigned it weeks ago.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import {
    computeMicrocycleRebase,
    type MicrocycleWindow,
} from '@/lib/scheduling/microcycle-rebase'

type Supa = SupabaseClient<Database>

export interface RebaseResult {
    /** Weeks whose date window moved. Empty when the grid was already current. */
    shiftedWeeks: number[]
    /** Non-completed workouts whose scheduled_date was re-derived. */
    rescheduledWorkouts: number
}

/**
 * Anchor `weekNumber` to today and carry later weeks along.
 *
 * Also re-derives `scheduled_date` on the shifted weeks' workouts, preserving
 * each workout's day offset within its week. Completed workouts are never
 * touched — their date is a record of when training actually happened.
 *
 * Errors are surfaced to the caller rather than swallowed: a silent failure here
 * puts sessions back in the past, which is the bug this exists to fix.
 */
export async function rebaseMicrocyclesFromWeek(
    supabase: Supa,
    userId: string,
    mesocycleId: string,
    weekNumber: number,
    today: string = new Date().toISOString().split('T')[0],
): Promise<{ ok: true; result: RebaseResult } | { ok: false; error: string }> {
    const { data: rows, error: readErr } = await supabase
        .from('microcycles')
        .select('id, week_number, start_date, end_date')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', userId)
        .order('week_number', { ascending: true })

    if (readErr) return { ok: false, error: readErr.message }
    if (!rows?.length) return { ok: false, error: 'No microcycles for mesocycle' }

    const windows: MicrocycleWindow[] = rows.map(r => ({
        weekNumber: r.week_number,
        startDate: r.start_date,
        endDate: r.end_date,
    }))

    const shifted = computeMicrocycleRebase(windows, weekNumber, today)
    if (shifted.length === 0) {
        return { ok: true, result: { shiftedWeeks: [], rescheduledWorkouts: 0 } }
    }

    const idByWeek = new Map(rows.map(r => [r.week_number, r.id]))
    const oldStartByWeek = new Map(rows.map(r => [r.week_number, r.start_date]))
    let rescheduled = 0

    for (const w of shifted) {
        const microcycleId = idByWeek.get(w.weekNumber)
        if (!microcycleId) continue

        const { error: updErr } = await supabase
            .from('microcycles')
            .update({ start_date: w.startDate, end_date: w.endDate })
            .eq('id', microcycleId)
            .eq('user_id', userId)
        if (updErr) {
            return { ok: false, error: `week ${w.weekNumber}: ${updErr.message}` }
        }

        // Carry this week's not-yet-done workouts along, preserving each one's
        // offset from the week start so the intra-week ordering survives.
        const oldStart = oldStartByWeek.get(w.weekNumber)
        if (!oldStart) continue

        const { data: workouts, error: wErr } = await supabase
            .from('workouts')
            .select('id, scheduled_date')
            .eq('microcycle_id', microcycleId)
            .eq('user_id', userId)
            .eq('is_completed', false)
        if (wErr) return { ok: false, error: `week ${w.weekNumber} workouts: ${wErr.message}` }

        for (const wk of workouts ?? []) {
            if (!wk.scheduled_date) continue
            const offsetDays = Math.round(
                (Date.parse(wk.scheduled_date) - Date.parse(oldStart)) / 86_400_000,
            )
            const nextDate = new Date(
                Date.parse(w.startDate) + offsetDays * 86_400_000,
            ).toISOString().split('T')[0]

            const { error: schedErr } = await supabase
                .from('workouts')
                .update({ scheduled_date: nextDate })
                .eq('id', wk.id)
                .eq('user_id', userId)
            if (schedErr) {
                return { ok: false, error: `workout ${wk.id}: ${schedErr.message}` }
            }
            rescheduled++
        }
    }

    // NOTE: `mesocycles.end_date` is deliberately NOT updated here — it is a
    // generated column (`start_date + (week_count * 7 - 1)`) and Postgres rejects
    // any write to it. Moving it would mean moving the block's `start_date`,
    // which is real history: the block did begin when it began.
    //
    // Consequence: after a rebase the block's stored end_date sits earlier than
    // its last microcycle, so the close-block nudge (which fires on
    // `today > end_date`) can prompt early. The nudge's other condition — all
    // sessions resolved — is the accurate one; keying it solely off that is the
    // real fix and is tracked separately.
    return {
        ok: true,
        result: {
            shiftedWeeks: shifted.map(w => w.weekNumber),
            rescheduledWorkouts: rescheduled,
        },
    }
}
