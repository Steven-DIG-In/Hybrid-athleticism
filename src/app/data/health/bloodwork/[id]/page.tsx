import { getPanelWithMarkers } from '@/lib/actions/health/bloodwork.actions'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { panel, markers } = await getPanelWithMarkers(id)
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-space-grotesk">{panel.panel_date}</h1>
      <div className="text-sm text-neutral-400">{panel.lab_name ?? 'Manually entered'}</div>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-neutral-500">
          <th className="text-left py-1">Marker</th><th className="text-right py-1">Value</th>
          <th className="text-right py-1">Unit</th><th className="text-right py-1">Range</th>
        </tr></thead>
        <tbody>
          {markers.map(m => (
            <tr key={m.id} className={`border-t border-neutral-900 ${m.is_out_of_range ? 'text-amber-500' : ''}`}>
              <td className="py-1">{m.name_en}</td>
              <td className="py-1 text-right">{m.value ?? '—'}</td>
              <td className="py-1 text-right text-neutral-500">{m.unit ?? ''}</td>
              <td className="py-1 text-right text-xs text-neutral-500">
                {m.reference_range_low ?? '—'} – {m.reference_range_high ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
