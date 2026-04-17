'use server'

import { createClient } from '@/lib/supabase/server'

export async function initBlockPointer(mesocycleId: string, weekNumber: number) {
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

export async function getBlockPointer(mesocycleId: string, weekNumber: number) {
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
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const cap = (opts.sessionsInWeek ?? 7) + 1
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
