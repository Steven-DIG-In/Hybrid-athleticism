-- =============================================================================
-- HYBRID ATHLETICISM — Multi-Agent Coaching Architecture Migration
--
-- This migration:
-- 1. Adds coaching_team JSONB column to profiles
-- 2. Adds mesocycle_strategy JSONB column to mesocycles (stores Head Coach output)
-- 3. Adds strength_program JSONB column to mesocycles (stores Strength Coach output)
-- 4. Adds recovery_status column to microcycles (GREEN/YELLOW/RED from Pipeline B)
--
-- coaching_team example:
-- [{"coach": "strength", "priority": 1}, {"coach": "endurance", "priority": 2}]
--
-- Mobility + Recovery are always active and NOT stored in this column.
-- =============================================================================

-- ── Profile: coaching team selection ────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coaching_team jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN profiles.coaching_team IS
  'Athlete-selected coaching team with priority ranking. E.g. [{"coach":"strength","priority":1}]. Mobility + Recovery are implicit.';

-- ── Mesocycle: store Head Coach strategy + domain programs ──────────────────

ALTER TABLE mesocycles
  ADD COLUMN IF NOT EXISTS mesocycle_strategy jsonb,
  ADD COLUMN IF NOT EXISTS strength_program jsonb,
  ADD COLUMN IF NOT EXISTS endurance_program jsonb,
  ADD COLUMN IF NOT EXISTS hypertrophy_program jsonb,
  ADD COLUMN IF NOT EXISTS conditioning_program jsonb,
  ADD COLUMN IF NOT EXISTS mobility_program jsonb;

COMMENT ON COLUMN mesocycles.mesocycle_strategy IS
  'Head Coach MesocycleStrategy output from Pipeline A Step 1';
COMMENT ON COLUMN mesocycles.strength_program IS
  'Strength Coach multi-week program output from Pipeline A Step 2';
COMMENT ON COLUMN mesocycles.endurance_program IS
  'Endurance Coach multi-week program output from Pipeline A Step 2';
COMMENT ON COLUMN mesocycles.hypertrophy_program IS
  'Hypertrophy Coach multi-week program output from Pipeline A Step 2';
COMMENT ON COLUMN mesocycles.conditioning_program IS
  'Conditioning Coach multi-week program output from Pipeline A Step 2';
COMMENT ON COLUMN mesocycles.mobility_program IS
  'Mobility Coach multi-week program output from Pipeline A Step 2';

-- ── Microcycle: recovery status per week ────────────────────────────────────

ALTER TABLE microcycles
  ADD COLUMN IF NOT EXISTS recovery_status text DEFAULT NULL;

COMMENT ON COLUMN microcycles.recovery_status IS
  'Recovery Coach assessment: GREEN, YELLOW, or RED. NULL if not yet assessed.';

ALTER TABLE microcycles
  ADD COLUMN IF NOT EXISTS recovery_assessment jsonb DEFAULT NULL;

COMMENT ON COLUMN microcycles.recovery_assessment IS
  'Full Recovery Coach assessment JSON from Pipeline B Step 1';

ALTER TABLE microcycles
  ADD COLUMN IF NOT EXISTS adjustment_directive jsonb DEFAULT NULL;

COMMENT ON COLUMN microcycles.adjustment_directive IS
  'Head Coach adjustment directive JSON from Pipeline B Step 3 (only for YELLOW/RED weeks)';
