/**
 * Helpers for translating the head-coach strategy's free-text
 * `methodologyDirective` strings into the `methodology_preference` enum stored
 * on `profiles.strength_methodology` / `endurance_methodology`. Used by
 * `approveBlockPlan` to persist the strategy's methodology choice and by
 * `buildMethodologyContext` as a fallback when the profile field is unset.
 */

import type { Database } from '@/lib/types/database.types'

export type MethodologyPreference =
    Database['public']['Enums']['methodology_preference']

export interface StrategyShape {
    domainAllocations?: Array<{
        coach: string
        methodologyDirective?: string
    }>
}

/** Map an arbitrary directive string to a strength methodology enum value. */
export function strengthMethodologyFromDirective(
    directive: string | undefined | null,
): MethodologyPreference | null {
    if (!directive) return null
    const d = directive.toLowerCase()

    if (d.includes('5/3/1') || d.includes('531') || d.includes('wendler')) return '531'
    if (d.includes('linear progression') || d.includes('starting strength') || d.includes('rippetoe')) return 'linear_progression'
    if (d.includes('conjugate') || d.includes('westside')) return 'conjugate'
    if (d.includes('undulating') || d.includes('percentage')) return 'percentage_based'
    return null
}

/** Map an arbitrary directive string to an endurance methodology enum value. */
export function enduranceMethodologyFromDirective(
    directive: string | undefined | null,
): MethodologyPreference | null {
    if (!directive) return null
    const d = directive.toLowerCase()

    if (d.includes('80/20') || d.includes('polarized')) return 'polarized_80_20'
    if (d.includes('maf') || d.includes('aerobic base')) return 'maf_aerobic'
    if (d.includes('daniels') || d.includes('vdot')) return 'daniels_formula'
    return null
}

/**
 * Resolve the strength methodology for the given strategy by looking at the
 * strength domain allocation's methodologyDirective.
 */
export function methodologyEnumFromStrategy(
    strategy: StrategyShape | null | undefined,
): MethodologyPreference | null {
    const directive = strategy?.domainAllocations?.find(d => d.coach === 'strength')
        ?.methodologyDirective
    return strengthMethodologyFromDirective(directive)
}
