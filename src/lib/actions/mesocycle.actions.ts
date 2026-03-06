'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, MesocycleWithWeeks } from '@/lib/types/training.types'
import type { Mesocycle } from '@/lib/types/database.types'

/**
 * Create a new training mesocycle (block) for the authenticated user.
 */
export async function createMesocycle(data: {
    name: string
    goal: Mesocycle['goal']
    weekCount: number
    startDate: string  // ISO date string YYYY-MM-DD
    aiContextJson?: Record<string, unknown>
}): Promise<ActionResult<Mesocycle>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Deactivate any currently active mesocycle
    await supabase
        .from('mesocycles')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true)

    const { data: mesocycle, error } = await supabase
        .from('mesocycles')
        .insert({
            user_id: user.id,
            name: data.name,
            goal: data.goal,
            week_count: data.weekCount,
            start_date: data.startDate,
            is_active: true,
            is_complete: false,
            ai_context_json: data.aiContextJson ?? null,
        })
        .select()
        .single()

    if (error) {
        console.error('[createMesocycle]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true, data: mesocycle }
}

/**
 * Fetch the user's currently active mesocycle with all of its microcycles.
 */
export async function getActiveMesocycle(): Promise<ActionResult<MesocycleWithWeeks | null>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: mesocycle, error } = await supabase
        .from('mesocycles')
        .select(`
      *,
      microcycles (
        *
      )
    `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('start_date', { referencedTable: 'microcycles', ascending: true })
        .maybeSingle()

    if (error) {
        console.error('[getActiveMesocycle]', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: mesocycle as MesocycleWithWeeks | null }
}

/**
 * Fetch a specific mesocycle by ID with all microcycles and their workouts.
 */
export async function getMesocycleById(id: string): Promise<ActionResult<MesocycleWithWeeks>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: mesocycle, error } = await supabase
        .from('mesocycles')
        .select(`
      *,
      microcycles (
        *,
        workouts (*)
      )
    `)
        .eq('id', id)
        .eq('user_id', user.id)  // RLS also enforces this, but explicit for clarity
        .single()

    if (error) {
        console.error('[getMesocycleById]', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: mesocycle as MesocycleWithWeeks }
}

/**
 * Mark a mesocycle as complete.
 */
export async function completeMesocycle(id: string): Promise<ActionResult<Mesocycle>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: mesocycle, error } = await supabase
        .from('mesocycles')
        .update({
            is_active: false,
            is_complete: true,
            completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

    if (error) {
        console.error('[completeMesocycle]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true, data: mesocycle }
}
