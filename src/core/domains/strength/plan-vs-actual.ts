// Pure plan-vs-actual delta for one set. Derives actual - prescribed; no storage.
// Powers the "am I above/below prescription" feedback. status keys off weight.

export interface PrescribedSet { targetWeightKg: number | null; targetReps: number; targetRir: number }
export interface ActualSet { actualWeightKg: number | null; actualReps: number | null; rirActual: number | null }

export interface SetDelta {
  weightKg: number | null
  reps: number | null
  rir: number | null
  status: 'over' | 'under' | 'on_target' | 'unlogged'
}

export function computeSetDelta(prescribed: PrescribedSet, actual: ActualSet): SetDelta {
  if (actual.actualWeightKg === null || actual.actualReps === null) {
    return { weightKg: null, reps: null, rir: null, status: 'unlogged' }
  }
  const weightKg = prescribed.targetWeightKg === null
    ? null
    : Number((actual.actualWeightKg - prescribed.targetWeightKg).toFixed(2))
  const reps = actual.actualReps - prescribed.targetReps
  const rir = actual.rirActual === null ? null : actual.rirActual - prescribed.targetRir
  const status: SetDelta['status'] =
    weightKg === null || weightKg === 0 ? 'on_target' : weightKg > 0 ? 'over' : 'under'
  return { weightKg, reps, rir, status }
}
