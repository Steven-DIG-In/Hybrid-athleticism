-- =============================================================================
-- Add Weight Display Preference
-- Migration 009: Adds display_weights_as_percentages setting to profiles
--
-- This allows users to toggle between:
-- - Individual weights per set (default, e.g., "65kg, 75kg, 85kg")
-- - Working max + percentages (e.g., "Working Max: 85kg → 65%, 75%, 85%")
--
-- Supports Issue #3: AI Weight Estimates (Working Max + Percentages)
-- =============================================================================

-- Add the preference column to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_weights_as_percentages BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.display_weights_as_percentages IS
  'When true, show working max with percentages. When false (default), show individual weights per set.';
