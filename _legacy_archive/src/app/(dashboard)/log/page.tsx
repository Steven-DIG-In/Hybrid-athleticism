'use client'

import { useState } from 'react'
import { Dumbbell, Mountain, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StrengthSession } from '@/components/workout/strength-session'

type Domain = 'strength' | 'rucking' | 'running'

const domains = [
  { id: 'strength' as Domain, label: 'Strength', icon: Dumbbell, color: 'text-blue-400' },
  { id: 'rucking' as Domain, label: 'Rucking', icon: Mountain, color: 'text-green-400' },
  { id: 'running' as Domain, label: 'Cardio', icon: Timer, color: 'text-orange-400' }, // ID kept for DB compat
]

export default function LogPage() {
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)

  if (selectedDomain === 'strength') {
    return <StrengthSession onBack={() => setSelectedDomain(null)} />
  }

  if (selectedDomain === 'rucking' || selectedDomain === 'running') {
    // Placeholder for cardio logging
    return (
      <div className="p-4">
        <button
          onClick={() => setSelectedDomain(null)}
          className="text-zinc-400 hover:text-white mb-4"
        >
          ← Back
        </button>
        <div className="text-center py-12">
          <p className="text-zinc-500">
            {selectedDomain.charAt(0).toUpperCase() + selectedDomain.slice(1)} logging coming soon.
          </p>
          <p className="text-zinc-600 text-sm mt-2">
            Sync from Garmin or log manually.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Log Workout</h1>
        <p className="text-zinc-500">Select training type</p>
      </header>

      <div className="space-y-3">
        {domains.map((domain) => (
          <button
            key={domain.id}
            onClick={() => setSelectedDomain(domain.id)}
            className={cn(
              'w-full bg-zinc-900 rounded-lg p-6 border border-zinc-800',
              'hover:border-zinc-700 transition-colors text-left',
              'flex items-center gap-4'
            )}
          >
            <div className={cn('w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center', domain.color)}>
              <domain.icon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{domain.label}</h2>
              <p className="text-sm text-zinc-500">
                {domain.id === 'strength' && 'Log sets, reps, and weight'}
                {domain.id === 'rucking' && 'Track distance and load'}
                {domain.id === 'running' && 'Running, rowing, cycling & more'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
