'use server'

/**
 * Training-max persistence — INTERNAL to server actions.
 *
 * Reads/writes per-user per-exercise training maxes stored as JSONB on
 * `profiles.training_maxes`. Called by recalibration flows to close the
 * stale-1RM loop between sessions. Throws on auth/DB errors.
 *
 * Shape:
 *   { [exerciseName: string]: { trainingMaxKg: number, updatedAt: string, source: TrainingMaxSource } }
 */

import { createClient } from '@/lib/supabase/server'
import { recordCapability } from '@/lib/athlete/capabilities.actions'

export type TrainingMaxSource = 'onboarding' | 'recalibration' | 'intervention_response'

export interface TrainingMaxEntry {
    trainingMaxKg: number
    updatedAt: string
    source: TrainingMaxSource
}

export async function getTrainingMax(exercise: string): Promise<TrainingMaxEntry | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    const { data, error } = await supabase
        .from('profiles')
        .select('training_maxes')
        .eq('id', user.id)
        .maybeSingle()
    if (error) throw error
    const map = (data?.training_maxes ?? {}) as Record<string, TrainingMaxEntry>
    return map[exercise] ?? null
}

export interface SetTrainingMaxInput {
    exercise: string
    trainingMaxKg: number
    source: TrainingMaxSource
}

export async function setTrainingMax(input: SetTrainingMaxInput): Promise<TrainingMaxEntry> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    // Read → merge → write. No atomic concurrency guarantee — acceptable for a personal app.
    const entry: TrainingMaxEntry = {
        trainingMaxKg: Number(input.trainingMaxKg.toFixed(1)),
        updatedAt: new Date().toISOString(),
        source: input.source
    }

    const { data: profile, error: readErr } = await supabase
        .from('profiles')
        .select('training_maxes')
        .eq('id', user.id)
        .maybeSingle()
    if (readErr) throw readErr

    const current = (profile?.training_maxes ?? {}) as Record<string, TrainingMaxEntry>
    const next = { ...current, [input.exercise]: entry }

    const { error: writeErr } = await supabase
        .from('profiles')
        .update({ training_maxes: next })
        .eq('id', user.id)
    if (writeErr) throw writeErr

    // Write-through to the canonical capability store. intervention_response maps to
    // recalibration. Failures must not break the training-max write.
    try {
        await recordCapability({
            name: input.exercise,
            value: entry.trainingMaxKg,
            source: input.source === 'intervention_response' ? 'recalibration' : input.source,
            evidence: { from: 'training_max', source: input.source },
        })
    } catch (err) {
        console.error('[setTrainingMax] capability write-through failed', err)
    }

    return entry
}
