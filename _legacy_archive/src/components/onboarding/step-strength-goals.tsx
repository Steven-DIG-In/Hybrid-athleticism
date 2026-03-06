'use client'

import { useState } from 'react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Chest', category: 'push' },
  { id: 'front_delts', label: 'Front Delts', category: 'push' },
  { id: 'side_delts', label: 'Side Delts', category: 'push' },
  { id: 'triceps', label: 'Triceps', category: 'push' },
  { id: 'back', label: 'Back', category: 'pull' },
  { id: 'rear_delts', label: 'Rear Delts', category: 'pull' },
  { id: 'biceps', label: 'Biceps', category: 'pull' },
  { id: 'quads', label: 'Quads', category: 'legs' },
  { id: 'hamstrings', label: 'Hamstrings', category: 'legs' },
  { id: 'glutes', label: 'Glutes', category: 'legs' },
  { id: 'calves', label: 'Calves', category: 'legs' },
  { id: 'core', label: 'Core', category: 'core' },
]

const MOVEMENT_PATTERNS = [
  { id: 'push', label: 'Push', description: 'Bench, OHP, dips' },
  { id: 'pull', label: 'Pull', description: 'Rows, pulldowns, curls' },
  { id: 'squat', label: 'Squat', description: 'Squats, leg press' },
  { id: 'hinge', label: 'Hinge', description: 'Deadlifts, RDLs' },
  { id: 'carry', label: 'Carry', description: 'Loaded carries' },
]

export function StepStrengthGoals() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore()
  const [focusMuscles, setFocusMuscles] = useState<string[]>(data.strengthGoals.focusMuscles)
  const [priorityMovements, setPriorityMovements] = useState<string[]>(data.strengthGoals.priorityMovements)

  const toggleMuscle = (muscle: string) => {
    setFocusMuscles((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : prev.length < 4
        ? [...prev, muscle]
        : prev
    )
  }

  const toggleMovement = (movement: string) => {
    setPriorityMovements((prev) =>
      prev.includes(movement)
        ? prev.filter((m) => m !== movement)
        : [...prev, movement]
    )
  }

  const handleContinue = () => {
    updateData({
      strengthGoals: {
        focusMuscles,
        priorityMovements,
      },
    })
    nextStep()
  }

  const groupedMuscles = {
    push: MUSCLE_GROUPS.filter((m) => m.category === 'push'),
    pull: MUSCLE_GROUPS.filter((m) => m.category === 'pull'),
    legs: MUSCLE_GROUPS.filter((m) => m.category === 'legs'),
    core: MUSCLE_GROUPS.filter((m) => m.category === 'core'),
  }

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Strength Goals
          </h1>
          <p className="text-zinc-400">
            Which areas do you want to prioritize? We&apos;ll allocate more
            volume to these.
          </p>
        </div>

        {/* Focus Muscles */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-zinc-300">
              Priority Muscle Groups
            </label>
            <span className="text-xs text-zinc-500">{focusMuscles.length}/4 selected</span>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Select up to 4 muscle groups to prioritize. These will get extra volume.
          </p>

          {/* Push */}
          <div className="mb-3">
            <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Push</p>
            <div className="flex flex-wrap gap-2">
              {groupedMuscles.push.map((muscle) => (
                <button
                  key={muscle.id}
                  onClick={() => toggleMuscle(muscle.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-1.5',
                    focusMuscles.includes(muscle.id)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  {focusMuscles.includes(muscle.id) && <Check className="w-3 h-3" />}
                  {muscle.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pull */}
          <div className="mb-3">
            <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Pull</p>
            <div className="flex flex-wrap gap-2">
              {groupedMuscles.pull.map((muscle) => (
                <button
                  key={muscle.id}
                  onClick={() => toggleMuscle(muscle.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-1.5',
                    focusMuscles.includes(muscle.id)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  {focusMuscles.includes(muscle.id) && <Check className="w-3 h-3" />}
                  {muscle.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legs */}
          <div className="mb-3">
            <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Legs</p>
            <div className="flex flex-wrap gap-2">
              {groupedMuscles.legs.map((muscle) => (
                <button
                  key={muscle.id}
                  onClick={() => toggleMuscle(muscle.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-1.5',
                    focusMuscles.includes(muscle.id)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  {focusMuscles.includes(muscle.id) && <Check className="w-3 h-3" />}
                  {muscle.label}
                </button>
              ))}
            </div>
          </div>

          {/* Core */}
          <div>
            <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Core</p>
            <div className="flex flex-wrap gap-2">
              {groupedMuscles.core.map((muscle) => (
                <button
                  key={muscle.id}
                  onClick={() => toggleMuscle(muscle.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-1.5',
                    focusMuscles.includes(muscle.id)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  {focusMuscles.includes(muscle.id) && <Check className="w-3 h-3" />}
                  {muscle.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Movement Patterns */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Movement Pattern Focus
          </label>
          <p className="text-xs text-zinc-500 mb-3">
            Which movement patterns do you enjoy or want to improve?
          </p>

          <div className="grid grid-cols-2 gap-2">
            {MOVEMENT_PATTERNS.map((pattern) => (
              <button
                key={pattern.id}
                onClick={() => toggleMovement(pattern.id)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  priorityMovements.includes(pattern.id)
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{pattern.label}</span>
                  {priorityMovements.includes(pattern.id) && (
                    <Check className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <p className="text-xs text-zinc-500">{pattern.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Helper */}
        <div className="p-3 bg-zinc-900/30 rounded-lg">
          <p className="text-xs text-zinc-500">
            <strong className="text-zinc-400">Tip:</strong> If you&apos;re unsure,
            skip this for now. You can always adjust your priorities later in settings.
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
          className="flex-1 py-4 bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
