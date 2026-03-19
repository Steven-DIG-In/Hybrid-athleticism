import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlannerClient } from '@/components/planner/PlannerClient'
import type { SessionInventory } from '@/lib/types/inventory.types'

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

    // Fetch all session_inventory for the mesocycle (both allocated and unallocated)
    const { data: allSessions } = await supabase
        .from('session_inventory')
        .select('*')
        .eq('mesocycle_id', mesocycle.id)
        .eq('user_id', user.id)
        .order('week_number', { ascending: true })
        .order('training_day', { ascending: true, nullsFirst: false })
        .order('session_slot', { ascending: true })

    const sessions = (allSessions ?? []) as SessionInventory[]

    // Determine total blocks: use mesocycle.week_count if available,
    // otherwise derive from the highest week_number in inventory
    const maxWeekFromSessions = sessions.reduce((max, s) => Math.max(max, s.week_number), 0)
    const totalBlocks: number = mesocycle.week_count ?? (maxWeekFromSessions > 0 ? maxWeekFromSessions : 6)

    return (
        <PlannerClient
            mesocycle={{
                id: mesocycle.id,
                name: mesocycle.name,
                week_count: mesocycle.week_count,
            }}
            allSessions={sessions}
            totalBlocks={totalBlocks}
        />
    )
}
