// Injury and recent-training rows are written once (onboarding) and read by
// every planner afterwards. Their descriptions are phrased in the present tense
// on the day they were written, so a prompt that renders them undated tells the
// coach a month-old "returning after 7 weeks off" is still true. These helpers
// date every row and flag recent training that has gone stale.

import { differenceInCalendarDays } from 'date-fns'
import type { AthleteInjury, RecentTrainingActivity } from '@/lib/types/database.types'

/** Recent training older than this is flagged as possibly out of date. */
export const RECENT_TRAINING_STALE_DAYS = 14

type InjuryRow = Pick<AthleteInjury, 'body_area' | 'severity' | 'description' | 'movements_to_avoid' | 'is_active'>
    & Partial<Pick<AthleteInjury, 'created_at'>>
type RecentTrainingRow = Pick<RecentTrainingActivity, 'modality' | 'frequency_per_week' | 'approximate_volume'>
    & Partial<Pick<RecentTrainingActivity, 'captured_at'>>

function daysAgo(iso: string, now: Date): number {
    return Math.max(0, differenceInCalendarDays(now, new Date(iso)))
}

/** "recorded 2026-09-23, 33 days ago" */
function recordedLabel(iso: string, days: number): string {
    return `recorded ${iso.slice(0, 10)}, ${days === 1 ? '1 day' : `${days} days`} ago`
}

export function formatInjuries(injuries: InjuryRow[], now: Date = new Date(), separator = '; '): string | null {
    const active = injuries.filter(i => i.is_active)
    if (active.length === 0) return null
    return active
        .map(i => {
            const when = i.created_at ? recordedLabel(i.created_at, daysAgo(i.created_at, now)) : null
            return `${i.body_area} (${i.severity}${when ? `, ${when}` : ''}): ${i.description || 'No description'}. Avoid: ${i.movements_to_avoid?.join(', ') || 'none specified'}`
        })
        .join(separator)
}

export function formatRecentTraining(rows: RecentTrainingRow[], now: Date, separator = '\n'): string | null {
    if (rows.length === 0) return null
    return rows
        .map(rt => {
            const line = `${rt.modality}: ${rt.frequency_per_week}x/week${rt.approximate_volume ? `, ~${rt.approximate_volume}` : ''}`
            if (!rt.captured_at) return line
            const days = daysAgo(rt.captured_at, now)
            const stale = days > RECENT_TRAINING_STALE_DAYS
            return `${line} (${recordedLabel(rt.captured_at, days)}${stale ? ' — may be out of date' : ''})`
        })
        .join(separator)
}
