-- supabase/migrations/023_workouts_endurance_prescription.sql
-- Freeze the immutable EndurancePrescription (VDOT target, zone, distance,
-- duration, pace, ruck weight, etc.) on CARDIO workouts. Written at generation,
-- read by the logger and the /data/endurance delta series; never mutated.
-- Nullable: non-cardio workouts and pre-migration cardio rows stay null.
-- Applied to prod 2026-07-13 via MCP (remote migration 20260713202203);
-- checked in here to keep local migration history reproducible.

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS endurance_prescription jsonb;

COMMENT ON COLUMN public.workouts.endurance_prescription IS
  'Frozen immutable EndurancePrescription for CARDIO workouts (VDOT target etc). Null for non-cardio.';
