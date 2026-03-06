'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Settings, Dumbbell, Mountain, Timer, Info, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { type TrainingDomain } from '@/lib/program-generator'

const DOMAIN_CONFIG: Record<TrainingDomain, { icon: typeof Dumbbell; color: string; bgColor: string; label: string }> = {
  strength: { icon: Dumbbell, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Strength' },
  rucking: { icon: Mountain, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Rucking' },
  cardio: { icon: Timer, color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: 'Cardio' },
}

interface DBPlannedSession {
  id: string
  week_number: number
  day_of_week: string
  scheduled_date: string
  session_type: string
  domain: string
  target_rpe: number
  estimated_duration_mins: number
  estimated_total_sets: number
  status: string
}

interface Mesocycle {
  id: string
  name: string
  start_date: string
  end_date: string
  total_weeks: number
  status: string
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ProgramPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<DBPlannedSession[]>([])
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProgram() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setError('Not authenticated')
          setIsLoading(false)
          return
        }

        // Get user ID
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (!userData) {
          setError('User profile not found')
          setIsLoading(false)
          return
        }

        const userId = (userData as { id: string }).id

        // Get active mesocycle
        const { data: mesoData, error: mesoError } = await supabase
          .from('mesocycles')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (mesoError || !mesoData) {
          setError('No active program found. Complete onboarding to generate a program.')
          setIsLoading(false)
          return
        }

        setMesocycle(mesoData as Mesocycle)

        // Get all planned sessions for this mesocycle
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('planned_sessions')
          .select('*')
          .eq('mesocycle_id', (mesoData as Mesocycle).id)
          .order('scheduled_date', { ascending: true })

        if (sessionsError) {
          console.error('Error fetching sessions:', sessionsError)
          setError('Failed to load sessions')
          setIsLoading(false)
          return
        }

        setSessions((sessionsData || []) as DBPlannedSession[])

        // Determine current week based on today's date
        const today = new Date()
        const mesoStart = new Date((mesoData as Mesocycle).start_date)
        const daysSinceStart = Math.floor((today.getTime() - mesoStart.getTime()) / (1000 * 60 * 60 * 24))
        const calculatedWeek = Math.max(1, Math.min(Math.ceil((daysSinceStart + 1) / 7), (mesoData as Mesocycle).total_weeks))
        setCurrentWeek(calculatedWeek)

      } catch (err) {
        console.error('Error loading program:', err)
        setError('Failed to load program')
      } finally {
        setIsLoading(false)
      }
    }

    loadProgram()
  }, [])

  // Get sessions for the current week
  const weekSessions = sessions.filter(s => s.week_number === currentWeek)

  // Group sessions by day
  const sessionsByDay = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = weekSessions.filter(s => s.day_of_week === day)
    return acc
  }, {} as Record<string, DBPlannedSession[]>)

  // Get today's day name
  const today = new Date()
  const todayDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1
  const todayName = DAYS_OF_WEEK[todayDayIndex]

  // Calculate week date range
  const getWeekDateRange = (weekNum: number): { start: Date; end: Date } | null => {
    if (!mesocycle) return null
    const mesoStart = new Date(mesocycle.start_date)
    const weekStart = new Date(mesoStart)
    weekStart.setDate(mesoStart.getDate() + (weekNum - 1) * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    return { start: weekStart, end: weekEnd }
  }

  const weekRange = getWeekDateRange(currentWeek)

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-48 mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="h-16 bg-zinc-900 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <header className="mb-6">
          <Link
            href="/today"
            className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors inline-block"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white mt-4">Your Program</h1>
        </header>
        <div className="bg-zinc-900 rounded-lg p-6 text-center border border-zinc-800">
          <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">{error}</p>
          <Link
            href="/onboarding"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            Start Onboarding
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/today"
            className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link
            href="/settings"
            className="p-2 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Settings className="w-5 h-5 text-zinc-400" />
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white">{mesocycle?.name || 'Your Program'}</h1>
        <p className="text-zinc-400 text-sm">
          {mesocycle?.total_weeks} week mesocycle
        </p>
      </header>

      {/* Week Navigation */}
      <section className="mb-6">
        <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-800">
          <button
            onClick={() => setCurrentWeek(w => Math.max(1, w - 1))}
            disabled={currentWeek === 1}
            className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="font-semibold text-white">Week {currentWeek}</p>
            {weekRange && (
              <p className="text-xs text-zinc-500">
                {weekRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}
            {currentWeek === mesocycle?.total_weeks && (
              <span className="text-xs text-amber-400">Deload Week</span>
            )}
          </div>
          <button
            onClick={() => setCurrentWeek(w => Math.min(mesocycle?.total_weeks || w, w + 1))}
            disabled={currentWeek === mesocycle?.total_weeks}
            className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Weekly Schedule */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Schedule</h2>
        <div className="space-y-2">
          {DAYS_OF_WEEK.map((day, index) => {
            const daySessions = sessionsByDay[day] || []
            const isToday = day === todayName
            const shortDay = SHORT_DAYS[index]

            return (
              <div
                key={day}
                className={cn(
                  'bg-zinc-900 rounded-lg border transition-colors',
                  isToday ? 'border-blue-500/50' : 'border-zinc-800'
                )}
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm font-medium',
                        isToday ? 'text-blue-400' : 'text-zinc-300'
                      )}>
                        {shortDay}
                      </span>
                      {isToday && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                          Today
                        </span>
                      )}
                    </div>
                    {daySessions.length > 0 && (
                      <span className="text-xs text-zinc-500">
                        {daySessions.length} session{daySessions.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {daySessions.length > 0 ? (
                    <div className="space-y-2">
                      {daySessions.map((session) => {
                        const domain = session.domain as TrainingDomain
                        const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.cardio
                        const Icon = config.icon

                        return (
                          <button
                            key={session.id}
                            onClick={() => {
                              router.push(`/session/${session.id}/execute`)
                            }}
                            className="w-full flex items-center gap-3 p-2 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors text-left"
                          >
                            <div className={cn('p-2 rounded-lg', config.bgColor)}>
                              <Icon className={cn('w-4 h-4', config.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white text-sm truncate">
                                {session.session_type}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {session.estimated_total_sets > 0 && `${session.estimated_total_sets} sets · `}
                                RPE {session.target_rpe} · ~{session.estimated_duration_mins}m
                              </p>
                            </div>
                            <span className={cn(
                              'text-xs px-2 py-1 rounded',
                              session.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              session.status === 'skipped' ? 'bg-zinc-700 text-zinc-400' :
                              'bg-zinc-800 text-zinc-400'
                            )}>
                              {session.status === 'completed' ? 'Done' :
                               session.status === 'skipped' ? 'Skipped' : 'Planned'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">Rest day</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Week Summary */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Week Summary</h2>
        <div className="grid grid-cols-3 gap-2">
          {(['strength', 'rucking', 'cardio'] as TrainingDomain[]).map((domain) => {
            const config = DOMAIN_CONFIG[domain]
            const Icon = config.icon
            const count = weekSessions.filter(s => s.domain === domain).length

            return (
              <div
                key={domain}
                className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 text-center"
              >
                <Icon className={cn('w-5 h-5 mx-auto mb-1', config.color)} />
                <p className="text-lg font-semibold text-white">{count}</p>
                <p className="text-xs text-zinc-500">{config.label}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Info */}
      <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          <div>
            <p className="text-sm text-zinc-400">
              Tap any session to start your workout. Sessions can be completed in any order.
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Need to change your schedule? Go to <Link href="/settings/availability" className="text-blue-400 hover:underline">Settings</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
