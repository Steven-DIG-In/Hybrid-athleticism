'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Dumbbell, Mountain, Timer, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DomainPriority, TrainingDomain } from '@/lib/program-generator'

interface PrioritiesData {
  strengthPriority: DomainPriority
  ruckingPriority: DomainPriority
  runningPriority: DomainPriority // Stored as 'running' but displayed as 'cardio'
}

const DOMAINS: {
  id: keyof PrioritiesData
  domain: TrainingDomain
  label: string
  icon: typeof Dumbbell
  color: string
  description: string
}[] = [
  {
    id: 'strengthPriority',
    domain: 'strength',
    label: 'Strength',
    icon: Dumbbell,
    color: 'text-blue-400',
    description: 'Resistance training, muscle building',
  },
  {
    id: 'ruckingPriority',
    domain: 'rucking',
    label: 'Rucking',
    icon: Mountain,
    color: 'text-green-400',
    description: 'Loaded carries, weighted hikes',
  },
  {
    id: 'runningPriority',
    domain: 'cardio',
    label: 'Cardio',
    icon: Timer,
    color: 'text-orange-400',
    description: 'Running, rowing, cycling, swimming',
  },
]

const PRIORITIES: { value: DomainPriority; label: string; sessions: string; description: string }[] = [
  { value: 'primary', label: 'Primary', sessions: '4x/week', description: 'Main training focus' },
  { value: 'secondary', label: 'Secondary', sessions: '2x/week', description: 'Supporting goal' },
  { value: 'maintenance', label: 'Maintenance', sessions: '1x/week', description: 'Maintain current level' },
]

export default function PrioritiesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<PrioritiesData>({
    strengthPriority: 'primary',
    ruckingPriority: 'secondary',
    runningPriority: 'secondary',
  })

  useEffect(() => {
    // Load from localStorage (onboarding store)
    try {
      const stored = localStorage.getItem('hybrid-onboarding')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.state?.data) {
          setData({
            strengthPriority: parsed.state.data.strengthPriority || 'primary',
            ruckingPriority: parsed.state.data.ruckingPriority || 'secondary',
            runningPriority: parsed.state.data.runningPriority || 'secondary',
          })
        }
      }
    } catch {
      // Use defaults
    }
    setLoading(false)
  }, [])

  const setPriority = (domainKey: keyof PrioritiesData, priority: DomainPriority) => {
    // If setting to primary, demote any existing primary
    if (priority === 'primary') {
      const newData = { ...data }
      Object.keys(newData).forEach((key) => {
        if (newData[key as keyof PrioritiesData] === 'primary') {
          newData[key as keyof PrioritiesData] = 'secondary'
        }
      })
      newData[domainKey] = priority
      setData(newData)
    } else {
      setData({ ...data, [domainKey]: priority })
    }
  }

  const handleSave = async () => {
    setSaving(true)

    // Save to localStorage
    try {
      const stored = localStorage.getItem('hybrid-onboarding')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.state?.data) {
          parsed.state.data.strengthPriority = data.strengthPriority
          parsed.state.data.ruckingPriority = data.ruckingPriority
          parsed.state.data.runningPriority = data.runningPriority
          localStorage.setItem('hybrid-onboarding', JSON.stringify(parsed))
        }
      } else {
        // Create new onboarding data
        const newData = {
          state: {
            data: {
              strengthPriority: data.strengthPriority,
              ruckingPriority: data.ruckingPriority,
              runningPriority: data.runningPriority,
            },
          },
        }
        localStorage.setItem('hybrid-onboarding', JSON.stringify(newData))
      }
    } catch {
      // Ignore errors
    }

    setSaving(false)
    router.push('/settings')
  }

  // Count priorities
  const primaryCount = Object.values(data).filter((p) => p === 'primary').length
  const hasNoPrimary = primaryCount === 0

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-32 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-zinc-900 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Domain Priorities</h1>
              <p className="text-zinc-500 text-sm">Set your training focus</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || hasNoPrimary}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </header>

      {/* Info */}
      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 mb-6">
        <div className="flex gap-2">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-300">
            Your primary focus gets more weekly sessions. You must have exactly one primary domain.
          </p>
        </div>
      </div>

      {/* Warning if no primary */}
      {hasNoPrimary && (
        <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 mb-6">
          <p className="text-sm text-amber-300">
            Please select one domain as your primary focus.
          </p>
        </div>
      )}

      {/* Domain Cards */}
      <div className="space-y-4">
        {DOMAINS.map((domain) => {
          const Icon = domain.icon
          const currentPriority = data[domain.id]

          return (
            <div
              key={domain.id}
              className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden"
            >
              {/* Domain Header */}
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg bg-zinc-800', domain.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{domain.label}</h3>
                    <p className="text-xs text-zinc-500">{domain.description}</p>
                  </div>
                </div>
              </div>

              {/* Priority Selection */}
              <div className="p-3 grid grid-cols-3 gap-2">
                {PRIORITIES.map((priority) => {
                  const isSelected = currentPriority === priority.value

                  return (
                    <button
                      key={priority.value}
                      onClick={() => setPriority(domain.id, priority.value)}
                      className={cn(
                        'p-3 rounded-lg border text-center transition-all',
                        isSelected
                          ? priority.value === 'primary'
                            ? 'bg-blue-500/20 border-blue-500 text-white'
                            : priority.value === 'secondary'
                              ? 'bg-purple-500/20 border-purple-500 text-white'
                              : 'bg-amber-500/20 border-amber-500 text-white'
                          : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      )}
                    >
                      <p className="text-sm font-medium">{priority.label}</p>
                      <p className="text-xs opacity-70">{priority.sessions}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-400 mb-2">Weekly Sessions</h3>
        <div className="flex gap-4 text-sm">
          {DOMAINS.map((domain) => {
            const priority = data[domain.id]
            const sessions = priority === 'primary' ? 4 : priority === 'secondary' ? 2 : 1

            return (
              <div key={domain.id} className="flex items-center gap-2">
                <domain.icon className={cn('w-4 h-4', domain.color)} />
                <span className="text-zinc-300">{sessions}x</span>
              </div>
            )
          })}
          <div className="ml-auto text-zinc-500">
            Total: {Object.values(data).reduce((sum, p) => sum + (p === 'primary' ? 4 : p === 'secondary' ? 2 : 1), 0)} sessions
          </div>
        </div>
      </div>
    </div>
  )
}
