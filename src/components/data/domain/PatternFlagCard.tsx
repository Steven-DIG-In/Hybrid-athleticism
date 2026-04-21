// src/components/data/domain/PatternFlagCard.tsx
import { AlertCircle } from 'lucide-react'
import type { PatternSignal } from '@/lib/analytics/coach-bias'

export function PatternFlagCard({ flag, coach }: { flag: PatternSignal | null; coach: string }) {
  if (!flag) return null
  return (
    <div className="p-3 border border-amber-800 bg-amber-950/30 rounded flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
      <div className="text-sm text-amber-200">
        <div>Pattern flagged in {coach}</div>
        <div className="text-xs text-amber-300 mt-1">
          {flag.direction}-performance across 3 sessions · magnitudes {flag.magnitudes.map(m => `${m.toFixed(0)}%`).join(', ')}
        </div>
      </div>
    </div>
  )
}
