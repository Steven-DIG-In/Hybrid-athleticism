'use client'

import { useState } from 'react'
import { useOnboardingStore, WeekDay } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const DAYS: { value: WeekDay; label: string; short: string }[] = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' },
  { value: 'sunday', label: 'Sunday', short: 'Sun' },
]

const DURATION_OPTIONS = [
  { value: 30, label: '30 min', description: 'Quick sessions' },
  { value: 45, label: '45 min', description: 'Focused training' },
  { value: 60, label: '60 min', description: 'Standard workout' },
  { value: 75, label: '75 min', description: 'Extended session' },
  { value: 90, label: '90 min', description: 'Full session' },
]

export function StepAvailability() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore()
  const [availableDays, setAvailableDays] = useState<WeekDay[]>(data.availableDays)
  const [duration, setDuration] = useState(data.preferredSessionDuration)
  const [maxSessions, setMaxSessions] = useState(data.maxSessionsPerDay)

  const toggleDay = (day: WeekDay) => {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleContinue = () => {
    updateData({
      availableDays,
      preferredSessionDuration: duration,
      maxSessionsPerDay: maxSessions,
    })
    nextStep()
  }

  const canContinue = availableDays.length >= 3 // Minimum 3 training days

  // Quick select helpers
  const selectWeekdays = () => {
    setAvailableDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
  }

  const selectAll = () => {
    setAvailableDays(DAYS.map((d) => d.value))
  }

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Training Availability
          </h1>
          <p className="text-zinc-400">
            When can you train? We&apos;ll build your schedule around this.
          </p>
        </div>

        {/* Days Selection */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-zinc-300">
              Available Days
            </label>
            <div className="flex gap-2">
              <button
                onClick={selectWeekdays}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Weekdays
              </button>
              <span className="text-zinc-600">|</span>
              <button
                onClick={selectAll}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                All days
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day) => (
              <button
                key={day.value}
                onClick={() => toggleDay(day.value)}
                className={cn(
                  'aspect-square rounded-lg border flex flex-col items-center justify-center transition-all',
                  availableDays.includes(day.value)
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                )}
              >
                <span className="text-xs font-medium">{day.short}</span>
                {availableDays.includes(day.value) && (
                  <Check className="w-3 h-3 mt-1 text-blue-400" />
                )}
              </button>
            ))}
          </div>

          <p className="text-xs text-zinc-500 mt-2">
            {availableDays.length} days selected
            {availableDays.length < 3 && (
              <span className="text-amber-500"> · Minimum 3 days required</span>
            )}
          </p>
        </div>

        {/* Session Duration */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Preferred Session Duration
          </label>
          <div className="grid grid-cols-5 gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                className={cn(
                  'py-3 px-2 rounded-lg border text-center transition-all',
                  duration === opt.value
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                )}
              >
                <span className="text-sm font-medium block">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Max Sessions Per Day */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Max Sessions Per Day
          </label>
          <p className="text-xs text-zinc-500 mb-3">
            Can you do two-a-days? (e.g., strength AM, run PM)
          </p>
          <div className="flex gap-3">
            {[1, 2].map((num) => (
              <button
                key={num}
                onClick={() => setMaxSessions(num)}
                className={cn(
                  'flex-1 py-4 rounded-lg border transition-all',
                  maxSessions === num
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                )}
              >
                <span className="text-lg font-semibold block">{num}</span>
                <span className="text-xs text-zinc-500">
                  {num === 1 ? 'session/day' : 'sessions/day'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <p className="text-sm text-zinc-400">
            Training capacity:{' '}
            <span className="text-white font-medium">
              {availableDays.length * maxSessions} sessions/week
            </span>
            {' '}×{' '}
            <span className="text-white font-medium">{duration} min</span>
            {' '}={' '}
            <span className="text-white font-medium">
              {Math.round((availableDays.length * maxSessions * duration) / 60)} hrs/week
            </span>
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
