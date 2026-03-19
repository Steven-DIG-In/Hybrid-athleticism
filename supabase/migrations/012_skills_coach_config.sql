-- =============================================================================
-- Skills & Coach Config Architecture
-- Migration 012: Check-in windows, self-reports, performance deltas, skill audit
--
-- This migration introduces the weekly coaching intelligence layer:
-- - Check-in windows track allocation state per week within a mesocycle
-- - Athlete self-reports capture weekly subjective wellbeing data
-- - Performance deltas record actual vs prescribed output per exercise
-- - Skill execution log provides an append-only audit trail of all skill runs
-- =============================================================================

-- =============================================================================
-- STEP 1: CREATE check_in_windows TABLE
-- =============================================================================

CREATE TABLE public.check_in_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mesocycle_id UUID NOT NULL REFERENCES public.mesocycles(id) ON DELETE CASCADE,

    -- Logical week identification
    week_number INT NOT NULL,
    allocation_start DATE NOT NULL,

    -- Session accounting
    total_allocated INT NOT NULL DEFAULT 0,
    total_completed INT NOT NULL DEFAULT 0,
    missed_sessions INT NOT NULL DEFAULT 0,

    -- Week outcome flags
    early_completion BOOLEAN NOT NULL DEFAULT FALSE,
    incomplete_week BOOLEAN NOT NULL DEFAULT FALSE,

    -- Lifecycle state
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triggered', 'completed')),
    triggered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.check_in_windows IS
    'Tracks the allocation window and check-in state for each week within a mesocycle. Drives the weekly coaching review cycle.';

COMMENT ON COLUMN public.check_in_windows.week_number IS
    'Logical week number within mesocycle (1, 2, 3...), NOT calendar week';

COMMENT ON COLUMN public.check_in_windows.allocation_start IS
    'Calendar date on which this week''s session allocation begins';

COMMENT ON COLUMN public.check_in_windows.early_completion IS
    'TRUE when all allocated sessions completed before the week window closes';

COMMENT ON COLUMN public.check_in_windows.incomplete_week IS
    'TRUE when the week closed with one or more sessions missed';

COMMENT ON COLUMN public.check_in_windows.status IS
    'open = active window; triggered = check-in prompt sent; completed = review done';

CREATE INDEX idx_check_in_windows_user_meso_week
    ON public.check_in_windows(user_id, mesocycle_id, week_number);

-- =============================================================================
-- STEP 2: CREATE athlete_self_reports TABLE
-- =============================================================================

CREATE TABLE public.athlete_self_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mesocycle_id UUID NOT NULL REFERENCES public.mesocycles(id) ON DELETE CASCADE,

    -- Logical week identification
    week_number INT NOT NULL,

    -- Subjective wellbeing scales (1 = very poor / very low, 5 = excellent / very high)
    sleep_quality INT NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
    energy_level INT NOT NULL CHECK (energy_level BETWEEN 1 AND 5),
    stress_level INT NOT NULL CHECK (stress_level BETWEEN 1 AND 5),
    motivation INT NOT NULL CHECK (motivation BETWEEN 1 AND 5),

    -- Muscle soreness map: { "quads": 3, "lower_back": 2, ... }
    soreness JSONB NOT NULL DEFAULT '{}',

    -- Free-text athlete notes
    notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.athlete_self_reports IS
    'Weekly subjective check-in data submitted by the athlete after a weekly review is triggered.';

COMMENT ON COLUMN public.athlete_self_reports.sleep_quality IS
    '1 = very poor, 5 = excellent';

COMMENT ON COLUMN public.athlete_self_reports.energy_level IS
    '1 = very low, 5 = very high';

COMMENT ON COLUMN public.athlete_self_reports.stress_level IS
    '1 = very low, 5 = very high';

COMMENT ON COLUMN public.athlete_self_reports.motivation IS
    '1 = very low, 5 = very high';

COMMENT ON COLUMN public.athlete_self_reports.soreness IS
    'Body-part keyed soreness map, e.g. { "quads": 3, "lower_back": 2 }. Scale 1–5.';

CREATE INDEX idx_athlete_self_reports_user_meso_week
    ON public.athlete_self_reports(user_id, mesocycle_id, week_number);

-- =============================================================================
-- STEP 3: CREATE performance_deltas TABLE
-- =============================================================================

CREATE TABLE public.performance_deltas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_inventory_id UUID NOT NULL REFERENCES public.session_inventory(id) ON DELETE CASCADE,

    -- Exercise identity
    exercise_name TEXT NOT NULL,

    -- Prescribed vs actual load
    prescribed_weight NUMERIC,
    actual_weight NUMERIC,

    -- Prescribed vs actual reps
    prescribed_reps INT,
    actual_reps INT,

    -- Prescribed vs actual RPE
    prescribed_rpe NUMERIC,
    actual_rpe NUMERIC,

    -- AI-assigned classification based on deltas
    delta_classification TEXT NOT NULL CHECK (delta_classification IN (
        'over_performing',
        'on_track',
        'under_performing'
    )),

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.performance_deltas IS
    'Records the deviation between prescribed and actual output for each exercise in a completed session. Feeds the coaching adjustment engine.';

COMMENT ON COLUMN public.performance_deltas.delta_classification IS
    'over_performing = consistently exceeded targets; on_track = within tolerance; under_performing = fell short of targets';

CREATE INDEX idx_performance_deltas_session
    ON public.performance_deltas(session_inventory_id);

-- =============================================================================
-- STEP 4: CREATE skill_execution_log TABLE (append-only audit trail)
-- =============================================================================

CREATE TABLE public.skill_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Skill identity
    skill_name TEXT NOT NULL,

    -- Deduplication / replay safety
    input_hash TEXT NOT NULL,

    -- Snapshots for full auditability
    input_snapshot JSONB NOT NULL,
    output_snapshot JSONB NOT NULL,

    -- Whether the output was written to production tables
    applied BOOLEAN NOT NULL DEFAULT FALSE,

    -- Error message if the skill run failed
    error TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.skill_execution_log IS
    'Append-only audit trail of every skill execution. Records inputs, outputs, and application status. Never updated or deleted.';

COMMENT ON COLUMN public.skill_execution_log.input_hash IS
    'SHA-256 (or similar) hash of the normalised input payload. Used to detect duplicate runs.';

COMMENT ON COLUMN public.skill_execution_log.applied IS
    'TRUE when the skill output was committed to production tables; FALSE if pending or rejected.';

CREATE INDEX idx_skill_execution_log_user_skill_date
    ON public.skill_execution_log(user_id, skill_name, created_at);

-- =============================================================================
-- STEP 5: ADD COLUMNS TO EXISTING TABLES
-- =============================================================================

-- Link session_inventory rows back to their check-in window
ALTER TABLE public.session_inventory
    ADD COLUMN IF NOT EXISTS check_in_window_id UUID REFERENCES public.check_in_windows(id);

COMMENT ON COLUMN public.session_inventory.check_in_window_id IS
    'References the check-in window that governs the week this session belongs to. NULL for sessions created before migration 012.';

-- Extend coaching_adjustments with tier, application, and persona context
ALTER TABLE public.coaching_adjustments
    ADD COLUMN IF NOT EXISTS tier INT CHECK (tier IN (1, 2, 3)),
    ADD COLUMN IF NOT EXISTS auto_applied BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS athlete_confirmed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS coach_persona_note TEXT;

COMMENT ON COLUMN public.coaching_adjustments.tier IS
    '1 = minor tweak (auto-apply); 2 = moderate change (notify athlete); 3 = major intervention (require confirmation)';

COMMENT ON COLUMN public.coaching_adjustments.auto_applied IS
    'TRUE when the adjustment was applied automatically without athlete interaction (tier 1).';

COMMENT ON COLUMN public.coaching_adjustments.athlete_confirmed IS
    'TRUE when the athlete explicitly confirmed a tier 2 or tier 3 adjustment.';

COMMENT ON COLUMN public.coaching_adjustments.coach_persona_note IS
    'Optional flavour text from the AI coach persona explaining the rationale in natural language.';

-- =============================================================================
-- STEP 6: EXPAND coaching_adjustments.adjustment_type CHECK CONSTRAINT
-- =============================================================================

ALTER TABLE public.coaching_adjustments
    DROP CONSTRAINT IF EXISTS coaching_adjustments_adjustment_type_check;

ALTER TABLE public.coaching_adjustments
    ADD CONSTRAINT coaching_adjustments_adjustment_type_check
    CHECK (adjustment_type IN (
        'reduce_intensity',
        'reduce_volume',
        'increase_rest',
        'swap_exercise',
        'add_deload',
        'modify_pace',
        'skip_session',
        'add_session',
        'remove_session',
        'volume_direction_change',
        'end_block_early',
        'change_focus',
        'trigger_unscheduled_deload'
    ));

-- =============================================================================
-- STEP 7: RLS POLICIES
-- =============================================================================

-- check_in_windows
ALTER TABLE public.check_in_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own check-in windows"
    ON public.check_in_windows FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own check-in windows"
    ON public.check_in_windows FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own check-in windows"
    ON public.check_in_windows FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own check-in windows"
    ON public.check_in_windows FOR DELETE USING (auth.uid() = user_id);

-- athlete_self_reports
ALTER TABLE public.athlete_self_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own self reports"
    ON public.athlete_self_reports FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own self reports"
    ON public.athlete_self_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own self reports"
    ON public.athlete_self_reports FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own self reports"
    ON public.athlete_self_reports FOR DELETE USING (auth.uid() = user_id);

-- performance_deltas
ALTER TABLE public.performance_deltas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own performance deltas"
    ON public.performance_deltas FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own performance deltas"
    ON public.performance_deltas FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own performance deltas"
    ON public.performance_deltas FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own performance deltas"
    ON public.performance_deltas FOR DELETE USING (auth.uid() = user_id);

-- skill_execution_log (append-only: SELECT + INSERT only, no UPDATE or DELETE)
ALTER TABLE public.skill_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skill execution log"
    ON public.skill_execution_log FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can append to their own skill execution log"
    ON public.skill_execution_log FOR INSERT WITH CHECK (auth.uid() = user_id);
