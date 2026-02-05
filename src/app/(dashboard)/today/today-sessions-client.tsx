'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dumbbell, Mountain, Timer, ChevronRight, Play, Check, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  generateWeeklyPlan,
  getTodaysSessions,
  type WeeklyPlan,
  type PlannedSession,
  type WeekDay,
  type DomainPriority,
  type TrainingDomain,
} from '@/lib/program-generator'
import { WeeklyPlanCompact } from '@/components/program/weekly-plan-view'

const DOMAIN_CONFIG: Record<TrainingDomain, { icon: typeof Dumbbell; color: string; bgColor: string; label: string }> = {
  strength: { icon: Dumbbell, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Strength' },
  rucking: { icon: Mountain, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Rucking' },
  cardio: { icon: Timer, color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: 'Cardio' },
}

interface TodaySessionsClientProps {
  currentDay: WeekDay
  availableDays: WeekDay[]
  sessionDuration: number
  maxSessionsPerDay: number
  completedSessions: Array<{
    id: string
    domain: 'strength' | 'rucking' | 'running'
    session_name: string | null
  }>
}

interface OnboardingData {
  strengthPriority: DomainPriority
  ruckingPriority: DomainPriority
  runningPriority: DomainPriority
  availableDays: WeekDay[]
  preferredSessionDuration: number
  maxSessionsPerDay: number
}

function getOnboardingData(): OnboardingData | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem('hybrid-onboarding')
    if (!stored) return null

    const parsed = JSON.parse(stored)
    return parsed.state?.data || null
  } catch {
    return null
  }
}

export function TodaySessionsClient({
  currentDay,
  availableDays: serverAvailableDays,
  sessionDuration: serverSessionDuration,
  maxSessionsPerDay: serverMaxSessions,
  completedSessions,
}: TodaySessionsClientProps) {
  const router = useRouter()
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [todaySessions, setTodaySessions] = useState<PlannedSession[]>([])
  const [plannedSessionsFromDB, setPlannedSessionsFromDB] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasRealProgram, setHasRealProgram] = useState(false)

  useEffect(() => {
    async function loadSessions() {
      try {
        const supabase = (await import('@/lib/supabase/client')).createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setIsLoading(false)
          return
        }

        // Get user ID from users table
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (!userData) {
          setIsLoading(false)
          return
        }

        const userId = (userData as { id: string }).id

        // Check if an active mesocycle exists for this user
        const { data: activeMeso, error: mesoError } = await supabase
          .from('mesocycles')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1)
          .single()

        if (activeMeso) {
          // User has an active program! Use database source of truth.
          setHasRealProgram(true)

          // Try to fetch today's planned sessions
          // Fix: Use local date instead of UTC to match user's perspective
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          const todayDate = `${year}-${month}-${day}`

          console.log('Fetching sessions for:', todayDate)

          const { data: dbSessions } = await supabase
            .from('planned_sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('scheduled_date', todayDate)

          if (dbSessions && dbSessions.length > 0) {
            setPlannedSessionsFromDB(dbSessions)
          } else {
            // It's a rest day in the real program
            setPlannedSessionsFromDB([])
          }
          setIsLoading(false)
          return
        }

        // Fallback: No active mesocycle, generate in-memory plan (e.g. pre-onboarding)
        const onboardingData = getOnboardingData()
        const priorities = onboardingData || {
          strengthPriority: 'primary' as DomainPriority,
          ruckingPriority: 'secondary' as DomainPriority,
          runningPriority: 'secondary' as DomainPriority,
          availableDays: serverAvailableDays,
          preferredSessionDuration: serverSessionDuration,
          maxSessionsPerDay: serverMaxSessions,
        }

        const availableDays = onboardingData?.availableDays?.length
          ? onboardingData.availableDays
          : serverAvailableDays

        const generatedPlan = generateWeeklyPlan({
          availableDays,
          strengthPriority: priorities.strengthPriority,
          ruckingPriority: priorities.ruckingPriority,
          cardioPriority: priorities.runningPriority,
          preferredSessionDuration: priorities.preferredSessionDuration || serverSessionDuration,
          maxSessionsPerDay: priorities.maxSessionsPerDay || serverMaxSessions,
        })

        setPlan(generatedPlan)
        const todaysPlan = generatedPlan.sessions.filter(s => s.day === currentDay)
        setTodaySessions(todaysPlan)
      } catch (error) {
        console.error('Error loading sessions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSessions()
  }, [currentDay, serverAvailableDays, serverSessionDuration, serverMaxSessions])

  // Check if a session type has been completed
  const isSessionCompleted = (session: PlannedSession) => {
    // Map our domain to DB domain (cardio -> running in DB)
    const dbDomain = session.domain === 'cardio' ? 'running' : session.domain
    return completedSessions.some(cs => cs.domain === dbDomain)
  }

  if (isLoading) {
    return (
      <section className="mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-zinc-800 rounded w-32 mb-3"></div>
          <div className="h-24 bg-zinc-900 rounded-lg"></div>
        </div>
      </section>
    )
  }

  return (
    <>
      {/* Today's Planned Sessions */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-medium text-zinc-400">Today&apos;s Plan</h2>
          <Link
            href="/program"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            Full week
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {hasRealProgram && plannedSessionsFromDB.length > 0 ? (
          <div className="space-y-3">
            {plannedSessionsFromDB.map((session) => {
              const domain = session.domain as 'strength' | 'rucking' | 'cardio'
              const config = DOMAIN_CONFIG[domain]
              const Icon = config.icon
              // Check if completed by matching domain
              const dbDomain = domain === 'cardio' ? 'running' : domain
              const completed = completedSessions.some(cs => cs.domain === dbDomain)

              return (
                <button
                  key={session.id}
                  onClick={() => {
                    const date = session.scheduled_date
                    router.push(`/session?date=${date}`)
                  }}
                  className={cn(
                    'w-full text-left bg-zinc-900 rounded-lg p-4 border transition-all',
                    completed
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center',
                      completed ? 'bg-green-500/20' : config.bgColor
                    )}>
                      {completed ? (
                        <Check className="w-6 h-6 text-green-400" />
                      ) : (
                        <Icon className={cn('w-6 h-6', config.color)} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={cn(
                          'font-semibold',
                          completed ? 'text-green-400' : 'text-white'
                        )}>
                          {session.session_type}
                        </h3>
                        {completed && (
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                            Done
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500">
                        {session.estimated_total_sets ? `${session.estimated_total_sets} sets` : `Week ${session.week_number}`} · RPE {session.target_rpe}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">
                        ~{session.estimated_duration_mins}m
                      </span>
                      {!completed && (
                        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <Play className="w-4 h-4 text-blue-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : todaySessions.length > 0 ? (
          <div className="space-y-3">
            {todaySessions.map((session) => {
              const config = DOMAIN_CONFIG[session.domain]
              const Icon = config.icon
              const completed = isSessionCompleted(session)

              return (
                <button
                  key={session.id}
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0]
                    router.push(`/session?date=${today}`)
                  }}
                  className={cn(
                    'w-full text-left bg-zinc-900 rounded-lg p-4 border transition-all',
                    completed
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center',
                      completed ? 'bg-green-500/20' : config.bgColor
                    )}>
                      {completed ? (
                        <Check className="w-6 h-6 text-green-400" />
                      ) : (
                        <Icon className={cn('w-6 h-6', config.color)} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={cn(
                          'font-semibold',
                          completed ? 'text-green-400' : 'text-white'
                        )}>
                          {session.sessionType}
                        </h3>
                        {completed && (
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                            Done
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500">
                        {session.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">
                        ~{session.estimatedDuration}m
                      </span>
                      {!completed && (
                        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <Play className="w-4 h-4 text-blue-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-lg p-6 text-center border border-zinc-800">
            <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-zinc-500" />
            </div>
            <p className="text-zinc-400 font-medium">Rest Day</p>
            <p className="text-sm text-zinc-500 mt-1">
              Recovery is when you grow stronger. Take it easy!
            </p>
          </div>
        )}
      </section>

      {/* Weekly Overview - Only show if using in-memory plan */}
      {!hasRealProgram && plan && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Week at a Glance</h2>
          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <WeeklyPlanCompact plan={plan} currentDay={currentDay} />
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800">
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500/50" />
                  <span className="text-zinc-400">{plan.domainBreakdown.strength} Strength</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500/50" />
                  <span className="text-zinc-400">{plan.domainBreakdown.rucking} Rucking</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-orange-500/50" />
                  <span className="text-zinc-400">{plan.domainBreakdown.cardio} Cardio</span>
                </div>
              </div>
              <span className="text-xs text-zinc-500">
                ~{plan.totalHours.toFixed(0)}h/week
              </span>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
