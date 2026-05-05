import type { CoachDomain } from '@/lib/analytics/shared/coach-domain'

export type AdherenceCounts = {
  prescribed: number
  completed: number
  missed: number
  pct: number  // 0-100, integer rounded
}

export type DomainExecution = {
  sessionsWithDeltas: number
  meanDeltaPct: number  // signed; positive = over-performed prescription
  classificationCounts: { over: number; on: number; under: number }
}

export type RecalibrationTrigger =
  | 'drift_lt_5' | 'drift_5_to_10' | 'drift_gt_10' | 'manual'

export type RecalibrationSource =
  | 'recalibration' | 'intervention_response' | 'manual'

export type RecalibrationEntry = {
  exerciseName: string
  fromKg: number
  toKg: number
  source: RecalibrationSource
  triggeredBy: RecalibrationTrigger
  occurredAt: string  // ISO timestamp
}

export type InterventionUserResponse = 'keep' | 'harder' | 'recalibrate' | null

export type InterventionEntry = {
  id: string
  coachDomain: CoachDomain | null
  triggerType: string
  rationale: string
  presentedToUser: boolean
  userResponse: InterventionUserResponse
  occurredAt: string
}

export type MissedSessionEntry = {
  sessionInventoryId: string
  name: string
  modality: string
  coachDomain: CoachDomain
  weekNumber: number
  trainingDay: number
}

export type BlockRetrospectiveSnapshot = {
  schemaVersion: 1
  block: {
    id: string
    name: string
    goal: string
    weekCount: number
    startDate: string
    endDate: string  // computed: max(microcycle.end_date)
    closedAt: string
  }
  adherence: {
    overall: AdherenceCounts
    byCoachDomain: Record<CoachDomain, AdherenceCounts>
    byWeek: Array<AdherenceCounts & { weekNumber: number }>
  }
  executionQuality: {
    byCoachDomain: Record<CoachDomain, DomainExecution>
  }
  recalibrations: RecalibrationEntry[]
  interventions: InterventionEntry[]
  missedSessions: MissedSessionEntry[]
}

/** All valid CoachDomain values, used to seed empty `Record<CoachDomain, …>`. */
export const COACH_DOMAINS: readonly CoachDomain[] = [
  'strength', 'hypertrophy', 'endurance', 'conditioning', 'mobility', 'recovery',
] as const

export function emptyAdherenceCounts(): AdherenceCounts {
  return { prescribed: 0, completed: 0, missed: 0, pct: 0 }
}

export function emptyDomainExecution(): DomainExecution {
  return {
    sessionsWithDeltas: 0,
    meanDeltaPct: 0,
    classificationCounts: { over: 0, on: 0, under: 0 },
  }
}

export function emptyByCoachDomainAdherence(): Record<CoachDomain, AdherenceCounts> {
  return Object.fromEntries(
    COACH_DOMAINS.map(d => [d, emptyAdherenceCounts()]),
  ) as Record<CoachDomain, AdherenceCounts>
}

export function emptyByCoachDomainExecution(): Record<CoachDomain, DomainExecution> {
  return Object.fromEntries(
    COACH_DOMAINS.map(d => [d, emptyDomainExecution()]),
  ) as Record<CoachDomain, DomainExecution>
}
