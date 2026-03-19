# Skills & Coach Config Architecture — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Runtime skills library, coach config system, orchestrator refactor, data model changes, check-in system, UI aesthetic direction

## Problem

The coaching agents handle all work via AI reasoning — including deterministic calculations (5/3/1 progressions, VDOT paces, volume landmarks) that have known formulas. This wastes tokens, adds latency, and introduces unpredictability where none is needed.

Coaches also lack structured governance — there's no clear separation between what should auto-adjust, what the coach should decide, and what requires athlete confirmation.

## Design Principle

**Feel the coach, not the skill.** Athletes see coaching personality, strategic decisions, and personal notes. They never see formulas, tiers, or routing logic. Skills are invisible infrastructure. The coach is the human connection; the skills run the program.

## Out of Scope

- Mobility Coach enhancements (separate brainstorm)
- Nutrition Coach (Phase 5, separate brainstorm)
- UI wireframes and component specifications (separate UI spec needed before implementing Section 5)

## Key Types

```typescript
type CoachDomain = 'strength' | 'endurance' | 'hypertrophy' | 'conditioning' | 'mobility' | 'recovery';
```

Note: `CoachDomain` maps to session modalities as follows:
- `strength` → `LIFTING` (barbell compounds)
- `hypertrophy` → `LIFTING` (hypertrophy-focused)
- `endurance` → `CARDIO`
- `conditioning` → `METCON`
- `mobility` → `MOBILITY`
- `recovery` → no sessions (assessment-only)

---

## 1. Skills Architecture

### Skill Interface

Every skill follows one contract:

```typescript
interface Skill<TInput, TOutput> {
  name: string;
  domain: CoachDomain;
  tier: 1; // skills are always Tier 1 (deterministic)
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  execute(input: TInput): TOutput; // pure calculation, no side effects
  apply?(output: TOutput, supabase: SupabaseClient): Promise<void>; // writes to DB — called by orchestrator, not skill itself
}
```

### Skill Registry

Central registry at `src/lib/skills/registry.ts`:
- Auto-discovers skills from `src/lib/skills/domains/{domain}/`
- Indexes by domain — orchestrator queries: "give me all strength skills"
- Validates input/output schemas at registration time
- Exposes `getSkill(name)`, `getSkillsForDomain(domain)`, `executeSkill(name, input)`

### Skills Inventory (11 skills)

| Skill | Domain | Calculates |
|-------|--------|------------|
| `531-progression` | strength | Wendler wave weights per week, training max updates |
| `training-max-estimation` | strength | Estimated 1RM from reps/weight/RPE |
| `progression-engine` | strength | Auto weight/rep increases from performance data |
| `deload-calculator` | shared | Volume/intensity reduction (configurable % per domain) |
| `volume-landmarks` | hypertrophy | Weekly sets per muscle group vs. MEV/MAV/MRV |
| `hypertrophy-volume-tracker` | hypertrophy | Running set count tracking, flags approaching MRV |
| `vdot-pacer` | endurance | Daniels VDOT to training paces per zone |
| `zone-distributor` | endurance | 80/20 polarized split across weekly sessions |
| `interference-checker` | shared | 48hr strength / 24hr cardio / legs-before-running rules |
| `recovery-scorer` | recovery | Formula-based readiness from RPE/RIR/completion/self-report |
| `conditioning-scaler` | conditioning | EMOM/AMRAP/interval prescriptions scaled to fitness level |

### File Structure

```
src/lib/skills/
├── registry.ts
├── types.ts
├── domains/
│   ├── strength/
│   │   ├── 531-progression.ts
│   │   ├── training-max-estimation.ts
│   │   └── progression-engine.ts
│   ├── hypertrophy/
│   │   ├── volume-landmarks.ts
│   │   └── hypertrophy-volume-tracker.ts
│   ├── endurance/
│   │   ├── vdot-pacer.ts
│   │   └── zone-distributor.ts
│   ├── conditioning/
│   │   └── conditioning-scaler.ts
│   ├── recovery/
│   │   └── recovery-scorer.ts
│   └── shared/
│       ├── deload-calculator.ts
│       └── interference-checker.ts
```

The existing `methodology-helpers.ts` is refactored — its functions move into the appropriate skill modules. The helpers file becomes a thin re-export for UI code that still imports from it.

### Skill Execution Ownership

- **`execute()`** is a pure function — no DB, no side effects. Can be unit tested trivially.
- **`apply()`** writes to DB — called **only by the orchestrator**, never by the skill itself. The orchestrator manages transaction boundaries: if multiple skills need to apply in sequence, the orchestrator wraps them in a single Supabase transaction. If any `apply()` fails, the entire batch rolls back.
- **Shared skills** (`deload-calculator`, `interference-checker`) can be assigned to multiple coaches. The orchestrator runs shared skills **once per check-in cycle**, not once per coach. Results are passed to all affected coaches.

### Error Handling

Skills validate inputs via Zod schemas. If input validation fails, the skill throws a `SkillInputError` with the Zod error details. The orchestrator catches this and falls back to AI reasoning for that specific calculation (Tier 2), logging the failure for debugging. Skills should never return fallback/default values silently — explicit failure is safer than wrong numbers in a training program.

### Conditioning Scaler Note

`conditioning-scaler` is the least deterministic of the 11 skills. It will use lookup tables mapping fitness levels to work/rest ratios, round counts, and load percentages for common conditioning formats (EMOM, AMRAP, Tabata, intervals). Where the prescription is too novel for the lookup table, the skill returns `null` and the orchestrator routes to AI reasoning.

---

## 2. Coach Config System

Each coach is a complete config unit — persona, methodology, skills, governance.

### CoachConfig Interface

```typescript
interface CoachConfig {
  id: CoachDomain;

  persona: {
    name: string;        // "Marcus Cole"
    title: string;       // "Strength Coach"
    bio: string;         // Background, philosophy, credentials
    voiceGuidelines: string; // How they talk in check-ins/notes
  };

  methodology: {
    philosophy: string;
    principles: string[];
    references: string[];
  };

  assignedSkills: string[]; // skill names from registry

  checkIn: {
    assessmentPrompt: string; // what the coach looks at during review
    signalWeights: {
      // Weights 0-1, consumed by recovery-scorer skill.
      // Recovery scorer runs ONCE per check-in using a weighted average
      // across ALL active coaches' signal weights. Each coach's weights
      // reflect what matters most to their domain (e.g., strength coach
      // weights RPE deviation high, endurance coach weights completion rate high).
      // The blended score determines the overall readiness level.
      // Individual coach signal profiles are also passed to Tier 2 AI
      // so the coach can reason about domain-specific concerns.
      rpeDeviation: number;
      rirDeviation: number;
      completionRate: number;
      earlyCompletion: number;
      missedSessions: number;
      selfReportEnergy: number;
      selfReportSoreness: number;
      selfReportSleep: number;
      selfReportStress: number;
      selfReportMotivation: number;
    };
  };

  governance: {
    tier1Auto: string[];           // e.g., ["weight_progression", "rep_adjustment_within_1"]
    tier2CoachDecides: string[];   // e.g., ["exercise_swap", "volume_direction_change"]
    tier3AthleteConfirms: string[];// e.g., ["add_remove_session", "end_block_early"]
  };

  alwaysActive: boolean;
}
```

### File Structure

```
src/lib/coaches/
├── types.ts
├── registry.ts
├── configs/
│   ├── strength.ts      // Marcus Cole
│   ├── hypertrophy.ts   // Dr. Adriana Voss
│   ├── endurance.ts     // Nadia Okafor
│   ├── conditioning.ts  // Kai Reeves
│   ├── mobility.ts      // Sofia Nguyen
│   └── recovery.ts      // James Whitfield
```

Old prompt files in `src/lib/ai/coaches/` become slimmed-down prompt templates that the orchestrator fills from config data. No more hardcoded methodology in prompts.

### Recovery Coach Role Clarification

The Recovery Coach (James Whitfield) operates in a hybrid mode:
- **Readiness scoring** is deterministic — the `recovery-scorer` skill computes a numeric score from performance deltas, completion data, and self-reports. This replaces the current AI-driven GREEN/YELLOW/RED assessment.
- **Coaching notes and recommendations** remain AI-driven — when the readiness score triggers Tier 2, the Recovery Coach persona provides human-readable context, explanations, and encouragement in James Whitfield's voice.
- The Recovery Coach config has `alwaysActive: true` and participates in every check-in cycle regardless of the athlete's coaching team selection.

---

## 3. Orchestrator Refactor

The 733-line orchestrator becomes a generic engine.

### Pipeline A: Mesocycle Generation

1. **Head Coach strategises** → `MesocycleStrategy` (AI)
2. **For each domain coach:**
   a. Load `CoachConfig`
   b. Run assigned skills to pre-compute (weights, paces, volumes, intervals)
   c. Pass pre-computed data + persona + methodology to AI
   d. AI handles ONLY: exercise selection, session structure, coaching notes
   e. `Skill.apply()` → write sessions to `session_inventory`
3. **Interference checker** validates full week (skill, no AI)

### Pipeline B: Weekly Check-in

**Trigger:** all allocated sessions completed OR 7 days from first allocation date — whichever comes first.

**Trigger logic:**
- On session log: count completed sessions for current allocation window (query: `session_inventory WHERE mesocycle_id = X AND week_number = Y AND scheduled_date IS NOT NULL`). If all have `completed_at IS NOT NULL` → trigger, flag `early_completion = true` if `NOW() - allocation_window_start < 7 days`.
- On app open / daily check: if `NOW() - allocation_window_start >= 7 days` and no `check_in_windows` record exists with `status = 'completed'` for this week → trigger, flag `missed_sessions = total_allocated - total_completed` and `incomplete_week = true` if any sessions lack `completed_at`.

**Check-in flow:**

1. **Gather signals (deterministic):**
   - Recovery scorer skill → readiness score
   - Progression engine skill → actual vs. prescribed deltas
   - Pull athlete self-report (sleep, stress, motivation, soreness)
   - Flag: early completion / missed sessions / incomplete week

2. **Tier 1 — Skills auto-adjust (no AI):**
   - Progression engine writes next week's weights based on performance
   - Volume tracker adjusts sets if within +/-1 of current prescription
   - Deload calculator applies if scheduled deload week

3. **Tier 2 — Coach reasons (AI):**
   - Receives: readiness score, performance deltas, self-report, flags
   - Does NOT recalculate numbers (skills already did)
   - Decides: exercise swaps, volume direction, session priority shifts
   - Writes coaching notes in persona voice
   - Modified decisions → skills recalculate downstream

4. **Tier 3 — Coach recommends, athlete confirms:**
   - Coach proposes: add/remove session, change focus, early deload, end block
   - Stored as pending `coaching_adjustment` with `tier: 3`
   - Athlete sees recommendation with coach's reasoning in persona voice
   - On confirm → skills recalculate affected weeks

---

## 4. Data Model Changes

### New Tables

**`check_in_windows`** — Tracks each allocation window and its check-in state

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| mesocycle_id | uuid | FK → mesocycles |
| week_number | int | Which week |
| allocation_start | date | When first session was allocated |
| total_allocated | int | How many sessions in this window |
| total_completed | int | How many finished (updated on each log) |
| early_completion | boolean | Finished before 7 days |
| missed_sessions | int | Allocated but not completed at trigger time |
| incomplete_week | boolean | Had unfinished sessions at trigger time |
| status | text | `open` / `triggered` / `completed` |
| triggered_at | timestamptz | When check-in was triggered |
| completed_at | timestamptz | When check-in cycle finished |
| created_at | timestamptz | Window creation time |

**`athlete_self_reports`**

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| mesocycle_id | uuid | FK → mesocycles |
| week_number | int | Which week |
| sleep_quality | int (1-5) | Self-rated |
| energy_level | int (1-5) | Self-rated |
| stress_level | int (1-5) | Self-rated |
| motivation | int (1-5) | Self-rated |
| soreness | jsonb | `{ "lower_back": 3, "shoulders": 1 }` by body region |
| notes | text | Free-form |
| created_at | timestamptz | When submitted |

**`performance_deltas`**

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| session_inventory_id | uuid | FK → session_inventory |
| exercise_name | text | Which movement |
| prescribed_weight | numeric | Skill-calculated target |
| actual_weight | numeric | Athlete logged |
| prescribed_reps | int | Target |
| actual_reps | int | Achieved |
| prescribed_rpe | numeric | Target effort |
| actual_rpe | numeric | Reported effort |
| delta_classification | text | `over_performing` / `on_track` / `under_performing` |
| created_at | timestamptz | Auto-generated post-session |

**`performance_deltas` generation mechanism:** Created by a server action called after workout completion (same hook point as existing `session_assessments`). The action:
1. Loads the `session_inventory` record for the completed session (contains prescribed values from skills)
2. Loads the logged `exercise_sets` for that session (contains actual values from athlete)
3. Joins prescribed vs. actual per exercise
4. Classifies each delta using thresholds: >5% above prescribed = `over_performing`, within +/-5% = `on_track`, >5% below = `under_performing`
5. Writes `performance_deltas` rows

**`skill_execution_log`** — Audit trail for skill executions

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| skill_name | text | Which skill ran |
| input_hash | text | SHA-256 of input for dedup/debugging |
| input_snapshot | jsonb | Full input (for replay) |
| output_snapshot | jsonb | Full output |
| applied | boolean | Whether `apply()` was called |
| error | text | null if success, error message if failed |
| created_at | timestamptz | When executed |

### Modified Tables

**`session_inventory`** — add column:
- `check_in_window_id`: uuid (FK → `check_in_windows`, nullable — set when allocated)

**`coaching_adjustments`** — add columns and expand CHECK constraint:
- `tier`: int (1, 2, or 3)
- `auto_applied`: boolean (Tier 1 adjustments apply without review)
- `athlete_confirmed`: boolean (Tier 3 requires this)
- `coach_persona_note`: text (coaching voice message)
- Expand `adjustment_type` CHECK to include: `reduce_intensity`, `reduce_volume`, `increase_rest`, `swap_exercise`, `add_deload`, `modify_pace`, `skip_session`, `add_session`, `remove_session`, `volume_direction_change`, `end_block_early`, `change_focus`, `trigger_unscheduled_deload`

### Unchanged

- `session_assessments` — already captures per-session feeling/energy/pain
- `profiles`, `mesocycles`, `microcycles`, `exercise_sets` — no changes

---

## 5. UI Aesthetic Direction

### Design Principle: Quiet Confidence

A small silhouette standing in the valley of a vast jungle landscape — conquering the world because they are prepared. Not aggressive, not clinical. Prepared.

### Design Language

- **Palette:** Deep earth tones — dark jungle greens, volcanic blacks, warm amber accents
- **Typography:** Bold, grounded headings. Clean body text. Carved, not floating.
- **Imagery:** Atmospheric gradients suggesting depth — valleys, mist, scale. Athlete is small relative to environment but positioned deliberately.
- **Motion:** Subtle parallax. Progress feels like terrain conquered — loading moves forward, not spinning.
- **Data viz:** Load graphs and volume charts as topographic layers, not corporate charts. Training blocks feel like expeditions.

### Key UI Moments

**Dashboard:** Atmospheric hero with block name as expedition title. "Week 3 of 6 — Strength Focus Block" as a waypoint. Upcoming sessions as path ahead, completed as conquered ground.

**Check-in:** Coach avatar/name prominent. Self-report via quick sliders/taps. Coach response as personal note in their voice. Tier 3 recommendations as a fork in the trail.

**Session view:** Minimal, dark, focused. Just the work. Coaching notes as brief persona-voiced encouragements. Sets filling in as ground covered.

**Planner:** Week as landscape with sessions as landmarks. Interference warnings as environmental signals. Allocation as route-plotting.

### What This Isn't

- Not neon/aggressive/shouty
- Not minimal/clinical/corporate
- It is **quiet confidence** — prepared for what's ahead

---

## 6. Migration Notes

- Current 3 tracked workouts can be trashed (athlete's own data, clean slate approved)
- No backward-compatibility shims needed
- `methodology-helpers.ts` becomes thin re-export for existing UI imports
- Old coach prompt files replaced by config-driven templates

### Migration file required (implementation step):
- Create `012_skills_coach_config.sql`:
  - Create `check_in_windows` table with RLS (user_id = auth.uid())
  - Create `athlete_self_reports` table with RLS
  - Create `performance_deltas` table with RLS
  - Create `skill_execution_log` table with RLS
  - Add `check_in_window_id` column to `session_inventory`
  - Add `tier`, `auto_applied`, `athlete_confirmed`, `coach_persona_note` columns to `coaching_adjustments`
  - Expand `adjustment_type` CHECK constraint on `coaching_adjustments`
  - Add indexes: `(user_id, mesocycle_id, week_number)` on `check_in_windows`, `(session_inventory_id)` on `performance_deltas`, `(skill_name, created_at)` on `skill_execution_log`

---

## 7. Technical Stack

- **Runtime:** Next.js 16 + React 19 + TypeScript
- **Database:** Supabase PostgreSQL
- **AI:** Claude Sonnet (for coach reasoning only — strategy, check-ins, persona notes)
- **Skills:** Pure TypeScript functions with Zod validation
- **Library docs:** Context7 for up-to-date Supabase/Next.js/Zod patterns during implementation
