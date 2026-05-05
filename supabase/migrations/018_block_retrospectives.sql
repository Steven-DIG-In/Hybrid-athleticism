-- Block Retrospective table + atomic close RPC.
-- See docs/superpowers/specs/2026-05-05-block-retrospective-design.md

-- Extend agent_activity.decision_type CHECK to allow 'block_close' audit rows.
-- The RPC defined below writes one of these on every block close. Without
-- this widening, the audit insert violates the CHECK and rolls back the
-- entire close transaction. The 'coach' allow-list already includes 'head'
-- which the RPC uses as the system-wide author for cross-coach actions.
ALTER TABLE public.agent_activity
  DROP CONSTRAINT IF EXISTS agent_activity_decision_type_check;
ALTER TABLE public.agent_activity
  ADD CONSTRAINT agent_activity_decision_type_check
  CHECK (decision_type IN ('recalibration', 'intervention_fired', 'block_close'));

CREATE TABLE public.block_retrospectives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mesocycle_id    uuid NOT NULL REFERENCES public.mesocycles(id) ON DELETE CASCADE,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  schema_version  smallint NOT NULL DEFAULT 1,
  snapshot        jsonb NOT NULL,
  UNIQUE (user_id, mesocycle_id)
);

CREATE INDEX block_retrospectives_user_generated_at_idx
  ON public.block_retrospectives (user_id, generated_at DESC);

ALTER TABLE public.block_retrospectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON public.block_retrospectives
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON public.block_retrospectives
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Snapshot is frozen — no UPDATE / DELETE policies.

-- Atomic close RPC.
CREATE OR REPLACE FUNCTION public.close_mesocycle(
  p_mesocycle_id uuid,
  p_snapshot jsonb
) RETURNS public.block_retrospectives
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_meso public.mesocycles%ROWTYPE;
  v_retro public.block_retrospectives%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_meso
  FROM public.mesocycles
  WHERE id = p_mesocycle_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mesocycle not found';
  END IF;

  IF v_meso.is_complete THEN
    RAISE EXCEPTION 'mesocycle already closed';
  END IF;

  -- Snapshot shape sanity-check: ensures the format() audit message below
  -- never renders NULL pct as garbage. Failing fast at the boundary beats
  -- recording a malformed audit row.
  IF NOT (p_snapshot ? 'adherence'
          AND (p_snapshot -> 'adherence') ? 'overall'
          AND (p_snapshot -> 'adherence' -> 'overall') ? 'pct') THEN
    RAISE EXCEPTION 'invalid snapshot shape: missing adherence.overall.pct';
  END IF;

  -- Defensive pending → missed: guard against the historical inventory drift
  -- by excluding rows with a matching completed workout. After migration 019
  -- runs, this NOT EXISTS clause becomes a no-op safety net.
  UPDATE public.session_inventory si
  SET status = 'missed'
  WHERE si.mesocycle_id = p_mesocycle_id
    AND si.status = 'pending'
    AND NOT EXISTS (
      SELECT 1
      FROM public.workouts w
      WHERE w.session_inventory_id = si.id
        AND w.completed_at IS NOT NULL
    );

  INSERT INTO public.block_retrospectives (user_id, mesocycle_id, snapshot)
  VALUES (v_user_id, p_mesocycle_id, p_snapshot)
  RETURNING * INTO v_retro;

  UPDATE public.mesocycles
  SET is_active = false, is_complete = true, completed_at = now()
  WHERE id = p_mesocycle_id;

  DELETE FROM public.block_pointer
  WHERE user_id = v_user_id AND mesocycle_id = p_mesocycle_id;

  -- Audit row. coach='head' = the cross-coach system author (existing
  -- convention; same value used by other block-level decisions).
  INSERT INTO public.agent_activity (
    user_id, coach, decision_type, target_entity,
    reasoning_structured, reasoning_text
  ) VALUES (
    v_user_id, 'head', 'block_close',
    jsonb_build_object('mesocycle_id', p_mesocycle_id, 'retrospective_id', v_retro.id),
    p_snapshot -> 'adherence' -> 'overall',
    format('Closed block %s — %s%% adherence',
      v_meso.name,
      (p_snapshot -> 'adherence' -> 'overall' ->> 'pct')
    )
  );

  RETURN v_retro;
END;
$$;

REVOKE ALL ON FUNCTION public.close_mesocycle(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.close_mesocycle(uuid, jsonb) TO authenticated;
