import { describe, it, expect } from 'vitest'
import { computeMicrocycleRebase, type MicrocycleWindow } from '../microcycle-rebase'

/** Block 4's real grid: six consecutive weeks from 2026-06-29. */
const block4 = (): MicrocycleWindow[] => [
    { weekNumber: 1, startDate: '2026-06-29', endDate: '2026-07-05' },
    { weekNumber: 2, startDate: '2026-07-06', endDate: '2026-07-12' },
    { weekNumber: 3, startDate: '2026-07-13', endDate: '2026-07-19' },
    { weekNumber: 4, startDate: '2026-07-20', endDate: '2026-07-26' },
    { weekNumber: 5, startDate: '2026-07-27', endDate: '2026-08-02' },
    { weekNumber: 6, startDate: '2026-08-03', endDate: '2026-08-09' },
]

describe('computeMicrocycleRebase', () => {
    it('anchors a stale week to today and shifts every later week by the same delta', () => {
        // The live bug: athlete is on program week 2, calendar says 20 Jul.
        const out = computeMicrocycleRebase(block4(), 2, '2026-07-20')

        expect(out).toEqual([
            { weekNumber: 2, startDate: '2026-07-20', endDate: '2026-07-26' },
            { weekNumber: 3, startDate: '2026-07-27', endDate: '2026-08-02' },
            { weekNumber: 4, startDate: '2026-08-03', endDate: '2026-08-09' },
            { weekNumber: 5, startDate: '2026-08-10', endDate: '2026-08-16' },
            { weekNumber: 6, startDate: '2026-08-17', endDate: '2026-08-23' },
        ])
    })

    it('never touches weeks before the anchor — completed history keeps its real dates', () => {
        const out = computeMicrocycleRebase(block4(), 2, '2026-07-20')
        expect(out.some(w => w.weekNumber === 1)).toBe(false)
    })

    it('preserves the 7-day window length on every shifted week', () => {
        const days = (a: string, b: string) =>
            (Date.parse(b) - Date.parse(a)) / 86_400_000
        for (const w of computeMicrocycleRebase(block4(), 2, '2026-07-20')) {
            expect(days(w.startDate, w.endDate)).toBe(6)
        }
    })

    it('is a no-op when the week already starts today', () => {
        expect(computeMicrocycleRebase(block4(), 4, '2026-07-20')).toEqual([])
    })

    it('is a no-op when the week is still in the future — never drags a week backwards', () => {
        expect(computeMicrocycleRebase(block4(), 5, '2026-07-20')).toEqual([])
    })

    it('is idempotent — rebasing an already-rebased grid changes nothing', () => {
        const once = computeMicrocycleRebase(block4(), 2, '2026-07-20')
        const applied = block4().map(w => once.find(o => o.weekNumber === w.weekNumber) ?? w)
        expect(computeMicrocycleRebase(applied, 2, '2026-07-20')).toEqual([])
    })

    it('handles a single-day slip', () => {
        const out = computeMicrocycleRebase(block4(), 4, '2026-07-21')
        expect(out[0]).toEqual({ weekNumber: 4, startDate: '2026-07-21', endDate: '2026-07-27' })
        expect(out).toHaveLength(3)
    })

    it('returns empty when the anchor week is not in the grid', () => {
        expect(computeMicrocycleRebase(block4(), 9, '2026-07-20')).toEqual([])
    })

    it('handles a month/year boundary without drift', () => {
        const grid: MicrocycleWindow[] = [
            { weekNumber: 1, startDate: '2026-12-21', endDate: '2026-12-27' },
            { weekNumber: 2, startDate: '2026-12-28', endDate: '2027-01-03' },
        ]
        expect(computeMicrocycleRebase(grid, 1, '2027-01-04')).toEqual([
            { weekNumber: 1, startDate: '2027-01-04', endDate: '2027-01-10' },
            { weekNumber: 2, startDate: '2027-01-11', endDate: '2027-01-17' },
        ])
    })
})
