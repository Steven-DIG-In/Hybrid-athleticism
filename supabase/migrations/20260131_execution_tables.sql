-- Execution Tables
-- Stores the actual workout data (logs, sets, reps)

-- 1. Actual Sessions (High level summary)
CREATE TABLE IF NOT EXISTS actual_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Link back to plan (optional, because you might do an unplanned workout)
  planned_session_id UUID, -- No FK constraint to avoid cycles if not careful, or circular dep issues
  
  session_date DATE NOT NULL,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  
  domain VARCHAR(20) DEFAULT 'strength' CHECK (domain IN ('strength', 'rucking', 'running')),
  session_name VARCHAR(100),
  
  -- Metrics
  duration_mins INT,
  rpe DECIMAL(3,1),
  notes TEXT,
  
  -- Strength specific summary
  strength_metrics JSONB DEFAULT '{}', -- { total_sets: 15, volume_kg: 5000 }
  
  -- Cardio/Rucking specific
  distance_km DECIMAL(6,2),
  pace_min_per_km DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Actual Session Exercises (Detailed logs)
CREATE TABLE IF NOT EXISTS actual_session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actual_session_id UUID REFERENCES actual_sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_id TEXT NOT NULL, -- Link to exercise library key
  
  -- The detailed sets
  -- Structure: [{ weight_kg: 100, reps: 10, rir: 2, set_type: 'straight' }, ...]
  logs JSONB NOT NULL DEFAULT '[]',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_actual_sessions_user_date ON actual_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_actual_session_exercises_session ON actual_session_exercises(actual_session_id);

-- RLS
ALTER TABLE actual_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE actual_session_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY actual_sessions_user_policy ON actual_sessions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY actual_session_exercises_user_policy ON actual_session_exercises
  FOR ALL USING (
    actual_session_id IN (
      SELECT id FROM actual_sessions WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Triggers
CREATE TRIGGER update_actual_sessions_updated_at
    BEFORE UPDATE ON actual_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
