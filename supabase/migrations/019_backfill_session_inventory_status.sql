-- One-shot heal of session_inventory.status drift on Block 1.
-- All 14 drifted rows are completions logged before Phase 2 (cc4d80b)
-- shipped the completeWorkout → session_inventory state transition on
-- 2026-04-20. Phase 2 prevents recurrence; this migration is a no-op
-- on subsequent runs.

UPDATE public.session_inventory si
SET status = 'completed', updated_at = now()
WHERE si.status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.workouts w
    WHERE w.session_inventory_id = si.id
      AND w.completed_at IS NOT NULL
  );
