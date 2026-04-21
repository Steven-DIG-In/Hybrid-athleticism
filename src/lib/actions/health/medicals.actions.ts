'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type MedicalEventType =
  | 'injury' | 'diagnosis' | 'surgery'
  | 'medication_change' | 'lab_test' | 'other'

export interface MedicalEventInput {
  event_type: MedicalEventType
  event_date: string
  title: string
  details?: string | null
  attachment_path?: string | null
  structured_data?: Record<string, unknown> | null
}

export async function addMedicalEvent(input: MedicalEventInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' as const }
  const { data, error } = await supabase
    .from('medical_events')
    .insert({ ...input, user_id: user.id })
    .select('id').single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/medicals')
  revalidatePath('/data/health')
  return { ok: true, id: data.id }
}

export async function updateMedicalEvent(id: string, patch: Partial<MedicalEventInput>) {
  const supabase = await createClient()
  const { error } = await supabase.from('medical_events').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/medicals')
  return { ok: true }
}

export async function deleteMedicalEvent(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('medical_events').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/medicals')
  return { ok: true }
}

export async function listMedicalEvents() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('medical_events').select('*').order('event_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
