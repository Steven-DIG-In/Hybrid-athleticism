import type { CoachDomain } from '@/lib/skills/types'

export type Archetype =
    | 'hypertrophy'
    | 'strength'
    | 'endurance_event'
    | 'conditioning'
    | 'hybrid'
    | 'custom'

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
    hypertrophy: 'Hypertrophy',
    strength: 'Strength',
    endurance_event: 'Endurance Event',
    conditioning: 'Conditioning',
    hybrid: 'Hybrid',
    custom: 'Custom',
}

export const ARCHETYPE_DESCRIPTIONS: Record<Archetype, string> = {
    hypertrophy: 'Build muscle. Strength gains carry as accessory load.',
    strength: 'Heavy compounds. New TM each cycle.',
    endurance_event: 'Race-prep periodization toward a date.',
    conditioning: 'AMRAPs, intervals, mixed-modal.',
    hybrid: 'Balanced across all domains.',
    custom: 'Set per-coach session counts directly.',
}

// Per-coach session-count defaults for each non-custom archetype.
export const ARCHETYPE_DEFAULTS: Record<Exclude<Archetype, 'custom'>, Record<CoachDomain, number>> = {
    hypertrophy:     { hypertrophy: 3, strength: 2, conditioning: 1, endurance: 0, mobility: 2, recovery: 0 },
    strength:        { hypertrophy: 1, strength: 4, conditioning: 1, endurance: 0, mobility: 2, recovery: 0 },
    endurance_event: { hypertrophy: 0, strength: 2, conditioning: 1, endurance: 4, mobility: 2, recovery: 0 },
    conditioning:    { hypertrophy: 1, strength: 2, conditioning: 4, endurance: 1, mobility: 2, recovery: 0 },
    hybrid:          { hypertrophy: 2, strength: 2, conditioning: 2, endurance: 1, mobility: 2, recovery: 0 },
}

export function defaultsFor(
    archetype: Archetype,
    customCounts?: Record<CoachDomain, number>,
): Record<CoachDomain, number> {
    if (archetype === 'custom') {
        return customCounts ?? {
            hypertrophy: 0, strength: 0, conditioning: 0, endurance: 0, mobility: 0, recovery: 0,
        } as Record<CoachDomain, number>
    }
    return ARCHETYPE_DEFAULTS[archetype]
}
