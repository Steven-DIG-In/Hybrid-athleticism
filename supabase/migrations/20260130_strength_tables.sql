-- Strength Training Tables Migration
-- Adds tables for: mesocycles, planned sessions, planned exercises, and lift maxes

-- CLEAN SLATE: Drop existing tables if they exist (in reverse dependency order)
-- CASCADE automatically drops associated policies, triggers, and indexes
DROP TABLE IF EXISTS user_volume_landmarks CASCADE;
DROP TABLE IF EXISTS lift_max_history CASCADE;
DROP TABLE IF EXISTS user_lift_maxes CASCADE;
DROP TABLE IF EXISTS planned_exercises CASCADE;
DROP TABLE IF EXISTS planned_sessions CASCADE;
DROP TABLE IF EXISTS mesocycles CASCADE;

-- 1. Mesocycles table - training blocks (4-6 weeks)
CREATE TABLE mesocycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  name VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  total_weeks INT NOT NULL DEFAULT 5,
  deload_week INT DEFAULT 5,  -- Which week is the deload

  -- Store generation config as JSON snapshot
  config JSONB NOT NULL DEFAULT '{}',

  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed', 'archived')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Planned Sessions - generated workout plans
CREATE TABLE planned_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  mesocycle_id UUID REFERENCES mesocycles(id) ON DELETE CASCADE,

  -- Scheduling
  week_number INT NOT NULL,
  day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  scheduled_date DATE NOT NULL,

  -- Session info
  session_type VARCHAR(50) NOT NULL,  -- 'Upper Push', 'Lower', etc.
  domain VARCHAR(20) DEFAULT 'strength' CHECK (domain IN ('strength', 'rucking', 'cardio')),

  -- Targets
  target_rpe DECIMAL(3,1),
  target_rir INT,
  estimated_duration_mins INT,
  estimated_total_sets INT,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'skipped', 'in_progress')),
  actual_session_id UUID REFERENCES actual_sessions(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Planned Exercises - exercises within planned sessions
-- Note: exercise_id stores the string ID from EXERCISE_LIBRARY (e.g., 'bench_press')
-- rather than a UUID FK, as the library is the source of truth for exercise definitions
CREATE TABLE planned_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planned_session_id UUID REFERENCES planned_sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_id TEXT NOT NULL,

  -- Order & targeting
  exercise_order INT NOT NULL,
  target_muscle VARCHAR(30) NOT NULL,
  is_primary BOOLEAN DEFAULT true,

  -- Prescription
  sets INT NOT NULL,
  rep_range_min INT NOT NULL,
  rep_range_max INT NOT NULL,
  target_rpe DECIMAL(3,1),
  target_rir INT,
  rest_seconds INT DEFAULT 120,

  -- Weight guidance (from Training Max)
  suggested_weight_kg DECIMAL(6,2),
  percentage_of_tm DECIMAL(4,2),  -- e.g., 0.75 for 75%

  -- Notes/cues
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Lift Maxes - track 1RM and Training Max per lift
-- Note: exercise_id stores the string ID from EXERCISE_LIBRARY (e.g., 'bench_press')
CREATE TABLE user_lift_maxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  exercise_id TEXT NOT NULL,

  -- Maxes
  tested_1rm_kg DECIMAL(6,2),           -- Actually tested max
  estimated_1rm_kg DECIMAL(6,2),         -- Calculated from performance
  training_max_kg DECIMAL(6,2),          -- TM = typically 85-90% of E1RM
  training_max_percentage DECIMAL(4,2) DEFAULT 0.90,  -- User preference for TM calc

  -- Tracking
  last_tested_date DATE,
  last_pr_date DATE,
  pr_weight_kg DECIMAL(6,2),
  source VARCHAR(20) DEFAULT 'estimated' CHECK (source IN ('tested', 'estimated', 'manual')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per user per exercise
  UNIQUE(user_id, exercise_id)
);

-- 5. Lift Max History - track progression over time
-- Note: exercise_id stores the string ID from EXERCISE_LIBRARY (e.g., 'bench_press')
CREATE TABLE lift_max_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  exercise_id TEXT NOT NULL,

  recorded_date DATE NOT NULL,
  e1rm_kg DECIMAL(6,2) NOT NULL,
  source VARCHAR(20) DEFAULT 'session' CHECK (source IN ('session', 'test', 'manual')),

  -- Context for the estimate
  weight_kg DECIMAL(6,2),
  reps INT,
  rir INT,
  actual_session_id UUID REFERENCES actual_sessions(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. User Volume Landmarks - custom volume settings per muscle
CREATE TABLE user_volume_landmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  muscle_group VARCHAR(30) NOT NULL,

  -- RP Volume Landmarks (sets per week)
  mv INT NOT NULL,   -- Maintenance Volume
  mev INT NOT NULL,  -- Minimum Effective Volume
  mav INT NOT NULL,  -- Maximum Adaptive Volume
  mrv INT NOT NULL,  -- Maximum Recoverable Volume

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, muscle_group)
);

-- Indexes for performance
CREATE INDEX idx_mesocycles_user_status ON mesocycles(user_id, status);
CREATE INDEX idx_planned_sessions_user_date ON planned_sessions(user_id, scheduled_date);
CREATE INDEX idx_planned_sessions_mesocycle ON planned_sessions(mesocycle_id);
CREATE INDEX idx_planned_exercises_session ON planned_exercises(planned_session_id);
CREATE INDEX idx_user_lift_maxes_user ON user_lift_maxes(user_id);
CREATE INDEX idx_lift_max_history_user_exercise ON lift_max_history(user_id, exercise_id, recorded_date);
CREATE INDEX idx_user_volume_landmarks_user ON user_volume_landmarks(user_id);

-- Update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_mesocycles_updated_at
    BEFORE UPDATE ON mesocycles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planned_sessions_updated_at
    BEFORE UPDATE ON planned_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_lift_maxes_updated_at
    BEFORE UPDATE ON user_lift_maxes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_volume_landmarks_updated_at
    BEFORE UPDATE ON user_volume_landmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (Row Level Security)
ALTER TABLE mesocycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lift_maxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lift_max_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_volume_landmarks ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own data
-- Note: user_id references users.id, not auth.uid() directly
CREATE POLICY mesocycles_user_policy ON mesocycles
  FOR ALL USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY planned_sessions_user_policy ON planned_sessions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY planned_exercises_user_policy ON planned_exercises
  FOR ALL USING (
    planned_session_id IN (
      SELECT id FROM planned_sessions WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY user_lift_maxes_user_policy ON user_lift_maxes
  FOR ALL USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY lift_max_history_user_policy ON lift_max_history
  FOR ALL USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY user_volume_landmarks_user_policy ON user_volume_landmarks
  FOR ALL USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
