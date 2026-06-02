-- supabase/migrations/021_athlete_capabilities.sql
-- =============================================================================
-- Layer 1 (Athlete & State): canonical current-capability store.
-- Ends the three-way "current strength" split (athlete_benchmarks append-only
-- dupes + profiles.training_maxes JSON + agent_activity recalibration log).
-- One row per (user_id, capability_key) is the single source of truth for
-- "what can this athlete do right now." Benchmarks + recalibration are inputs.
-- Additive + non-destructive: source tables are untouched.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.athlete_capabilities (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    capability_key text NOT NULL,
    family        text NOT NULL CHECK (family IN ('strength', 'endurance')),
    current_value numeric NOT NULL,
    unit          text NOT NULL,
    source        text NOT NULL CHECK (source IN ('onboarding', 'recalibration', 'manual', 'test')),
    evidence      jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, capability_key)
);

COMMENT ON TABLE public.athlete_capabilities IS
    'Canonical current capability per athlete. One row per (user_id, capability_key). Written via recordCapability(); read via getCapabilities()/getAthleteState().';

ALTER TABLE public.athlete_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_capabilities_owner_all"
    ON public.athlete_capabilities
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS athlete_capabilities_user_idx
    ON public.athlete_capabilities (user_id);
