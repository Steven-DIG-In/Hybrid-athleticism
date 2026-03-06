'use client'

import { useState } from 'react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, Mountain, Heart, Check, Waves } from 'lucide-react'
import { cn } from '@/lib/utils'

const RUCKING_GOALS = [
  { id: 'general_fitness', label: 'General Fitness', description: 'Build base conditioning' },
  { id: 'load_progression', label: 'Load Progression', description: 'Carry heavier weight over time' },
  { id: 'distance', label: 'Distance Building', description: 'Increase ruck distance' },
  { id: 'event_prep', label: 'Event Prep', description: 'Training for a rucking event' },
]

const CARDIO_ACTIVITIES = [
  { id: 'running', label: 'Running', icon: '🏃' },
  { id: 'rowing', label: 'Rowing', icon: '🚣' },
  { id: 'swimming', label: 'Swimming', icon: '🏊' },
  { id: 'cycling', label: 'Cycling', icon: '🚴' },
  { id: 'air_bike', label: 'Air Bike', icon: '💨' },
]

const CARDIO_GOALS = [
  { id: 'general_fitness', label: 'General Fitness', description: 'Maintain cardiovascular health' },
  { id: 'vo2_max', label: 'VO2 Max', description: 'Improve aerobic capacity' },
  { id: 'endurance', label: 'Endurance', description: 'Build long-duration capacity' },
  { id: 'speed', label: 'Speed/Power', description: 'Improve pace and intervals' },
  { id: 'event_prep', label: 'Event Prep', description: 'Training for a specific event' },
  { id: 'weight_loss', label: 'Fat Loss Support', description: 'Cardio for body composition' },
]

export function StepCardioGoals() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore()
  const [ruckingGoal, setRuckingGoal] = useState<string | null>(data.cardioGoals.ruckingGoal)
  const [ruckingTargetDistance, setRuckingTargetDistance] = useState(
    data.cardioGoals.ruckingTargetDistance?.toString() || ''
  )
  const [ruckingTargetLoad, setRuckingTargetLoad] = useState(
    data.cardioGoals.ruckingTargetLoad?.toString() || ''
  )
  const [cardioActivities, setCardioActivities] = useState<string[]>(
    data.cardioGoals.cardioActivities || ['running']
  )
  const [cardioGoal, setCardioGoal] = useState<string | null>(data.cardioGoals.runningGoal || 'general_fitness')

  const toggleCardioActivity = (activity: string) => {
    setCardioActivities((prev) =>
      prev.includes(activity)
        ? prev.filter((a) => a !== activity)
        : [...prev, activity]
    )
  }

  const handleContinue = () => {
    updateData({
      cardioGoals: {
        ruckingGoal,
        ruckingTargetDistance: ruckingTargetDistance ? parseFloat(ruckingTargetDistance) : null,
        ruckingTargetLoad: ruckingTargetLoad ? parseFloat(ruckingTargetLoad) : null,
        runningGoal: cardioGoal, // Keep for backwards compat
        cardioActivities,
        cardioGoal,
        runningTargetDistance: null,
        runningTargetPace: null,
      },
    })
    nextStep()
  }

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Cardio Goals
          </h1>
          <p className="text-zinc-400">
            What are you working toward with rucking and running?
          </p>
        </div>

        {/* Rucking Goals */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-green-500/20 rounded-lg">
              <Mountain className="w-4 h-4 text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Rucking</h2>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {RUCKING_GOALS.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setRuckingGoal(goal.id)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  ruckingGoal === goal.id
                    ? 'bg-green-500/20 border-green-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{goal.label}</span>
                  {ruckingGoal === goal.id && (
                    <Check className="w-4 h-4 text-green-400" />
                  )}
                </div>
                <p className="text-xs text-zinc-500">{goal.description}</p>
              </button>
            ))}
          </div>

          {/* Rucking Targets */}
          {ruckingGoal && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-900/50 rounded-lg">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Target Distance
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ruckingTargetDistance}
                    onChange={(e) => setRuckingTargetDistance(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 pr-10"
                    placeholder="10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                    km
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Target Load
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ruckingTargetLoad}
                    onChange={(e) => setRuckingTargetLoad(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 pr-10"
                    placeholder="20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                    kg
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cardio Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-orange-500/20 rounded-lg">
              <Heart className="w-4 h-4 text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Cardio</h2>
          </div>

          {/* Activity Selection */}
          <div className="mb-4">
            <label className="block text-sm text-zinc-400 mb-2">
              Which activities do you do?
            </label>
            <div className="flex flex-wrap gap-2">
              {CARDIO_ACTIVITIES.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => toggleCardioActivity(activity.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg border transition-all flex items-center gap-2',
                    cardioActivities.includes(activity.id)
                      ? 'bg-orange-500/20 border-orange-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  )}
                >
                  <span>{activity.icon}</span>
                  <span className="text-sm">{activity.label}</span>
                  {cardioActivities.includes(activity.id) && (
                    <Check className="w-3 h-3 text-orange-400" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Cardio Goals */}
          <div className="mb-4">
            <label className="block text-sm text-zinc-400 mb-2">
              Primary cardio goal
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CARDIO_GOALS.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => setCardioGoal(goal.id)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    cardioGoal === goal.id
                      ? 'bg-orange-500/20 border-orange-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{goal.label}</span>
                    {cardioGoal === goal.id && (
                      <Check className="w-4 h-4 text-orange-400" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">{goal.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* VO2 Max info */}
          {cardioGoal === 'vo2_max' && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-xs text-orange-300">
                <strong>VO2 Max focus:</strong> We&apos;ll include high-intensity intervals,
                tempo work, and structured cardio to maximize aerobic capacity.
              </p>
            </div>
          )}
        </div>

        {/* Skip option */}
        <div className="p-3 bg-zinc-900/30 rounded-lg">
          <p className="text-xs text-zinc-500">
            Not sure about specific goals? That&apos;s okay — select &quot;General Fitness&quot;
            and we&apos;ll build a balanced program you can adjust later.
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
