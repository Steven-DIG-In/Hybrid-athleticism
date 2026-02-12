# Strength/Hypertrophy Implementation Plan

> **ARCHIVED:** February 5, 2026
> Most items in this plan have been implemented. See [BACKLOG.md](../../BACKLOG.md) for remaining work.

## Overview

This document outlines the implementation plan for strength/hypertrophy training in Hybrid Athleticism. We're focusing **exclusively** on strength training first, getting it working properly before adding cardio or rucking modalities.

---

## Current State vs. Required State

### ✅ What Exists

| Component | Status | Notes |
|-----------|--------|-------|
| Exercise Library | Good | 50+ exercises with SFR ratings, equipment tags |
| Session Templates | Basic | 7 templates (Upper Push/Pull, Lower, Full Body, PPL) |
| Volume Landmarks | Partial | Collected in onboarding, not enforced |
| Mesocycle Generator | Basic | Volume progression MEV→MAV, RPE periodization |
| Session Logger | Good | Sets, reps, weight, RIR tracking |
| Set Logs Table | Good | Full structure for logging performance |

### ❌ What's Missing

| Component | Priority | Impact |
|-----------|----------|--------|
| **Lift 1RM Tracking** | HIGH | No way to track maxes per lift over time |
| **Training Max (TM)** | HIGH | Wendler-style submaximal training not supported |
| **Planned Sessions Table** | HIGH | Sessions generated but not persisted |
| **Auto-Progression Logic** | HIGH | No weight suggestions based on performance |
| **Strength Assessment in Onboarding** | HIGH | No lift testing step |
| **Fatigue/Recovery Management** | MEDIUM | fatigue_cost exists but not used |
| **Personal Records Tracking** | MEDIUM | No PR tracking or display |

---

## Phase 1: Database Schema Updates

### New Tables Required

#### 1. `user_lift_maxes` - Track 1RM and TM per lift

```sql
CREATE TABLE user_lift_maxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  exercise_id UUID REFERENCES exercises(id) NOT NULL,

  -- Maxes
  tested_1rm_kg DECIMAL(6,2),           -- Actually tested max
  estimated_1rm_kg DECIMAL(6,2),         -- Calculated from performance
  training_max_kg DECIMAL(6,2),          -- TM = 85-90% of E1RM
  training_max_percentage DECIMAL(3,2) DEFAULT 0.90,  -- User preference

  -- Tracking
  last_tested_date DATE,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(20) DEFAULT 'estimated',  -- 'tested', 'estimated', 'manual'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, exercise_id)
);
```

#### 2. `planned_sessions` - Persist generated workout plans

```sql
CREATE TABLE planned_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  mesocycle_id UUID REFERENCES mesocycles(id),

  -- Scheduling
  week_number INT NOT NULL,
  day_of_week VARCHAR(10) NOT NULL,
  scheduled_date DATE NOT NULL,

  -- Session info
  session_type VARCHAR(50) NOT NULL,  -- 'Upper Push', 'Lower', etc.
  domain VARCHAR(20) DEFAULT 'strength',

  -- Targets
  target_rpe DECIMAL(3,1),
  target_rir INT,
  estimated_duration_mins INT,
  estimated_total_sets INT,

  -- Status
  status VARCHAR(20) DEFAULT 'planned',  -- 'planned', 'completed', 'skipped'
  actual_session_id UUID REFERENCES actual_sessions(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. `planned_exercises` - Exercises within planned sessions

```sql
CREATE TABLE planned_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planned_session_id UUID REFERENCES planned_sessions(id) NOT NULL,
  exercise_id UUID REFERENCES exercises(id) NOT NULL,

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

  -- Weight guidance (based on TM)
  suggested_weight_kg DECIMAL(6,2),
  percentage_of_tm DECIMAL(3,2),

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. `mesocycles` - Training blocks

```sql
CREATE TABLE mesocycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,

  name VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  total_weeks INT NOT NULL,
  deload_week INT,  -- Which week is deload (usually last)

  -- Configuration snapshot
  config JSONB NOT NULL,  -- Store the generation config

  status VARCHAR(20) DEFAULT 'active',  -- 'planned', 'active', 'completed'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 2: Onboarding Updates for Strength

### Current Flow (12 steps)
1. Welcome
2. Basic Info (name, age, weight, height)
3. Training Experience (level, training age)
4. Availability (days, duration)
5. Domain Priorities (strength/cardio/rucking)
6. Strength Goals (focus muscles, movements)
7. Cardio Goals ← **SKIP for strength-only**
8. Rucking Goals ← **SKIP for strength-only**
9. Equipment Access
10. Volume Landmarks
11. Program Preferences
12. Complete/Confirm

### New Strength-Focused Flow (8 steps)

| Step | Name | Data Collected |
|------|------|----------------|
| 1 | Welcome | -- |
| 2 | Basic Info | name, weight_kg, height_cm |
| 3 | Training Experience | training_age_years, strength_level |
| 4 | Availability | available_days, session_duration |
| 5 | Equipment Access | equipment[] |
| 6 | **Lift Assessment** | tested/estimated 1RMs for key lifts |
| 7 | Volume Landmarks | custom or defaults based on level |
| 8 | Program Preferences | mesocycle length, deload preference |

### Step 6: Lift Assessment (NEW)

**Key Lifts to Assess:**
- Bench Press (chest primary)
- Overhead Press (delts primary)
- Squat (quads primary)
- Deadlift (posterior chain)
- Barbell Row (back primary)
- Pull-up/Lat Pulldown (vertical pull)

**Assessment Options:**
1. **"I know my maxes"** → Enter tested 1RMs
2. **"I know my working weights"** → Enter weight × reps → Calculate E1RM
3. **"I'm new, estimate for me"** → Use body weight ratios by level

**E1RM Calculation (Epley):**
```
E1RM = weight × (1 + reps/30)
```

**Training Max Calculation:**
```
TM = E1RM × 0.85 (conservative) or 0.90 (standard)
```

---

## Phase 3: Program Generation Engine

### Generation Pipeline

```
User Config → Weekly Template → Mesocycle → Sessions → Exercises
```

### Stage 1: Determine Weekly Structure

Based on `available_days` and `strength_level`:

| Days Available | Split Type | Sessions |
|----------------|------------|----------|
| 2 | Full Body | 2× Full Body |
| 3 | Full Body or U/L | 3× Full Body OR 2× Upper + 1× Lower |
| 4 | Upper/Lower | 2× Upper + 2× Lower |
| 5 | Upper/Lower/PPL | Upper Push, Upper Pull, Lower, Upper, Lower |
| 6 | PPL | Push, Pull, Legs × 2 |

### Stage 2: Apply Volume Landmarks

For each muscle group:
- **Week 1**: Start at MEV (Minimum Effective Volume)
- **Week 2-4**: Progress toward MAV (Maximum Adaptive Volume)
- **Week 5**: Deload at 50% of MEV

```typescript
function getSetsForMuscle(muscle: MuscleGroup, week: number, totalWeeks: number): number {
  const landmarks = getUserVolumeLandmarks(muscle)

  if (week === totalWeeks) {
    return Math.round(landmarks.mev * 0.5)  // Deload
  }

  // Linear progression MEV → MAV
  const progress = (week - 1) / (totalWeeks - 2)
  return Math.round(landmarks.mev + (landmarks.mav - landmarks.mev) * progress)
}
```

### Stage 3: Select Exercises per Muscle

For each muscle target in session:
1. Get exercises matching user equipment
2. Sort by Stimulus-to-Fatigue Ratio (SFR)
3. Select top N exercises
4. Ensure mix of compounds (1-2) + isolations (1-2)

```typescript
function selectExercises(muscle: MuscleGroup, equipment: Equipment[], count: number): Exercise[] {
  const available = getExercisesForMuscle(muscle, equipment)

  // Prioritize high SFR
  const sorted = available.sort((a, b) => b.stimulusToFatigueRatio - a.stimulusToFatigueRatio)

  // Get 1 compound + rest isolation for balance
  const compound = sorted.find(e => e.category === 'compound')
  const isolations = sorted.filter(e => e.category !== 'compound').slice(0, count - 1)

  return [compound, ...isolations].filter(Boolean)
}
```

### Stage 4: Assign Sets/Reps/RPE

**Rep Ranges by Goal:**
- Strength: 3-5 reps
- Hypertrophy: 8-12 reps
- Endurance: 15-20 reps

**RPE/RIR by Week:**
| Week | RPE | RIR | Intensity |
|------|-----|-----|-----------|
| 1 | 7 | 3 | Light |
| 2 | 7.5 | 2-3 | Moderate |
| 3 | 8 | 2 | Moderate-Hard |
| 4 | 8.5-9 | 1-2 | Hard |
| 5 | 6 | 4+ | Deload |

### Stage 5: Calculate Suggested Weights

For exercises with a Training Max:
```typescript
function getSuggestedWeight(exercise: Exercise, targetRPE: number, trainingMax: number): number {
  // RPE-based percentage of TM
  const rpeToPercentage: Record<number, number> = {
    6: 0.65,
    7: 0.70,
    7.5: 0.75,
    8: 0.80,
    8.5: 0.85,
    9: 0.90,
  }

  return Math.round(trainingMax * rpeToPercentage[targetRPE] / 2.5) * 2.5  // Round to nearest 2.5kg
}
```

---

## Phase 4: Workout Execution & Logging

### Session Flow

1. **Load Planned Session** → Display exercises with targets
2. **For Each Exercise:**
   - Show suggested weight, sets × reps @ RPE
   - Log actual: weight, reps, RIR per set
   - Calculate E1RM from best set
3. **Session Complete:**
   - Calculate total volume
   - Update E1RMs if better
   - Mark planned_session as completed
   - Link actual_session to planned_session

### Auto-Progression Logic

**Double Progression Model:**

```typescript
function getNextSessionWeight(exercise: Exercise, lastPerformance: SetLog[]): number {
  const workingSets = lastPerformance.filter(s => s.set_type === 'working')

  // Check if all sets hit top of rep range with low RIR
  const allSetsHitTarget = workingSets.every(set =>
    set.reps >= exercise.repRangeMax && set.rir <= 1
  )

  if (allSetsHitTarget) {
    // Increase weight by smallest increment
    const increment = exercise.category === 'compound' ? 2.5 : 1.25
    return lastPerformance[0].weight_kg + increment
  }

  // Otherwise keep same weight, focus on adding reps
  return lastPerformance[0].weight_kg
}
```

**RPE-Based Adjustment:**

```typescript
function adjustWeightForRPE(suggestedWeight: number, actualRPE: number, targetRPE: number): number {
  const rpeDiff = actualRPE - targetRPE

  if (rpeDiff > 0.5) {
    // Too hard - reduce 5%
    return Math.round((suggestedWeight * 0.95) / 2.5) * 2.5
  } else if (rpeDiff < -0.5) {
    // Too easy - increase 2.5-5%
    return Math.round((suggestedWeight * 1.025) / 2.5) * 2.5
  }

  return suggestedWeight
}
```

---

## Phase 5: UI Components Required

### 1. Lift Assessment Step (Onboarding)
- List of key lifts
- Toggle: "I know my max" vs "Estimate from reps"
- Weight/reps inputs
- Calculated E1RM and TM display

### 2. Program Overview Page
- Mesocycle calendar view (weeks 1-5)
- Current week highlighted
- Click day → session detail

### 3. Session Detail Page (Pre-Workout)
- Exercise list with targets
- Suggested weights
- "Start Workout" button

### 4. Active Workout Logger
- Current exercise with timer
- Set-by-set logging (weight, reps, RIR)
- E1RM display updating live
- Rest timer
- "Complete Session" button

### 5. Progress Dashboard
- Lift-specific E1RM trends
- Weekly volume by muscle
- Recent PRs

---

## Implementation Order

### Sprint 1: Foundation (Database + Types)
- [ ] Create new database tables
- [ ] Update TypeScript types
- [ ] Create Supabase migrations

### Sprint 2: Lift Assessment
- [ ] Build lift assessment onboarding step
- [ ] E1RM calculation utility
- [ ] TM storage and retrieval

### Sprint 3: Program Generation
- [ ] Refactor mesocycle generator to use new schema
- [ ] Persist planned_sessions to database
- [ ] Calculate suggested weights from TM

### Sprint 4: Workout Execution
- [ ] Load planned session with exercises
- [ ] Enhanced logging with weight suggestions
- [ ] Update E1RM on session completion

### Sprint 5: Progression & Analytics
- [ ] Auto-progression calculation
- [ ] Progress visualization
- [ ] PR tracking

---

## File Structure Changes

```
/src/lib/
  ├── strength/
  │   ├── e1rm-calculator.ts      # E1RM formulas
  │   ├── training-max.ts         # TM calculation
  │   ├── volume-calculator.ts    # Sets per muscle from landmarks
  │   ├── weight-suggestion.ts    # Suggested weights from TM/RPE
  │   └── progression.ts          # Auto-progression logic
  ├── exercise-library.ts         # (existing, enhanced)
  ├── session-templates.ts        # (existing)
  └── mesocycle-generator.ts      # (refactored)

/src/components/onboarding/
  └── step-lift-assessment.tsx    # NEW

/src/app/(dashboard)/
  ├── program/
  │   └── [date]/page.tsx         # Session detail before workout
  └── workout/
      └── [sessionId]/page.tsx    # Active logging
```

---

## Success Criteria

1. **User can set their lift maxes** in onboarding
2. **Program generates with correct volume** based on landmarks
3. **Sessions show suggested weights** based on Training Max
4. **Logging tracks actual performance** vs planned
5. **E1RMs update automatically** after each session
6. **Next session weights adjust** based on performance

---

*Focus: Get strength working perfectly before adding cardio/rucking.*
