'use client'

import { useState } from 'react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, Sparkles, Calendar, RefreshCcw, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const MESOCYCLE_OPTIONS = [
  { value: 4, label: '4 weeks', description: 'Standard mesocycle, good for most trainees' },
  { value: 5, label: '5 weeks', description: 'Slightly longer accumulation phase' },
  { value: 6, label: '6 weeks', description: 'Extended block, better for advanced lifters' },
]

export function StepProgramGeneration() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore()
  const [mesocycleLength, setMesocycleLength] = useState(data.mesocycleLengthWeeks)
  const [includeDeload, setIncludeDeload] = useState(data.includeDeload)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewGenerated, setPreviewGenerated] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    // Simulate generation delay
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsGenerating(false)
    setPreviewGenerated(true)
  }

  const handleContinue = () => {
    updateData({
      mesocycleLengthWeeks: mesocycleLength,
      includeDeload,
    })
    nextStep()
  }

  // Calculate summary stats based on settings
  const totalWeeks = includeDeload ? mesocycleLength : mesocycleLength - 1
  const accumulationWeeks = mesocycleLength - (includeDeload ? 1 : 0)

  // Session distribution based on domain priorities
  const getSessionsPerWeek = () => {
    const sessions = {
      strength: data.strengthPriority === 'primary' ? 4 : data.strengthPriority === 'secondary' ? 3 : 2,
      rucking: data.ruckingPriority === 'primary' ? 3 : data.ruckingPriority === 'secondary' ? 2 : 1,
      running: data.runningPriority === 'primary' ? 4 : data.runningPriority === 'secondary' ? 3 : 2,
    }
    return sessions
  }

  const sessions = getSessionsPerWeek()

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">
              Generate Your Program
            </h1>
          </div>
          <p className="text-zinc-400">
            Based on your inputs, we&apos;ll create a personalized mesocycle.
          </p>
        </div>

        {/* Mesocycle Length */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Mesocycle Length
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MESOCYCLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMesocycleLength(opt.value)}
                className={cn(
                  'p-3 rounded-lg border text-center transition-all',
                  mesocycleLength === opt.value
                    ? 'bg-purple-500/20 border-purple-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                )}
              >
                <span className="font-semibold block">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Deload Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <div>
              <p className="font-medium text-white">Include Deload Week</p>
              <p className="text-sm text-zinc-500">
                Final week at reduced volume for recovery
              </p>
            </div>
            <button
              onClick={() => setIncludeDeload(!includeDeload)}
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                includeDeload ? 'bg-purple-500' : 'bg-zinc-700'
              )}
            >
              <div
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  includeDeload ? 'translate-x-7' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        </div>

        {/* Program Preview */}
        <div className="mb-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          <h3 className="font-medium text-white mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Program Overview
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-zinc-800 rounded">
              <p className="text-xs text-zinc-500">Duration</p>
              <p className="text-lg font-semibold text-white">{mesocycleLength} weeks</p>
            </div>
            <div className="p-3 bg-zinc-800 rounded">
              <p className="text-xs text-zinc-500">Structure</p>
              <p className="text-lg font-semibold text-white">
                {accumulationWeeks}+{includeDeload ? '1' : '0'}
              </p>
              <p className="text-xs text-zinc-500">accumulation + deload</p>
            </div>
          </div>

          {/* Weekly Session Breakdown */}
          <div className="space-y-2">
            <p className="text-sm text-zinc-400">Weekly Sessions:</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 p-2 bg-zinc-800 rounded">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-sm text-zinc-300">Strength</span>
                <span className="text-sm font-medium text-white ml-auto">{sessions.strength}x</span>
              </div>
              <div className="flex-1 flex items-center gap-2 p-2 bg-zinc-800 rounded">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm text-zinc-300">Rucking</span>
                <span className="text-sm font-medium text-white ml-auto">{sessions.rucking}x</span>
              </div>
              <div className="flex-1 flex items-center gap-2 p-2 bg-zinc-800 rounded">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-sm text-zinc-300">Running</span>
                <span className="text-sm font-medium text-white ml-auto">{sessions.running}x</span>
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        {!previewGenerated ? (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <RefreshCcw className="w-5 h-5 animate-spin" />
                Generating your program...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Mesocycle
              </>
            )}
          </button>
        ) : (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-green-400" />
              <span className="font-medium text-green-400">Program Ready!</span>
            </div>
            <p className="text-sm text-zinc-400">
              Your {mesocycleLength}-week mesocycle has been created. You can view and
              modify it after completing setup.
            </p>
          </div>
        )}
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
          disabled={!previewGenerated}
          className="flex-1 py-4 bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
