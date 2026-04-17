// src/lib/scheduling/__tests__/load-scoring.test.ts
import { describe, it, expect } from 'vitest'
import { computeDayLoad, type DayLoadInput } from '../load-scoring'

describe('computeDayLoad — aggregation by calendar date', () => {
    it('sums cns + muscular load for sessions sharing a scheduled_date', () => {
        const sessions: DayLoadInput[] = [
            { scheduled_date: '2026-04-14', training_day: 1, cns_load: 8, muscular_load: 6 },
            { scheduled_date: '2026-04-14', training_day: 2, cns_load: 4, muscular_load: 5 }
        ]
        const result = computeDayLoad(sessions)
        expect(result['2026-04-14']).toEqual({ cns: 12, muscular: 11 })
    })

    it('does not merge sessions with same training_day on different dates', () => {
        const sessions: DayLoadInput[] = [
            { scheduled_date: '2026-04-14', training_day: 1, cns_load: 8, muscular_load: 6 },
            { scheduled_date: '2026-04-15', training_day: 1, cns_load: 4, muscular_load: 5 }
        ]
        const result = computeDayLoad(sessions)
        expect(result['2026-04-14']).toEqual({ cns: 8, muscular: 6 })
        expect(result['2026-04-15']).toEqual({ cns: 4, muscular: 5 })
    })

    it('skips sessions with null scheduled_date', () => {
        const sessions: DayLoadInput[] = [
            { scheduled_date: null, training_day: 1, cns_load: 8, muscular_load: 6 },
            { scheduled_date: '2026-04-14', training_day: 2, cns_load: 4, muscular_load: 5 }
        ]
        const result = computeDayLoad(sessions)
        expect(Object.keys(result)).toEqual(['2026-04-14'])
        expect(result['2026-04-14']).toEqual({ cns: 4, muscular: 5 })
    })

    it('treats missing cns_load and muscular_load as 0', () => {
        const sessions: DayLoadInput[] = [
            { scheduled_date: '2026-04-14', training_day: 1 }
        ]
        const result = computeDayLoad(sessions)
        expect(result['2026-04-14']).toEqual({ cns: 0, muscular: 0 })
    })

    it('returns empty object for empty input', () => {
        expect(computeDayLoad([])).toEqual({})
    })
})
