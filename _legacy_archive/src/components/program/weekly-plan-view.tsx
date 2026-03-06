'use client'

import { Dumbbell, Mountain, Timer, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type WeeklyPlan,
  type PlannedSession,
  type WeekDay,
  type TrainingDomain,
  getShortDayName,
} from '@/lib/program-generator'

const DAY_ORDER: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DOMAIN_CONFIG: Record<TrainingDomain, { icon: typeof Dumbbell; color: string; bgColor: string }> = {
  strength: { icon: Dumbbell, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  rucking: { icon: Mountain, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  cardio: { icon: Timer, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
}

interface WeeklyPlanViewProps {
  plan: WeeklyPlan
  currentDay?: WeekDay
  onSessionClick?: (session: PlannedSession) => void
}

export function WeeklyPlanView({ plan, currentDay, onSessionClick }: WeeklyPlanViewProps) {
  // Determine current day if not provided
  const today = currentDay || DAY_ORDER[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

  // Group sessions by day
  const sessionsByDay = DAY_ORDER.reduce((acc, day) => {
    acc[day] = plan.sessions.filter(s => s.day === day)
    return acc
  }, {} as Record<WeekDay, PlannedSession[]>)

  return (
    <div className="space-y-2">
      {DAY_ORDER.map((day) => {
        const sessions = sessionsByDay[day]
        const isToday = day === today
        const hasSessions = sessions.length > 0

        return (
          <div
            key={day}
            className={cn(
              'rounded-lg border transition-all',
              isToday
                ? 'bg-zinc-900 border-blue-500/50'
                : hasSessions
                  ? 'bg-zinc-900/50 border-zinc-800'
                  : 'bg-zinc-950/50 border-zinc-800/50'
            )}
          >
            {/* Day Header */}
            <div className={cn(
              'flex items-center justify-between px-4 py-2',
              hasSessions ? '' : 'opacity-50'
            )}>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-medium',
                  isToday ? 'text-blue-400' : 'text-zinc-400'
                )}>
                  {getShortDayName(day)}
                </span>
                {isToday && (
                  <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                    Today
                  </span>
                )}
              </div>
              {hasSessions && (
                <span className="text-xs text-zinc-500">
                  {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Sessions */}
            {hasSessions && (
              <div className="px-4 pb-3 space-y-2">
                {sessions.map((session) => {
                  const domainConfig = DOMAIN_CONFIG[session.domain]
                  const Icon = domainConfig.icon

                  return (
                    <button
                      key={session.id}
                      onClick={() => onSessionClick?.(session)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg',
                        'bg-zinc-800/50 hover:bg-zinc-800 transition-colors',
                        'text-left'
                      )}
                    >
                      <div className={cn('p-2 rounded-lg', domainConfig.bgColor)}>
                        <Icon className={cn('w-4 h-4', domainConfig.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {session.sessionType}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {session.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">
                          {session.estimatedDuration}m
                        </span>
                        <ChevronRight className="w-4 h-4 text-zinc-600" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Rest Day */}
            {!hasSessions && (
              <div className="px-4 pb-3">
                <p className="text-xs text-zinc-600 italic">Rest day</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Compact version for dashboard sidebar or summary
 */
export function WeeklyPlanCompact({ plan, currentDay }: { plan: WeeklyPlan; currentDay?: WeekDay }) {
  const today = currentDay || DAY_ORDER[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

  return (
    <div className="flex gap-1">
      {DAY_ORDER.map((day) => {
        const sessions = plan.sessions.filter(s => s.day === day)
        const isToday = day === today

        return (
          <div
            key={day}
            className={cn(
              'flex-1 rounded-lg p-2 text-center transition-all',
              isToday ? 'ring-2 ring-blue-500' : '',
              sessions.length > 0 ? 'bg-zinc-800' : 'bg-zinc-900'
            )}
          >
            <p className={cn(
              'text-xs font-medium mb-1',
              isToday ? 'text-blue-400' : 'text-zinc-500'
            )}>
              {getShortDayName(day).charAt(0)}
            </p>
            <div className="flex flex-col gap-0.5 items-center">
              {sessions.length > 0 ? (
                sessions.map((session) => {
                  const config = DOMAIN_CONFIG[session.domain]
                  return (
                    <div
                      key={session.id}
                      className={cn('w-2 h-2 rounded-full', config.bgColor)}
                      title={session.sessionType}
                    />
                  )
                })
              ) : (
                <div className="w-2 h-2" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
