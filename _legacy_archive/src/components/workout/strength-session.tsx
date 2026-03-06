'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2, Check, Scale, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Exercise } from '@/types/database'
import { calculateE1RM, roundToIncrement, getBestE1RMFromSets } from '@/lib/strength'
import { getPlannedExercises, updateSessionStatus, saveLiftMax } from '@/lib/services/mesocycle-service'
import { getExerciseById, EXERCISE_LIBRARY } from '@/lib/exercise-library'

interface SetEntry {
  id: string
  set_number: number
  weight_kg: number
  reps: number
  rir: number | null
  set_type: 'warmup' | 'working' | 'backoff' | 'dropset' | 'failure'
}

interface ExerciseEntry {
  exercise_id: string
  exercise_name: string
  primary_muscles: string[]
  suggested_weight_kg: number | null
  target_sets: number
  target_rep_min: number
  target_rep_max: number
  target_rpe: number | null
  sets: SetEntry[]
}

interface Props {
  onBack: () => void
  plannedSessionId?: string | null
}

export function StrengthSession({ onBack, plannedSessionId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = plannedSessionId || searchParams.get('session')

  const [exercises, setExercises] = useState<ExerciseEntry[]>([])
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([])
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [sessionStartTime] = useState(new Date())
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [prAchieved, setPrAchieved] = useState<string[]>([])

  // Load user and planned exercises
  useEffect(() => {
    const loadSession = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // Get user profile
      const { data: profileData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      const profile = profileData as { id: string } | null
      if (profile) {
        setUserId(profile.id)
      }

      // Load planned exercises if we have a session ID
      if (sessionId) {
        const plannedExercises = await getPlannedExercises(sessionId)

        if (plannedExercises.length > 0) {
          const exerciseEntries: ExerciseEntry[] = plannedExercises.map(pe => {
            const libraryExercise = getExerciseById(pe.exercise_id)

            return {
              exercise_id: pe.exercise_id,
              exercise_name: libraryExercise?.name || 'Unknown Exercise',
              primary_muscles: libraryExercise?.primaryMuscles || [pe.target_muscle],
              suggested_weight_kg: pe.suggested_weight_kg,
              target_sets: pe.sets,
              target_rep_min: pe.rep_range_min,
              target_rep_max: pe.rep_range_max,
              target_rpe: pe.target_rpe,
              sets: Array.from({ length: pe.sets }, (_, i) => ({
                id: crypto.randomUUID(),
                set_number: i + 1,
                weight_kg: pe.suggested_weight_kg || 0,
                reps: 0,
                rir: pe.target_rir ?? 2,
                set_type: 'working' as const,
              })),
            }
          })

          setExercises(exerciseEntries)
        }
      }

      // Load available exercises from database for adding more
      const { data: dbExercises } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (dbExercises) {
        setAvailableExercises(dbExercises as Exercise[])
      }

      setLoading(false)
    }

    loadSession()
  }, [sessionId])

  const filteredExercises = availableExercises.filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.primary_muscles.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const addExercise = (exercise: Exercise) => {
    setExercises(prev => [...prev, {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      primary_muscles: exercise.primary_muscles,
      suggested_weight_kg: null,
      target_sets: 3,
      target_rep_min: 8,
      target_rep_max: 12,
      target_rpe: 8,
      sets: [{
        id: crypto.randomUUID(),
        set_number: 1,
        weight_kg: 0,
        reps: 0,
        rir: 2,
        set_type: 'working',
      }]
    }])
    setShowExercisePicker(false)
    setSearchQuery('')
  }

  // Also allow adding from library if DB exercises not loaded
  const addExerciseFromLibrary = (exercise: typeof EXERCISE_LIBRARY[0]) => {
    setExercises(prev => [...prev, {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      primary_muscles: exercise.primaryMuscles,
      suggested_weight_kg: null,
      target_sets: 3,
      target_rep_min: exercise.repRangeMin,
      target_rep_max: exercise.repRangeMax,
      target_rpe: 8,
      sets: [{
        id: crypto.randomUUID(),
        set_number: 1,
        weight_kg: 0,
        reps: 0,
        rir: 2,
        set_type: 'working',
      }]
    }])
    setShowExercisePicker(false)
    setSearchQuery('')
  }

  const addSet = (exerciseIndex: number) => {
    setExercises(prev => {
      const updated = [...prev]
      const lastSet = updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1]
      updated[exerciseIndex].sets.push({
        id: crypto.randomUUID(),
        set_number: updated[exerciseIndex].sets.length + 1,
        weight_kg: lastSet?.weight_kg || updated[exerciseIndex].suggested_weight_kg || 0,
        reps: lastSet?.reps || 0,
        rir: lastSet?.rir ?? 2,
        set_type: 'working',
      })
      return updated
    })
  }

  const updateSet = (exerciseIndex: number, setIndex: number, field: keyof SetEntry, value: number | string | null) => {
    setExercises(prev => {
      const updated = [...prev]
      updated[exerciseIndex].sets[setIndex] = {
        ...updated[exerciseIndex].sets[setIndex],
        [field]: value,
      }
      return updated
    })
  }

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExercises(prev => {
      const updated = [...prev]
      updated[exerciseIndex].sets.splice(setIndex, 1)
      updated[exerciseIndex].sets.forEach((set, i) => {
        set.set_number = i + 1
      })
      if (updated[exerciseIndex].sets.length === 0) {
        updated.splice(exerciseIndex, 1)
      }
      return updated
    })
  }

  // Calculate E1RM for an exercise's best set
  const getExerciseE1RM = (entry: ExerciseEntry): number | null => {
    const validSets = entry.sets.filter(s => s.weight_kg > 0 && s.reps > 0 && s.set_type === 'working')
    if (validSets.length === 0) return null

    const result = getBestE1RMFromSets(
      validSets.map(s => ({
        weight_kg: s.weight_kg,
        reps: s.reps,
        rir: s.rir,
        set_type: s.set_type,
      }))
    )

    return result?.e1rm || null
  }

  const saveSession = async () => {
    if (exercises.length === 0 || !userId) return

    setSaving(true)
    const supabase = createClient()

    // Calculate session metrics
    const totalSets = exercises.reduce((acc, ex) =>
      acc + ex.sets.filter(s => s.set_type === 'working').length, 0
    )
    const totalReps = exercises.reduce((acc, ex) =>
      acc + ex.sets.filter(s => s.set_type === 'working').reduce((a, s) => a + s.reps, 0), 0
    )
    const totalVolume = exercises.reduce((acc, ex) =>
      acc + ex.sets.filter(s => s.set_type === 'working').reduce((a, s) => a + (s.weight_kg * s.reps), 0), 0
    )

    // Calculate muscle group sets
    const muscleGroupSets: Record<string, number> = {}
    exercises.forEach(ex => {
      const workingSets = ex.sets.filter(s => s.set_type === 'working').length
      ex.primary_muscles.forEach(muscle => {
        muscleGroupSets[muscle] = (muscleGroupSets[muscle] || 0) + workingSets
      })
    })

    const endTime = new Date()
    const durationMins = Math.round((endTime.getTime() - sessionStartTime.getTime()) / 60000)

    // Create actual session
    const { data: session, error: sessionError } = await supabase
      .from('actual_sessions')
      .insert({
        user_id: userId,
        session_date: new Date().toISOString().split('T')[0],
        start_time: sessionStartTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_mins: durationMins,
        domain: 'strength',
        session_name: exercises.map(e => e.exercise_name).slice(0, 2).join(', '),
        planned_session_id: sessionId || null,
        strength_metrics: {
          total_sets: totalSets,
          total_reps: totalReps,
          total_volume_kg: totalVolume,
          muscle_group_sets: muscleGroupSets,
        },
        volume_contribution: totalSets,
      } as never)
      .select()
      .single()

    const typedSession = session as { id: string } | null

    if (sessionError || !typedSession) {
      console.error('Session error:', sessionError)
      setSaving(false)
      return
    }

    // Create set logs
    const setLogs = exercises.flatMap(ex =>
      ex.sets.map(set => ({
        actual_session_id: typedSession.id,
        exercise_id: ex.exercise_id,
        set_number: set.set_number,
        weight_kg: set.weight_kg,
        reps: set.reps,
        rir: set.rir,
        set_type: set.set_type,
      }))
    )

    const { error: setsError } = await supabase
      .from('set_logs')
      .insert(setLogs as never[])

    if (setsError) {
      console.error('Sets error:', setsError)
    }

    // Update E1RMs for each exercise
    const newPRs: string[] = []
    for (const ex of exercises) {
      const newE1RM = getExerciseE1RM(ex)
      if (newE1RM && newE1RM > 0) {
        // Get current E1RM
        const { data: currentMax } = await supabase
          .from('user_lift_maxes')
          .select('estimated_1rm_kg, pr_weight_kg')
          .eq('user_id', userId)
          .eq('exercise_id', ex.exercise_id)
          .single() as { data: { estimated_1rm_kg: number | null; pr_weight_kg: number | null } | null }

        const currentE1RM = currentMax?.estimated_1rm_kg || 0
        const currentPR = currentMax?.pr_weight_kg || 0

        // Check if it's a new PR
        const isPR = newE1RM > currentPR

        if (isPR) {
          newPRs.push(ex.exercise_name)
        }

        // Update lift max if it's better
        if (newE1RM >= currentE1RM) {
          await saveLiftMax(userId, ex.exercise_id, {
            estimated_1rm_kg: newE1RM,
            training_max_kg: roundToIncrement(newE1RM * 0.9, 2.5),
            source: 'estimated',
            ...(isPR ? { pr_weight_kg: newE1RM } : {}),
          } as any)

          // Record in history
          const bestSet = ex.sets
            .filter(s => s.weight_kg > 0 && s.reps > 0)
            .sort((a, b) => {
              const e1rmA = calculateE1RM({ weight: a.weight_kg, reps: a.reps, rir: a.rir || 0 })
              const e1rmB = calculateE1RM({ weight: b.weight_kg, reps: b.reps, rir: b.rir || 0 })
              return e1rmB.e1rm - e1rmA.e1rm
            })[0]

          if (bestSet) {
            await supabase
              .from('lift_max_history')
              .insert({
                user_id: userId,
                exercise_id: ex.exercise_id,
                recorded_date: new Date().toISOString().split('T')[0],
                e1rm_kg: newE1RM,
                source: 'session',
                weight_kg: bestSet.weight_kg,
                reps: bestSet.reps,
                rir: bestSet.rir,
                actual_session_id: typedSession.id,
              } as never)
          }
        }
      }
    }

    // Mark planned session as completed
    if (sessionId) {
      await updateSessionStatus(sessionId, 'completed', typedSession.id)
    }

    setPrAchieved(newPRs)

    // If PRs achieved, show briefly then redirect
    if (newPRs.length > 0) {
      setTimeout(() => {
        router.push('/today')
        router.refresh()
      }, 2000)
    } else {
      setSaving(false)
      router.push('/today')
      router.refresh()
    }
  }

  // Format weight for display
  const formatWeight = (kg: number): string => {
    return kg % 1 === 0 ? kg.toString() : kg.toFixed(1)
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-48"></div>
          <div className="h-32 bg-zinc-900 rounded-lg"></div>
          <div className="h-32 bg-zinc-900 rounded-lg"></div>
        </div>
      </div>
    )
  }

  // PR celebration
  if (prAchieved.length > 0) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center z-50">
        <div className="text-center p-8">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-10 h-10 text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">New PR! 🎉</h1>
          <p className="text-zinc-400 mb-4">
            {prAchieved.length === 1
              ? `You set a new estimated 1RM on ${prAchieved[0]}!`
              : `You set new PRs on ${prAchieved.join(' and ')}!`}
          </p>
          <div className="animate-pulse text-sm text-zinc-500">Saving...</div>
        </div>
      </div>
    )
  }

  // Exercise Picker Modal
  if (showExercisePicker) {
    const combinedExercises = availableExercises.length > 0
      ? filteredExercises
      : EXERCISE_LIBRARY.filter(ex =>
          ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ex.primaryMuscles.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
        )

    return (
      <div className="fixed inset-0 bg-zinc-950 z-50 overflow-auto">
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => {
                setShowExercisePicker(false)
                setSearchQuery('')
              }}
              className="text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-white">Add Exercise</h2>
          </div>

          <input
            type="text"
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            autoFocus
          />

          <div className="space-y-2">
            {availableExercises.length > 0 ? (
              filteredExercises.map(exercise => (
                <button
                  key={exercise.id}
                  onClick={() => addExercise(exercise)}
                  className="w-full text-left p-4 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <p className="font-medium text-white">{exercise.name}</p>
                  <p className="text-sm text-zinc-500">
                    {exercise.primary_muscles.join(', ')}
                  </p>
                </button>
              ))
            ) : (
              EXERCISE_LIBRARY
                .filter(ex =>
                  ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  ex.primaryMuscles.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                .slice(0, 20)
                .map(exercise => (
                  <button
                    key={exercise.id}
                    onClick={() => addExerciseFromLibrary(exercise)}
                    className="w-full text-left p-4 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    <p className="font-medium text-white">{exercise.name}</p>
                    <p className="text-sm text-zinc-500">
                      {exercise.primaryMuscles.join(', ')}
                    </p>
                  </button>
                ))
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-zinc-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Strength Training</h1>
            <p className="text-sm text-zinc-500">
              {exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.set_type === 'working').length, 0)} working sets
            </p>
          </div>
        </div>
        <button
          onClick={saveSession}
          disabled={exercises.length === 0 || saving}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
            exercises.length > 0
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-zinc-800 text-zinc-500'
          )}
        >
          <Check className="w-4 h-4" />
          {saving ? 'Saving...' : 'Finish'}
        </button>
      </div>

      {/* Exercises */}
      <div className="space-y-6">
        {exercises.map((entry, exerciseIndex) => {
          const e1rm = getExerciseE1RM(entry)

          return (
            <div key={entry.exercise_id + exerciseIndex} className="bg-zinc-900 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">{entry.exercise_name}</h3>
                  <p className="text-xs text-zinc-500">
                    Target: {entry.target_sets} × {entry.target_rep_min}-{entry.target_rep_max}
                    {entry.target_rpe && ` @ RPE ${entry.target_rpe}`}
                  </p>
                </div>
                {entry.suggested_weight_kg && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded text-xs text-blue-400">
                    <Scale className="w-3 h-3" />
                    {entry.suggested_weight_kg}kg
                  </div>
                )}
              </div>

              {/* Set Headers */}
              <div className="grid grid-cols-12 gap-2 mb-2 text-xs text-zinc-500 px-1">
                <div className="col-span-1">Set</div>
                <div className="col-span-3">Weight</div>
                <div className="col-span-3">Reps</div>
                <div className="col-span-3">RIR</div>
                <div className="col-span-2"></div>
              </div>

              {/* Sets */}
              {entry.sets.map((set, setIndex) => (
                <div key={set.id} className="grid grid-cols-12 gap-2 mb-2 items-center">
                  <div className="col-span-1 text-zinc-400 text-sm pl-1">
                    {set.set_number}
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={set.weight_kg || ''}
                      onChange={(e) => updateSet(exerciseIndex, setIndex, 'weight_kg', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 bg-zinc-800 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="kg"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={set.reps || ''}
                      onChange={(e) => updateSet(exerciseIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-2 bg-zinc-800 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="reps"
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      value={set.rir ?? ''}
                      onChange={(e) => updateSet(exerciseIndex, setIndex, 'rir', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-2 py-2 bg-zinc-800 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-</option>
                      <option value="0">0</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4+</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={() => removeSet(exerciseIndex, setIndex)}
                      className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* E1RM Display */}
              {e1rm && (
                <div className="flex items-center gap-2 mt-3 py-2 px-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">
                    Estimated 1RM: <span className="font-semibold">{formatWeight(e1rm)}kg</span>
                  </span>
                </div>
              )}

              {/* Add Set Button */}
              <button
                onClick={() => addSet(exerciseIndex)}
                className="w-full mt-3 py-2 text-sm text-zinc-400 hover:text-white border border-dashed border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
              >
                + Add Set
              </button>
            </div>
          )
        })}
      </div>

      {/* Add Exercise Button */}
      <button
        onClick={() => setShowExercisePicker(true)}
        className="w-full mt-6 py-4 bg-zinc-900 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Exercise
      </button>

      {/* Fixed Finish Button */}
      {exercises.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 to-transparent">
          <button
            onClick={saveSession}
            disabled={saving}
            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            {saving ? 'Saving Workout...' : 'Complete Workout'}
          </button>
        </div>
      )}
    </div>
  )
}
