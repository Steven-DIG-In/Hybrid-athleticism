-- Adherence honesty carryover store. Single-entry, consumed-and-cleared by
-- generateMesocyclePlan in sub-project D. Source-tagged by where the entry
-- was captured: block close-out, Block 2 wizard, or mid-block overrun signal.

ALTER TABLE public.profiles
  ADD COLUMN pending_planner_notes jsonb;

COMMENT ON COLUMN public.profiles.pending_planner_notes IS
  'Carryover from sub-project B (Adherence Honesty). One pending entry per
   athlete, merged on subsequent writes. Read + cleared by sub-project D
   planner. Shape: PendingPlannerNotes type in
   src/lib/types/pending-planner-notes.types.ts';
