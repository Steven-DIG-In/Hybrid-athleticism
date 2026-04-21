import { listMedicalEvents } from '@/lib/actions/health/medicals.actions'
import { MedicalsList } from '@/components/data/health/MedicalsList'

export default async function Page() {
  const events = await listMedicalEvents()
  return <MedicalsList events={events ?? []} />
}
