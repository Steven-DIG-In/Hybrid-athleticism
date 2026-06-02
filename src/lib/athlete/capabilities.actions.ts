// The single writer + reader for the canonical athlete_capabilities store.
// recordCapability() is the ONLY path that mutates the table; benchmark + recalibration
// flows call it as a write-through. Unknown names are skipped (logged), never dropped silently.

import { createClient } from '@/lib/supabase/server'
import { resolveCapabilityKey, CAPABILITY_REGISTRY } from './capability-registry'
import type { StrengthCapability, EnduranceCapability } from '@/lib/types/athlete-state.types'

export type CapabilitySource = 'onboarding' | 'recalibration' | 'manual' | 'test'

export interface RecordCapabilityInput {
  name: string
  value: number
  source: CapabilitySource
  evidence?: Record<string, unknown>
}

export async function recordCapability(input: RecordCapabilityInput): Promise<void> {
  const descriptor = resolveCapabilityKey(input.name)
  if (!descriptor) {
    console.warn(`[recordCapability] unmapped capability name skipped: "${input.name}"`)
    return
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthenticated')

  const { error } = await supabase
    .from('athlete_capabilities')
    .upsert({
      user_id: user.id,
      capability_key: descriptor.key,
      family: descriptor.family,
      current_value: input.value,
      unit: descriptor.unit,
      source: input.source,
      evidence: input.evidence ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,capability_key' })

  if (error) throw error
}

export interface AthleteCapabilities {
  strength: StrengthCapability[]
  endurance: EnduranceCapability[]
}

export async function getCapabilities(userId: string): Promise<AthleteCapabilities> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_capabilities')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error

  const rows = data ?? []
  const strength: StrengthCapability[] = []
  const endurance: EnduranceCapability[] = []

  for (const r of rows as Array<Record<string, any>>) {
    const label = CAPABILITY_REGISTRY[r.capability_key]?.label ?? r.capability_key
    if (r.family === 'strength') {
      strength.push({ key: r.capability_key, label, currentValueKg: Number(r.current_value), source: r.source, updatedAt: r.updated_at, evidence: r.evidence ?? {} })
    } else {
      endurance.push({ key: r.capability_key, label, currentValueSeconds: Number(r.current_value), source: r.source, updatedAt: r.updated_at, evidence: r.evidence ?? {} })
    }
  }
  return { strength, endurance }
}
