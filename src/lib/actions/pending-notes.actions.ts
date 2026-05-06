'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  type PendingPlannerNotes,
  type PendingPlannerNoteSource,
  type AvailabilityAnswers,
  type SignalEvidence,
  mergePendingPlannerNotes,
} from '@/lib/types/pending-planner-notes.types'
import type { ActionResult } from '@/lib/types/training.types'

const FREE_TEXT_LIMIT = 200

export type SubmitRealityCheckInput = {
  source: PendingPlannerNoteSource
  availability?: AvailabilityAnswers
  freeText?: string
  signalEvidence?: SignalEvidence
}

export async function submitRealityCheck(
  input: SubmitRealityCheckInput,
): Promise<ActionResult<{ written: PendingPlannerNotes }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('pending_planner_notes')
    .eq('id', user.id)
    .maybeSingle()

  const prev = (profile?.pending_planner_notes ?? null) as PendingPlannerNotes | null
  const next: PendingPlannerNotes = {
    schemaVersion: 1,
    source: input.source,
    capturedAt: new Date().toISOString(),
    ...(input.availability ? { availability: input.availability } : {}),
    ...(input.freeText
      ? { freeText: input.freeText.slice(0, FREE_TEXT_LIMIT) }
      : {}),
    ...(input.signalEvidence ? { signalEvidence: input.signalEvidence } : {}),
  }
  const merged = mergePendingPlannerNotes(prev, next)

  const { error } = await supabase
    .from('profiles')
    .update({ pending_planner_notes: merged as unknown as Record<string, unknown> })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  return { success: true, data: { written: merged } }
}

export async function dismissOverrunSignal(
  signalEvidence: SignalEvidence,
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('pending_planner_notes')
    .eq('id', user.id)
    .maybeSingle()

  const prev = (profile?.pending_planner_notes ?? null) as PendingPlannerNotes | null
  const next: PendingPlannerNotes = {
    schemaVersion: 1,
    source: 'mid_block_signal',
    capturedAt: new Date().toISOString(),
    signalEvidence,
    dismissedWithoutAnswer: true,
  }
  const merged = mergePendingPlannerNotes(prev, next)

  const { error } = await supabase
    .from('profiles')
    .update({ pending_planner_notes: merged as unknown as Record<string, unknown> })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

export async function getPendingPlannerNotes(): Promise<ActionResult<PendingPlannerNotes | null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('profiles')
    .select('pending_planner_notes')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  return {
    success: true,
    data: (data?.pending_planner_notes ?? null) as PendingPlannerNotes | null,
  }
}

export async function clearPendingPlannerNotes(): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ pending_planner_notes: null })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}
