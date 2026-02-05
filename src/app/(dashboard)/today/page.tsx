import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'
import { Dumbbell, Mountain, Timer, Plus, Calendar, ChevronRight, Settings } from 'lucide-react'
import { generateWeeklyPlan, type WeekDay, type DomainPriority } from '@/lib/program-generator'
import { WeeklyPlanCompact } from '@/components/program/weekly-plan-view'
import { TodaySessionsClient } from './today-sessions-client'

type Session = {
  id: string
  domain: 'strength' | 'rucking' | 'running'
  session_name: string | null
  strength_metrics: { total_sets?: number } | null
  distance_km: number | null
  duration_mins: number | null
  rpe: number | null
}

interface UserProfile {
  name: string | null
  available_days: string[] | null
  preferred_session_duration_mins: number | null
  max_sessions_per_day: number | null
}

// Fetch user priorities from a separate table or use defaults
// For now, we'll use localStorage on client side via a client component
// This is a simplified version - in production, priorities would be in DB

export default async function TodayPage() {
  const supabase = await createClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const currentDayName = format(new Date(), 'EEEE').toLowerCase() as WeekDay

  // Get user profile
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profileRaw } = await supabase
    .from('users')
    .select('name, available_days, preferred_session_duration_mins, max_sessions_per_day')
    .eq('auth_id', user!.id)
    .single()

  const profile = profileRaw as UserProfile | null

  // Get today's sessions
  const { data: todaySessionsRaw } = await supabase
    .from('actual_sessions')
    .select('*')
    .eq('session_date', today)
    .order('start_time', { ascending: true })

  const todaySessions = todaySessionsRaw as Session[] | null

  // Get this week's volume summary
  const { data: recentSessionsRaw } = await supabase
    .from('actual_sessions')
    .select('domain, strength_metrics, distance_km')
    .gte('session_date', format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))

  const recentSessions = recentSessionsRaw as Session[] | null

  // Calculate week totals
  const weekTotals = {
    strength: 0,
    rucking: 0,
    cardio: 0, // Note: DB still uses 'running' but we display as 'cardio'
  }

  recentSessions?.forEach((session) => {
    if (session.domain === 'strength' && session.strength_metrics) {
      weekTotals.strength += session.strength_metrics.total_sets || 0
    } else if (session.domain === 'rucking') {
      weekTotals.rucking += Number(session.distance_km) || 0
    } else if (session.domain === 'running') {
      weekTotals.cardio += Number(session.distance_km) || 0
    }
  })

  // Parse available days from profile
  const availableDays = (profile?.available_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) as WeekDay[]

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <header className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-zinc-500 text-sm">{format(new Date(), 'EEEE, MMMM d')}</p>
            <h1 className="text-2xl font-bold text-white">
              {profile?.name ? `Hey, ${profile.name.split(' ')[0]}` : 'Dashboard'}
            </h1>
          </div>
          <Link
            href="/settings"
            className="p-2 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Settings className="w-5 h-5 text-zinc-400" />
          </Link>
        </div>
      </header>

      {/* Today's Planned Sessions - Client Component for localStorage access */}
      <TodaySessionsClient
        currentDay={currentDayName}
        availableDays={availableDays}
        sessionDuration={profile?.preferred_session_duration_mins || 60}
        maxSessionsPerDay={profile?.max_sessions_per_day || 2}
        completedSessions={todaySessions || []}
      />

      {/* Weekly Volume Summary */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">This Week&apos;s Progress</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Dumbbell className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-zinc-400">Strength</span>
            </div>
            <p className="text-xl font-semibold text-white">{weekTotals.strength}</p>
            <p className="text-xs text-zinc-500">sets</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mountain className="w-4 h-4 text-green-400" />
              <span className="text-xs text-zinc-400">Rucking</span>
            </div>
            <p className="text-xl font-semibold text-white">{weekTotals.rucking.toFixed(1)}</p>
            <p className="text-xs text-zinc-500">km</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-zinc-400">Cardio</span>
            </div>
            <p className="text-xl font-semibold text-white">{weekTotals.cardio.toFixed(1)}</p>
            <p className="text-xs text-zinc-500">km</p>
          </div>
        </div>
      </section>

      {/* Logged Sessions Today */}
      {todaySessions && todaySessions.length > 0 && (
        <section className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-medium text-zinc-400">Completed Today</h2>
          </div>
          <div className="space-y-3">
            {todaySessions.map((session) => (
              <div
                key={session.id}
                className="bg-zinc-900 rounded-lg p-4 border border-zinc-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {session.domain === 'strength' && <Dumbbell className="w-4 h-4 text-blue-400" />}
                      {session.domain === 'rucking' && <Mountain className="w-4 h-4 text-green-400" />}
                      {session.domain === 'running' && <Timer className="w-4 h-4 text-orange-400" />}
                      <span className="font-medium text-white capitalize">
                        {session.session_name || (session.domain === 'running' ? 'Cardio' : session.domain)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">
                      {session.domain === 'strength' && session.strength_metrics
                        ? `${(session.strength_metrics as { total_sets?: number }).total_sets || 0} sets`
                        : session.distance_km
                          ? `${Number(session.distance_km).toFixed(1)} km`
                          : 'Completed'}
                      {session.duration_mins && ` · ${session.duration_mins} min`}
                    </p>
                  </div>
                  {session.rpe && (
                    <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-300">
                      RPE {session.rpe}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/log"
            className="flex items-center gap-3 p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Plus className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-white">Log Workout</p>
              <p className="text-xs text-zinc-500">Record a session</p>
            </div>
          </Link>
          <Link
            href="/program"
            className="flex items-center gap-3 p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-white">View Program</p>
              <p className="text-xs text-zinc-500">Weekly schedule</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}
