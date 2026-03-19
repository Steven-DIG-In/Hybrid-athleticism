-- =============================================================================
-- Training Day Allocation
-- Migration 013: Switches from calendar-date allocation to training-day model
--
-- Sessions get assigned training_day (1, 2, 3...) instead of calendar dates.
-- "Day 1" = the athlete's first training day that week, done whenever ready.
-- Two sessions on the same training_day = two-a-day (AM/PM split).
-- =============================================================================

-- Add training_day to session_inventory (replaces calendar-based allocation)
ALTER TABLE session_inventory ADD COLUMN IF NOT EXISTS training_day SMALLINT;

-- Add session_slot for two-a-days (1 = primary/AM, 2 = secondary/PM)
ALTER TABLE session_inventory ADD COLUMN IF NOT EXISTS session_slot SMALLINT DEFAULT 1 CHECK (session_slot IN (1, 2));

COMMENT ON COLUMN public.session_inventory.training_day IS
    'Logical training day within the week (1, 2, 3...). NULL until allocated. Athlete trains on their own schedule.';

COMMENT ON COLUMN public.session_inventory.session_slot IS
    '1 = primary session (AM), 2 = secondary session (PM two-a-day)';

CREATE INDEX idx_session_inventory_training_day
    ON session_inventory(user_id, mesocycle_id, week_number, training_day);
