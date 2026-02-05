'use client'

import { useState } from 'react'
import { useOnboardingStore, DomainPriority } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, Dumbbell, Mountain, Timer, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Domain {
  id: 'strength' | 'rucking' | 'running'
  label: string
  icon: typeof Dumbbell
  color: string
  bgColor: string
  description: string
}

const DOMAINS: Domain[] = [
  {
    id: 'strength',
    label: 'Strength',
    icon: Dumbbell,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    description: 'Build muscle and strength',
  },
  {
    id: 'rucking',
    label: 'Rucking',
    icon: Mountain,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    description: 'Loaded carries and hikes',
  },
  {
    id: 'running', // ID kept for backwards compat, label changed to Cardio
    label: 'Cardio',
    icon: Timer,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    description: 'Running, rowing, swimming, cycling',
  },
]

const PRIORITY_LABELS: Record<DomainPriority, { label: string; description: string }> = {
  primary: {
    label: 'Primary',
    description: 'Main focus, most volume allocated',
  },
  secondary: {
    label: 'Secondary',
    description: 'Supporting goal, moderate volume',
  },
  maintenance: {
    label: 'Maintenance',
    description: 'Minimum to maintain current level',
  },
}

export function StepDomainPriorities() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore()
  const [strengthPriority, setStrengthPriority] = useState<DomainPriority>(data.strengthPriority)
  const [ruckingPriority, setRuckingPriority] = useState<DomainPriority>(data.ruckingPriority)
  const [runningPriority, setRunningPriority] = useState<DomainPriority>(data.runningPriority)

  const getPriority = (domain: Domain['id']): DomainPriority => {
    switch (domain) {
      case 'strength':
        return strengthPriority
      case 'rucking':
        return ruckingPriority
      case 'running':
        return runningPriority
    }
  }

  const setPriority = (domain: Domain['id'], priority: DomainPriority) => {
    switch (domain) {
      case 'strength':
        setStrengthPriority(priority)
        break
      case 'rucking':
        setRuckingPriority(priority)
        break
      case 'running':
        setRunningPriority(priority)
        break
    }
  }

  const handleContinue = () => {
    updateData({
      strengthPriority,
      ruckingPriority,
      runningPriority,
    })
    nextStep()
  }

  // Check if at least one domain is primary
  const hasPrimary = [strengthPriority, ruckingPriority, runningPriority].includes('primary')

  // Calculate weekly session distribution preview
  const getSessionCount = (priority: DomainPriority) => {
    switch (priority) {
      case 'primary':
        return 4
      case 'secondary':
        return 2
      case 'maintenance':
        return 1
    }
  }

  const totalSessions =
    getSessionCount(strengthPriority) +
    getSessionCount(ruckingPriority) +
    getSessionCount(runningPriority)

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Domain Priorities
          </h1>
          <p className="text-zinc-400">
            How should we balance your training across the three domains?
            Your recovery budget is shared, so we need to prioritize.
          </p>
        </div>

        {/* Domain Cards */}
        <div className="space-y-4 mb-6">
          {DOMAINS.map((domain) => {
            const priority = getPriority(domain.id)
            const Icon = domain.icon
            return (
              <div
                key={domain.id}
                className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden"
              >
                {/* Domain Header */}
                <div className="p-4 flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', domain.bgColor)}>
                    <Icon className={cn('w-5 h-5', domain.color)} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{domain.label}</h3>
                    <p className="text-xs text-zinc-500">{domain.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500">~{getSessionCount(priority)}/week</span>
                  </div>
                </div>

                {/* Priority Selector */}
                <div className="grid grid-cols-3 border-t border-zinc-800">
                  {(['primary', 'secondary', 'maintenance'] as DomainPriority[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(domain.id, p)}
                      className={cn(
                        'py-3 text-center transition-all border-r last:border-r-0 border-zinc-800',
                        priority === p
                          ? p === 'primary'
                            ? 'bg-blue-500/20 text-blue-400 border-b-2 border-b-blue-500'
                            : p === 'secondary'
                            ? 'bg-purple-500/20 text-purple-400 border-b-2 border-b-purple-500'
                            : 'bg-amber-500/20 text-amber-400 border-b-2 border-b-amber-500'
                          : 'text-zinc-500 hover:bg-zinc-800/50'
                      )}
                    >
                      <span className="text-sm font-medium">{PRIORITY_LABELS[p].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Warning if no primary */}
        {!hasPrimary && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
            <p className="text-sm text-amber-400">
              Select at least one domain as Primary to focus your training.
            </p>
          </div>
        )}

        {/* Preview */}
        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <p className="text-sm text-zinc-400 mb-2">Weekly distribution preview:</p>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-zinc-300">Strength: {getSessionCount(strengthPriority)}</span>
            </div>
            <span className="text-zinc-600">·</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-zinc-300">Rucking: {getSessionCount(ruckingPriority)}</span>
            </div>
            <span className="text-zinc-600">·</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-zinc-300">Cardio: {getSessionCount(runningPriority)}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {totalSessions} sessions/week total (may overlap on two-a-days)
          </p>
        </div>

        {/* Info Box */}
        <div className="mt-4 p-3 bg-zinc-900/30 rounded-lg">
          <p className="text-xs text-zinc-500">
            <strong className="text-zinc-400">How it works:</strong> Primary domains
            receive more weekly volume and progress faster. Secondary domains get
            moderate attention. Maintenance keeps you from losing ground while
            focusing elsewhere.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={prevStep}
          className="px-6 py-4 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={handleContinue}
          disabled={!hasPrimary}
          className="flex-1 py-4 bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
