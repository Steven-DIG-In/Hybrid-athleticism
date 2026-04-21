import { createClient } from '@/lib/supabase/server'

export async function activeSupplementsSnapshot(userId: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('supplements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).is('end_date', null)
  return { count: count ?? 0 }
}
