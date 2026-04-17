'use server'

/**
 * Block pointer helpers — INTERNAL to server actions.
 *
 * These functions throw on auth/DB errors rather than returning ActionResult
 * envelopes. They are called by other server actions (completeWorkout,
 * allocateWeek), never directly from components. Top-level actions are
 * responsible for catching and wrapping errors into user-facing results.
 *
 * Race note: `advanceBlockPointer` reads-then-writes without a transaction.
 * Two concurrent advances in the same week could result in a single skip.
 * Acceptable today (no concurrent advance path exists). If needed later,
 * replace with `UPDATE ... SET next_training_day = LEAST(next_training_day + 1, $cap)`.
 */

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database.types'

type BlockPointer = Database['public']['Tables']['block_pointer']['Row']

/** Max sessions per training week across current programming (strength + conditioning + mobility etc.). */
const DEFAULT_SESSIONS_PER_WEEK = 7

/** When `next_training_day` exceeds sessions-in-week, the week is considered complete. */

export async function initBlockPointer(
    mesocycleId: string,
    weekNumber: number
): Promise<BlockPointer> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const { data, error } = await supabase
        .from('block_pointer')
        .upsert(
            {
                user_id: user.id,
                mesocycle_id: mesocycleId,
                week_number: weekNumber,
                next_training_day: 1
            },
            { onConflict: 'user_id,mesocycle_id,week_number' }
        )
        .select()
        .single()
    if (error) throw error
    return data
}

export async function getBlockPointer(
    mesocycleId: string,
    weekNumber: number
): Promise<BlockPointer> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const { data, error } = await supabase
        .from('block_pointer')
        .select('*')
        .eq('user_id', user.id)
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', weekNumber)
        .maybeSingle()
    if (error) throw error
    return data ?? (await initBlockPointer(mesocycleId, weekNumber))
}

export async function advanceBlockPointer(
    mesocycleId: string,
    weekNumber: number,
    opts: { sessionsInWeek?: number } = {}
): Promise<BlockPointer> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const cap = (opts.sessionsInWeek ?? DEFAULT_SESSIONS_PER_WEEK) + 1
    const pointer = await getBlockPointer(mesocycleId, weekNumber)
    const nextVal = Math.min(pointer.next_training_day + 1, cap)

    const { data, error } = await supabase
        .from('block_pointer')
        .update({ next_training_day: nextVal, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', weekNumber)
        .select()
        .single()
    if (error) throw error
    return data
}
