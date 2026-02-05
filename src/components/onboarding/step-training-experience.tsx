'use client'

import { useState } from 'react'
import { useOnboardingStore, TrainingLevel } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, Check, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LevelOption {
  value: TrainingLevel
  label: string
  description: string
  strengthExample: string
  enduranceExample: string
}

const levels: LevelOption[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: '0-1 years of consistent training',
    strengthExample: 'Learning movement patterns, rapid progress',
    enduranceExample: 'Building base fitness, can run 1-3km',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: '1-3 years of consistent training',
    strengthExample: 'Solid technique, steady strength gains',
    enduranceExample: 'Comfortable 5-10km runs, basic periodization',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: '3-7 years of consistent training',
    strengthExample: 'Near genetic potential, slow gains',
    enduranceExample: 'Half-marathon capable, structured training',
  },
  {
    value: 'elite',
    label: 'Elite',
    description: '7+ years, competitive level',
    strengthExample: 'Competitive numbers, fine-tuning',
    enduranceExample: 'Marathon+, high volume tolerance',
  },
]

export function StepTrainingExperience() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore()
  const [trainingAge, setTrainingAge] = useState(data.trainingAgeYears?.toString() || '')
  const [strengthLevel, setStrengthLevel] = useState<TrainingLevel | null>(data.strengthLevel)
  const [enduranceLevel, setEnduranceLevel] = useState<TrainingLevel | null>(data.enduranceLevel)
  const [showInfo, setShowInfo] = useState<'strength' | 'endurance' | null>(null)

  const handleContinue = () => {
    updateData({
      trainingAgeYears: trainingAge ? parseFloat(trainingAge) : null,
      strengthLevel,
      enduranceLevel,
    })
    nextStep()
  }

  const canContinue = strengthLevel && enduranceLevel

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Training Experience
          </h1>
          <p className="text-zinc-400">
            This determines your starting volume landmarks and progression rate.
          </p>
        </div>

        {/* Training Age */}
        <div className="mb-8">
          <label htmlFor="training-age" className="block text-sm font-medium text-zinc-300 mb-2">
            How many years have you been training seriously?
          </label>
          <div className="relative">
            <input
              id="training-age"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max="50"
              value={trainingAge}
              onChange={(e) => setTrainingAge(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-16"
              placeholder="3"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
              years
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Count years of consistent, intentional training (not just gym membership)
          </p>
        </div>

        {/* Strength Level */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-zinc-300">
              Strength Training Level
            </label>
            <button
              onClick={() => setShowInfo(showInfo === 'strength' ? null : 'strength')}
              className="text-zinc-500 hover:text-white"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {levels.map((level) => (
              <button
                key={`strength-${level.value}`}
                onClick={() => setStrengthLevel(level.value)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  strengthLevel === level.value
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{level.label}</span>
                  {strengthLevel === level.value && (
                    <Check className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <p className="text-xs text-zinc-500">{level.description}</p>
              </button>
            ))}
          </div>

          {/* Info Panel */}
          {showInfo === 'strength' && (
            <div className="mt-3 p-3 bg-zinc-900/70 rounded-lg border border-zinc-800">
              <p className="text-xs text-zinc-400 mb-2">Strength level examples:</p>
              <ul className="text-xs text-zinc-500 space-y-1">
                {levels.map((l) => (
                  <li key={l.value}>
                    <span className="text-zinc-300">{l.label}:</span> {l.strengthExample}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Endurance Level */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-zinc-300">
              Endurance Training Level
            </label>
            <button
              onClick={() => setShowInfo(showInfo === 'endurance' ? null : 'endurance')}
              className="text-zinc-500 hover:text-white"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {levels.map((level) => (
              <button
                key={`endurance-${level.value}`}
                onClick={() => setEnduranceLevel(level.value)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  enduranceLevel === level.value
                    ? 'bg-green-500/20 border-green-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{level.label}</span>
                  {enduranceLevel === level.value && (
                    <Check className="w-4 h-4 text-green-400" />
                  )}
                </div>
                <p className="text-xs text-zinc-500">{level.description}</p>
              </button>
            ))}
          </div>

          {/* Info Panel */}
          {showInfo === 'endurance' && (
            <div className="mt-3 p-3 bg-zinc-900/70 rounded-lg border border-zinc-800">
              <p className="text-xs text-zinc-400 mb-2">Endurance level examples:</p>
              <ul className="text-xs text-zinc-500 space-y-1">
                {levels.map((l) => (
                  <li key={l.value}>
                    <span className="text-zinc-300">{l.label}:</span> {l.enduranceExample}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          disabled={!canContinue}
          className="flex-1 py-4 bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
