import type { RAG } from '@/lib/analytics/coach-bias'

export function CoachBiasDrill({ ragByCoach }: { ragByCoach: Record<string, RAG> }) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-space-grotesk mb-4">Coach bias — 21-day window</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-neutral-500">
          <th className="text-left">Coach</th><th className="text-center">Status</th>
        </tr></thead>
        <tbody>
          {Object.entries(ragByCoach).map(([coach, rag]) => (
            <tr key={coach} className="border-t border-neutral-900">
              <td className="py-1 capitalize">{coach}</td>
              <td className="text-center">{rag}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
