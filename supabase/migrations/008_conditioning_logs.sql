-- =============================================================================
-- HYBRID ATHLETICISM — Conditioning Logs Table
-- Captures execution data for METCON workouts (AMRAP, EMOM, For Time, etc.)
-- Follows the same pattern as cardio_logs and rucking_logs.
-- =============================================================================

CREATE TABLE public.conditioning_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id            UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  workout_format        TEXT NOT NULL DEFAULT 'metcon',
  -- 'amrap' | 'emom' | 'for_time' | 'intervals' | 'circuit' | 'chipper' | 'metcon'

  is_rx                 BOOLEAN NOT NULL DEFAULT TRUE,
  result_time_seconds   INT,            -- For Time / Chipper: completion time in seconds
  result_rounds         INT,            -- AMRAP: complete rounds achieved
  result_partial_reps   INT,            -- AMRAP: extra reps in incomplete round
  result_completed      BOOLEAN,        -- EMOM / Circuit / Intervals: finished all work?
  perceived_effort_rpe  NUMERIC(3,1),   -- 1-10 overall session RPE
  modifications         TEXT,           -- What was scaled/changed
  athlete_notes         TEXT,           -- Freeform feedback

  logged_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.conditioning_logs IS 'Conditioning/metcon session logs. Tracks Rx/Scaled, format-specific results, and RPE for AI coach review.';
CREATE INDEX idx_conditioning_logs_workout ON public.conditioning_logs(workout_id);
CREATE INDEX idx_conditioning_logs_user    ON public.conditioning_logs(user_id);

-- RLS policies (matching cardio_logs pattern)
ALTER TABLE public.conditioning_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conditioning logs"      ON public.conditioning_logs;
DROP POLICY IF EXISTS "Users can log their own conditioning sessions"   ON public.conditioning_logs;
DROP POLICY IF EXISTS "Users can update their own conditioning logs"    ON public.conditioning_logs;
DROP POLICY IF EXISTS "Users can delete their own conditioning logs"    ON public.conditioning_logs;

CREATE POLICY "Users can view their own conditioning logs"
  ON public.conditioning_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can log their own conditioning sessions"
  ON public.conditioning_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conditioning logs"
  ON public.conditioning_logs FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conditioning logs"
  ON public.conditioning_logs FOR DELETE USING (auth.uid() = user_id);
