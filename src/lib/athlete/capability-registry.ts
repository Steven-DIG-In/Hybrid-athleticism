// Controlled vocabulary: free-text benchmark/exercise names → stable capability keys.
// Resolves "benchmark identity is free text" so domains can deterministically
// look up state.capabilities.strength['back_squat'].

export type CapabilityFamily = 'strength' | 'endurance'

export interface CapabilityDescriptor {
  key: string
  family: CapabilityFamily
  unit: 'kg' | 'seconds'
  label: string
}

export const CAPABILITY_REGISTRY: Record<string, CapabilityDescriptor> = {
  back_squat:     { key: 'back_squat',     family: 'strength',  unit: 'kg',      label: 'Back Squat' },
  bench_press:    { key: 'bench_press',    family: 'strength',  unit: 'kg',      label: 'Bench Press' },
  deadlift:       { key: 'deadlift',       family: 'strength',  unit: 'kg',      label: 'Deadlift' },
  overhead_press: { key: 'overhead_press', family: 'strength',  unit: 'kg',      label: 'Overhead Press' },
  run_5k:         { key: 'run_5k',         family: 'endurance', unit: 'seconds', label: 'Run 5km' },
  row_2000m:      { key: 'row_2000m',      family: 'endurance', unit: 'seconds', label: 'Row 2000m' },
  swim_1k:        { key: 'swim_1k',        family: 'endurance', unit: 'seconds', label: 'Swim 1km' },
}

const ALIASES: Record<string, string> = {
  'back squat': 'back_squat',
  'squat': 'back_squat',
  'bench press': 'bench_press',
  'bench': 'bench_press',
  'deadlift': 'deadlift',
  'overhead press': 'overhead_press',
  'ohp': 'overhead_press',
  'run 5km': 'run_5k',
  'run 5k': 'run_5k',
  '5k': 'run_5k',
  'row 2000m': 'row_2000m',
  'row 2km': 'row_2000m',
  'swim 1km': 'swim_1k',
  'swim 1k': 'swim_1k',
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function resolveCapabilityKey(name: string): CapabilityDescriptor | null {
  const key = ALIASES[normalize(name)]
  return key ? CAPABILITY_REGISTRY[key] : null
}
