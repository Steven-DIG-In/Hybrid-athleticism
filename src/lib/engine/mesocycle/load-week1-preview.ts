'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types/training.types'

export interface Week1PreviewSession {
  id: string
  name: string
  modality: string
  duration_minutes: number | null
}

export interface LoadWeek1PreviewResult {
  microcycleId: string
  sessions: Week1PreviewSession[]
}

/**
 * Load the week-1 microcycle id + a slim preview of its sessions.
 *
 * `session_inventory` is keyed by `mesocycle_id` + `week_number` (no
 * `microcycle_id` column on this table). The microcycle lookup is done
 * separately so callers can pass the id to `generateSessionPool`.
 *
 * If session_inventory is empty (likely for a freshly-generated block where
 * only the `workouts` table has been written), we fall back to listing
 * the workouts for that microcycle. Workouts have no duration field, so
 * `duration_minutes` will be `null` in that case — the wizard typically
 * sources durations from the `sessionPool` returned by `generateSessionPool`
 * directly.
 */
export async function loadWeek1Preview(
  mesocycleId: string,
): Promise<ActionResult<LoadWeek1PreviewResult>> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { success: false, error: 'Not authenticated' }

  // Find the week-1 microcycle (callers need this id to invoke generateSessionPool)
  const { data: micro, error: microErr } = await supabase
    .from('microcycles')
    .select('id')
    .eq('mesocycle_id', mesocycleId)
    .eq('week_number', 1)
    .eq('user_id', user.id)
    .single()
  if (microErr || !micro) return { success: false, error: 'Week 1 microcycle not found' }

  // Try session_inventory first (has estimated_duration_minutes)
  const { data: invRows, error: invErr } = await supabase
    .from('session_inventory')
    .select('id, name, modality, estimated_duration_minutes, training_day')
    .eq('mesocycle_id', mesocycleId)
    .eq('week_number', 1)
    .eq('user_id', user.id)
    .order('training_day', { ascending: true, nullsFirst: false })

  if (invErr) return { success: false, error: invErr.message }

  if (invRows && invRows.length > 0) {
    const sessions: Week1PreviewSession[] = invRows.map(r => ({
      id: r.id,
      name: r.name,
      modality: r.modality,
      duration_minutes: r.estimated_duration_minutes,
    }))
    return { success: true, data: { microcycleId: micro.id, sessions } }
  }

  // Fallback: list workouts for this microcycle (no duration available)
  const { data: workoutRows, error: workoutErr } = await supabase
    .from('workouts')
    .select('id, name, modality')
    .eq('microcycle_id', micro.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (workoutErr) return { success: false, error: workoutErr.message }

  const sessions: Week1PreviewSession[] = (workoutRows ?? []).map(w => ({
    id: w.id,
    name: w.name,
    modality: w.modality,
    duration_minutes: null,
  }))

  return { success: true, data: { microcycleId: micro.id, sessions } }
}
