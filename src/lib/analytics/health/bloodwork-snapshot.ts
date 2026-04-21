import { createClient } from '@/lib/supabase/server'

export interface BloodworkSnapshot {
  last_panel_date: string | null
  out_of_range_count: number
}

export async function latestBloodworkSnapshot(userId: string): Promise<BloodworkSnapshot> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('lab_panels')
    .select('panel_date, out_of_range_count')
    .eq('user_id', userId)
    .order('panel_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return { last_panel_date: null, out_of_range_count: 0 }
  return { last_panel_date: data.panel_date, out_of_range_count: data.out_of_range_count ?? 0 }
}
