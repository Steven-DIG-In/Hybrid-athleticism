import { listBodyComp } from '@/lib/actions/health/body-comp.actions'
import { BodyCompList } from '@/components/data/health/BodyCompList'

export default async function Page() {
  const rows = await listBodyComp()
  return <BodyCompList rows={rows ?? []} />
}
