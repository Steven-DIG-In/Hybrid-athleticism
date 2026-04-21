'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SupplementInput {
  name: string
  dose: number | null
  dose_unit: string | null
  timing: string[]
  start_date: string
  end_date?: string | null
  notes?: string | null
}

export async function addSupplement(input: SupplementInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' as const }
  const { data, error } = await supabase
    .from('supplements')
    .insert({ ...input, user_id: user.id })
    .select('id').single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/supplements')
  revalidatePath('/data/health')
  revalidatePath('/data')
  return { ok: true, id: data.id }
}

export async function updateSupplement(id: string, patch: Partial<SupplementInput>) {
  const supabase = await createClient()
  const { error } = await supabase.from('supplements').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/supplements')
  return { ok: true }
}

export async function endSupplement(id: string, end_date: string) {
  return updateSupplement(id, { end_date })
}

export async function listSupplements(opts: { include_ended: boolean }) {
  const supabase = await createClient()
  const q = supabase.from('supplements').select('*').order('start_date', { ascending: false })
  if (!opts.include_ended) q.is('end_date', null)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data
}
