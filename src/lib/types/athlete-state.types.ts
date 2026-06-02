// src/lib/types/athlete-state.types.ts
// The canonical read model for Layer 1 (Athlete & State).
// Capability families are DISTINCT types, mirroring the prescription-family split.

import type { AthleteInjury } from './database.types'

export type CapabilitySource = 'onboarding' | 'recalibration' | 'manual' | 'test'

export interface StrengthCapability {
  key: string                 // e.g. 'back_squat'
  label: string               // e.g. 'Back Squat'
  currentValueKg: number
  source: CapabilitySource
  updatedAt: string
  evidence: Record<string, unknown>
}

export interface EnduranceCapability {
  key: string                 // e.g. 'run_5k'
  label: string
  currentValueSeconds: number
  source: CapabilitySource
  updatedAt: string
  evidence: Record<string, unknown>
}

export interface Readiness {
  status: 'GREEN' | 'YELLOW' | 'RED'
  score: number               // 0-1
  rationale: string
}

export interface AthleteState {
  identity: {
    age: number | null
    sex: string | null
    bodyweightKg: number | null
    goalArchetype: string | null
    primaryGoal: string | null
    experienceByModality: Record<string, string | null>
  }
  constraints: {
    injuries: AthleteInjury[]            // active only
    movementsToAvoid: string[]
    equipmentList: string[]
    environment: string | null
    availableDays: number | null
    sessionDurationMinutes: number | null
  }
  capabilities: {
    strength: StrengthCapability[]
    endurance: EnduranceCapability[]
  }
  readiness: Readiness | { status: 'UNKNOWN' }
}
