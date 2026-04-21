'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, WeeklyReviewPayload } from '@/lib/types/training.types'
import type { AICoachIntervention } from '@/lib/types/database.types'
import { buildWeeklyPayload } from './logging.actions'
import { generateStructuredResponse } from '@/lib/ai/client'
import { CoachResponseSchema } from '@/lib/ai/schemas/coach'
import { buildCoachSystemPrompt, buildCoachUserPrompt } from '@/lib/ai/prompts/coach'
import { setTrainingMax } from './training-maxes.actions'

// ─── AI Coach: Weekly Review Generation ─────────────────────────────────────

/**
 * Generate a full AI Coach weekly review for a completed microcycle.
 *
 * Flow:
 * 1. Aggregate all workout/cardio/rucking data via buildWeeklyPayload()
 * 2. Enrich with microcycle context (target RIR, week number, deload status)
 * 3. Enrich with profile context (equipment, goals)
 * 4. Send structured prompt to Anthropic Claude (via ai/client)
 * 5. Validated response is persisted to ai_coach_interventions table
 */
export async function generateWeeklyReview(
    microcycleId: string
): Promise<ActionResult<AICoachIntervention>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Step 1: Aggregate weekly data
    const payloadResult = await buildWeeklyPayload(microcycleId)
    if (!payloadResult.success) {
        return { success: false, error: `Failed to build weekly payload: ${payloadResult.error}` }
    }
    const weeklyData = payloadResult.data!

    // Step 2: Fetch microcycle context
    const { data: microcycle, error: mcError } = await supabase
        .from('microcycles')
        .select('*, mesocycles!inner(goal, name, week_count)')
        .eq('id', microcycleId)
        .eq('user_id', user.id)
        .single()

    if (mcError || !microcycle) {
        return { success: false, error: mcError?.message ?? 'Microcycle not found' }
    }

    // Step 3: Fetch profile for equipment context
    const { data: profile } = await supabase
        .from('profiles')
        .select('equipment_access, primary_goal, bodyweight_kg')
        .eq('id', user.id)
        .single()

    // Step 4: Fetch RIR deviation data (completed sets with both target & actual RIR)
    const { data: workouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('microcycle_id', microcycleId)
        .eq('user_id', user.id)

    const workoutIds = workouts?.map(w => w.id) ?? []

    let avgRIRDeviation = 0
    const rpeSpikes: string[] = []

    if (workoutIds.length > 0) {
        const { data: setsWithRir } = await supabase
            .from('exercise_sets')
            .select('exercise_name, target_rir, rir_actual, rpe_actual')
            .in('workout_id', workoutIds)
            .not('rir_actual', 'is', null)
            .not('target_rir', 'is', null)

        if (setsWithRir && setsWithRir.length > 0) {
            const deviations = setsWithRir.map(s => (s.rir_actual ?? 0) - (s.target_rir ?? 0))
            avgRIRDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length
        }

        // Check for RPE spikes (>= 9.5)
        const { data: spikedSets } = await supabase
            .from('exercise_sets')
            .select('exercise_name')
            .in('workout_id', workoutIds)
            .gte('rpe_actual', 9.5)

        if (spikedSets) {
            const uniqueNames = new Set(spikedSets.map(s => s.exercise_name))
            rpeSpikes.push(...uniqueNames)
        }
    }

    // Fetch avg HR for cardio this week
    let avgHeartRateCardio: number | null = null
    if (workoutIds.length > 0) {
        const { data: cardioHr } = await supabase
            .from('cardio_logs')
            .select('avg_heart_rate_bpm')
            .in('workout_id', workoutIds)
            .not('avg_heart_rate_bpm', 'is', null)

        if (cardioHr && cardioHr.length > 0) {
            avgHeartRateCardio = Math.round(
                cardioHr.reduce((sum, c) => sum + (c.avg_heart_rate_bpm ?? 0), 0) / cardioHr.length
            )
        }
    }

    const mesocycleData = microcycle.mesocycles as { goal: string; name: string; week_count: number }

    // Build the full review payload
    const reviewPayload: WeeklyReviewPayload = {
        userId: user.id,
        microcycleId,
        weekNumber: microcycle.week_number,
        mesocycleGoal: mesocycleData.goal as WeeklyReviewPayload['mesocycleGoal'],

        muscleGroupVolumes: weeklyData.muscleGroupVolumes,
        avgRIRDeviation,
        rpeSpikes,

        totalCardioMinutes: weeklyData.totalCardioMinutes,
        avgHeartRateCardio,

        totalRuckDistanceKm: weeklyData.totalRuckDistanceKm,
        totalRuckLoadIndex: weeklyData.totalRuckLoadIndex,
        hadHighFatigueRuck: weeklyData.hadHighFatigueRuck,

        equipmentAccess: profile?.equipment_access ?? [],
    }

    // Step 5: Generate validated AI response via the shared client
    const systemPrompt = buildCoachSystemPrompt()
    const userPrompt = buildCoachUserPrompt(reviewPayload, microcycle.target_rir, microcycle.is_deload)

    const aiResult = await generateStructuredResponse({
        systemPrompt,
        userPrompt,
        schema: CoachResponseSchema,
        maxRetries: 2,
        maxTokens: 1024,
    })

    if (!aiResult.success) {
        console.error('[generateWeeklyReview] AI call failed:', aiResult.error)
        return { success: false, error: aiResult.error }
    }

    const coachResponse = aiResult.data
    const metadata = aiResult.metadata!

    // Step 6: Persist to DB
    const { data: intervention, error: saveError } = await supabase
        .from('ai_coach_interventions')
        .insert({
            microcycle_id: microcycleId,
            user_id: user.id,
            trigger_type: coachResponse.triggerType,
            rationale: coachResponse.rationale,
            volume_adjustments: coachResponse.volumeAdjustments ?? null,
            exercise_swaps: coachResponse.exerciseSwaps ?? null,
            rir_adjustment: coachResponse.rirAdjustment ?? null,
            model_used: metadata.model,
            input_payload: reviewPayload as unknown as Record<string, unknown>,
            raw_response: metadata.rawResponse,
            presented_to_user: false,
        })
        .select()
        .single()

    if (saveError) {
        console.error('[generateWeeklyReview] DB save error:', saveError)
        return { success: false, error: saveError.message }
    }

    // Mark the microcycle as reviewed
    await supabase
        .from('microcycles')
        .update({
            reviewed_at: new Date().toISOString(),
            review_summary: coachResponse.rationale,
        })
        .eq('id', microcycleId)
        .eq('user_id', user.id)

    revalidatePath('/coach')
    revalidatePath('/dashboard')
    return { success: true, data: intervention }
}

// ─── Existing CRUD operations ────────────────────────────────────────────────

/**
 * Fetch the latest AI coach intervention for a given microcycle.
 * Used by the Weekly Review screen.
 */
export async function getLatestIntervention(
    microcycleId: string
): Promise<ActionResult<AICoachIntervention | null>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: intervention, error } = await supabase
        .from('ai_coach_interventions')
        .select('*')
        .eq('microcycle_id', microcycleId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .maybeSingle()

    if (error) {
        console.error('[getLatestIntervention]', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: intervention }
}

/**
 * Fetch all unreviewed AI coach interventions for the current user.
 * Triggers the notification badge in the dashboard.
 */
export async function getUnreviewedInterventions(): Promise<ActionResult<AICoachIntervention[]>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: interventions, error } = await supabase
        .from('ai_coach_interventions')
        .select('*')
        .eq('user_id', user.id)
        .eq('presented_to_user', false)
        .order('created_at', { ascending: false })

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, data: interventions ?? [] }
}

/**
 * Persist a structured AI Coach response (from Anthropic API) into the database.
 * Called from the weekly cron job / edge function after the Anthropic API returns.
 */
export async function saveCoachIntervention(data: {
    microcycleId: string
    triggerType: AICoachIntervention['trigger_type']
    rationale: string
    volumeAdjustments?: Record<string, number>
    exerciseSwaps?: Array<{ from: string; to: string; reason: string }>
    rirAdjustment?: number
    modelUsed?: string
    inputPayload?: Record<string, unknown>
    rawResponse?: string
    coachDomain?: string
    patternSignal?: Record<string, unknown>
}): Promise<ActionResult<AICoachIntervention>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: intervention, error } = await supabase
        .from('ai_coach_interventions')
        .insert({
            microcycle_id: data.microcycleId,
            user_id: user.id,
            trigger_type: data.triggerType,
            rationale: data.rationale,
            volume_adjustments: data.volumeAdjustments ?? null,
            exercise_swaps: data.exerciseSwaps ?? null,
            rir_adjustment: data.rirAdjustment ?? null,
            model_used: data.modelUsed ?? 'claude-sonnet-4-5-20250929',
            input_payload: data.inputPayload ?? null,
            raw_response: data.rawResponse ?? null,
            presented_to_user: false,
            coach_domain: data.coachDomain ?? null,
            pattern_signal: data.patternSignal ?? null,
        })
        .select()
        .single()

    if (error) {
        console.error('[saveCoachIntervention]', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    revalidatePath('/coach')
    return { success: true, data: intervention }
}

/**
 * Mark an AI coach intervention as presented to the user.
 * Call this when the Weekly Review modal is shown.
 */
export async function markInterventionPresented(
    interventionId: string
): Promise<ActionResult<AICoachIntervention>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: intervention, error } = await supabase
        .from('ai_coach_interventions')
        .update({ presented_to_user: true })
        .eq('id', interventionId)
        .eq('user_id', user.id)
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true, data: intervention }
}

/**
 * Record the user's response to an AI intervention (accepted/rejected + optional feedback).
 */
export async function respondToIntervention(
    interventionId: string,
    accepted: boolean,
    feedback?: string
): Promise<ActionResult<AICoachIntervention>> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { data: intervention, error } = await supabase
        .from('ai_coach_interventions')
        .update({
            user_accepted: accepted,
            user_feedback: feedback ?? null,
            presented_to_user: true,
        })
        .eq('id', interventionId)
        .eq('user_id', user.id)
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message }
    }

    // When the athlete accepts a recalibration prompt, persist the observed
    // training max so next-session prescriptions pick up the new number.
    if (accepted && intervention?.trigger_type === 'recalibration_prompt') {
        const payload = intervention.input_payload as {
            exercise?: string
            observedMax?: number
        } | null
        if (payload?.exercise && typeof payload.observedMax === 'number') {
            try {
                await setTrainingMax({
                    exercise: payload.exercise,
                    trainingMaxKg: payload.observedMax,
                    source: 'intervention_response'
                })
            } catch (err) {
                console.error('[respondToIntervention] setTrainingMax failed', err)
            }
        }
    }

    revalidatePath('/coach')
    return { success: true, data: intervention }
}
