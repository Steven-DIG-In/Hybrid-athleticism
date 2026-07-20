import { describe, it, expect } from 'vitest'
import { selectStaleSessions, type StaleCandidate } from '../stale-sessions'

const s = (
    id: string,
    weekNumber: number,
    status: string,
    trainingDay: number | null = 1,
): StaleCandidate => ({
    id,
    name: `Session ${id}`,
    modality: 'LIFTING',
    weekNumber,
    trainingDay,
    status,
})

describe('selectStaleSessions', () => {
    it('surfaces pending sessions from earlier program weeks', () => {
        const out = selectStaleSessions(
            [s('a', 1, 'pending'), s('b', 2, 'pending')],
            2,
        )
        expect(out.map(x => x.id)).toEqual(['a'])
    })

    it('never surfaces the current week — a week is the athlete\'s unit of work', () => {
        const out = selectStaleSessions([s('a', 2, 'pending'), s('b', 2, 'pending')], 2)
        expect(out).toEqual([])
    })

    it('never surfaces future weeks', () => {
        expect(selectStaleSessions([s('a', 4, 'pending')], 2)).toEqual([])
    })

    it('only surfaces pending — completed, missed and off_plan are already resolved', () => {
        const out = selectStaleSessions(
            [
                s('done', 1, 'completed'),
                s('gone', 1, 'missed'),
                s('off', 1, 'off_plan'),
                s('live', 1, 'active'),
                s('open', 1, 'pending'),
            ],
            3,
        )
        expect(out.map(x => x.id)).toEqual(['open'])
    })

    it('orders by week then training day so the modal reads chronologically', () => {
        const out = selectStaleSessions(
            [
                s('w2d2', 2, 'pending', 2),
                s('w1d3', 1, 'pending', 3),
                s('w2d1', 2, 'pending', 1),
                s('w1d1', 1, 'pending', 1),
            ],
            3,
        )
        expect(out.map(x => x.id)).toEqual(['w1d1', 'w1d3', 'w2d1', 'w2d2'])
    })

    it('sorts unallocated sessions (null training day) last within their week', () => {
        const out = selectStaleSessions(
            [s('none', 1, 'pending', null), s('day1', 1, 'pending', 1)],
            2,
        )
        expect(out.map(x => x.id)).toEqual(['day1', 'none'])
    })

    it('returns empty on week 1 — there is no earlier week to be behind on', () => {
        expect(selectStaleSessions([s('a', 1, 'pending')], 1)).toEqual([])
    })

    it('returns empty for empty input', () => {
        expect(selectStaleSessions([], 5)).toEqual([])
    })

    it('does not mutate its input', () => {
        const input = [s('b', 2, 'pending', 2), s('a', 1, 'pending', 1)]
        const snapshot = input.map(x => x.id)
        selectStaleSessions(input, 3)
        expect(input.map(x => x.id)).toEqual(snapshot)
    })
})
