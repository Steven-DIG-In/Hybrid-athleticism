/**
 * Mesocycle Database Service
 *
 * Handles persistence of mesocycles, planned sessions, and planned exercises
 * to Supabase. Also provides retrieval and update operations.
 *
 * NOTE: This service requires the database migration (20260130_strength_tables.sql)
 * to be run first. Until then, operations will fail at runtime.
 */

import { createClient } from '@/lib/supabase/client'
import type {
  Mesocycle as DBMesocycle,
  PlannedSession as DBPlannedSession,
  PlannedExercise as DBPlannedExercise,
  UserLiftMax,
  UserVolumeLandmark,
  Json,
} from '@/types/database'
import { type Mesocycle } from '../mesocycle-generator'
import { type PlannedExercise } from '../session-templates'
import { getSuggestedWeight } from '../strength'

// Helper for new tables not yet recognized by Supabase client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTable = (supabase: ReturnType<typeof createClient>, table: string): any => {
  return supabase.from(table as never)
}

/**
 * Create a new mesocycle and all its planned sessions in the database
 */
export async function saveMesocycleToDatabase(
  userId: string,
  mesocycle: Mesocycle,
  liftMaxes?: UserLiftMax[]
): Promise<{ mesocycleId: string; sessionCount: number } | null> {
  const supabase = createClient()

  try {
    // 1. Insert mesocycle record
    const mesocycleData = {
      user_id: userId,
      name: mesocycle.config.name,
      start_date: formatDate(mesocycle.config.startDate),
      end_date: formatDate(
        new Date(mesocycle.config.startDate.getTime() + (mesocycle.config.totalWeeks * 7 - 1) * 24 * 60 * 60 * 1000)
      ),
      total_weeks: mesocycle.config.totalWeeks,
      deload_week: mesocycle.config.totalWeeks,
      config: mesocycle.config as unknown as Json,
      status: 'active',
    }

    const { data: insertedMesocycle, error: mesoError } = await getTable(supabase, 'mesocycles')
      .insert(mesocycleData)
      .select('id')
      .single()

    if (mesoError || !insertedMesocycle) {
      console.error('Error inserting mesocycle:', mesoError)
      return null
    }

    const mesocycleId = (insertedMesocycle as { id: string }).id

    // 2. Insert all planned sessions
    const sessionsToInsert: Array<{
      user_id: string
      mesocycle_id: string
      week_number: number
      day_of_week: string
      scheduled_date: string
      session_type: string
      domain: string
      target_rpe: number
      target_rir: number
      estimated_duration_mins: number
      estimated_total_sets: number
      status: string
      actual_session_id: null
    }> = []
    const sessionExercises: { sessionIndex: number; exercises: PlannedExercise[] }[] = []

    let sessionIndex = 0
    for (const week of mesocycle.weeks) {
      for (const session of week.sessions) {
        sessionsToInsert.push({
          user_id: userId,
          mesocycle_id: mesocycleId,
          week_number: week.weekNumber,
          day_of_week: session.dayOfWeek,
          scheduled_date: formatDate(session.date),
          session_type: session.sessionType,
          domain: session.domain,
          target_rpe: session.targetRPE,
          target_rir: Math.round(10 - session.targetRPE),
          estimated_duration_mins: session.estimatedDuration,
          estimated_total_sets: session.totalSets,
          status: 'planned',
          actual_session_id: null,
        })

        if (session.exercises.length > 0) {
          sessionExercises.push({ sessionIndex, exercises: session.exercises })
        }
        sessionIndex++
      }
    }

    const { error: sessionsError } = await getTable(supabase, 'planned_sessions')
      .insert(sessionsToInsert)

    if (sessionsError) {
      console.error('Error inserting sessions:', sessionsError)
      // Rollback mesocycle
      await getTable(supabase, 'mesocycles').delete().eq('id', mesocycleId)
      return null
    }

    // IMPORTANT: Fetch all inserted sessions to match them back to our local data
    const { data: insertedSessions, error: fetchError } = await getTable(supabase, 'planned_sessions')
      .select('id, scheduled_date, session_type, domain')
      .eq('mesocycle_id', mesocycleId)

    if (fetchError || !insertedSessions) {
      console.error('Error fetching inserted sessions:', fetchError)
      await getTable(supabase, 'mesocycles').delete().eq('id', mesocycleId)
      return null
    }

    const castedInsertedSessions = insertedSessions as Array<{
      id: string
      scheduled_date: string
      session_type: string
      domain: string
    }>

    // 3. Insert planned exercises for each session
    // We map back by matching date, type, and domain to handle potential DB reordering
    const exercisesToInsert: Array<{
      planned_session_id: string
      exercise_id: string
      exercise_order: number
      target_muscle: string
      is_primary: boolean
      sets: number
      rep_range_min: number
      rep_range_max: number
      target_rpe: number
      target_rir: number
      rest_seconds: number
      suggested_weight_kg: number | null
      percentage_of_tm: number | null
      notes: string | null
    }> = []

    for (const { sessionIndex: sIdx, exercises } of sessionExercises) {
      // Get the original session data to match against
      const originalSession = sessionsToInsert[sIdx]

      // Find the matching inserted session
      const matchedSession = castedInsertedSessions.find(s =>
        s.scheduled_date === originalSession.scheduled_date &&
        s.session_type === originalSession.session_type &&
        s.domain === originalSession.domain
      )

      if (!matchedSession) {
        console.warn(`[Mesocycle Service] Could not find matching DB session for ${originalSession.session_type} on ${originalSession.scheduled_date}`)
        continue
      }

      const sessionId = matchedSession.id

      exercises.forEach((ex, order) => {
        // Find training max for this exercise if available
        const liftMax = liftMaxes?.find(lm => lm.exercise_id === ex.exercise.id)

        const suggestedWeight = liftMax?.training_max_kg
          ? getSuggestedWeight(liftMax.training_max_kg, ex.targetRPE)
          : null

        exercisesToInsert.push({
          planned_session_id: sessionId,
          exercise_id: ex.exercise.id,
          exercise_order: order + 1,
          target_muscle: ex.muscle,
          is_primary: true,
          sets: ex.sets,
          rep_range_min: ex.repRangeMin,
          rep_range_max: ex.repRangeMax,
          target_rpe: ex.targetRPE,
          target_rir: Math.round(10 - ex.targetRPE),
          rest_seconds: ex.restSeconds,
          suggested_weight_kg: suggestedWeight,
          percentage_of_tm: suggestedWeight && liftMax?.training_max_kg
            ? suggestedWeight / liftMax.training_max_kg
            : null,
          notes: ex.notes || null,
        })
      })
    }

    if (exercisesToInsert.length > 0) {
      // Log exercises per session for debugging
      const exercisesBySession = exercisesToInsert.reduce((acc, ex) => {
        acc[ex.planned_session_id] = (acc[ex.planned_session_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      console.log(`[Mesocycle Service] Inserting ${exercisesToInsert.length} planned exercises:`)
      Object.entries(exercisesBySession).forEach(([sessionId, count]) => {
        console.log(`  - Session ${sessionId.slice(-8)}: ${count} exercises`)
      })

      const { data: insertedExercises, error: exercisesError } = await getTable(supabase, 'planned_exercises')
        .insert(exercisesToInsert)
        .select('id, planned_session_id, exercise_id')

      if (exercisesError) {
        console.error('[Mesocycle Service] Error inserting exercises:', exercisesError)
        // Don't rollback - sessions are still useful
      } else {
        const insertedCount = (insertedExercises as unknown[])?.length || 0
        console.log(`[Mesocycle Service] Successfully inserted ${insertedCount} exercises`)
        if (insertedCount !== exercisesToInsert.length) {
          console.warn(`[Mesocycle Service] WARNING: Expected ${exercisesToInsert.length} but only ${insertedCount} were inserted!`)
        }
      }
    } else {
      console.warn('[Mesocycle Service] WARNING: No exercises to insert!')
    }

    return { mesocycleId, sessionCount: castedInsertedSessions.length }
  } catch (error) {
    console.error('Error saving mesocycle:', error)
    return null
  }
}

/**
 * Get active mesocycle for a user
 */
export async function getActiveMesocycle(userId: string): Promise<DBMesocycle | null> {
  const supabase = createClient()

  const { data, error } = await getTable(supabase, 'mesocycles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching active mesocycle:', error)
    return null
  }

  return data as DBMesocycle
}

/**
 * Get planned sessions for a mesocycle
 */
export async function getPlannedSessions(
  mesocycleId: string,
  options?: { weekNumber?: number; startDate?: string; endDate?: string }
): Promise<DBPlannedSession[]> {
  const supabase = createClient()

  let query = getTable(supabase, 'planned_sessions')
    .select('*')
    .eq('mesocycle_id', mesocycleId)
    .order('scheduled_date', { ascending: true })

  if (options?.weekNumber) {
    query = query.eq('week_number', options.weekNumber)
  }
  if (options?.startDate) {
    query = query.gte('scheduled_date', options.startDate)
  }
  if (options?.endDate) {
    query = query.lte('scheduled_date', options.endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching planned sessions:', error)
    return []
  }

  return (data || []) as DBPlannedSession[]
}

/**
 * Get planned session by date for a user
 */
export async function getPlannedSessionForDate(
  userId: string,
  date: Date
): Promise<DBPlannedSession | null> {
  const supabase = createClient()
  const dateStr = formatDate(date)

  console.log(`[Mesocycle Service] Looking for session: user=${userId}, date=${dateStr}`)

  const { data, error } = await getTable(supabase, 'planned_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('scheduled_date', dateStr)
    .single()

  if (error) {
    console.log(`[Mesocycle Service] No session found for ${dateStr}:`, error.message)
    return null
  }

  console.log(`[Mesocycle Service] Found session: ${(data as DBPlannedSession).session_type}`)
  return data as DBPlannedSession
}

/**
 * Get planned exercises for a session
 */
export async function getPlannedExercises(sessionId: string): Promise<DBPlannedExercise[]> {
  const supabase = createClient()

  const { data, error } = await getTable(supabase, 'planned_exercises')
    .select('*')
    .eq('planned_session_id', sessionId)
    .order('exercise_order', { ascending: true })

  if (error) {
    console.error('Error fetching planned exercises:', error)
    return []
  }

  return (data || []) as DBPlannedExercise[]
}

/**
 * Update session status (when completed or skipped)
 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'completed' | 'skipped',
  actualSessionId?: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await getTable(supabase, 'planned_sessions')
    .update({
      status,
      actual_session_id: actualSessionId || null,
    })
    .eq('id', sessionId)

  if (error) {
    console.error('Error updating session status:', error)
    return false
  }

  return true
}

/**
 * Get user's lift maxes
 */
export async function getUserLiftMaxes(userId: string): Promise<UserLiftMax[]> {
  const supabase = createClient()

  const { data, error } = await getTable(supabase, 'user_lift_maxes')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching lift maxes:', error)
    return []
  }

  return (data || []) as UserLiftMax[]
}

/**
 * Save or update a lift max
 */
export async function saveLiftMax(
  userId: string,
  exerciseId: string,
  liftData: {
    tested_1rm_kg?: number
    estimated_1rm_kg?: number
    training_max_kg?: number
    training_max_percentage?: number
    source?: 'tested' | 'estimated' | 'manual'
  }
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await getTable(supabase, 'user_lift_maxes')
    .upsert({
      user_id: userId,
      exercise_id: exerciseId,
      ...liftData,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,exercise_id'
    })

  if (error) {
    console.error('Error saving lift max:', error)
    return false
  }

  return true
}

/**
 * Get user's volume landmarks
 */
export async function getUserVolumeLandmarks(userId: string): Promise<UserVolumeLandmark[]> {
  const supabase = createClient()

  const { data, error } = await getTable(supabase, 'user_volume_landmarks')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching volume landmarks:', error)
    return []
  }

  return (data || []) as UserVolumeLandmark[]
}

/**
 * Save volume landmarks for a user
 */
export async function saveVolumeLandmarks(
  userId: string,
  landmarks: Array<{
    muscle_group: string
    mv: number
    mev: number
    mav: number
    mrv: number
  }>
): Promise<boolean> {
  const supabase = createClient()

  const dataToSave = landmarks.map(l => ({
    user_id: userId,
    ...l,
  }))

  const { error } = await getTable(supabase, 'user_volume_landmarks')
    .upsert(dataToSave, {
      onConflict: 'user_id,muscle_group'
    })

  if (error) {
    console.error('Error saving volume landmarks:', error)
    return false
  }

  return true
}

/**
 * Get mesocycle with all related data
 */
export async function getMesocycleWithSessions(mesocycleId: string): Promise<{
  mesocycle: DBMesocycle
  sessions: (DBPlannedSession & { exercises: DBPlannedExercise[] })[]
} | null> {
  const supabase = createClient()

  // Get mesocycle
  const { data: mesocycle, error: mesoError } = await getTable(supabase, 'mesocycles')
    .select('*')
    .eq('id', mesocycleId)
    .single()

  if (mesoError || !mesocycle) {
    return null
  }

  // Get sessions
  const { data: sessions, error: sessionsError } = await getTable(supabase, 'planned_sessions')
    .select('*')
    .eq('mesocycle_id', mesocycleId)
    .order('scheduled_date', { ascending: true })

  if (sessionsError || !sessions) {
    return { mesocycle: mesocycle as DBMesocycle, sessions: [] }
  }

  const typedSessions = sessions as DBPlannedSession[]

  // Get exercises for all sessions
  const sessionIds = typedSessions.map(s => s.id)
  const { data: exercises } = await getTable(supabase, 'planned_exercises')
    .select('*')
    .in('planned_session_id', sessionIds)
    .order('exercise_order', { ascending: true })

  const typedExercises = (exercises || []) as DBPlannedExercise[]

  // Group exercises by session
  const exercisesBySession = typedExercises.reduce((acc, ex) => {
    if (!acc[ex.planned_session_id]) {
      acc[ex.planned_session_id] = []
    }
    acc[ex.planned_session_id].push(ex)
    return acc
  }, {} as Record<string, DBPlannedExercise[]>)

  const sessionsWithExercises = typedSessions.map(s => ({
    ...s,
    exercises: exercisesBySession[s.id] || [],
  }))

  return { mesocycle: mesocycle as DBMesocycle, sessions: sessionsWithExercises }
}

// Helper function to format date as YYYY-MM-DD in local timezone (NOT UTC)
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
