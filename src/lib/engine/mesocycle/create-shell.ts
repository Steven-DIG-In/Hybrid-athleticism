'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types/training.types'
import type { CoachDomain } from '@/lib/skills/types'

export type Archetype =
    | 'hypertrophy'
    | 'strength'
    | 'endurance_event'
    | 'conditioning'
    | 'hybrid'
    | 'custom'

export interface CreateBlockShellInput {
    mode: 'first-block' | 'post-block'
    archetype: Archetype
    durationWeeks: 4 | 6 | 8
    customCounts?: Record<CoachDomain, number>
    carryover: {
        daysPerWeek: number
        sessionMinutes: number
        warmupMinutes: number
        cooldownMinutes: number
        freeText: string
    }
}

function getNextMonday(from: Date): Date {
    const d = new Date(from)
    const day = d.getDay()
    const offset = day === 0 ? 1 : (8 - day) % 7 || 7
    d.setDate(d.getDate() + offset)
    return d
}

export async function createBlockShell(
    input: CreateBlockShellInput,
    blockNumberOverride?: number,
): Promise<ActionResult<{ mesocycleId: string }>> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }

    // Determine block number
    let blockNumber = blockNumberOverride
    if (blockNumber === undefined) {
        const { count } = await supabase
            .from('mesocycles')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
        blockNumber = (count ?? 0) + 1
    }

    const startDate = getNextMonday(new Date())
    const name = `${input.archetype.toUpperCase()} Block ${blockNumber}`

    const { data: meso, error: mesoErr } = await supabase
        .from('mesocycles')
        .insert({
            user_id: user.id,
            name,
            goal: input.archetype.toUpperCase(),
            week_count: input.durationWeeks,
            start_date: startDate.toISOString().split('T')[0],
            is_active: false,
            is_complete: false,
            ai_context_json: {
                archetype: input.archetype,
                customCounts: input.customCounts ?? null,
                carryover: input.carryover,
                mode: input.mode,
                strategy: null,
            },
        })
        .select()
        .single()

    if (mesoErr || !meso) return { success: false, error: mesoErr?.message ?? 'Mesocycle insert failed' }

    // Scaffold microcycles
    const microcycles = []
    for (let week = 1; week <= input.durationWeeks; week++) {
        const weekStart = new Date(startDate)
        weekStart.setDate(weekStart.getDate() + (week - 1) * 7)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)

        const isDeload = week === input.durationWeeks
        const targetRir = isDeload ? 4 : Math.max(0, 3 - (week - 1) * 0.5)

        microcycles.push({
            mesocycle_id: meso.id,
            user_id: user.id,
            week_number: week,
            start_date: weekStart.toISOString().split('T')[0],
            end_date: weekEnd.toISOString().split('T')[0],
            target_rir: targetRir,
            is_deload: isDeload,
        })
    }

    const { error: microErr } = await supabase.from('microcycles').insert(microcycles)
    if (microErr) return { success: false, error: `Microcycle scaffold failed: ${microErr.message}` }

    revalidatePath('/data/blocks/new')
    return { success: true, data: { mesocycleId: meso.id } }
}
