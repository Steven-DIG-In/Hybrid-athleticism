// src/core/domains/endurance/prescription.types.ts
// Layer 3: the immutable endurance prescription model. One EndurancePrescription is
// one endurance session's prescribed work, produced by generation and never mutated.
// This is the *second* prescription shape — pace/zone/distance/duration, deliberately
// not unified with the resistance (sets/reps/load) shape.

export type EnduranceModality = 'running' | 'rucking' | 'rowing' | 'swimming' | 'cycling'

export type IntensityZone = 'easy' | 'zone_2' | 'tempo' | 'threshold' | 'vo2max' | 'interval'

export type EnduranceSource = 'formula' | 'ai'  // VDOT-derived pace vs AI-chosen

export interface EndurancePrescription {
  modality: EnduranceModality
  intensityZone: IntensityZone
  targetDistanceKm: number | null     // distance- or…
  targetDurationMin: number | null    // …time-based
  targetPaceSecPerKm: number | null   // precise for running; null = zone-only (other modalities)
  ruckWeightKg: number | null         // rucking only (normalized from lbs)
  intervalStructure: string | null    // opaque, e.g. "8x400m @ 5K pace, 90s rest"
  source: EnduranceSource
  paceSource?: string | null          // e.g. "VDOT 48 → threshold 4:42/km" — present when source = 'formula'
  notes?: string | null
}
