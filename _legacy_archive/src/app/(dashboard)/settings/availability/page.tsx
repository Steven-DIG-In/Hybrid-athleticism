'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekDay } from '@/lib/program-generator'

interface AvailabilityData {
  available_days: WeekDay[]
  preferred_session_duration_mins: number
  max_sessions_per_day: number
}

const DAYS: { value: WeekDay; label: string; short: string }[] = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' },
  { value: 'sunday', label: 'Sunday', short: 'Sun' },
]

const SESSION_DURATIONS = [30, 45, 60, 75, 90, 120]

export default function AvailabilityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<AvailabilityData>({
    available_days: [],
    preferred_session_duration_mins: 60,
    max_sessions_per_day: 2,
  })

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('available_days, preferred_session_duration_mins, max_sessions_per_day')
          .eq('auth_id', user.id)
          .single()

        const profileData = profile as AvailabilityData | null
        if (profileData) {
          setData({
            available_days: (profileData.available_days || []) as WeekDay[],
            preferred_session_duration_mins: profileData.preferred_session_duration_mins || 60,
            max_sessions_per_day: profileData.max_sessions_per_day || 2,
          })
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const toggleDay = (day: WeekDay) => {
    setData((prev) => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter((d) => d !== day)
        : [...prev.available_days, day],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      await supabase
        .from('users')
        .update({
          available_days: data.available_days,
          preferred_session_duration_mins: data.preferred_session_duration_mins,
          max_sessions_per_day: data.max_sessions_per_day,
        } as never)
        .eq('auth_id', user.id)

      // Also update localStorage
      try {
        const stored = localStorage.getItem('hybrid-onboarding')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.state?.data) {
            parsed.state.data.availableDays = data.available_days
            parsed.state.data.preferredSessionDuration = data.preferred_session_duration_mins
            parsed.state.data.maxSessionsPerDay = data.max_sessions_per_day
            localStorage.setItem('hybrid-onboarding', JSON.stringify(parsed))
          }
        }
      } catch {
        // Ignore localStorage errors
      }
    }

    setSaving(false)
    router.push('/settings')
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-32 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-zinc-900 rounded-lg"></div>
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
              <h1 className="text-xl font-bold text-white">Availability</h1>
              <p className="text-zinc-500 text-sm">Set your training schedule</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
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

      <div className="space-y-6">
        {/* Available Days */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Training Days</h2>
          <p className="text-xs text-zinc-500 mb-4">
            Select the days you can train. Your program will be scheduled around these days.
          </p>
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day) => {
              const isSelected = data.available_days.includes(day.value)
              return (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    'flex flex-col items-center justify-center p-3 rounded-lg border transition-all',
                    isSelected
                      ? 'bg-blue-500/20 border-blue-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                  )}
                >
                  <span className="text-xs font-medium">{day.short}</span>
                  {isSelected && <Check className="w-3 h-3 mt-1" />}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-zinc-500 mt-2 text-center">
            {data.available_days.length} days selected
          </p>
        </section>

        {/* Session Duration */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Session Duration</h2>
          <p className="text-xs text-zinc-500 mb-4">
            How long do you typically have for each workout?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SESSION_DURATIONS.map((duration) => (
              <button
                key={duration}
                onClick={() => setData({ ...data, preferred_session_duration_mins: duration })}
                className={cn(
                  'p-3 rounded-lg border text-center transition-all',
                  data.preferred_session_duration_mins === duration
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                )}
              >
                <span className="font-medium">{duration}</span>
                <span className="text-xs text-zinc-500 ml-1">min</span>
              </button>
            ))}
          </div>
        </section>

        {/* Max Sessions Per Day */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Sessions Per Day</h2>
          <p className="text-xs text-zinc-500 mb-4">
            Maximum number of training sessions you can do in one day (e.g., AM strength + PM cardio).
          </p>
          <div className="flex gap-2">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                onClick={() => setData({ ...data, max_sessions_per_day: num })}
                className={cn(
                  'flex-1 p-4 rounded-lg border text-center transition-all',
                  data.max_sessions_per_day === num
                    ? 'bg-blue-500/20 border-blue-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                )}
              >
                <span className="text-xl font-bold">{num}</span>
                <p className="text-xs text-zinc-500 mt-1">
                  {num === 1 ? 'session' : 'sessions'}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Summary */}
        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <p className="text-sm text-zinc-400">
            With these settings, you&apos;ll have up to{' '}
            <span className="text-white font-medium">
              {data.available_days.length * data.max_sessions_per_day} sessions
            </span>{' '}
            per week, averaging{' '}
            <span className="text-white font-medium">
              {Math.round((data.available_days.length * data.max_sessions_per_day * data.preferred_session_duration_mins) / 60)}h
            </span>{' '}
            of training time.
          </p>
        </div>
      </div>
    </div>
  )
}
