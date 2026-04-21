import { getHealthSnapshot } from '@/lib/actions/data.actions'
import { latestMedicalsSnapshot } from '@/lib/analytics/health/medicals-snapshot'
import { latestBodyCompSnapshot } from '@/lib/analytics/health/body-comp-snapshot'
import { createClient } from '@/lib/supabase/server'
import { HealthLanding } from '@/components/data/health/HealthLanding'
import { redirect } from 'next/navigation'

export default async function HealthDomainPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const snap = await getHealthSnapshot()
  const [medicals, bodyComp] = await Promise.all([
    latestMedicalsSnapshot(user.id),
    latestBodyCompSnapshot(user.id),
  ])

  return (
    <HealthLanding
      bloodwork={snap.success ? snap.data.bloodwork : { last_panel_date: null, out_of_range_count: 0 }}
      garmin={snap.success ? snap.data.garmin : { last_synced: null, sleep_trend: 'flat', hrv_trend: 'flat', rhr_trend: 'flat' }}
      activeSupplements={snap.success ? snap.data.activeSupplements : 0}
      medicals={medicals}
      bodyComp={bodyComp}
    />
  )
}
