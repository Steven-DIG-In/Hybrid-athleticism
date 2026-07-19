import { describe, it, expect } from 'vitest'
import { normalizeExerciseKey } from '../exercise-key'

describe('normalizeExerciseKey', () => {
    it('maps the four main lifts from their canonical display names', () => {
        expect(normalizeExerciseKey('Back Squat')).toBe('back_squat')
        expect(normalizeExerciseKey('Bench Press')).toBe('bench_press')
        expect(normalizeExerciseKey('Deadlift')).toBe('deadlift')
        expect(normalizeExerciseKey('Overhead Press')).toBe('overhead_press')
    })

    it('maps the short forms the generation readers use', () => {
        expect(normalizeExerciseKey('Squat')).toBe('back_squat')
        expect(normalizeExerciseKey('OHP')).toBe('overhead_press')
        expect(normalizeExerciseKey('Bench')).toBe('bench_press')
    })

    it('strips parenthetical qualifiers so variants collapse to the parent lift', () => {
        expect(normalizeExerciseKey('Back Squat (Warm-up)')).toBe('back_squat')
        expect(normalizeExerciseKey('Back Squat (FSL)')).toBe('back_squat')
        expect(normalizeExerciseKey('Deadlift (Supplemental BBB)')).toBe('deadlift')
        expect(normalizeExerciseKey('Bench Press (Warm-up)')).toBe('bench_press')
        expect(normalizeExerciseKey('Overhead Press (Supplemental BBB)')).toBe('overhead_press')
    })

    it('tolerates barbell prefixes and loose whitespace/casing', () => {
        expect(normalizeExerciseKey('Barbell Back Squat')).toBe('back_squat')
        expect(normalizeExerciseKey('  BARBELL   BENCH PRESS ')).toBe('bench_press')
    })

    it('returns null for accessories so they never pollute training_maxes', () => {
        expect(normalizeExerciseKey('Romanian Deadlift')).toBeNull()
        expect(normalizeExerciseKey('Single-Leg Romanian Deadlift')).toBeNull()
        expect(normalizeExerciseKey('Bulgarian Split Squat')).toBeNull()
        expect(normalizeExerciseKey('Front Squat')).toBeNull()
        expect(normalizeExerciseKey('Kettlebell Goblet Squat')).toBeNull()
        expect(normalizeExerciseKey('Hanging Leg Raises')).toBeNull()
        expect(normalizeExerciseKey('Barbell Row')).toBeNull()
        expect(normalizeExerciseKey('Incline Dumbbell Press')).toBeNull()
    })

    it('returns null for empty or junk input', () => {
        expect(normalizeExerciseKey('')).toBeNull()
        expect(normalizeExerciseKey('   ')).toBeNull()
    })
})
