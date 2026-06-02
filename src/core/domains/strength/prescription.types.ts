// src/core/domains/strength/prescription.types.ts
// Layer 2: the immutable resistance prescription model. One ResistancePrescription
// is one exercise's prescribed work, produced by generation and never mutated.
// Strength and Hypertrophy share the core; they differ only in category + a few fields.

export type ResistanceSource = 'formula' | 'ai'  // 531-derived vs AI-chosen accessory

export interface ResistancePrescription {
  exerciseName: string
  muscleGroup: string
  sets: number
  targetReps: number
  targetWeightKg: number | null
  targetRir: number
  source: ResistanceSource
  methodologySource?: string   // e.g. "5/3/1 wk1: 5+ @ 85% TM" — present when source = 'formula'
  notes?: string | null
}

export interface StrengthPrescription extends ResistancePrescription {
  category: 'primary_compound' | 'secondary_compound' | 'accessory' | 'warm_up'
  isBenchmarkTest?: boolean
}

export interface HypertrophyPrescription extends ResistancePrescription {
  category: 'compound' | 'isolation' | 'machine' | 'warm_up'
  tempo?: string | null
  restSeconds?: number | null
}
