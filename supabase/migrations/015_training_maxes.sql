-- supabase/migrations/015_training_maxes.sql
-- =============================================================================
-- Training maxes persistence (Phase 2, Task 9.5 A+)
-- Adds per-user per-exercise training_max store so recalibration can
-- actually update next-session prescriptions.
-- =============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS training_maxes JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.training_maxes IS
    'Map of exercise_name → { trainingMaxKg, updatedAt, source }. Populated by recalibration and intervention responses. Read when generating next-session prescribed weights.';
