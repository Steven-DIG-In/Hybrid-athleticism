-- =============================================================================
-- Training Day Model Cleanup
-- Migration 014: Phase 2 training-loop data model
--
-- Establishes the data shape the daily training loop needs:
--   1. session_inventory.status enum (pending/active/completed/missed/off_plan)
--   2. workouts.completed_date (calendar day work actually happened)
--   3. block_pointer (per-(user, mesocycle, week) next-training-day cursor)
--   4. agent_activity (coach decisions: recalibrations, interventions)
--   5. off_plan_sessions (ad-hoc sessions outside the plan; Task 15)
--
-- All creates/alters are idempotent so re-running is a no-op.
-- =============================================================================

-- =============================================================================
-- STEP 1: session_inventory.status enum
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_inventory_status') THEN
        CREATE TYPE public.session_inventory_status AS ENUM (
            'pending',
            'active',
            'completed',
            'missed',
            'off_plan'
        );
    END IF;
END$$;

ALTER TABLE public.session_inventory
    ADD COLUMN IF NOT EXISTS status public.session_inventory_status NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.session_inventory.status IS
    'Lifecycle state: pending (not started), active (in progress), completed, missed (skipped past its day), off_plan (replaced by an off-plan session).';

CREATE INDEX IF NOT EXISTS idx_session_inventory_status
    ON public.session_inventory(user_id, mesocycle_id, status);

-- =============================================================================
-- STEP 2: workouts.completed_date
-- =============================================================================

ALTER TABLE public.workouts
    ADD COLUMN IF NOT EXISTS completed_date DATE;

COMMENT ON COLUMN public.workouts.completed_date IS
    'Calendar day the athlete actually performed the work. Distinct from completed_at (timestamp) and scheduled_date (plan). Used by load-scoring and metrics.';

CREATE INDEX IF NOT EXISTS idx_workouts_completed_date
    ON public.workouts(user_id, completed_date)
    WHERE completed_date IS NOT NULL;

-- =============================================================================
-- STEP 3: block_pointer
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.block_pointer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mesocycle_id UUID NOT NULL REFERENCES public.mesocycles(id) ON DELETE CASCADE,
    week_number SMALLINT NOT NULL,
    next_training_day SMALLINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, mesocycle_id, week_number)
);

COMMENT ON TABLE public.block_pointer IS
    'Per-(user, mesocycle, week) cursor tracking the next training_day to bind. Drives the "start next session" flow.';

COMMENT ON COLUMN public.block_pointer.next_training_day IS
    'Next training_day (1, 2, 3...) to bind for this week. Advances when the athlete starts/completes sessions.';

CREATE INDEX IF NOT EXISTS idx_block_pointer_user_meso
    ON public.block_pointer(user_id, mesocycle_id);

ALTER TABLE public.block_pointer ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own block pointer" ON public.block_pointer;
CREATE POLICY "Users can view their own block pointer"
    ON public.block_pointer FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own block pointer" ON public.block_pointer;
CREATE POLICY "Users can create their own block pointer"
    ON public.block_pointer FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own block pointer" ON public.block_pointer;
CREATE POLICY "Users can update their own block pointer"
    ON public.block_pointer FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- STEP 4: agent_activity
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    coach TEXT NOT NULL CHECK (coach IN (
        'strength',
        'hypertrophy',
        'endurance',
        'conditioning',
        'mobility',
        'recovery',
        'head'
    )),
    decision_type TEXT NOT NULL CHECK (decision_type IN (
        'recalibration',
        'intervention_fired'
    )),

    target_entity JSONB NOT NULL,
    reasoning_structured JSONB NOT NULL,
    reasoning_text TEXT NOT NULL,

    mesocycle_id UUID REFERENCES public.mesocycles(id) ON DELETE SET NULL,
    week_number SMALLINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.agent_activity IS
    'Audit trail of coach decisions (recalibrations, interventions). Phase 2 owns writes; Phase 3 will extend.';

COMMENT ON COLUMN public.agent_activity.target_entity IS
    'JSON pointer to what the decision affects: { kind: "session_inventory" | "workout" | "mesocycle" | ..., id: "..." }';

COMMENT ON COLUMN public.agent_activity.reasoning_structured IS
    'Machine-readable reasoning payload (signals, thresholds, deltas). Shape varies by decision_type.';

COMMENT ON COLUMN public.agent_activity.reasoning_text IS
    'Human-readable reasoning shown to the athlete (e.g., CoachNotesBanner).';

CREATE INDEX IF NOT EXISTS idx_agent_activity_user_time
    ON public.agent_activity(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_activity_user_coach_time
    ON public.agent_activity(user_id, coach, created_at DESC);

ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own agent activity" ON public.agent_activity;
CREATE POLICY "Users can view their own agent activity"
    ON public.agent_activity FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own agent activity" ON public.agent_activity;
CREATE POLICY "Users can create their own agent activity"
    ON public.agent_activity FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- STEP 5: off_plan_sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.off_plan_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modality TEXT NOT NULL,
    duration_minutes INT NOT NULL,
    rpe SMALLINT,
    notes TEXT,
    count_toward_load BOOLEAN NOT NULL DEFAULT TRUE,
    linked_domain TEXT
);

COMMENT ON TABLE public.off_plan_sessions IS
    'Ad-hoc training sessions outside the plan (pickup basketball, extra run, etc). count_toward_load controls whether load-scoring includes them.';

COMMENT ON COLUMN public.off_plan_sessions.linked_domain IS
    'Optional training_domain slug this off-plan session relates to (e.g., "endurance", "strength").';

CREATE INDEX IF NOT EXISTS idx_off_plan_sessions_user_time
    ON public.off_plan_sessions(user_id, logged_at DESC);

ALTER TABLE public.off_plan_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own off-plan sessions" ON public.off_plan_sessions;
CREATE POLICY "Users manage their own off-plan sessions"
    ON public.off_plan_sessions FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- STEP 6: Corrective patches (safe to re-run)
-- =============================================================================

-- Corrective: ensure week_number is NOT NULL
ALTER TABLE public.block_pointer
    ALTER COLUMN week_number SET NOT NULL;
