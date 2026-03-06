'use client'

import { useState } from 'react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { Dumbbell, Mountain, Timer, ArrowRight } from 'lucide-react'

export function StepWelcome() {
  const { data, updateData, nextStep } = useOnboardingStore()
  const [name, setName] = useState(data.name)

  const handleContinue = () => {
    if (name.trim()) {
      updateData({ name: name.trim() })
      nextStep()
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Dumbbell className="w-6 h-6 text-blue-400" />
            </div>
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Mountain className="w-6 h-6 text-green-400" />
            </div>
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Timer className="w-6 h-6 text-orange-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Welcome to Hybrid Athleticism
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Build strength, endurance, and resilience with intelligent periodization
            that manages your recovery across all three domains.
          </p>
        </div>

        {/* Features Preview */}
        <div className="space-y-3 mb-8">
          <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs text-blue-400">1</span>
            </div>
            <div>
              <p className="text-white font-medium">Unified Fatigue Management</p>
              <p className="text-sm text-zinc-500">Track recovery across strength, rucking, and running</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs text-green-400">2</span>
            </div>
            <div>
              <p className="text-white font-medium">RP-Based Periodization</p>
              <p className="text-sm text-zinc-500">Volume landmarks guide your training progression</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs text-orange-400">3</span>
            </div>
            <div>
              <p className="text-white font-medium">Smart Program Generation</p>
              <p className="text-sm text-zinc-500">Personalized mesocycles based on your goals</p>
            </div>
          </div>
        </div>

        {/* Name Input */}
        <div className="mb-6">
          <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-2">
            What should we call you?
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            placeholder="Your first name"
            autoFocus
          />
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={handleContinue}
        disabled={!name.trim()}
        className="w-full py-4 bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Let&apos;s get started
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}
