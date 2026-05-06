import { createClient } from '@/lib/supabase/server'
import {
  modalityToCoachDomain,
  computeExerciseDeltaPct,
  type CoachDomain,
} from './shared/coach-domain'
import {
  type BlockRetrospectiveSnapshot,
  type RecalibrationEntry,
  type RecalibrationSource,
  type RecalibrationTrigger,
  type InterventionEntry,
  type InterventionUserResponse,
  type MissedSessionEntry,
  type AdherenceCounts,
  type DomainExecution,
  COACH_DOMAINS,
  emptyByCoachDomainAdherence,
  emptyByCoachDomainExecution,
} from '@/lib/types/block-retrospective.types'

function pct(num: number, den: number): number {
  if (den === 0) return 0
  return Math.round((num / den) * 100)
}

function withPct(c: Omit<AdherenceCounts, 'pct'>): AdherenceCounts {
  return { ...c, pct: pct(c.completed, c.prescribed) }
}

/** Pure assembler — loads everything needed and returns the typed snapshot.
 *  No mutations; safe to call as a dry-run for the pre-close confirm modal. */
export async function buildBlockRetrospectiveSnapshot(
  mesocycleId: string,
): Promise<BlockRetrospectiveSnapshot> {
  const supabase = await createClient()

  const { data: meso } = await supabase
    .from('mesocycles').select('*').eq('id', mesocycleId).maybeSingle()
  if (!meso) throw new Error(`mesocycle ${mesocycleId} not found`)

  const { data: microcycles } = await supabase
    .from('microcycles').select('*').eq('mesocycle_id', mesocycleId).order('week_number')

  const microcycleIds = (microcycles ?? []).map((mc: any) => mc.id)
  const { data: workouts } = microcycleIds.length
    ? await supabase.from('workouts').select('*').in('microcycle_id', microcycleIds)
    : { data: [] as any[] }

  const { data: inventory } = await supabase
    .from('session_inventory').select('*').eq('mesocycle_id', mesocycleId)

  const inventoryIds = (inventory ?? []).map((i: any) => i.id)
  const { data: deltas } = inventoryIds.length
    ? await supabase.from('performance_deltas').select('*').in('session_inventory_id', inventoryIds)
    : { data: [] as any[] }

  const { data: agentRows } = await supabase
    .from('agent_activity').select('*')
    .eq('user_id', meso.user_id).eq('decision_type', 'recalibration')
    .gte('created_at', meso.start_date)

  const { data: interventionRows } = microcycleIds.length
    ? await supabase.from('ai_coach_interventions').select('*').in('microcycle_id', microcycleIds)
    : { data: [] as any[] }

  // ─── Adherence ───────────────────────────────────────────────────────
  const completedInvIds = new Set(
    (workouts ?? [])
      .filter((w: any) => w.completed_at != null && w.session_inventory_id)
      .map((w: any) => w.session_inventory_id as string),
  )

  const byWeekCounts = new Map<number, { prescribed: number; completed: number }>()
  const byDomainCounts: Record<CoachDomain, { prescribed: number; completed: number }> =
    Object.fromEntries(COACH_DOMAINS.map(d => [d, { prescribed: 0, completed: 0 }])) as any

  for (const inv of inventory ?? []) {
    const w = byWeekCounts.get(inv.week_number) ?? { prescribed: 0, completed: 0 }
    w.prescribed++
    const isDone = completedInvIds.has(inv.id)
    if (isDone) w.completed++
    byWeekCounts.set(inv.week_number, w)

    const domain = modalityToCoachDomain(inv.modality ?? '')
    if (domain) {
      byDomainCounts[domain].prescribed++
      if (isDone) byDomainCounts[domain].completed++
    }
  }

  const overallPrescribed = (inventory ?? []).length
  const overallCompleted = completedInvIds.size
  const overallAdherence = withPct({
    prescribed: overallPrescribed,
    completed: overallCompleted,
    missed: overallPrescribed - overallCompleted,
  })

  const byCoachDomainAdherence = emptyByCoachDomainAdherence()
  for (const d of COACH_DOMAINS) {
    const c = byDomainCounts[d]
    byCoachDomainAdherence[d] = withPct({
      prescribed: c.prescribed,
      completed: c.completed,
      missed: c.prescribed - c.completed,
    })
  }

  const byWeek = (microcycles ?? []).map((mc: any) => {
    const c = byWeekCounts.get(mc.week_number) ?? { prescribed: 0, completed: 0 }
    return {
      weekNumber: mc.week_number,
      ...withPct({
        prescribed: c.prescribed,
        completed: c.completed,
        missed: c.prescribed - c.completed,
      }),
    }
  })

  // ─── Execution quality ───────────────────────────────────────────────
  const invToDomain = new Map<string, CoachDomain>()
  for (const inv of inventory ?? []) {
    const domain = modalityToCoachDomain(inv.modality ?? '')
    if (domain) invToDomain.set(inv.id, domain)
  }

  const perSessionByDomain: Record<CoachDomain, number[]> =
    Object.fromEntries(COACH_DOMAINS.map(d => [d, [] as number[]])) as any
  const classByDomain: Record<CoachDomain, { over: number; on: number; under: number }> =
    Object.fromEntries(COACH_DOMAINS.map(d => [d, { over: 0, on: 0, under: 0 }])) as any

  const deltasBySession = new Map<string, any[]>()
  for (const d of deltas ?? []) {
    if (!d.session_inventory_id) continue
    const arr = deltasBySession.get(d.session_inventory_id) ?? []
    arr.push(d)
    deltasBySession.set(d.session_inventory_id, arr)
  }

  for (const [invId, exDeltas] of deltasBySession) {
    const domain = invToDomain.get(invId)
    if (!domain) continue
    const valid = exDeltas
      .map(d => computeExerciseDeltaPct(d))
      .filter((v): v is number => v != null)
    if (valid.length === 0) continue
    const sessionDelta = valid.reduce((a, c) => a + c, 0) / valid.length
    perSessionByDomain[domain].push(sessionDelta)

    for (const d of exDeltas) {
      const cls: 'over' | 'on' | 'under' =
        d.delta_classification === 'over' || d.delta_classification === 'on' || d.delta_classification === 'under'
          ? d.delta_classification
          : sessionDelta > 1 ? 'over' : sessionDelta < -1 ? 'under' : 'on'
      classByDomain[domain][cls]++
    }
  }

  const executionByDomain = emptyByCoachDomainExecution()
  for (const d of COACH_DOMAINS) {
    const sessions = perSessionByDomain[d]
    const exec: DomainExecution = {
      sessionsWithDeltas: sessions.length,
      meanDeltaPct: sessions.length === 0
        ? 0
        : Math.round((sessions.reduce((a, c) => a + c, 0) / sessions.length) * 10) / 10,
      classificationCounts: classByDomain[d],
    }
    executionByDomain[d] = exec
  }

  // ─── Recalibrations from agent_activity ──────────────────────────────
  const recalibrations: RecalibrationEntry[] = (agentRows ?? [])
    .filter((r: any) => r.decision_type === 'recalibration')
    .map((r: any) => {
      const target = r.target_entity ?? {}
      const reason = r.reasoning_structured ?? {}
      return {
        exerciseName: String(target.exercise_name ?? 'Unknown'),
        fromKg: Number(reason.from_kg ?? 0),
        toKg: Number(reason.to_kg ?? 0),
        source: ((reason.source as RecalibrationSource) ?? 'manual'),
        triggeredBy: ((reason.triggered_by as RecalibrationTrigger) ?? 'manual'),
        occurredAt: String(r.created_at),
      }
    })
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  // ─── Interventions ───────────────────────────────────────────────────
  const interventions: InterventionEntry[] = (interventionRows ?? []).map((r: any) => {
    const domain = r.coach_domain
      ? (COACH_DOMAINS.includes(r.coach_domain as CoachDomain) ? (r.coach_domain as CoachDomain) : null)
      : null
    return {
      id: r.id,
      coachDomain: domain,
      triggerType: r.trigger_type ?? 'unknown',
      rationale: r.rationale ?? '',
      presentedToUser: r.presented_to_user === true,
      userResponse: ((r.user_response as InterventionUserResponse) ?? null),
      occurredAt: String(r.created_at),
    }
  }).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  // ─── Missed sessions (any inventory not completed at close time) ─────
  const missedSessions: MissedSessionEntry[] = (inventory ?? [])
    .filter((inv: any) => !completedInvIds.has(inv.id))
    .map((inv: any) => {
      const domain = modalityToCoachDomain(inv.modality ?? '')
      return {
        sessionInventoryId: inv.id,
        name: inv.name ?? 'Untitled',
        modality: inv.modality ?? 'unknown',
        coachDomain: domain ?? 'recovery',
        weekNumber: inv.week_number,
        trainingDay: inv.training_day ?? 0,
      }
    })

  // ─── Block header ────────────────────────────────────────────────────
  const endDate = (microcycles ?? []).reduce<string>(
    (max: string, mc: any) => (mc.end_date && mc.end_date > max ? mc.end_date : max),
    meso.start_date,
  )

  return {
    schemaVersion: 1,
    block: {
      id: meso.id,
      name: meso.name,
      goal: meso.goal,
      weekCount: meso.week_count,
      startDate: meso.start_date,
      endDate,
      closedAt: new Date().toISOString(),
    },
    adherence: {
      overall: overallAdherence,
      byCoachDomain: byCoachDomainAdherence,
      byWeek,
    },
    executionQuality: { byCoachDomain: executionByDomain },
    recalibrations,
    interventions,
    missedSessions,
  }
}
