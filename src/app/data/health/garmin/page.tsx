import { createClient } from '@/lib/supabase/server'
import { GarminDisplay } from '@/components/data/health/GarminDisplay'
import { redirect } from 'next/navigation'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const [credsRes, dailiesRes, vo2Res] = await Promise.all([
    supabase.from('garmin_credentials').select('last_sync_at, last_sync_status').eq('user_id', user.id).maybeSingle(),
    supabase.from('garmin_daily').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(30),
    supabase.from('garmin_vo2_trend').select('*').eq('user_id', user.id).order('measured_on', { ascending: false }).limit(20),
  ])

  return (
    <GarminDisplay
      creds={credsRes.data ?? null}
      dailies={dailiesRes.data ?? []}
      vo2={vo2Res.data ?? []}
    />
  )
}
