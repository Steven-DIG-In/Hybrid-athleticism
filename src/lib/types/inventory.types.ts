/**
 * Type definitions for Session Inventory Architecture
 *
 * Supports flexible, calendar-independent training programming:
 * - Sessions generated as unscheduled inventory
 * - User allocates sessions to calendar dates
 * - Daily coaching assessments and adjustments
 */

export type SessionPriority = 1 | 2 | 3
// 1 = must-do core session
// 2 = recommended beneficial session
// 3 = optional bonus volume

export type WorkoutModality = 'LIFTING' | 'CARDIO' | 'METCON' | 'RUCKING' | 'MOBILITY'

export interface SessionInventory {
    id: string
    mesocycle_id: string
    user_id: string

    // Logical organization
    week_number: number
    session_priority: SessionPriority

    // Session details
    modality: WorkoutModality
    name: string
    coach_notes: string | null
    estimated_duration_minutes: number | null
    load_budget: number | null

    // Scheduling state
    scheduled_date: string | null  // ISO date string
    completed_at: string | null    // ISO timestamp
    is_approved: boolean

    // Coaching context
    carry_over_notes: string | null
    adjustment_pending: AdjustmentPending | null

    // Metadata
    created_at: string
    updated_at: string
}

export interface AdjustmentPending {
    type: AdjustmentType
    reason: string
    original: Record<string, unknown>
    modified: Record<string, unknown>
}

export type AdjustmentType =
    | 'reduce_intensity'
    | 'reduce_volume'
    | 'increase_rest'
    | 'swap_exercise'
    | 'add_deload'
    | 'modify_pace'
    | 'skip_session'

export interface TrainingConstraints {
    id: string
    user_id: string
    mesocycle_id: string

    // Availability
    unavailable_days: string[]  // ['monday', 'wednesday', etc.]
    preferred_start_date: string | null  // ISO date
    sessions_per_week: number

    // Interference preferences
    no_heavy_legs_before_run: boolean
    min_rest_between_heavy_sessions_hours: number
    prefer_am_or_pm: 'morning' | 'evening' | 'no_preference' | null

    // Metadata
    created_at: string
    updated_at: string
}

export type OverallFeeling = 'great' | 'as_expected' | 'struggled' | 'skipped'
export type EnergyLevel = 'high' | 'normal' | 'low' | 'very_low'

export interface SessionAssessment {
    id: string
    workout_id: string
    user_id: string

    // User input
    overall_feeling: OverallFeeling | null
    energy_level: EnergyLevel | null
    had_pain: boolean
    pain_details: string | null
    athlete_notes: string | null

    // AI analysis
    performance_summary: string | null
    carry_over_notes: string | null
    adjustment_recommended: AdjustmentRecommendation | null

    // Metadata
    assessed_at: string
}

export interface AdjustmentRecommendation {
    type: AdjustmentType
    magnitude?: number  // e.g., -10 for "reduce by 10%"
    reason: string
    target_session_id?: string
}

export type AdjustmentStatus = 'pending' | 'accepted' | 'overridden' | 'expired'

export interface CoachingAdjustment {
    id: string
    session_inventory_id: string
    user_id: string

    // What changed
    adjustment_type: AdjustmentType
    original_prescription: Record<string, unknown>
    modified_prescription: Record<string, unknown>

    // Why it changed
    reason: string
    triggering_assessment_id: string | null

    // User interaction
    status: AdjustmentStatus
    user_response: string | null

    // Metadata
    created_at: string
    resolved_at: string | null
}

// ─── Helper Types for Allocation ────────────────────────────────────────────

export interface AllocationRequest {
    mesocycleId: string
    weekNumber: number
    startDate: string  // ISO date
    constraints: TrainingConstraints
}

export interface AllocationResult {
    session: SessionInventory
    suggestedDate: string  // ISO date
    reasoning: string  // e.g., "Rest day after heavy squats"
}

export interface ScheduleSuggestion {
    allocations: AllocationResult[]
    warnings: string[]  // e.g., "3 consecutive training days - consider rest"
}

// ─── Helper Types for Session Pool Display ─────────────────────────────────

export interface InventoryGroup {
    weekNumber: number
    sessions: SessionInventory[]
    totalDuration: number
    totalLoad: number
}

export interface UnscheduledInventoryView {
    mesocycleId: string
    mesocycleName: string
    weekGroups: InventoryGroup[]
    totalSessions: number
    approvedSessions: number
}
