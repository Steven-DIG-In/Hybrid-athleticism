import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Get user ID
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!userData) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const userId = (userData as { id: string }).id

  // Get active mesocycle
  const { data: mesocycle } = await supabase
    .from('mesocycles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!mesocycle) {
    return NextResponse.json({ error: 'No active mesocycle' }, { status: 404 })
  }

  // Get all sessions for this mesocycle
  const { data: sessions } = await supabase
    .from('planned_sessions')
    .select('id, user_id, week_number, day_of_week, scheduled_date, session_type, estimated_total_sets')
    .eq('mesocycle_id', (mesocycle as { id: string }).id)
    .order('scheduled_date', { ascending: true })

  if (!sessions) {
    return NextResponse.json({ error: 'No sessions found' }, { status: 404 })
  }

  // For each session, count exercises
  const sessionDetails = await Promise.all(
    (sessions as Array<{
      id: string
      week_number: number
      day_of_week: string
      scheduled_date: string
      session_type: string
      estimated_total_sets: number
    }>).map(async (session) => {
      const { data: exercises, count } = await supabase
        .from('planned_exercises')
        .select('id, exercise_id, sets, target_muscle', { count: 'exact' })
        .eq('planned_session_id', session.id)

      const exerciseList = exercises as Array<{
        id: string
        exercise_id: string
        sets: number
        target_muscle: string
      }> | null

      return {
        id: session.id,
        week: session.week_number,
        day: session.day_of_week,
        date: session.scheduled_date,
        type: session.session_type,
        expected_sets: session.estimated_total_sets,
        actual_exercise_count: count || 0,
        actual_total_sets: exerciseList?.reduce((sum, e) => sum + e.sets, 0) || 0,
        exercises: exerciseList?.map(e => ({
          muscle: e.target_muscle,
          sets: e.sets
        })) || [],
        MISMATCH: session.estimated_total_sets !== (exerciseList?.reduce((sum, e) => sum + e.sets, 0) || 0)
      }
    })
  )

  // Filter to just week 1 for readability
  const week1 = sessionDetails.filter(s => s.week === 1)

  // Get user_id from first session to check
  const sessionUserId = (sessions as Array<{ user_id: string }>)[0]?.user_id

  return NextResponse.json({
    current_user_id: userId,
    session_user_id: sessionUserId,
    USER_ID_MISMATCH: userId !== sessionUserId,
    mesocycle: {
      id: (mesocycle as { id: string }).id,
      name: (mesocycle as { name: string }).name,
    },
    week1_sessions: week1,
    summary: {
      total_sessions: sessionDetails.length,
      sessions_with_mismatch: sessionDetails.filter(s => s.MISMATCH).length,
      sessions_with_zero_exercises: sessionDetails.filter(s => s.actual_exercise_count === 0).length,
    }
  }, { status: 200 })
}
