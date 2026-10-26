'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { AthleteInjury } from '@/lib/types/database.types'
import type { ActionResult } from '@/lib/types/training.types'

// athlete_injuries was writable only from onboarding, so a return-from-illness
// note stayed active — and was read as current by every planner — long after
// the athlete was back to full training. The block wizard now lists active
// injuries and lets the athlete resolve them before the head coach plans.

export async function getActiveInjuries(): Promise<ActionResult<AthleteInjury[]>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    const { data, error } = await supabase
        .from('athlete_injuries')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
    if (error) return { success: false, error: error.message }
    return { success: true, data: data ?? [] }
}

export async function resolveInjury(injuryId: string): Promise<ActionResult<void>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    const { data, error } = await supabase
        .from('athlete_injuries')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', injuryId)
        .eq('user_id', user.id)
        .select('id')
    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) return { success: false, error: 'Injury not found' }

    revalidatePath('/data/blocks/new')
    return { success: true, data: undefined }
}
