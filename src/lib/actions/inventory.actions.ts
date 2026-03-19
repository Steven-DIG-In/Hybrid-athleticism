/**
 * Session Inventory Actions
 *
 * Handles creation, allocation, and management of unscheduled training sessions.
 * Sessions are generated as inventory (week_number, no dates), then allocated
 * to training days (1, 2, 3...) with optional two-a-day support.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types/training.types'
import type {
    SessionInventory,
    DayAllocation,
    TrainingDay,
    TrainingDaySession,
    UnscheduledInventoryView,
    InventoryGroup,
} from '@/lib/types/inventory.types'
import type { TwoADayWillingness } from '@/lib/types/database.types'

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

    // Get all unscheduled inventory sessions (training_day is NULL = unallocated)
    const { data: sessions, error: sessionsError } = await supabase
        .from('session_inventory')
        .select('*')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .is('training_day', null)
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

// ─── Allocate Sessions to Training Days ─────────────────────────────────────

/** Modality priority for distribution: higher-priority modalities get placed first. */
const MODALITY_PRIORITY: Record<string, number> = {
    LIFTING: 1,
    CARDIO: 2,
    METCON: 3,
    RUCKING: 4,
    MOBILITY: 5,
}

/**
 * Generate day-based allocation suggestions for a week's inventory.
 *
 * Training days are numbered 1, 2, 3... (not calendar dates).
 * The athlete does "Day 1" whenever they are ready, then "Day 2", etc.
 * Two sessions on the same training_day = two-a-day (slot 1 AM, slot 2 PM).
 *
 * Uses athlete profile (available_days, two_a_day) and interference rules
 * to distribute sessions optimally across training days.
 */
export async function suggestAllocation(
    mesocycleId: string,
    weekNumber: number
): Promise<ActionResult<DayAllocation>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Load athlete profile for available_days and two_a_day preference
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('available_days, two_a_day')
        .eq('id', user.id)
        .single()

    if (profileError || !profile) {
        return { success: false, error: 'Could not load athlete profile' }
    }

    const availableDays: number = profile.available_days ?? 4
    const twoADay: TwoADayWillingness = (profile.two_a_day as TwoADayWillingness) ?? 'no'

    // Get unallocated sessions for this week
    const { data: sessions, error: sessionsError } = await supabase
        .from('session_inventory')
        .select('*')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .eq('week_number', weekNumber)
        .is('training_day', null)
        .order('session_priority', { ascending: true })

    if (sessionsError) {
        return { success: false, error: sessionsError.message }
    }

    if (!sessions || sessions.length === 0) {
        return { success: false, error: `No unallocated sessions found for week ${weekNumber}` }
    }

    // Sort by modality priority, then by session_priority within same modality
    const sortedSessions = [...sessions].sort((a, b) => {
        const modA = MODALITY_PRIORITY[a.modality] ?? 99
        const modB = MODALITY_PRIORITY[b.modality] ?? 99
        if (modA !== modB) return modA - modB
        return (a.session_priority ?? 1) - (b.session_priority ?? 1)
    }) as SessionInventory[]

    // Group by modality
    const byModality = (mod: string) => sortedSessions.filter(s => s.modality === mod)
    const liftingSessions = byModality('LIFTING')
    const cardioSessions = byModality('CARDIO')
    const metconSessions = byModality('METCON')
    const ruckingSessions = byModality('RUCKING')
    const mobilitySessions = byModality('MOBILITY')

    // Initialize training day slots
    // Each day can hold slot 1 (primary) and optionally slot 2 (secondary)
    const daySlots: Map<number, { slot1: SessionInventory | null; slot2: SessionInventory | null; slot1Reasoning: string; slot2Reasoning: string }> = new Map()
    for (let d = 1; d <= availableDays; d++) {
        daySlots.set(d, { slot1: null, slot2: null, slot1Reasoning: '', slot2Reasoning: '' })
    }

    const warnings: string[] = []
    const maxPerDay = twoADay === 'no' ? 1 : 2

    // Helper: get modality on a given day's slot 1
    const dayHasModality = (day: number, mod: string): boolean => {
        const slot = daySlots.get(day)
        if (!slot) return false
        return slot.slot1?.modality === mod || slot.slot2?.modality === mod
    }

    // Helper: check if a day has any session in slot 1
    const dayHasSlot1 = (day: number): boolean => {
        return daySlots.get(day)?.slot1 !== null
    }

    // Helper: check if a day has room for slot 2
    const dayHasSlot2Room = (day: number): boolean => {
        const slot = daySlots.get(day)
        return slot !== null && slot !== undefined && slot.slot1 !== null && slot.slot2 === null
    }

    // Helper: place a session in slot 1 on a given day
    const placeSlot1 = (day: number, session: SessionInventory, reasoning: string): boolean => {
        const slot = daySlots.get(day)
        if (!slot || slot.slot1 !== null) return false
        slot.slot1 = session
        slot.slot1Reasoning = reasoning
        return true
    }

    // Helper: place a session in slot 2 on a given day (two-a-day)
    const placeSlot2 = (day: number, session: SessionInventory, reasoning: string): boolean => {
        if (twoADay === 'no') return false
        const slot = daySlots.get(day)
        if (!slot || slot.slot1 === null || slot.slot2 !== null) return false
        slot.slot2 = session
        slot.slot2Reasoning = reasoning
        return true
    }

    // ── STEP 1: Spread LIFTING sessions across days with gaps ─────────────
    if (liftingSessions.length > 0) {
        const liftCount = liftingSessions.length
        // Spread evenly: e.g., 3 in 5 days -> days 1, 3, 5
        const spacing = liftCount <= availableDays
            ? Math.floor(availableDays / liftCount)
            : 1

        let nextDay = 1
        for (const session of liftingSessions) {
            // Find next available slot 1 starting from nextDay
            let placed = false
            for (let attempt = nextDay; attempt <= availableDays; attempt++) {
                if (!dayHasSlot1(attempt)) {
                    placeSlot1(attempt, session, `Day ${attempt} - strength session, spaced for recovery`)
                    nextDay = attempt + spacing
                    placed = true
                    break
                }
            }
            // Wrap around if we ran out of days
            if (!placed) {
                for (let attempt = 1; attempt <= availableDays; attempt++) {
                    if (!dayHasSlot1(attempt)) {
                        placeSlot1(attempt, session, `Day ${attempt} - strength session (wrapped placement)`)
                        placed = true
                        break
                    }
                }
            }
            // If still not placed, try as slot 2 if two-a-day allowed
            if (!placed && twoADay !== 'no') {
                for (let attempt = 1; attempt <= availableDays; attempt++) {
                    if (dayHasSlot2Room(attempt) && !dayHasModality(attempt, 'LIFTING')) {
                        placeSlot2(attempt, session, `Day ${attempt} - strength as two-a-day (overflow)`)
                        placed = true
                        break
                    }
                }
            }
            if (!placed) {
                warnings.push(`Could not place lifting session "${session.name}" - not enough available days`)
            }
        }
    }

    // ── STEP 2: Assign CARDIO to gap days first ──────────────────────────
    const unplacedCardio: SessionInventory[] = []
    for (const session of cardioSessions) {
        // Prefer non-lifting days first
        let placed = false
        for (let d = 1; d <= availableDays; d++) {
            if (!dayHasSlot1(d)) {
                placeSlot1(d, session, `Day ${d} - cardio on rest day from lifting`)
                placed = true
                break
            }
        }
        if (!placed) {
            unplacedCardio.push(session)
        }
    }
    // Place remaining cardio as slot 2 if two-a-day allowed
    for (const session of unplacedCardio) {
        let placed = false
        if (twoADay !== 'no') {
            for (let d = 1; d <= availableDays; d++) {
                if (dayHasSlot2Room(d)) {
                    placeSlot2(d, session, `Day ${d} - cardio paired as two-a-day`)
                    placed = true
                    break
                }
            }
        }
        if (!placed) {
            warnings.push(`Could not place cardio session "${session.name}" - no room`)
        }
    }

    // ── STEP 3: Assign METCON + RUCKING to remaining slots ──────────────
    const otherHighIntensity = [...metconSessions, ...ruckingSessions]
    const unplacedOther: SessionInventory[] = []
    for (const session of otherHighIntensity) {
        let placed = false
        // Fill empty days first
        for (let d = 1; d <= availableDays; d++) {
            if (!dayHasSlot1(d)) {
                const label = session.modality === 'METCON' ? 'conditioning' : 'rucking'
                placeSlot1(d, session, `Day ${d} - ${label} session`)
                placed = true
                break
            }
        }
        if (!placed) {
            unplacedOther.push(session)
        }
    }
    // Place remaining as slot 2
    for (const session of unplacedOther) {
        let placed = false
        if (twoADay !== 'no') {
            for (let d = 1; d <= availableDays; d++) {
                if (dayHasSlot2Room(d)) {
                    const label = session.modality === 'METCON' ? 'conditioning' : 'rucking'
                    placeSlot2(d, session, `Day ${d} - ${label} paired as two-a-day`)
                    placed = true
                    break
                }
            }
        }
        if (!placed) {
            warnings.push(`Could not place ${session.modality.toLowerCase()} session "${session.name}" - no room`)
        }
    }

    // ── STEP 4: Assign MOBILITY as slot 2 (primer/cooldown) ─────────────
    for (const session of mobilitySessions) {
        let placed = false
        // Try to pair with another session as slot 2
        if (maxPerDay >= 2) {
            for (let d = 1; d <= availableDays; d++) {
                if (dayHasSlot2Room(d)) {
                    placeSlot2(d, session, `Day ${d} - mobility as primer/cooldown`)
                    placed = true
                    break
                }
            }
        }
        // If no room as slot 2, give its own day
        if (!placed) {
            for (let d = 1; d <= availableDays; d++) {
                if (!dayHasSlot1(d)) {
                    placeSlot1(d, session, `Day ${d} - dedicated mobility session`)
                    placed = true
                    break
                }
            }
        }
        if (!placed) {
            warnings.push(`Could not place mobility session "${session.name}" - no room`)
        }
    }

    // ── STEP 5: Check interference rules and generate warnings ──────────
    let consecutiveLiftingDays = 0
    for (let d = 1; d <= availableDays; d++) {
        if (dayHasModality(d, 'LIFTING')) {
            consecutiveLiftingDays++
            if (consecutiveLiftingDays >= 3) {
                warnings.push(`3+ consecutive training days with lifting (days ${d - 2}-${d}) - consider rearranging`)
            }
        } else {
            consecutiveLiftingDays = 0
        }

        // Check two LIFTING on same day
        const slot = daySlots.get(d)
        if (slot?.slot1?.modality === 'LIFTING' && slot?.slot2?.modality === 'LIFTING') {
            warnings.push(`Day ${d} has two lifting sessions - high CNS demand`)
        }
    }

    // Check capacity overflow
    const totalCapacity = availableDays * maxPerDay
    if (sortedSessions.length > totalCapacity) {
        const overflow = sortedSessions.length - totalCapacity
        warnings.push(`${overflow} session(s) could not be placed - consider increasing available days or enabling two-a-days`)
    }

    // Total load warning
    const totalSessions = sortedSessions.length
    if (totalSessions > 6) {
        warnings.push(`${totalSessions} sessions this week - high training volume`)
    }

    // ── Build result ────────────────────────────────────────────────────
    const days: TrainingDay[] = []
    for (let d = 1; d <= availableDays; d++) {
        const slot = daySlots.get(d)!
        const daySessions: TrainingDaySession[] = []

        if (slot.slot1) {
            daySessions.push({ session: slot.slot1, slot: 1, reasoning: slot.slot1Reasoning })
        }
        if (slot.slot2) {
            daySessions.push({ session: slot.slot2, slot: 2, reasoning: slot.slot2Reasoning })
        }

        if (daySessions.length > 0) {
            days.push({ dayNumber: d, sessions: daySessions })
        }
    }

    return {
        success: true,
        data: {
            days,
            warnings,
            totalTrainingDays: days.length,
        }
    }
}

/**
 * Apply day-based allocation: update session_inventory with training_day + session_slot
 * AND create corresponding workout entries for the workout logger.
 * Also creates a check_in_windows record to drive the weekly coaching review cycle.
 *
 * scheduled_date stays NULL — we are day-based, not calendar-based.
 */
export async function applyAllocation(
    allocation: DayAllocation
): Promise<ActionResult<{ allocated: number }>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    let allocated = 0
    let firstSession: SessionInventory | null = null

    for (const day of allocation.days) {
        for (const entry of day.sessions) {
            const session = entry.session
            if (!firstSession) firstSession = session

            // 1. Update session_inventory with training_day + session_slot
            const { error: updateError } = await supabase
                .from('session_inventory')
                .update({
                    training_day: day.dayNumber,
                    session_slot: entry.slot,
                })
                .eq('id', session.id)
                .eq('user_id', user.id)

            if (updateError) {
                console.error(`Failed to allocate session ${session.id}:`, updateError)
                continue
            }

            // 2. Find microcycle for this week
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
            // scheduled_date is set to a synthetic date for ordering purposes
            // (today + dayNumber offset), but the real scheduling is training_day-based
            const { data: workout, error: workoutError } = await supabase
                .from('workouts')
                .insert({
                    user_id: user.id,
                    microcycle_id: microcycle.id,
                    modality: session.modality,
                    name: session.name,
                    coach_notes: session.coach_notes,
                    scheduled_date: new Date().toISOString().split('T')[0], // placeholder
                    is_completed: false,
                    is_allocated: true,
                    session_inventory_id: session.id,
                })
                .select('id')
                .single()

            if (workoutError || !workout) {
                console.error(`Failed to create workout for session ${session.id}:`, workoutError)
                continue
            }

            // 4. Create exercise_sets if LIFTING modality
            if (session.modality === 'LIFTING' && session.adjustment_pending) {
                const prescription = (session.adjustment_pending as unknown as Record<string, unknown>)?.prescription
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
    }

    // Create a check_in_windows record for this week if any sessions were allocated.
    if (allocated > 0 && firstSession) {
        const mesocycleId = firstSession.mesocycle_id
        const weekNumber = firstSession.week_number
        const allocationStart = new Date().toISOString().split('T')[0] // today = reference point for 7-day safety net

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
                console.error('[applyAllocation] Failed to create check_in_windows record:', windowError)
            }
        } else {
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
 * Manually assign a session to a specific training day and slot.
 */
export async function scheduleSession(
    sessionId: string,
    trainingDay: number,
    sessionSlot: 1 | 2 = 1
): Promise<ActionResult<void>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('session_inventory')
        .update({ training_day: trainingDay, session_slot: sessionSlot })
        .eq('id', sessionId)
        .eq('user_id', user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, data: undefined }
}

/**
 * Unschedule a session (remove from training day, back to inventory).
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
        .update({ training_day: null, session_slot: null, scheduled_date: null })
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

    // Get all allocated sessions for this week (training_day-based or scheduled_date-based)
    const { data: sessions } = await supabase
        .from('session_inventory')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('user_id', user.id)
        .eq('week_number', weekNumber)
        .not('training_day', 'is', null)

    if (!sessions || sessions.length === 0) {
        return { success: true, data: { deallocated: 0 } }
    }

    const sessionIds = sessions.map(s => s.id)

    // Delete associated workouts (cascade will handle exercise_sets)
    await supabase
        .from('workouts')
        .delete()
        .in('session_inventory_id', sessionIds)

    // Clear training_day, session_slot, and scheduled_date
    const { error: updateError } = await supabase
        .from('session_inventory')
        .update({ training_day: null, session_slot: null, scheduled_date: null })
        .in('id', sessionIds)

    if (updateError) {
        return { success: false, error: updateError.message }
    }

    return { success: true, data: { deallocated: sessionIds.length } }
}

