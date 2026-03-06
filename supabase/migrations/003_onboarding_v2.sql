-- =============================================================================
-- HYBRID ATHLETICISM — Onboarding V2 Migration
-- Build Section 1: Extended profiles, new tables, expanded enums
--
-- This migration:
-- 1. Creates new enum types for the expanded onboarding
-- 2. Extends the profiles table with 20+ new columns
-- 3. Creates athlete_injuries, athlete_benchmarks, recent_training_activity,
--    external_load_logs tables
-- 4. Adds RLS policies to all new tables
-- 5. Adds updated_at triggers where needed
--
-- IMPORTANT: Does NOT drop or modify existing tables (mesocycles, microcycles,
-- workouts, exercise_sets, cardio_logs, rucking_logs, ai_coach_interventions)
-- =============================================================================

-- =============================================================================
-- STEP 1: NEW ENUM TYPES
-- =============================================================================

CREATE TYPE onboarding_path AS ENUM ('quick', 'deep');

CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced');

CREATE TYPE training_environment AS ENUM (
  'commercial_gym',
  'home_gym',
  'outdoor_minimal',
  'mix'
);

CREATE TYPE goal_archetype AS ENUM (
  'hybrid_fitness',
  'strength_focus',
  'endurance_focus',
  'conditioning_focus',
  'longevity'
);

CREATE TYPE work_type AS ENUM ('desk', 'active', 'physical_labor', 'mixed');

CREATE TYPE stress_level AS ENUM ('low', 'moderate', 'high', 'variable');

CREATE TYPE travel_frequency AS ENUM ('rarely', 'monthly', 'weekly');

CREATE TYPE two_a_day_willingness AS ENUM ('yes', 'sometimes', 'no');

CREATE TYPE time_of_day_preference AS ENUM (
  'morning',
  'midday',
  'evening',
  'no_preference',
  'varies'
);

CREATE TYPE methodology_preference AS ENUM (
  'ai_decides',
  'linear_progression',
  '531',
  'percentage_based',
  'conjugate',
  'rp_volume',
  'high_frequency',
  'traditional_split',
  'polarized_80_20',
  'maf_aerobic',
  'daniels_formula',
  'hybrid_mixed',
  'other'
);

CREATE TYPE transparency_preference AS ENUM ('minimal', 'detailed');

CREATE TYPE body_comp_goal AS ENUM (
  'gain_muscle',
  'lose_fat',
  'recomp',
  'maintain',
  'no_preference'
);

CREATE TYPE benchmark_discovery_status AS ENUM ('pending', 'in_progress', 'complete');

CREATE TYPE injury_severity AS ENUM ('minor', 'moderate', 'significant');

CREATE TYPE injury_body_area AS ENUM (
  'shoulder',
  'lower_back',
  'knee',
  'hip',
  'ankle',
  'wrist',
  'elbow',
  'neck',
  'other'
);

CREATE TYPE benchmark_source AS ENUM ('self_reported', 'tested', 'estimated');

CREATE TYPE perceived_intensity AS ENUM ('low', 'moderate', 'high', 'very_high');

CREATE TYPE equipment_usage_intent AS ENUM ('endurance', 'conditioning', 'both');

-- =============================================================================
-- STEP 2: EXTEND PROFILES TABLE
-- Add all new onboarding columns. Uses ADD COLUMN IF NOT EXISTS for safety.
-- =============================================================================

-- Onboarding metadata
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_path onboarding_path;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age smallint;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm numeric(5,1);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unit_preference text DEFAULT 'metric';

-- Experience levels per modality (individual columns for query simplicity)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lifting_experience experience_level;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS running_experience experience_level;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rucking_experience experience_level;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rowing_experience experience_level;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS swimming_experience experience_level;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cycling_experience experience_level;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS conditioning_experience experience_level;

-- Training environment & equipment
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_training_environment training_environment;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipment_list text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipment_usage_intents jsonb DEFAULT '{}';

-- Modality & conditioning preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS endurance_modality_preferences text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS conditioning_style_preferences text[] DEFAULT '{}';

-- Availability
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS session_duration_minutes smallint DEFAULT 60;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_a_day two_a_day_willingness DEFAULT 'no';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS time_of_day time_of_day_preference DEFAULT 'no_preference';

-- Lifestyle factors
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_type work_type;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stress_level stress_level;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS travel_frequency travel_frequency;

-- Goals
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_archetype goal_archetype;

-- Methodology preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS strength_methodology methodology_preference DEFAULT 'ai_decides';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hypertrophy_methodology methodology_preference DEFAULT 'ai_decides';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS endurance_methodology methodology_preference DEFAULT 'ai_decides';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transparency transparency_preference DEFAULT 'minimal';

-- Body composition (optional)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS body_fat_percentage numeric(4,1);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS body_comp_goal body_comp_goal;

-- Onboarding completion (replaces benchmark_week_complete as gate)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS benchmark_discovery_status benchmark_discovery_status DEFAULT 'pending';

-- Injuries flag (for quick path — "do you have injuries?")
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_injuries boolean DEFAULT false;

-- Movements to avoid (global, beyond individual injury records)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS movements_to_avoid text[] DEFAULT '{}';


-- =============================================================================
-- STEP 3: NEW TABLE — athlete_injuries
-- =============================================================================

CREATE TABLE public.athlete_injuries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  body_area         injury_body_area NOT NULL,
  description       TEXT,
  severity          injury_severity NOT NULL DEFAULT 'minor',
  movements_to_avoid TEXT[] DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.athlete_injuries IS 'Athlete injury records. Supports multiple active injuries per user.';
CREATE INDEX idx_athlete_injuries_user ON public.athlete_injuries(user_id);
CREATE INDEX idx_athlete_injuries_active ON public.athlete_injuries(user_id, is_active);


-- =============================================================================
-- STEP 4: NEW TABLE — athlete_benchmarks
-- =============================================================================

CREATE TABLE public.athlete_benchmarks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  modality          TEXT NOT NULL,
  benchmark_name    TEXT NOT NULL,
  value             NUMERIC NOT NULL,
  unit              TEXT NOT NULL,
  source            benchmark_source NOT NULL DEFAULT 'self_reported',
  tested_at         TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.athlete_benchmarks IS 'Append-only benchmark history. AI reads latest per benchmark_name.';
CREATE INDEX idx_athlete_benchmarks_user ON public.athlete_benchmarks(user_id);
CREATE INDEX idx_athlete_benchmarks_lookup ON public.athlete_benchmarks(user_id, benchmark_name);


-- =============================================================================
-- STEP 5: NEW TABLE — recent_training_activity
-- =============================================================================

CREATE TABLE public.recent_training_activity (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  modality              TEXT NOT NULL,
  frequency_per_week    SMALLINT NOT NULL,
  approximate_volume    TEXT,
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.recent_training_activity IS 'Snapshot of pre-onboarding training activity. Used for initial calibration.';
CREATE INDEX idx_recent_training_user ON public.recent_training_activity(user_id);


-- =============================================================================
-- STEP 6: NEW TABLE — external_load_logs
-- =============================================================================

CREATE TABLE public.external_load_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  activity_type         TEXT NOT NULL,
  duration_minutes      SMALLINT,
  perceived_intensity   perceived_intensity DEFAULT 'moderate',
  notes                 TEXT,
  logged_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.external_load_logs IS 'Ad hoc external activity logs. AI adjusts remaining session pool.';
CREATE INDEX idx_external_load_user ON public.external_load_logs(user_id);


-- =============================================================================
-- STEP 7: updated_at TRIGGERS for new tables
-- =============================================================================

CREATE TRIGGER set_athlete_injuries_updated_at
  BEFORE UPDATE ON public.athlete_injuries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- STEP 8: RLS POLICIES for new tables
-- =============================================================================

-- athlete_injuries
ALTER TABLE public.athlete_injuries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own injuries"
  ON public.athlete_injuries FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own injuries"
  ON public.athlete_injuries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own injuries"
  ON public.athlete_injuries FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own injuries"
  ON public.athlete_injuries FOR DELETE USING (auth.uid() = user_id);

-- athlete_benchmarks
ALTER TABLE public.athlete_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own benchmarks"
  ON public.athlete_benchmarks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own benchmarks"
  ON public.athlete_benchmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own benchmarks"
  ON public.athlete_benchmarks FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- recent_training_activity
ALTER TABLE public.recent_training_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recent training"
  ON public.recent_training_activity FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recent training"
  ON public.recent_training_activity FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recent training"
  ON public.recent_training_activity FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recent training"
  ON public.recent_training_activity FOR DELETE USING (auth.uid() = user_id);

-- external_load_logs
ALTER TABLE public.external_load_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own external loads"
  ON public.external_load_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own external loads"
  ON public.external_load_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own external loads"
  ON public.external_load_logs FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own external loads"
  ON public.external_load_logs FOR DELETE USING (auth.uid() = user_id);
