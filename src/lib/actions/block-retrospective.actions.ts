'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildBlockRetrospectiveSnapshot } from '@/lib/analytics/block-retrospective'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'
import type { ActionResult } from '@/lib/types/training.types'

export async function closeMesocycle(
  mesocycleId: string,
): Promise<ActionResult<{ retrospectiveMesocycleId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Pre-check: mesocycle exists, owned by user, not already closed.
  const { data: meso } = await supabase
    .from('mesocycles')
    .select('id, is_active, is_complete')
    .eq('id', mesocycleId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!meso) return { success: false, error: 'Block not found' }
  if (meso.is_complete) return { success: false, error: 'Block already closed' }

  // Pre-check: retrospective doesn't already exist (UNIQUE catches it,
  // but the friendly error is nicer).
  const { data: existing } = await supabase
    .from('block_retrospectives')
    .select('id')
    .eq('mesocycle_id', mesocycleId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) return { success: false, error: 'Block already closed' }

  // Build snapshot (TS pure assembler).
  let snapshot: BlockRetrospectiveSnapshot
  try {
    snapshot = await buildBlockRetrospectiveSnapshot(mesocycleId)
  } catch (e) {
    return { success: false, error: `Failed to build retrospective snapshot: ${(e as Error).message}` }
  }

  // Atomic close via RPC.
  try {
    await supabase.rpc('close_mesocycle', {
      p_mesocycle_id: mesocycleId,
      p_snapshot: snapshot as unknown as Record<string, unknown>,
    })
  } catch (e) {
    const msg = (e as Error).message
    return { success: false, error: msg.includes('already closed') ? 'Block already closed' : msg }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/data/blocks/${mesocycleId}/retrospective`)
  return { success: true, data: { retrospectiveMesocycleId: mesocycleId } }
}

export async function getLatestBlockRetrospective(): Promise<ActionResult<BlockRetrospectiveSnapshot | null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('block_retrospectives')
    .select('snapshot')
    .eq('user_id', user.id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ? (data.snapshot as unknown as BlockRetrospectiveSnapshot) : null }
}

export async function getBlockRetrospective(
  mesocycleId: string,
): Promise<ActionResult<BlockRetrospectiveSnapshot | null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('block_retrospectives')
    .select('snapshot')
    .eq('user_id', user.id)
    .eq('mesocycle_id', mesocycleId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ? (data.snapshot as unknown as BlockRetrospectiveSnapshot) : null }
}
