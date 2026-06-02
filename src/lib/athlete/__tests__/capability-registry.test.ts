import { describe, it, expect } from 'vitest'
import { resolveCapabilityKey, CAPABILITY_REGISTRY } from '../capability-registry'

describe('capability registry', () => {
  it('maps known benchmark names to stable keys', () => {
    expect(resolveCapabilityKey('Back Squat')).toEqual({ key: 'back_squat', family: 'strength', unit: 'kg', label: 'Back Squat' })
    expect(resolveCapabilityKey('Run 5km')).toEqual({ key: 'run_5k', family: 'endurance', unit: 'seconds', label: 'Run 5km' })
    expect(resolveCapabilityKey('Row 2000m')).toEqual({ key: 'row_2000m', family: 'endurance', unit: 'seconds', label: 'Row 2000m' })
  })

  it('is case- and whitespace-insensitive', () => {
    expect(resolveCapabilityKey('  back squat ')?.key).toBe('back_squat')
    expect(resolveCapabilityKey('BENCH PRESS')?.key).toBe('bench_press')
  })

  it('resolves training-max aliases (Squat → back_squat, Bench → bench_press)', () => {
    expect(resolveCapabilityKey('Squat')?.key).toBe('back_squat')
    expect(resolveCapabilityKey('Bench')?.key).toBe('bench_press')
    expect(resolveCapabilityKey('OHP')?.key).toBe('overhead_press')
  })

  it('returns null for unknown names', () => {
    expect(resolveCapabilityKey('Sled Drag')).toBeNull()
  })

  it('every registry entry has a consistent family/unit', () => {
    for (const entry of Object.values(CAPABILITY_REGISTRY)) {
      expect(['strength', 'endurance']).toContain(entry.family)
      expect(entry.unit).toBe(entry.family === 'strength' ? 'kg' : 'seconds')
    }
  })
})
