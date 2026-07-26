import { describe, it, expect } from 'vitest'
import { effectiveCalendarDate } from '../effective-date'

describe('effectiveCalendarDate', () => {
    it('places completed workouts on the day they were completed', () => {
        expect(effectiveCalendarDate({
            scheduled_date: '2026-07-24',
            completed_date: '2026-07-21',
            is_completed: true,
        })).toBe('2026-07-21')
    })

    it('keeps pending workouts on their scheduled day', () => {
        expect(effectiveCalendarDate({
            scheduled_date: '2026-07-24',
            completed_date: null,
            is_completed: false,
        })).toBe('2026-07-24')
    })

    it('falls back to scheduled_date for completed workouts missing completed_date (legacy rows)', () => {
        expect(effectiveCalendarDate({
            scheduled_date: '2026-07-24',
            completed_date: null,
            is_completed: true,
        })).toBe('2026-07-24')
    })
})
