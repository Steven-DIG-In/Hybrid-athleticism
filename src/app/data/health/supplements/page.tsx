import { listSupplements } from '@/lib/actions/health/supplements.actions'
import { SupplementsList } from '@/components/data/health/SupplementsList'

export default async function Page() {
  const [active, ended] = await Promise.all([
    listSupplements({ include_ended: false }),
    listSupplements({ include_ended: true }),
  ])
  const endedOnly = (ended ?? []).filter(s => s.end_date)
  return <SupplementsList active={active ?? []} ended={endedOnly} />
}
