'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Play,
  Dumbbell,
  Clock,
  Target,
  Info,
  ChevronDown,
  ChevronUp,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  getPlannedSessionForDate,
  getPlannedExercises,
  getActiveMesocycle,
} from '@/lib/services/mesocycle-service'
import type { PlannedSession, PlannedExercise } from '@/types/database'
import { getExerciseById } from '@/lib/exercise-library'
import { rpeToRIR } from '@/lib/session-templates'

// Extended exercise data with library info
interface ExerciseWithDetails extends PlannedExercise {
  exerciseName?: string
  exerciseCues?: string[]
}

function SessionContent() {
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')

  const [session, setSession] = useState<PlannedSession | null>(null)
  const [exercises, setExercises] = useState<ExerciseWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const loadSession = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        // Get user ID from users table
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (!userData) {
          setLoading(false)
          return
        }

        const typedUserData = userData as { id: string }
        setUserId(typedUserData.id)

        // Get planned session for the requested date
        const targetDate = dateParam ? new Date(dateParam) : new Date()
        const plannedSession = await getPlannedSessionForDate(typedUserData.id, targetDate)

        if (plannedSession) {
          setSession(plannedSession)

          // Load exercises for this session
          const plannedExercises = await getPlannedExercises(plannedSession.id)

          // Enrich with exercise library data
          const enrichedExercises: ExerciseWithDetails[] = plannedExercises.map(ex => {
            const libraryExercise = getExerciseById(ex.exercise_id)
            return {
              ...ex,
              exerciseName: libraryExercise?.name || 'Unknown Exercise',
              exerciseCues: libraryExercise?.cues || [],
            }
          })

          setExercises(enrichedExercises)
        }
      } catch (error) {
        console.error('Error loading session:', error)
      }

      setLoading(false)
    }

    loadSession()
  }, [dateParam])

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-48 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-zinc-900 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-4">
        <header className="mb-6">
          <Link
            href="/program"
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Program
          </Link>
        </header>
        <div className="text-center py-12">
          <Dumbbell className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Rest Day</h2>
          <p className="text-zinc-500">No session scheduled for this day.</p>
          <Link
            href="/program"
            className="inline-block mt-4 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
          >
            View Full Program
          </Link>
        </div>
      </div>
    )
  }

  const isStrength = session.domain === 'strength'
  const sessionDate = new Date(session.scheduled_date)
  const isToday = new Date().toDateString() === sessionDate.toDateString()
  const targetRIR = session.target_rir ?? (session.target_rpe ? Math.round(10 - session.target_rpe) : 2)

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <header className="mb-6">
        <Link
          href="/program"
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Program
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-500">
              {sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              {isToday && <span className="ml-2 text-blue-400">Today</span>}
            </p>
            <h1 className="text-2xl font-bold text-white">{session.session_type}</h1>
            <p className="text-zinc-400 text-sm capitalize">{session.domain} Session • Week {session.week_number}</p>
          </div>

          {isStrength && (
            <Link
              href={`/session/${session.id}/execute`}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Start
            </Link>
          )}
        </div>
      </header>

      {/* Session Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-900 rounded-lg p-3 text-center">
          <Dumbbell className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <p className="text-lg font-semibold text-white">{session.estimated_total_sets || exercises.reduce((sum, e) => sum + e.sets, 0)}</p>
          <p className="text-xs text-zinc-500">Total Sets</p>
        </div>
        <div className="bg-zinc-900 rounded-lg p-3 text-center">
          <Target className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <p className="text-lg font-semibold text-white">RPE {session.target_rpe}</p>
          <p className="text-xs text-zinc-500">{targetRIR} RIR</p>
        </div>
        <div className="bg-zinc-900 rounded-lg p-3 text-center">
          <Clock className="w-5 h-5 text-orange-400 mx-auto mb-1" />
          <p className="text-lg font-semibold text-white">~{session.estimated_duration_mins}</p>
          <p className="text-xs text-zinc-500">Minutes</p>
        </div>
      </div>

      {/* Exercises List */}
      {isStrength && exercises.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">Exercises</h2>

          {exercises.map((exercise, index) => {
            const isExpanded = expandedExercise === exercise.id

            return (
              <div
                key={exercise.id}
                className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden"
              >
                {/* Exercise Header */}
                <button
                  onClick={() => setExpandedExercise(isExpanded ? null : exercise.id)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{exercise.exerciseName}</h3>
                      <p className="text-sm text-zinc-500 capitalize">
                        {exercise.target_muscle.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">
                        {exercise.sets} × {exercise.rep_range_min}-{exercise.rep_range_max}
                      </p>
                      <p className="text-xs text-zinc-500">
                        RPE {exercise.target_rpe}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-zinc-500" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
                    {/* Suggested Weight */}
                    {exercise.suggested_weight_kg && (
                      <div className="flex items-center justify-between py-2 px-3 bg-blue-500/10 rounded-lg mb-3 border border-blue-500/20">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-blue-300">Suggested Weight</span>
                        </div>
                        <span className="text-lg font-semibold text-white">
                          {exercise.suggested_weight_kg}kg
                        </span>
                      </div>
                    )}

                    {/* Set Breakdown */}
                    <div className="mb-3">
                      <p className="text-xs text-zinc-500 mb-2">SET BREAKDOWN</p>
                      <div className="space-y-1">
                        {Array.from({ length: exercise.sets }).map((_, setIndex) => (
                          <div
                            key={setIndex}
                            className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 rounded"
                          >
                            <span className="text-sm text-zinc-400">Set {setIndex + 1}</span>
                            <span className="text-sm text-white">
                              {exercise.rep_range_min}-{exercise.rep_range_max} reps @ RPE {exercise.target_rpe}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rest Time */}
                    <div className="flex items-center justify-between py-2 px-3 bg-zinc-800/30 rounded mb-3">
                      <span className="text-xs text-zinc-500">Rest between sets</span>
                      <span className="text-sm text-white">
                        {Math.floor(exercise.rest_seconds / 60)}:{(exercise.rest_seconds % 60).toString().padStart(2, '0')}
                      </span>
                    </div>

                    {/* Cues */}
                    {exercise.exerciseCues && exercise.exerciseCues.length > 0 && (
                      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="flex gap-2">
                          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-blue-400 mb-1">Form Cues</p>
                            <ul className="text-sm text-blue-300 space-y-1">
                              {exercise.exerciseCues.map((cue, i) => (
                                <li key={i}>• {cue}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {exercise.notes && (
                      <div className="mt-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <p className="text-sm text-amber-300">{exercise.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : isStrength ? (
        <div className="bg-zinc-900 rounded-lg p-6 text-center border border-zinc-800">
          <Dumbbell className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 mb-2">No exercises loaded for this session</p>
          <p className="text-sm text-zinc-500">
            Complete the onboarding to generate your program with exercises.
          </p>
        </div>
      ) : (
        // Cardio/Rucking Session
        <div className="bg-zinc-900 rounded-lg p-6 text-center border border-zinc-800">
          <p className="text-zinc-400 mb-4">
            {session.domain === 'rucking' ? (
              <>Complete your {session.session_type.toLowerCase()} at RPE {session.target_rpe}.</>
            ) : (
              <>Complete your {session.session_type.toLowerCase()} session at the prescribed intensity.</>
            )}
          </p>
          <p className="text-sm text-zinc-500">
            This session will sync from Garmin or can be logged manually.
          </p>
        </div>
      )}

      {/* Footer Action */}
      {isStrength && exercises.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 to-transparent">
          <Link
            href={`/session/${session.id}/execute`}
            className="block w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-center font-semibold rounded-lg transition-colors"
          >
            Start Workout
          </Link>
        </div>
      )}
    </div>
  )
}

export default function SessionPage() {
  return (
    <Suspense fallback={
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-48 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-zinc-900 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    }>
      <SessionContent />
    </Suspense>
  )
}
