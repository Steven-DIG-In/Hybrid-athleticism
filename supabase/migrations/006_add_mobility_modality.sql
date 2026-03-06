-- Add MOBILITY to workout_modality enum
-- Previously mobility sessions were stored as 'CARDIO' with name-based detection
ALTER TYPE workout_modality ADD VALUE IF NOT EXISTS 'MOBILITY';
