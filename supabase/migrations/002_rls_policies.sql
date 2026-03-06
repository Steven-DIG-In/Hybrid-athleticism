-- =============================================================================
-- HYBRID ATHLETICISM — Row Level Security Policies (Idempotent)
-- Run AFTER 001_initial_schema.sql
-- Uses DROP POLICY IF EXISTS before each CREATE POLICY to be safely re-runnable.
-- =============================================================================

-- =============================================================================
-- PROFILES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =============================================================================
-- MESOCYCLES
-- =============================================================================

ALTER TABLE public.mesocycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own mesocycles"   ON public.mesocycles;
DROP POLICY IF EXISTS "Users can create their own mesocycles" ON public.mesocycles;
DROP POLICY IF EXISTS "Users can update their own mesocycles" ON public.mesocycles;
DROP POLICY IF EXISTS "Users can delete their own mesocycles" ON public.mesocycles;

CREATE POLICY "Users can view their own mesocycles"
  ON public.mesocycles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mesocycles"
  ON public.mesocycles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mesocycles"
  ON public.mesocycles FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mesocycles"
  ON public.mesocycles FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- MICROCYCLES
-- =============================================================================

ALTER TABLE public.microcycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own microcycles"   ON public.microcycles;
DROP POLICY IF EXISTS "Users can create their own microcycles" ON public.microcycles;
DROP POLICY IF EXISTS "Users can update their own microcycles" ON public.microcycles;
DROP POLICY IF EXISTS "Users can delete their own microcycles" ON public.microcycles;

CREATE POLICY "Users can view their own microcycles"
  ON public.microcycles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own microcycles"
  ON public.microcycles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own microcycles"
  ON public.microcycles FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own microcycles"
  ON public.microcycles FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- WORKOUTS
-- =============================================================================

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own workouts"   ON public.workouts;
DROP POLICY IF EXISTS "Users can create their own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can update their own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can delete their own workouts" ON public.workouts;

CREATE POLICY "Users can view their own workouts"
  ON public.workouts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workouts"
  ON public.workouts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts"
  ON public.workouts FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts"
  ON public.workouts FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- EXERCISE_SETS
-- =============================================================================

ALTER TABLE public.exercise_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own exercise sets"   ON public.exercise_sets;
DROP POLICY IF EXISTS "Users can log their own exercise sets"    ON public.exercise_sets;
DROP POLICY IF EXISTS "Users can update their own exercise sets" ON public.exercise_sets;
DROP POLICY IF EXISTS "Users can delete their own exercise sets" ON public.exercise_sets;

CREATE POLICY "Users can view their own exercise sets"
  ON public.exercise_sets FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can log their own exercise sets"
  ON public.exercise_sets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercise sets"
  ON public.exercise_sets FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercise sets"
  ON public.exercise_sets FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- CARDIO_LOGS
-- =============================================================================

ALTER TABLE public.cardio_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own cardio logs"      ON public.cardio_logs;
DROP POLICY IF EXISTS "Users can log their own cardio sessions"   ON public.cardio_logs;
DROP POLICY IF EXISTS "Users can update their own cardio logs"    ON public.cardio_logs;
DROP POLICY IF EXISTS "Users can delete their own cardio logs"    ON public.cardio_logs;

CREATE POLICY "Users can view their own cardio logs"
  ON public.cardio_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can log their own cardio sessions"
  ON public.cardio_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cardio logs"
  ON public.cardio_logs FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cardio logs"
  ON public.cardio_logs FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- RUCKING_LOGS
-- =============================================================================

ALTER TABLE public.rucking_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own rucking logs"     ON public.rucking_logs;
DROP POLICY IF EXISTS "Users can log their own rucking sessions"  ON public.rucking_logs;
DROP POLICY IF EXISTS "Users can update their own rucking logs"   ON public.rucking_logs;
DROP POLICY IF EXISTS "Users can delete their own rucking logs"   ON public.rucking_logs;

CREATE POLICY "Users can view their own rucking logs"
  ON public.rucking_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can log their own rucking sessions"
  ON public.rucking_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rucking logs"
  ON public.rucking_logs FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rucking logs"
  ON public.rucking_logs FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- AI_COACH_INTERVENTIONS
-- =============================================================================

ALTER TABLE public.ai_coach_interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own coach interventions"   ON public.ai_coach_interventions;
DROP POLICY IF EXISTS "Users can create their own coach interventions" ON public.ai_coach_interventions;
DROP POLICY IF EXISTS "Users can update their own coach interventions" ON public.ai_coach_interventions;

CREATE POLICY "Users can view their own coach interventions"
  ON public.ai_coach_interventions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own coach interventions"
  ON public.ai_coach_interventions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coach interventions"
  ON public.ai_coach_interventions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
