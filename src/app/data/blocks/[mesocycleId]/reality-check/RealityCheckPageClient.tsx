'use client'

import { useRouter } from 'next/navigation'
import { RealityCheckForm } from '@/components/reality-check/RealityCheckForm'
import type { AvailabilityAnswers } from '@/lib/types/pending-planner-notes.types'

export function RealityCheckPageClient({
  defaults, prefill,
}: {
  mesocycleId: string
  defaults: AvailabilityAnswers
  prefill?: Partial<AvailabilityAnswers> & { freeText?: string }
}) {
  const router = useRouter()
  const handleComplete = () => {
    router.push('/data/blocks/new')
    router.refresh()
  }
  return (
    <RealityCheckForm
      source="block_close"
      defaults={defaults}
      prefill={prefill}
      onComplete={handleComplete}
    />
  )
}
