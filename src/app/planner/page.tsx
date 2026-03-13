import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlannerClient } from '@/components/planner/PlannerClient'
import type { WorkoutWithSets } from '@/lib/types/training.types'

export default async function PlannerPage() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        redirect('/login')
    }

    // Get current mesocycle
    const { data: mesocycle } = await supabase
        .from('mesocycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!mesocycle) {
        redirect('/dashboard')
    }

    // Get all workouts for the mesocycle
    const { data: microcycles } = await supabase
        .from('microcycles')
        .select('id')
        .eq('mesocycle_id', mesocycle.id)
        .eq('user_id', user.id)

    const microcycleIds = microcycles?.map(m => m.id) ?? []

    let allWorkouts: WorkoutWithSets[] = []
    if (microcycleIds.length > 0) {
        const { data: workouts } = await supabase
            .from('workouts')
            .select(`
                *,
                exercise_sets (*)
            `)
            .in('microcycle_id', microcycleIds)
            .order('scheduled_date', { ascending: true })

        allWorkouts = (workouts ?? []) as WorkoutWithSets[]
    }

    return (
        <PlannerClient
            mesocycle={mesocycle}
            initialWorkouts={allWorkouts}
        />
    )
}
