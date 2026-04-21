'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BodyCompInput {
  measured_on: string
  method: 'scale' | 'dexa' | 'caliper' | 'tape'
  weight_kg?: number | null
  body_fat_pct?: number | null
  lean_mass_kg?: number | null
  measurements?: Record<string, number> | null
  notes?: string | null
}

export async function addBodyCompMeasurement(input: BodyCompInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' as const }
  const { data, error } = await supabase
    .from('body_composition_measurements')
    .insert({ ...input, user_id: user.id })
    .select('id').single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/body-comp')
  revalidatePath('/data/health')
  return { ok: true, id: data.id }
}

export async function listBodyComp() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('body_composition_measurements').select('*').order('measured_on', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
