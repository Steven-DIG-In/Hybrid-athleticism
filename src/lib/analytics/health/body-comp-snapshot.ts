import { createClient } from '@/lib/supabase/server'

export async function latestBodyCompSnapshot(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('body_composition_measurements')
    .select('measured_on, weight_kg, body_fat_pct')
    .eq('user_id', userId)
    .order('measured_on', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { latest: data ?? null }
}
