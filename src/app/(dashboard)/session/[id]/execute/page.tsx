import { createClient } from '@/lib/supabase/server'

import { WorkoutLogger } from '@/components/workout/workout-logger'
import { redirect } from 'next/navigation'
import type { PlannedExercise, UserLiftMax } from '@/types/database'

export default async function ExecuteSessionPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const supabase = await createClient()
    const { id } = await params

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // 2. Get user ID
    const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

    if (!userData) redirect('/login')
    const userId = (userData as { id: string }).id

    // 3. Fetch session
    const { data: session, error } = await supabase
        .from('planned_sessions')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !session) {
        return <div>Session not found</div>
    }

    // 4. Fetch exercises
    const { data: exercisesData } = await supabase
        .from('planned_exercises')
        .select('*')
        .eq('planned_session_id', id)
        .order('exercise_order', { ascending: true })

    const exercises = (exercisesData || []) as PlannedExercise[]

    // 5. Fetch lift maxes
    const { data: liftMaxes } = await supabase
        .from('user_lift_maxes')
        .select('*')
        .eq('user_id', userId)

    // 6. Fetch exercise history
    const exerciseIds = exercises.map(e => e.exercise_id)
    const { data: historyData } = await supabase
        .from('actual_session_exercises')
        .select('exercise_id, logs, created_at, actual_sessions!inner(user_id)')
        .eq('actual_sessions.user_id', userId)
        .in('exercise_id', exerciseIds)
        .order('created_at', { ascending: false })
        .limit(50)

    // Process history to find the last completed set for each exercise
    const history: Record<string, { weight: number, reps: number, date: string }> = {}

    if (historyData) {
        for (const r of historyData) {
            const record = r as { exercise_id: string; logs: any; created_at: string }
            if (history[record.exercise_id]) continue // Already found latest

            // Find best/last set in logs
            // logs is JSONB, assumed to be array of objects
            const logs = record.logs as any[]
            if (Array.isArray(logs) && logs.length > 0) {
                // Find last completed working set
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
