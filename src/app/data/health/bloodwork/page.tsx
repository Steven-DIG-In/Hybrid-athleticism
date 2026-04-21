import Link from 'next/link'
import { listPanels } from '@/lib/actions/health/bloodwork.actions'
import { Plus, Upload } from 'lucide-react'

export default async function Page() {
  const panels = await listPanels()
  const list = panels ?? []
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-space-grotesk">Bloodwork</h1>
        <div className="flex items-center gap-3">
          <Link href="/data/health/bloodwork/upload" className="inline-flex items-center gap-1 text-sm text-amber-500">
            <Upload className="w-4 h-4" /> Upload PDF
          </Link>
          <Link href="/data/health/bloodwork/new" className="inline-flex items-center gap-1 text-sm text-amber-500">
            <Plus className="w-4 h-4" /> Enter manually
          </Link>
        </div>
      </div>
      {list.length === 0 && (
        <div className="p-6 border border-neutral-800 rounded text-center text-sm text-neutral-500">
          No bloodwork yet. <Link href="/data/health/bloodwork/new" className="text-amber-500">Enter your first panel</Link>.
        </div>
      )}
      {list.map(p => (
        <Link key={p.id} href={`/data/health/bloodwork/${p.id}`}
          className="block p-3 border border-neutral-800 rounded hover:border-amber-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-neutral-100">{p.panel_date}</div>
              <div className="text-xs text-neutral-500">{p.lab_name ?? 'No lab name'}</div>
            </div>
            <div className="text-xs">
              <span className={(p.out_of_range_count ?? 0) > 0 ? 'text-amber-500' : 'text-neutral-500'}>
                {p.out_of_range_count ?? 0} out of range
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
