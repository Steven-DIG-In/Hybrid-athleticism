import { createClient } from '@/lib/supabase/server'

import { WorkoutLogger } from '@/components/workout/workout-logger'
import { redirect } from 'next/navigation'
import type { PlannedExercise } from '@/types/database'

export default async function ExecuteSessionPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const supabase = await createClient()
    const { id } = await params

    console.log(`[Execute Page] Loading session: ${id}`)

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        console.log('[Execute Page] No user, redirecting to login')
        redirect('/login')
    }

    // 2. Get user ID
    const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

    if (!userData) {
        console.log('[Execute Page] No user data, redirecting to login')
        redirect('/login')
    }
    const userId = (userData as { id: string }).id

    // 3. Fetch session (include user_id filter for RLS)
    const { data: session, error: sessionError } = await supabase
        .from('planned_sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

    if (sessionError) {
        console.error('[Execute Page] Session fetch error:', sessionError)
        console.error('[Execute Page] Session ID:', id, 'User ID:', userId)
        return <div className="p-4 text-red-400">Error loading session: {sessionError.message || 'Session not found or access denied'}</div>
    }

    if (!session) {
        console.log('[Execute Page] Session not found for ID:', id, 'User:', userId)
        return <div className="p-4 text-zinc-400">Session not found</div>
    }

    console.log(`[Execute Page] Found session: ${(session as { session_type: string }).session_type}`)

    // 4. Fetch exercises
    const { data: exercisesData, error: exercisesError } = await supabase
        .from('planned_exercises')
        .select('*')
        .eq('planned_session_id', id)
        .order('exercise_order', { ascending: true })

    if (exercisesError) {
        console.error('[Execute Page] Exercises fetch error:', exercisesError)
    }

    const exercises = (exercisesData || []) as PlannedExercise[]
    console.log(`[Execute Page] Loaded ${exercises.length} exercises`)

    // 5. Fetch lift maxes
    const { data: liftMaxes } = await supabase
        .from('user_lift_maxes')
        .select('*')
        .eq('user_id', userId)

    // 6. Fetch exercise history (optional - don't crash if tables don't exist)
    const history: Record<string, { weight: number, reps: number, date: string }> = {}

    try {
        const exerciseIds = exercises.map(e => e.exercise_id)
        if (exerciseIds.length > 0) {
            const { data: historyData } = await supabase
                .from('actual_session_exercises')
                .select('exercise_id, logs, created_at, actual_sessions!inner(user_id)')
                .eq('actual_sessions.user_id', userId)
                .in('exercise_id', exerciseIds)
                .order('created_at', { ascending: false })
                .limit(50)

            if (historyData) {
                for (const r of historyData) {
                    const record = r as { exercise_id: string; logs: any; created_at: string }
                    if (history[record.exercise_id]) continue

                    const logs = record.logs as any[]
                    if (Array.isArray(logs) && logs.length > 0) {
                        const lastSet = [...logs].reverse().find((l: any) => l.completed)
                        if (lastSet) {
                            history[record.exercise_id] = {
                                weight: Number(lastSet.weight),
                                reps: Number(lastSet.reps),
                                date: new Date(record.created_at).toLocaleDateString()
                            }
                        }
                    }
                }
            }
        }
    } catch (historyError) {
        console.log('[Execute Page] History fetch skipped (tables may not exist yet)')
    }

    console.log(`[Execute Page] Rendering WorkoutLogger with ${exercises.length} exercises`)

    return (
        <WorkoutLogger
            session={session}
            exercises={exercises}
            liftMaxes={liftMaxes || []}
            userId={userId}
            history={history}
        />
    )
}
