/**
 * Mesocycle strategy helpers (Task 11 — engine refactor).
 *
 * Pure helpers extracted from the orchestrator that operate on a
 * MesocycleStrategy. No I/O, no AI calls.
 */

import type { WeekBrief } from '@/lib/types/coach-context'
import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'

/**
 * Extract the WeekBrief for a specific domain coach from the MesocycleStrategy.
 * This slices the strategy into a per-coach mandate for a specific week.
 */
export function extractWeekBrief(
    strategy: MesocycleStrategyValidated,
    coachType: string,
    weekNumber: number
): WeekBrief | null {
    const allocation = strategy.domainAllocations.find(d => d.coach === coachType)
    if (!allocation) return null

    const weekEmphasis = strategy.weeklyEmphasis.find(w => w.weekNumber === weekNumber)
    if (!weekEmphasis) return null

    const otherDomains = strategy.domainAllocations
        .filter(d => d.coach !== coachType)
        .map(d => ({
            domain: d.coach,
            sessionCount: d.sessionsPerWeek,
            loadBudget: d.loadBudgetPerSession,
        }))

    return {
        weekNumber,
        isDeload: weekEmphasis.isDeload,
        weekEmphasis: weekEmphasis.emphasis,
        volumePercent: weekEmphasis.volumePercent,
        sessionsToGenerate: allocation.sessionsPerWeek,
        loadBudget: allocation.loadBudgetPerSession,
        constraints: allocation.constraints,
        methodologyDirective: allocation.methodologyDirective,
        otherDomainsThisWeek: otherDomains,
    }
}
