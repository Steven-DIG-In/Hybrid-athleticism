export function OffPlanDrill({ rows }: { rows: {
  id: string; logged_at: string; modality: string; duration_minutes: number;
  rpe: number | null; notes: string | null; count_toward_load: boolean;
}[] }) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-space-grotesk mb-4">Off-plan sessions</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-neutral-500">
          <th className="text-left">Logged</th><th>Modality</th>
          <th>Duration</th><th>RPE</th><th>Load</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t border-neutral-900">
              <td className="py-1">{r.logged_at.slice(0, 10)}</td>
              <td className="text-center">{r.modality}</td>
              <td className="text-center">{r.duration_minutes}m</td>
              <td className="text-center">{r.rpe ?? '—'}</td>
              <td className="text-center">{r.count_toward_load ? '✓' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
