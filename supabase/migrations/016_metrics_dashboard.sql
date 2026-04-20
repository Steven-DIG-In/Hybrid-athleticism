-- ============================================================================
-- Migration 016: Metrics Dashboard — Health Extension + Adherence Columns
-- Spec:      docs/superpowers/specs/2026-04-20-metrics-dashboard-health-extension-design.md
-- Audit:     docs/superpowers/specs/2026-04-20-metrics-schema-audit.md
--
-- Corrected against live schema:
--   - Adds columns to `ai_coach_interventions` (do NOT create a parallel table)
--   - Does NOT add `delta_magnitude_pct` to `performance_deltas` (source column
--     `delta_pct` does not exist; analytics computes this in-memory)
--   - Keeps a no-op `CREATE TABLE IF NOT EXISTS off_plan_sessions` guard
--     (existing table matches desired shape)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Training adherence: additive columns on existing `ai_coach_interventions`
-- ----------------------------------------------------------------------------
ALTER TABLE ai_coach_interventions
  ADD COLUMN IF NOT EXISTS coach_domain text,
  ADD COLUMN IF NOT EXISTS pattern_signal jsonb,
  ADD COLUMN IF NOT EXISTS user_response text,
  ADD COLUMN IF NOT EXISTS needs_retry boolean DEFAULT false;

-- Add check for user_response but allow null + pre-existing rows to be valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'ai_coach_interventions_user_response_check'
  ) THEN
    ALTER TABLE ai_coach_interventions
      ADD CONSTRAINT ai_coach_interventions_user_response_check
      CHECK (user_response IS NULL OR user_response IN ('keep','harder','recalibrate'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Off-plan sessions: already exists in live DB; no-op guard for portability
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS off_plan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  modality text NOT NULL,
  duration_minutes int NOT NULL,
  rpe int,
  notes text,
  count_toward_load boolean NOT NULL DEFAULT true,
  linked_domain text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- Health: bloodwork
-- ============================================================================
CREATE TABLE lab_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  panel_date date NOT NULL,
  lab_name text,
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('pending_extraction','needs_review','ready','failed')),
  original_file_path text,
  extraction_json jsonb,
  out_of_range_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_lab_panels_user_date ON lab_panels(user_id, panel_date DESC);

CREATE TABLE lab_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name_en text NOT NULL,
  name_original text,
  value numeric,
  unit text,
  reference_range_low numeric,
  reference_range_high numeric,
  is_out_of_range boolean,
  confidence text CHECK (confidence IN ('high','medium','low')),
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('needs_review','confirmed')),
  notes text
);
CREATE INDEX idx_lab_markers_user_name_panel ON lab_markers(user_id, name_en, panel_id);

-- ============================================================================
-- Health: supplements
-- ============================================================================
CREATE TABLE supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose numeric,
  dose_unit text,
  timing text[] DEFAULT '{}',
  start_date date NOT NULL,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_supplements_user_active ON supplements(user_id) WHERE end_date IS NULL;

-- ============================================================================
-- Health: medical_events (unified: injury / diagnosis / surgery / med / lab_test)
-- ============================================================================
CREATE TABLE medical_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'injury','diagnosis','surgery','medication_change','lab_test','other'
  )),
  event_date date NOT NULL,
  title text NOT NULL,
  details text,
  attachment_path text,
  structured_data jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_medical_events_user_date ON medical_events(user_id, event_date DESC);

-- ============================================================================
-- Health: Garmin
-- ============================================================================
CREATE TABLE garmin_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_secret_id_email uuid,
  vault_secret_id_password uuid,
  session_token_encrypted text,
  session_expires_at timestamptz,
  last_sync_at timestamptz,
  last_sync_status text,
  connected_at timestamptz DEFAULT now()
);

CREATE TABLE garmin_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  sleep_total_min int,
  sleep_deep_min int,
  sleep_rem_min int,
  sleep_light_min int,
  sleep_awake_min int,
  sleep_score int,
  hrv_overnight_avg numeric,
  hrv_morning_status text,
  resting_hr int,
  body_battery_start int,
  body_battery_end int,
  body_battery_min int,
  body_battery_max int,
  stress_avg int,
  steps int,
  active_kcal int,
  PRIMARY KEY (user_id, date)
);
CREATE INDEX idx_garmin_daily_user_date ON garmin_daily(user_id, date DESC);

CREATE TABLE garmin_vo2_trend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_on date NOT NULL,
  modality text NOT NULL CHECK (modality IN ('run','ride')),
  vo2_max numeric NOT NULL,
  fitness_age int,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_garmin_vo2_trend_user ON garmin_vo2_trend(user_id, measured_on DESC);

-- ============================================================================
-- Health: body composition
-- ============================================================================
CREATE TABLE body_composition_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_on date NOT NULL,
  method text NOT NULL CHECK (method IN ('scale','dexa','caliper','tape')),
  weight_kg numeric,
  body_fat_pct numeric,
  lean_mass_kg numeric,
  measurements jsonb,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_body_comp_user_date ON body_composition_measurements(user_id, measured_on DESC);

-- ============================================================================
-- Reports: doctor_reports
-- ============================================================================
CREATE TABLE doctor_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  window_start date NOT NULL,
  window_end date NOT NULL,
  window_preset text NOT NULL CHECK (window_preset IN ('3mo','6mo','12mo','custom')),
  pdf_file_path text,
  snapshot_json jsonb NOT NULL
);
CREATE INDEX idx_doctor_reports_user ON doctor_reports(user_id, generated_at DESC);

-- ============================================================================
-- RLS (only for tables created in this migration)
-- ============================================================================
ALTER TABLE lab_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_vo2_trend ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_composition_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_panels_owner ON lab_panels FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY lab_markers_owner ON lab_markers FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY supplements_owner ON supplements FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY medical_events_owner ON medical_events FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY garmin_credentials_owner ON garmin_credentials FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY garmin_daily_owner ON garmin_daily FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY garmin_vo2_trend_owner ON garmin_vo2_trend FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY body_comp_owner ON body_composition_measurements FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY doctor_reports_owner ON doctor_reports FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Storage buckets + RLS (files live under {user_id}/...)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('lab-reports', 'lab-reports', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('doctor-reports', 'doctor-reports', false)
  ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'lab_reports_owner'
  ) THEN
    CREATE POLICY lab_reports_owner ON storage.objects FOR ALL
      USING (bucket_id = 'lab-reports' AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK (bucket_id = 'lab-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'doctor_reports_owner'
  ) THEN
    CREATE POLICY doctor_reports_owner ON storage.objects FOR ALL
      USING (bucket_id = 'doctor-reports' AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK (bucket_id = 'doctor-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

-- ============================================================================
COMMENT ON TABLE lab_panels IS 'Uploaded or manually-entered blood panels';
COMMENT ON TABLE lab_markers IS 'Individual markers for a panel; status needs_review|confirmed';
COMMENT ON TABLE doctor_reports IS 'Generated report metadata; snapshot_json frozen for determinism';
COMMENT ON COLUMN ai_coach_interventions.coach_domain IS 'Added 2026-04-20 for block-end/rolling-pattern interventions. Nullable; pre-existing LLM-authored rows are null.';
COMMENT ON COLUMN ai_coach_interventions.pattern_signal IS 'Added 2026-04-20. Evidence payload for pattern-based interventions.';
COMMENT ON COLUMN ai_coach_interventions.user_response IS 'Added 2026-04-20. keep|harder|recalibrate. Coexists with legacy user_accepted boolean.';
COMMENT ON COLUMN ai_coach_interventions.needs_retry IS 'Added 2026-04-20. Marks stub interventions awaiting retry after LLM failure.';
