import { describe, it, expect } from 'vitest'
import { buildStrengthMethodologyContext } from '../context'

const profile = { strength_methodology: '531', lifting_experience: 'intermediate' }

describe('buildStrengthMethodologyContext capability sourcing', () => {
  it('uses a capability TM (recalibration) over the benchmark for the 5/3/1 protocol', async () => {
    const benchmarks: any = [{ benchmark_name: 'Back Squat', value: 120, user_id: 'u', modality: 'LIFTING', unit: 'kg', source: 'self_reported', tested_at: null, created_at: 't', id: '1' }]
    const capabilities: any = [{ key: 'back_squat', label: 'Back Squat', currentValueKg: 86.5, source: 'recalibration', updatedAt: 't', evidence: {} }]
    const ctx = await buildStrengthMethodologyContext(profile as any, benchmarks, 1, 4, false, capabilities)
    expect(ctx?.liftingProtocol).toContain('TM: 86.5kg')
    expect(ctx?.liftingProtocol).not.toContain('TM: 120')
  })

  it('falls back to benchmark-derived TM when no capability is present', async () => {
    const benchmarks: any = [{ benchmark_name: 'Back Squat', value: 100, user_id: 'u', modality: 'LIFTING', unit: 'kg', source: 'self_reported', tested_at: null, created_at: 't', id: '1' }]
    const ctx = await buildStrengthMethodologyContext(profile as any, benchmarks, 1, 4, false, [])
    expect(ctx?.liftingProtocol).toContain('Squat')
  })
})
