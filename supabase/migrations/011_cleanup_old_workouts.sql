-- =====================================================================
-- Migration: Cleanup Old Workouts from Legacy Multi-Coach System
-- =====================================================================
-- Purpose: Remove deprecated workouts created before session inventory system.
--          These are from the old direct-to-calendar programming approach.
-- Safe: Only affects workouts table; session_inventory remains intact.
-- =====================================================================

-- Delete exercise sets first (foreign key dependency)
DELETE FROM exercise_sets
WHERE workout_id IN (
    SELECT id FROM workouts
);

-- Delete all legacy workouts
DELETE FROM workouts;

-- Optional: Verify cleanup
-- SELECT COUNT(*) as remaining_workouts FROM workouts;
-- SELECT COUNT(*) as remaining_sets FROM exercise_sets;
