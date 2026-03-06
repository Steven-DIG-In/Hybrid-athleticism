-- =============================================================================
-- HYBRID ATHLETICISM — Schema Migration (Ground-Truth Version)
-- Project: hybrid-athleticism / Supabase Project: kuqgtholljrxnbxtmrnz
-- Created: 2026-02-22
--
-- PRE-FLIGHT CHECK (run scripts/introspect-db.ts to verify before running):
--   EXISTS (drop these):  mesocycles, microcycles, planned_sessions,
--                         planned_exercises, user_lift_maxes, lift_max_history,
--                         user_volume_landmarks
--   MISSING (create):     profiles, workouts, exercise_sets, cardio_logs,
--                         rucking_logs, ai_coach_interventions
--
-- Run in: Supabase Dashboard > SQL Editor
-- =============================================================================

-- =============================================================================
-- STEP 0: DROP OLD TABLES
-- All 7 old tables have 0 rows and no RLS — safe to drop.
-- CASCADE drops any indexes, triggers, and FK constraints automatically.
-- Note: We do NOT use DROP TRIGGER explicitly because PostgreSQL's IF EXISTS
--       on triggers still requires the table to exist, causing errors.
--       CASCADE from DROP TABLE handles trigger cleanup automatically.
-- =============================================================================

DROP TABLE IF EXISTS public.user_volume_landmarks   CASCADE;
DROP TABLE IF EXISTS public.lift_max_history        CASCADE;
DROP TABLE IF EXISTS public.user_lift_maxes         CASCADE;
DROP TABLE IF EXISTS public.planned_exercises       CASCADE;
DROP TABLE IF EXISTS public.planned_sessions        CASCADE;
DROP TABLE IF EXISTS public.microcycles             CASCADE;
DROP TABLE IF EXISTS public.mesocycles              CASCADE;

-- Drop any leftover functions from the old schema
DROP FUNCTION IF EXISTS public.handle_new_user()   CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Drop enum types if they somehow already exist
DROP TYPE IF EXISTS workout_modality;
DROP TYPE IF EXISTS mesocycle_goal;
DROP TYPE IF EXISTS equipment_type;

-- =============================================================================
-- STEP 1: ENUMS
-- =============================================================================

CREATE TYPE workout_modality AS ENUM ('LIFTING', 'CARDIO', 'RUCKING', 'METCON');
CREATE TYPE mesocycle_goal   AS ENUM ('HYPERTROPHY', 'STRENGTH', 'ENDURANCE', 'HYBRID_PEAKING');
CREATE TYPE equipment_type   AS ENUM (
  'FULL_GYM',
  'BARBELL_RACK',
  'DUMBBELLS_ONLY',
  'CABLES_MACHINES',
  'BODYWEIGHT_ONLY',
  'TRAVEL_MINIMAL'
);

-- =============================================================================
-- STEP 2: PROFILES
-- One row per auth.users row; auto-created on signup via trigger.
-- =============================================================================

CREATE TABLE public.profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  display_name            TEXT,
  avatar_url              TEXT,

  training_age_years      SMALLINT,
  primary_goal            mesocycle_goal DEFAULT 'HYBRID_PEAKING',
  equipment_access        equipment_type[] DEFAULT '{}',
  available_days          SMALLINT DEFAULT 4,
  bodyweight_kg           NUMERIC(5,2),
  benchmark_week_complete BOOLEAN DEFAULT FALSE,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Extended user profile. Drives program generation constraints.';

-- =============================================================================
-- STEP 3: MESOCYCLES
-- =============================================================================

CREATE TABLE public.mesocycles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  goal            mesocycle_goal NOT NULL DEFAULT 'HYBRID_PEAKING',
  week_count      SMALLINT NOT NULL DEFAULT 6,
  start_date      DATE NOT NULL,
  end_date        DATE GENERATED ALWAYS AS (start_date + (week_count * 7 - 1)) STORED,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_complete     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  ai_context_json JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.mesocycles IS 'A training block (4-8 weeks).';
CREATE INDEX idx_mesocycles_user_active ON public.mesocycles(user_id, is_active);

-- =============================================================================
-- STEP 4: MICROCYCLES
-- =============================================================================

CREATE TABLE public.microcycles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesocycle_id    UUID NOT NULL REFERENCES public.mesocycles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  week_number     SMALLINT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  target_rir      NUMERIC(3,1),
  is_deload       BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at     TIMESTAMPTZ,
  review_summary  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(mesocycle_id, week_number)
);

COMMENT ON TABLE public.microcycles IS 'A single training week within a mesocycle.';
CREATE INDEX idx_microcycles_user ON public.microcycles(user_id);

-- =============================================================================
-- STEP 5: WORKOUTS
-- =============================================================================

CREATE TABLE public.workouts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  microcycle_id           UUID NOT NULL REFERENCES public.microcycles(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  modality                workout_modality NOT NULL,
  name                    TEXT NOT NULL,
  scheduled_date          DATE NOT NULL,
  is_completed            BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at            TIMESTAMPTZ,
  actual_duration_minutes INT,
  coach_notes             TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.workouts IS 'A planned training session. Supports all modalities.';
CREATE INDEX idx_workouts_user_date    ON public.workouts(user_id, scheduled_date);
CREATE INDEX idx_workouts_microcycle   ON public.workouts(microcycle_id);

-- =============================================================================
-- STEP 6: EXERCISE_SETS
-- =============================================================================

CREATE TABLE public.exercise_sets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id        UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  exercise_name     TEXT NOT NULL,
  muscle_group      TEXT,
  set_number        SMALLINT NOT NULL,

  target_reps       SMALLINT,
  target_weight_kg  NUMERIC(6,2),
  target_rir        NUMERIC(3,1),

  actual_reps       SMALLINT,
  actual_weight_kg  NUMERIC(6,2),
  rir_actual        NUMERIC(3,1),
  rpe_actual        NUMERIC(3,1),
  notes             TEXT,
  is_pr             BOOLEAN DEFAULT FALSE,

  logged_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.exercise_sets IS 'Individual lifting sets. Core hypertrophy/strength tracking unit.';
CREATE INDEX idx_exercise_sets_workout       ON public.exercise_sets(workout_id);
CREATE INDEX idx_exercise_sets_user_exercise ON public.exercise_sets(user_id, exercise_name);

-- =============================================================================
-- STEP 7: CARDIO_LOGS
-- =============================================================================

CREATE TABLE public.cardio_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id            UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  cardio_type           TEXT NOT NULL DEFAULT 'ZONE_2',
  duration_minutes      NUMERIC(6,2) NOT NULL,
  distance_km           NUMERIC(7,3),
  avg_pace_sec_per_km   NUMERIC(7,2),
  avg_heart_rate_bpm    SMALLINT,
  max_heart_rate_bpm    SMALLINT,
  calories_burned       SMALLINT,
  perceived_effort_rpe  NUMERIC(3,1),
  device_source         TEXT,
  raw_data_json         JSONB,

  logged_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cardio_logs IS 'Cardio session logs. Covers Zone 2, VO2 Max, and tempo runs.';
CREATE INDEX idx_cardio_logs_user    ON public.cardio_logs(user_id);
CREATE INDEX idx_cardio_logs_workout ON public.cardio_logs(workout_id);

-- =============================================================================
-- STEP 8: RUCKING_LOGS
-- =============================================================================

CREATE TABLE public.rucking_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id            UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  distance_km           NUMERIC(7,3) NOT NULL,
  pack_weight_lbs       NUMERIC(5,2) NOT NULL,
  elevation_gain_m      NUMERIC(7,2),
  duration_minutes      NUMERIC(6,2) NOT NULL,
  avg_pace_sec_per_km   NUMERIC(7,2),
  total_load_index      NUMERIC(8,2) GENERATED ALWAYS AS (distance_km * pack_weight_lbs) STORED,
  terrain               TEXT,
  avg_heart_rate_bpm    SMALLINT,
  perceived_effort_rpe  NUMERIC(3,1),
  notes                 TEXT,
  fatigue_flag          BOOLEAN DEFAULT FALSE,

  logged_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.rucking_logs IS 'Rucking logs. total_load_index is the primary AI fatigue signal.';
CREATE INDEX idx_rucking_logs_user ON public.rucking_logs(user_id);

-- =============================================================================
-- STEP 9: AI_COACH_INTERVENTIONS
-- =============================================================================

CREATE TABLE public.ai_coach_interventions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  microcycle_id       UUID NOT NULL REFERENCES public.microcycles(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  trigger_type        TEXT NOT NULL,
  rationale           TEXT NOT NULL,
  volume_adjustments  JSONB,
  exercise_swaps      JSONB,
  rir_adjustment      NUMERIC(3,1),
  model_used          TEXT DEFAULT 'claude-3-5-sonnet',
  input_payload       JSONB,
  raw_response        TEXT,
  presented_to_user   BOOLEAN DEFAULT FALSE,
  user_accepted       BOOLEAN,
  user_feedback       TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ai_coach_interventions IS 'AI coaching decisions. Drives the Weekly Review UX.';
CREATE INDEX idx_ai_interventions_microcycle ON public.ai_coach_interventions(microcycle_id);
CREATE INDEX idx_ai_interventions_user       ON public.ai_coach_interventions(user_id);

-- =============================================================================
-- STEP 10: FUNCTIONS & TRIGGERS
-- =============================================================================

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_mesocycles_updated_at
  BEFORE UPDATE ON public.mesocycles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_microcycles_updated_at
  BEFORE UPDATE ON public.microcycles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_workouts_updated_at
  BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile row on Supabase signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
