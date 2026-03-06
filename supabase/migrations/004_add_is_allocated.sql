-- Add is_allocated flag to workouts table
-- DEFAULT TRUE ensures existing workouts are treated as allocated (already placed on calendar)
-- New sessions will be inserted with is_allocated = FALSE (unassigned to pool)

ALTER TABLE public.workouts
  ADD COLUMN is_allocated BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.workouts.is_allocated IS
  'False when session is in the pool but not yet placed on a calendar day. scheduled_date uses microcycle start_date as placeholder when unallocated.';
