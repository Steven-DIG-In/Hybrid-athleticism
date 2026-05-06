/**
 * Domain-specific prompt-arg builders — relocated from
 * src/lib/ai/orchestrator.ts.
 *
 * Pure helpers that fan strategy + brief data into per-domain prompt
 * argument tuples. No Supabase access.
 */

import type {
    AthleteContextPacket,
    CoachingTeamEntry,
    WeekBrief,
} from '@/lib/types/coach-context'
import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'
import type { MethodologyContext } from '@/lib/ai/prompts/programming'
import type { EnduranceMethodologyContext } from '@/lib/ai/prompts/endurance-coach'

/**
 * Check if a coaching team includes a specific coach type.
 */
function hasCoach(team: CoachingTeamEntry[], type: string): boolean {
    return team.some(t => t.coach === type)
}

/**
 * Build domain-specific user prompt args based on coach type.
 * Each domain coach has a slightly different user prompt signature.
 */
export function buildDomainUserPromptArgs(
    domain: string,
    ctx: AthleteContextPacket,
    brief: WeekBrief,
    strategy: MesocycleStrategyValidated,
    methodologyContext?: MethodologyContext,
    enduranceMethodologyContext?: EnduranceMethodologyContext,
    volumeTargets?: string
): unknown[] {
    switch (domain) {
        case 'strength':
            return [ctx, brief, methodologyContext, strategy.totalWeeks, hasCoach(ctx.coachingTeam, 'hypertrophy')]
        case 'endurance':
            return [ctx, brief, enduranceMethodologyContext, strategy.totalWeeks]
        case 'hypertrophy':
            return [ctx, brief, volumeTargets, strategy.totalWeeks, hasCoach(ctx.coachingTeam, 'strength')]
        case 'conditioning':
            return [ctx, brief, strategy.totalWeeks]
        case 'mobility': {
            const allDomainSessions: Array<{ coach: string; sessionName: string }> = []
            for (const allocation of strategy.domainAllocations) {
                if (allocation.coach !== 'mobility') {
                    for (let i = 0; i < allocation.sessionsPerWeek; i++) {
                        allDomainSessions.push({
                            coach: allocation.coach,
                            sessionName: `${allocation.coach} session ${i + 1}`,
                        })
                    }
                }
            }
            return [ctx, brief, strategy.totalWeeks, allDomainSessions]
        }
        default:
            return [ctx, brief, strategy.totalWeeks]
    }
}

/**
 * Build modification sessions from next-week data for a specific domain.
 * Returns the appropriate typed session array for the modification prompt.
 */
export function buildModSessions(
    domain: string,
    nextWeekSessions: Array<{ coach: string; sessionName: string; exercises?: string[] }>
): unknown[] {
    const domainSessions = nextWeekSessions.filter(s => s.coach === domain)
    if (domainSessions.length === 0) return []

    switch (domain) {
        case 'strength':
            return domainSessions.map(s => ({
                name: s.sessionName,
                exercises: (s.exercises ?? []).map(e => ({
                    exerciseName: e,
                    sets: 0,
                    targetReps: 0,
                    targetWeightKg: null as number | null,
                    targetRir: 2,
                })),
            }))
        case 'endurance':
            return domainSessions.map(s => ({
                name: s.sessionName,
                enduranceModality: 'running' as const,
                intensityZone: 'zone_2' as const,
                targetDistanceKm: null as number | null,
                estimatedDurationMinutes: 0,
            }))
        case 'hypertrophy':
            return domainSessions.map(s => ({
                name: s.sessionName,
                muscleGroupFocus: [] as string[],
                exercises: (s.exercises ?? []).map(e => ({
                    exerciseName: e,
                    sets: 0,
                    targetReps: 0,
                    targetWeightKg: null as number | null,
                    targetRir: 2,
                })),
            }))
        case 'conditioning':
            return domainSessions.map(s => ({
                name: s.sessionName,
                conditioningType: 'metcon' as const,
                targetIntensity: 'moderate' as const,
                estimatedDurationMinutes: 0,
            }))
        case 'mobility':
            return domainSessions.map(s => ({
                name: s.sessionName,
                focusAreas: [] as string[],
                estimatedDurationMinutes: 0,
            }))
        default:
            return []
    }
}
