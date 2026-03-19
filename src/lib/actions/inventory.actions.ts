/**
 * Session Inventory Actions
 *
 * Handles creation, allocation, and management of unscheduled training sessions.
 * Sessions are generated as inventory (no calendar dates), then allocated to calendar.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types/training.types'
import type {
    SessionInventory,
    AllocationResult,
    ScheduleSuggestion,
    UnscheduledInventoryView,
    InventoryGroup,
} from '@/lib/types/inventory.types'
import { addDays, parseISO, format, getDay } from 'date-fns'

// ─── Generate Session Inventory ─────────────────────────────────────────────

/**
 * Generate unscheduled session inventory for entire mesocycle.
 * Called after onboarding or when creating a new training block.
 *
 * @param mesocycleId - The mesocycle to generate inventory for
 * @param weekCount - Number of weeks to generate (4, 6, 8, or 12)
 */
export async function generateMesocycleInventory(
    mesocycleId: string,
    weekCount: number
): Promise<ActionResult<{ sessions: SessionInventory[]; totalCount: number }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // TODO: Call AI programming pipeline to generate sessions
    // For now, return placeholder to show the structure
    // This will be implemented by integrating with existing generateSessionPool logic

    return {
        success: true,
        data: {
            sessions: [],
            totalCount: 0
        }
    }
}

// ─── Get Unscheduled Inventory ──────────────────────────────────────────────

/**
 * Retrieve all unscheduled sessions for a mesocycle, grouped by week.
 */
export async function getUnscheduledInventory(
    mesocycleId: string
): Promise<ActionResult<UnscheduledInventoryView>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get mesocycle details
    const { data: mesocycle, error: mesoError } = await supabase
        .from('mesocycles')
        .select('id, name')
        .eq('id', mesocycleId)
        .eq('user_id', user.id)
        .single()

    if (mesoError || !mesocycle) {
        return { success: false, error: 'Mesocycle not found' }
    }

    // Get all unscheduled inventory sessions
    const { data: sessions, error: sessionsError } = await supabase
        .from('session_inventory')
        .select('*')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .is('scheduled_date', null)
        .order('week_number', { ascending: true })
        .order('session_priority', { ascending: true })

    if (sessionsError) {
        return { success: false, error: sessionsError.message }
    }

    // Group by week
    const weekGroups: InventoryGroup[] = []
    const weekMap = new Map<number, SessionInventory[]>()

    for (const session of sessions ?? []) {
        const week = session.week_number
        if (!weekMap.has(week)) {
            weekMap.set(week, [])
        }
        weekMap.get(week)!.push(session as SessionInventory)
    }

    for (const [weekNumber, weekSessions] of weekMap.entries()) {
        const totalDuration = weekSessions.reduce((sum, s) => sum + (s.estimated_duration_minutes ?? 0), 0)
        const totalLoad = weekSessions.reduce((sum, s) => sum + (s.load_budget ?? 0), 0)

        weekGroups.push({
            weekNumber,
            sessions: weekSessions,
            totalDuration,
            totalLoad
        })
    }

    weekGroups.sort((a, b) => a.weekNumber - b.weekNumber)

    const totalSessions = sessions?.length ?? 0
    const approvedSessions = sessions?.filter(s => s.is_approved).length ?? 0

    return {
        success: true,
        data: {
            mesocycleId: mesocycle.id,
            mesocycleName: mesocycle.name,
            weekGroups,
            totalSessions,
            approvedSessions
        }
    }
}

// ─── Allocate Sessions to Calendar ──────────────────────────────────────────

/**
 * Generate allocation suggestions for a week's inventory.
 * Uses interference rules and rest day preferences to suggest optimal scheduling.
 */
export async function suggestAllocation(
    mesocycleId: string,
    weekNumber: number,
    startDate: string  // ISO date string
): Promise<ActionResult<ScheduleSuggestion>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get user constraints
    const { data: constraints } = await supabase
        .from('training_constraints')
        .select('*')
        .eq('user_id', user.id)
        .eq('mesocycle_id', mesocycleId)
        .maybeSingle()

    // Get unscheduled sessions for this week
    const { data: sessions, error: sessionsError } = await supabase
        .from('session_inventory')
        .select('*')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .eq('week_number', weekNumber)
        .is('scheduled_date', null)
        .order('session_priority', { ascending: true })

    if (sessionsError) {
        return { success: false, error: sessionsError.message }
    }

    if (!sessions || sessions.length === 0) {
        return { success: false, error: `No unscheduled sessions found for week ${weekNumber}` }
    }

    // Build allocation suggestions with intelligent load distribution
    const suggestions: AllocationResult[] = []
    const warnings: string[] = []

    const unavailableDays = constraints?.unavailable_days ?? []
    const noHeavyLegsBeforeRun = constraints?.no_heavy_legs_before_run ?? true

    // Group sessions by modality for intelligent interleaving
    const liftingSessions = sessions.filter(s => s.modality === 'LIFTING')
    const cardioSessions = sessions.filter(s => s.modality === 'CARDIO')
    const otherSessions = sessions.filter(s => !['LIFTING', 'CARDIO'].includes(s.modality))

    // Create interleaved schedule to spread load
    const interleavedSessions: SessionInventory[] = []
    const maxLength = Math.max(liftingSessions.length, cardioSessions.length, otherSessions.length)

    for (let i = 0; i < maxLength; i++) {
        // Alternate: Lifting → Other → Cardio → repeat
        if (liftingSessions[i]) interleavedSessions.push(liftingSessions[i] as SessionInventory)
        if (otherSessions[i]) interleavedSessions.push(otherSessions[i] as SessionInventory)
        if (cardioSessions[i]) interleavedSessions.push(cardioSessions[i] as SessionInventory)
    }

    // Schedule sessions with recovery rules
    let currentDate = parseISO(startDate)
    let lastLiftingDate: Date | null = null
    let lastCardioDate: Date | null = null

    for (const session of interleavedSessions) {
        // Skip unavailable days
        while (isDayUnavailable(currentDate, unavailableDays)) {
            currentDate = addDays(currentDate, 1)
        }

        // Enforce 48hr recovery between strength sessions
        if (session.modality === 'LIFTING' && lastLiftingDate) {
            const hoursSinceLastLifting = (currentDate.getTime() - lastLiftingDate.getTime()) / (1000 * 60 * 60)
            if (hoursSinceLastLifting < 48) {
                currentDate = addDays(lastLiftingDate, 2) // Add 2 days = 48hr minimum
                while (isDayUnavailable(currentDate, unavailableDays)) {
                    currentDate = addDays(currentDate, 1)
                }
            }
        }

        // Enforce rest day between heavy lifting and cardio if configured
        if (noHeavyLegsBeforeRun && session.modality === 'CARDIO' && lastLiftingDate) {
            const daysSinceLifting = Math.floor((currentDate.getTime() - lastLiftingDate.getTime()) / (1000 * 60 * 60 * 24))
            if (daysSinceLifting === 0) {
                // Same day - move cardio to next day
                currentDate = addDays(currentDate, 1)
                while (isDayUnavailable(currentDate, unavailableDays)) {
                    currentDate = addDays(currentDate, 1)
                }
            }
        }

        // Enforce 24hr recovery between high-intensity cardio sessions
        if (session.modality === 'CARDIO' && lastCardioDate) {
            const hoursSinceLastCardio = (currentDate.getTime() - lastCardioDate.getTime()) / (1000 * 60 * 60)
            if (hoursSinceLastCardio < 24) {
                currentDate = addDays(lastCardioDate, 1)
                while (isDayUnavailable(currentDate, unavailableDays)) {
                    currentDate = addDays(currentDate, 1)
                }
            }
        }

        suggestions.push({
            session,
            suggestedDate: format(currentDate, 'yyyy-MM-dd'),
            reasoning: getAllocationReasoning(session, currentDate, lastLiftingDate, lastCardioDate, unavailableDays)
        })

        // Track last session dates by modality
        if (session.modality === 'LIFTING') lastLiftingDate = new Date(currentDate)
        if (session.modality === 'CARDIO') lastCardioDate = new Date(currentDate)

        currentDate = addDays(currentDate, 1)
    }

    // Generate warnings
    if (suggestions.length > 6) {
        warnings.push('More than 6 sessions per week - consider high training load')
    }

    // Check for consecutive heavy days
    let consecutiveHeavyDays = 0
    for (let i = 0; i < suggestions.length; i++) {
        const session = suggestions[i].session
        if (session.modality === 'LIFTING' || session.modality === 'METCON') {
            consecutiveHeavyDays++
            if (consecutiveHeavyDays >= 3) {
                warnings.push('3+ consecutive high-intensity days detected - consider adding rest')
            }
        } else {
            consecutiveHeavyDays = 0
        }
    }

    return {
        success: true,
        data: {
            allocations: suggestions,
            warnings
        }
    }
}

/**
 * Apply allocation suggestions: update session_inventory with scheduled_date
 * AND create corresponding workout entries for the workout logger.
 * Also creates a check_in_windows record to drive the weekly coaching review cycle.
 */
export async function applyAllocation(
    suggestion: ScheduleSuggestion
): Promise<ActionResult<{ allocated: number }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    let allocated = 0

    for (const allocation of suggestion.allocations) {
        const session = allocation.session

        // 1. Update session_inventory with scheduled_date
        const { error: updateError } = await supabase
            .from('session_inventory')
            .update({ scheduled_date: allocation.suggestedDate })
            .eq('id', session.id)
            .eq('user_id', user.id)

        if (updateError) {
            console.error(`Failed to schedule session ${session.id}:`, updateError)
            continue
        }

        // 2. Find microcycle for this scheduled date
        const { data: microcycle } = await supabase
            .from('microcycles')
            .select('id')
            .eq('mesocycle_id', session.mesocycle_id)
            .eq('week_number', session.week_number)
            .eq('user_id', user.id)
            .maybeSingle()

        if (!microcycle) {
            console.error(`No microcycle found for week ${session.week_number}`)
            continue
        }

        // 3. Create workout entry for the workout logger
        const { data: workout, error: workoutError } = await supabase
            .from('workouts')
            .insert({
                user_id: user.id,
                microcycle_id: microcycle.id,
                modality: session.modality,
                name: session.name,
                coach_notes: session.coach_notes,
                scheduled_date: allocation.suggestedDate,
                is_completed: false,
                is_allocated: true,
                session_inventory_id: session.id, // Link back to inventory
            })
            .select('id')
            .single()

        if (workoutError || !workout) {
            console.error(`Failed to create workout for session ${session.id}:`, workoutError)
            continue
        }

        // 4. Create exercise_sets if LIFTING modality
        if (session.modality === 'LIFTING' && session.adjustment_pending) {
            const prescription = (session.adjustment_pending as any).prescription
            if (prescription && Array.isArray(prescription)) {
                let setNumber = 1
                for (const exercise of prescription) {
                    for (const set of exercise.sets) {
                        await supabase.from('exercise_sets').insert({
                            user_id: user.id,
                            workout_id: workout.id,
                            exercise_name: exercise.name,
                            muscle_group: exercise.muscleGroup,
                            set_number: setNumber++,
                            target_reps: set.targetReps,
                            target_weight_kg: set.targetWeightKg,
                            target_rir: set.targetRir,
                            notes: set.notes,
                        })
                    }
                }
            }
        }

        allocated++
    }

    // Create a check_in_windows record for this week if any sessions were allocated.
    // Determines the mesocycle_id and week_number from the first allocation in the batch.
    if (allocated > 0 && suggestion.allocations.length > 0) {
        const firstAllocation = suggestion.allocations[0]
        const firstSession = firstAllocation.session
        const mesocycleId = firstSession.mesocycle_id
        const weekNumber = firstSession.week_number
        const allocationStart = firstAllocation.suggestedDate

        // Check for an existing window to avoid duplicate records on re-allocation
        const { data: existingWindow } = await supabase
            .from('check_in_windows')
            .select('id')
            .eq('user_id', user.id)
            .eq('mesocycle_id', mesocycleId)
            .eq('week_number', weekNumber)
            .maybeSingle()

        if (!existingWindow) {
            const { error: windowError } = await supabase
                .from('check_in_windows')
                .insert({
                    user_id: user.id,
                    mesocycle_id: mesocycleId,
                    week_number: weekNumber,
                    allocation_start: allocationStart,
                    total_allocated: allocated,
                    status: 'open',
                })

            if (windowError) {
                // Non-fatal: allocation succeeded; log the window creation failure
                console.error('[applyAllocation] Failed to create check_in_windows record:', windowError)
            }
        } else {
            // Window already exists — update total_allocated to reflect new count
            await supabase
                .from('check_in_windows')
                .update({ total_allocated: allocated })
                .eq('id', existingWindow.id)
        }
    }

    return {
        success: true,
        data: { allocated }
    }
}

/**
 * Manually schedule a session to a specific date.
 */
export async function scheduleSession(
    sessionId: string,
    scheduledDate: string
): Promise<ActionResult<void>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('session_inventory')
        .update({ scheduled_date: scheduledDate })
        .eq('id', sessionId)
        .eq('user_id', user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, data: undefined }
}

/**
 * Unschedule a session (remove from calendar, back to inventory).
 */
export async function unscheduleSession(
    sessionId: string
): Promise<ActionResult<void>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('session_inventory')
        .update({ scheduled_date: null })
        .eq('id', sessionId)
        .eq('user_id', user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, data: undefined }
}

/**
 * Deallocate an entire week - clears scheduled dates and deletes workouts.
 * Use this to reset a week's schedule and re-allocate with different dates.
 */
export async function deallocateWeek(
    mesocycleId: string,
    weekNumber: number
): Promise<ActionResult<{ deallocated: number }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get all scheduled sessions for this week
    const { data: sessions } = await supabase
        .from('session_inventory')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .eq('week_number', weekNumber)
        .not('scheduled_date', 'is', null)

    if (!sessions || sessions.length === 0) {
        return { success: true, data: { deallocated: 0 } }
    }

    const sessionIds = sessions.map(s => s.id)

    // Delete associated workouts (cascade will handle exercise_sets)
    await supabase
        .from('workouts')
        .delete()
        .in('session_inventory_id', sessionIds)

    // Clear scheduled dates
    const { error: updateError } = await supabase
        .from('session_inventory')
        .update({ scheduled_date: null })
        .in('id', sessionIds)

    if (updateError) {
        return { success: false, error: updateError.message }
    }

    return { success: true, data: { deallocated: sessionIds.length } }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function isDayUnavailable(date: Date, unavailableDays: string[]): boolean {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayOfWeek = dayNames[getDay(date)]
    return unavailableDays.includes(dayOfWeek)
}

function getAllocationReasoning(
    session: SessionInventory,
    currentDate: Date,
    lastLiftingDate: Date | null,
    lastCardioDate: Date | null,
    unavailableDays: string[]
): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = dayNames[getDay(currentDate)]

    // Strength session reasoning
    if (session.modality === 'LIFTING') {
        if (!lastLiftingDate) {
            return `${dayName} - first strength session of the week`
        }
        const daysSinceLast = Math.floor((currentDate.getTime() - lastLiftingDate.getTime()) / (1000 * 60 * 60 * 24))
        return `${dayName} - ${daysSinceLast} days recovery since last strength session`
    }

    // Cardio session reasoning
    if (session.modality === 'CARDIO') {
        if (lastLiftingDate) {
            const daysSinceLifting = Math.floor((currentDate.getTime() - lastLiftingDate.getTime()) / (1000 * 60 * 60 * 24))
            if (daysSinceLifting === 1) {
                return `${dayName} - rest day after strength, optimal for cardio`
            }
        }
        if (!lastCardioDate) {
            return `${dayName} - first cardio session of the week`
        }
        return `${dayName} - optimal spacing for endurance work`
    }

    // Other modalities
    if (unavailableDays.length > 0) {
        return `${dayName} - available day (avoiding ${unavailableDays.join(', ')})`
    }

    return `${dayName} - optimal spacing`
}
