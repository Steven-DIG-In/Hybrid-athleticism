import { createClient } from '@/lib/supabase/server'

export async function latestMedicalsSnapshot(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('medical_events')
    .select('event_date, event_type, title')
    .eq('user_id', userId)
    .order('event_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return { last_event_date: null, last_event_type: null, last_event_title: null }
  return {
    last_event_date: data.event_date,
    last_event_type: data.event_type,
    last_event_title: data.title,
  }
}
