import { getUnscheduledInventory } from '@/lib/actions/inventory.actions'
import { TestInventoryClient } from '@/components/test/TestInventoryClient'
import { createClient } from '@/lib/supabase/server'

export default async function TestInventoryPage() {
    const supabase = await createClient()

    // Get active mesocycle
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return <div className="p-6 text-white">Not authenticated</div>
    }

    const { data: mesocycle } = await supabase
        .from('mesocycles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

    if (!mesocycle) {
        return <div className="p-6 text-white">No active mesocycle found</div>
    }

    const result = await getUnscheduledInventory(mesocycle.id)

    if (!result.success) {
        return (
            <div className="p-6 bg-black min-h-screen">
                <div className="text-red-400">Error: {result.error}</div>
            </div>
        )
    }

    return (
        <div className="p-6 bg-black min-h-screen">
            <TestInventoryClient inventory={result.data} />
        </div>
    )
}
