import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LabReviewTable } from '@/components/data/health/LabReviewTable'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: panel } = await supabase
    .from('lab_panels')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!panel) redirect('/data/health/bloodwork')
  const { data: markers } = await supabase
    .from('lab_markers')
    .select('*')
    .eq('panel_id', id)
    .order('name_en')
  return <LabReviewTable panel={panel} markers={markers ?? []} />
}
