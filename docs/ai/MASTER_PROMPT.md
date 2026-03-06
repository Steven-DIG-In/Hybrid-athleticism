# MASTER PROMPT: Hybrid Athleticism Platform

## Context

You are building "Hybrid Athleticism" — a premium, AI-powered training platform for hybrid athletes. These are people who train across multiple domains simultaneously: strength/hypertrophy, endurance (running, rucking, rowing, swimming, cycling), conditioning (metcons, HIIT, circuits), and mobility. The platform generates intelligent, adaptive programming using AI — not templates, not coach-prescribed — fully algorithmic with athlete agency.

The target audience spans beginner to advanced, with the sweet spot being intermediate-to-advanced data-hungry athletes who want their programming to be as smart as they are about training.

This prompt is the single source of truth for the project. It replaces all prior prompt files. Build sections are modular — each section is an actionable unit of work. Architectural context sections provide the governing logic that all build sections must respect.

---

## Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Next.js Server Actions, Supabase (PostgreSQL + Auth + RLS)
- **AI:** Anthropic Claude API (claude-sonnet-4-5-20250929)
- **Styling:** Dark-first premium aesthetic. Deep blacks (#050505), cyan/blue accents, Space Grotesk for editorial headers, Inter for body text. Every component must feel premium — not generic SaaS.
- **Patterns:** All server actions return `ActionResult<T>` (`{ success: true, data: T } | { success: false, error: string }`). Supabase SSR client with cookie-based session management. RLS on all tables scoped to `auth.uid()`.

---

## Design Philosophy

The app embodies "atmospheric obsidian & chrome" — luxury precision fused with the raw awe of extreme nature. When users stare into a bottomless pit, they don't retreat; they ask for their rope. Every UI surface must feel like a high-end instrument: Audemars Piguet precision, Spotify-level micro-interactions, editorial typography. If a component doesn't command attention, it's a failed component.

Key principles:
- Vast negative space. Deep atmospheric backgrounds (not flat color).
- Ultra-clean data presentation. These users are obsessed with their training data — present it beautifully.
- Large, legible inputs. The workout logger must work with sweating hands and shaking arms.
- Subtle micro-animations via Framer Motion. The app feels alive.
- Dark mode is the only mode.

---

## Training Domain Taxonomy

The platform tracks four distinct training domains. Every feature, database table, and AI decision must respect these boundaries.

### 1. Strength / Lifting
Compound and accessory movements. Barbell, dumbbell, machine, bodyweight. The AI prescribes the split based on goals, available days, and equipment — but offers "buckets" the athlete can swap to based on preference. Progressive overload is tracked and managed by the AI.

### 2. Endurance (Structured Distance/Duration)
Running, Rucking, Rowing, Swimming, Cycling. Athletes select which modalities they train based on equipment access and preference. The AI programs only within selected modalities. Covers tempo work, long slow distance, interval sessions, progressive distance builds.

### 3. Cardio / Conditioning
Metcons, CrossFit-style WODs, Hyrox prep, Assault Bike intervals, Ski Erg, Battle Ropes, Circuit Training, HIIT. This is the "everything that isn't structured endurance or lifting" bucket. High-intensity conditioning, work capacity, anaerobic threshold work.

**Critical distinction:** Some equipment serves both Endurance and Conditioning (rower, assault bike). The system must understand the athlete's INTENT — steady-state use = Endurance, interval/sprint use = Conditioning, both = AI programs both types on that equipment. This is captured during onboarding.

### 4. Mobility
Primary placement: standalone sessions on active recovery and rest days. Secondary placement: session-specific mobility primers attached to training sessions when relevant (desk job athlete doing heavy squats gets hip/ankle mobility in warm-up; long run session gets hip flexor and calf work post-session). The AI selects mobility primers based on the session's movement demands, athlete lifestyle factors, and recent training load. Not individually assessed via movement screen in V1 — inferred from onboarding data.

---

## Programming Methodology Architecture

### The Hybrid Mediator Model

The AI operates on two layers:

**Layer 1: Domain-Specific Methodologies (the "engines")**

Each training domain draws from proven, evidence-based methodologies selected based on athlete experience level:

| Domain | Beginner | Intermediate | Advanced |
|---|---|---|---|
| Strength | Linear progression (Rippetoe-style) | 5/3/1, Texas Method, percentage-based periodization | Conjugate, DUP, block periodization |
| Hypertrophy | Simple progressive overload, moderate volume | RP volume landmarks (MEV → MAV → MRV), progressive overload within meso | RP advanced, high-frequency specialization |
| Endurance | Consistent base building, conversational pace | 80/20 polarized, structured intervals | Daniels' formula, advanced polarized |
| Conditioning | Introductory circuits, moderate intensity | Structured metcons, interval protocols, work:rest management | High-intensity mixed modal, competition-specific |

The AI selects methodology based on experience level and goal focus. Experienced athletes can override their preferred methodology via deep onboarding or settings at any time.

**Layer 2: The Hybrid Mediator (the "governor")**

This layer sits above the domain engines and manages the unique challenges of concurrent training. No methodology is used "pure" in a hybrid context — every prescription gets filtered through the mediator.

The mediator manages:

**Fatigue Budget Allocation:** The athlete has finite recovery capacity. The mediator distributes this budget across domains based on current focus. "Build strength while maintaining endurance" might allocate 60% recovery budget to lifting, 40% to endurance — endurance stays at minimum effective dose while strength gets pushed.

**Interference Management:** Heavy lower body strength before endurance = blunted endurance adaptations. High-volume endurance before strength = compromised force production. The mediator applies session spacing, sequencing rules, and volume modulation to manage this.

**Volume Distribution by Phase:** Rolling blocks shift emphasis automatically:
- Block A (4 weeks): Strength emphasis → lifting at MAV, endurance at MEV, conditioning maintenance
- Block B (4 weeks): Endurance emphasis → endurance volume builds, lifting drops to maintenance
- Block C (4 weeks): Balanced → moderate across all, focus on work capacity
- Blocks are auto-generated based on the athlete's goal archetype and progress signals.

**Cross-Domain Load Tracking:** The mediator thinks in body SYSTEMS, not modalities:
- Spinal loading: deadlifts, squats, rucking, rowing all draw from the same budget
- CNS demand: heavy singles, max sprints, competition-style metcons
- Joint stress: running volume (knees/ankles), overhead pressing (shoulders), rowing (lower back)
- Eccentric damage: long downhill runs, heavy negatives, new movements
- A heavy ruck Tuesday draws from the same spinal/CNS pool as deadlifts — the mediator sees this

**Methodology Adaptation Examples:**
- RP says increase volume to MAV → but athlete runs 25 mi/week → mediator caps leg volume, compensates with frequency or intensity
- 5/3/1 says heavy deadlift singles → but athlete did a heavy ruck yesterday → mediator shifts the day or substitutes trap bar / RDL
- Polarized running says long slow run Saturday → but heavy squats are in the pool → mediator flags sequencing guidance
- Metcon calls for high-CNS conditioning → athlete did heavy bench and has intervals tomorrow → mediator prescribes lower-CNS option (sled work, steady-state bike)

---

## Session Pool Delivery Model

Athletes receive a pool of sessions each week and schedule them as they see fit. No rigid day assignments.

Example week (5-day balanced hybrid):
1. Upper Body Strength (60 min)
2. Lower Body Strength (60 min)
3. Endurance — Long Run (45 min)
4. Conditioning — Metcon (30 min)
5. Active Recovery + Mobility (30 min)

### Intelligent Sequencing (Traffic Light System)

When athletes schedule sessions, the AI provides sequencing guidance:

- **Green:** No conflicts. Good spacing between complementary sessions.
- **Yellow:** Suboptimal but workable. AI explains the tradeoff, suggests alternatives, but allows it.
- **Red:** Strongly discouraged. High interference or injury risk. AI warns prominently but doesn't block.

The sequencing engine evaluates: muscle group overlap, spinal loading accumulation, CNS demand stacking, eccentric damage timing, and energy system interference.

### External Load Handling

Athletes can log unplanned external activities ad hoc (BJJ class, long hike, physical labor). The AI re-evaluates the remaining session pool: estimates systemic cost, may suggest reordering, may auto-adjust volume/intensity of the next conflicting session.

---

## Deload Strategy

The AI plans deload blocks into mesocycle structure (typically every 3-5 weeks based on accumulated load). It simultaneously monitors reactive signals — RPE trending upward, missed sessions, athlete feedback. If signals spike early, the AI offers to pull the deload forward. If the athlete is progressing well, it can extend the block. The athlete always has override agency: "I feel good, push me" or "I need a break."

---

## Periodization Model

Rolling/continuous blocks. No fixed event-based periodization in V1. The AI generates mesocycles with planned volume progressions and deloads, shifts emphasis between blocks based on goal archetype, and adapts based on logged performance and athlete feedback.

---

## V1 Scope

### In Scope
- Structured onboarding (quick + deep path options)
- AI-generated weekly session pools across all 4 domains
- Hybrid mediator layer managing cross-domain interference and fatigue budgets
- Domain-specific methodology selection (AI-recommended, athlete-overridable)
- Benchmark discovery weeks (AI-selected based on onboarding data)
- RPE and workout logging
- Manual wearable data upload
- Ad hoc external training load logging
- Adaptive programming based on logged performance
- Cross-domain load management and intelligent session sequencing (traffic light system)
- Planned + reactive deload management
- Equipment and modality-based exercise selection
- Equipment usage intent (resolving conditioning vs. endurance for dual-purpose equipment)
- Session-specific mobility primers + recovery day mobility programming
- Programming transparency toggle ("just tell me what to do" vs. "show me the science")
- Athlete ability to update benchmarks, preferences, and methodology choices anytime

### Out of Scope (V1)
- Nutrition tracking or guidance
- Sleep/recovery tracking (beyond lifestyle context from onboarding)
- Event-specific periodization
- Specific measurable goal targets (sub-20 5K, 300lb squat)
- Wearable API integration (manual upload only)
- Sport-specific programming profiles
- Coach interface
- Social/community features
- Individual movement quality screening / corrective exercise prescription
- Recurring external load scheduling

---

## Core Directives

1. **Onboarding data is sacred.** If we capture a data point, it MUST functionally feed into programming logic. Never build UI that collects data the backend ignores.

2. **Estimate, don't gate.** Missing data should never prevent programming. The AI estimates from what it has and refines over time from logged performance.

3. **Respect the whole athlete.** A heavy ruck impacts the next day's squat session. The AI must think in body systems, not isolated modalities.

4. **Athlete agency always.** The AI prescribes, but the athlete can adjust splits, swap sessions, push through or pull back on deloads, override methodology choices, and update their profile anytime.

5. **Never build MVPs.** Every component must be styled to the premium standard. We do not ship "basic."

6. **Structured data in, intelligent programming out.** Standardized inputs (not free-text) ensure clean data for the AI to reason about.

7. **Progressive discovery over front-loaded assessment.** Don't make someone test everything before they can train. Let the first weeks reveal what the onboarding couldn't capture.

---

# BUILD SECTION 1: ONBOARDING

## Execution Order (CRITICAL)

You MUST build in this exact sequence. Do not skip ahead. Each step depends on the one before it.

**Step 1: Database Migrations**
Write and apply Supabase SQL migrations FIRST. This includes: extending the `profiles` table with all new columns, creating new tables (`athlete_injuries`, `athlete_benchmarks`, `recent_training_activity`, `external_load_logs`), updating/creating enums (expanded equipment types, goal archetypes, methodology preferences, etc.), and adding RLS policies to all new tables. The UI and server actions depend on these tables existing.

**Step 2: TypeScript Types**
Update `src/lib/types/database.types.ts` and `src/lib/types/training.types.ts` to reflect the new schema. All new tables need Row, Insert, and Update type variants. The `OnboardingData` type needs to cover all quick + deep path fields.

**Step 3: Server Actions**
Rebuild `src/lib/actions/onboarding.actions.ts` with the new action signatures specified below. Each action must compile and work against the new schema before moving to UI.

**Step 4: Middleware Update**
Update `src/middleware.ts` to use `onboarding_completed_at IS NOT NULL` instead of `benchmark_week_complete` as the onboarding gate.

**Step 5: Onboarding UI**
Tear down the existing `src/app/onboarding/page.tsx` and rebuild with the full screen-by-screen flow specified below. The UI calls the server actions from Step 3.

**Step 6: Verify**
Ensure the app compiles (`npm run build`), the onboarding flow completes end-to-end, and data persists correctly to all tables.

**Do NOT:**
- Build UI before the schema and server actions exist
- Modify anything outside the onboarding flow (dashboard, workout logger, AI coach, etc.)
- Build any logic from future build sections (programming engine, session pool generation, etc.)
- Remove or modify existing tables that other features depend on (mesocycles, microcycles, workouts, exercise_sets, cardio_logs, rucking_logs, ai_coach_interventions) — only extend and add

---

## Overview

The onboarding is a complete rebuild of the existing 4-step flow. The current implementation captures 6 data points (height, weight, sex, training age, equipment from a limited list, goal from 3 options). The new onboarding captures 30+ data points across 7 categories, with a quick/deep path split, and feeds every data point into the programming engine.

## Architecture

### Two-Phase Intake Model

**Phase 1: Structured Onboarding (Day 0)**
A standardized form/wizard with two paths:
- **Quick Path (~3-5 minutes):** Captures essentials only. Gets the athlete training today.
- **Deep Path (~8-12 minutes):** Everything in Quick, plus training detail, benchmarks, methodology preferences, lifestyle factors, and more.

The athlete chooses their path at the start. All data is captured in structured fields (selectors, sliders, checklists) — not free-text — for clean AI consumption.

**Phase 2: Benchmark Discovery (Weeks 1-2)**
After onboarding completes, the AI generates the first session pool with benchmark test sessions woven in. The AI determines WHICH benchmarks to test based on what it doesn't know from onboarding. This replaces the current `benchmark_week_complete` flag logic — onboarding completion should trigger session pool generation with discovery sessions included, not immediately mark benchmarks as complete.

If the athlete skips benchmarks or doesn't complete all tests, the AI estimates from self-reported data and auto-calibrates from actual logged performance over time. Athletes can manually input known benchmarks at any time.

### Onboarding Screens

#### Quick Path

**Screen 1: Welcome & Path Selection**
- Brief context: "Let's calibrate your training engine."
- Two options: "Quick Setup (3 min)" and "Deep Calibration (10 min)"
- Quick gets them training today. Deep gives the AI more to work with.

**Screen 2: Athlete Profile**
- Age (number input)
- Sex (Male / Female)
- Height (cm or ft/in toggle)
- Weight (kg or lbs toggle)
- Unit preference is saved and used throughout the app

**Screen 3: Experience Snapshot**
- Experience level per modality: Beginner / Intermediate / Advanced
- Show only relevant modalities. Always show: Lifting, Running, Conditioning/Metcon
- Conditionally show: Rucking, Rowing, Swimming, Cycling (shown if they exist in the athlete's awareness — or show all with "N/A / Don't train this" option)
- Use a visual slider or segmented control, not a dropdown

**Screen 4: Equipment & Access**
- Primary training environment: Commercial gym / Home gym / Outdoor-minimal / Mix
- Equipment checklist (multi-select with icons, glowing accent on selection):
  - Barbell + rack
  - Dumbbells (adjustable or fixed range)
  - Kettlebells
  - Pull-up bar
  - Cable machine / machines
  - Assault / Air bike
  - Rower (Concept2 or equivalent)
  - Ski Erg
  - Treadmill
  - Stationary bike / spin bike
  - Swimming pool access
  - Ruck (weight vest / rucksack + weights)
  - Sled / prowler
  - Battle ropes
  - Resistance bands
  - Other (free text)

**Screen 5: Training Availability**
- Days per week available to train: slider or number selector (3-7)
- Typical session duration: 30 / 45 / 60 / 75 / 90+ minutes
- Willingness to do two-a-days: Yes / Sometimes / No

**Screen 6: Goal Selection**
- General focus archetype (single select, large cards):
  - "Improve overall hybrid fitness"
  - "Build strength while maintaining endurance"
  - "Build endurance while maintaining strength"
  - "Focus on conditioning / work capacity"
  - "General health and longevity"

**Screen 7: Injuries & Limitations**
- "Do you have any current injuries or limitations?" Yes / No
- If Yes: body area multi-select (Shoulder, Lower Back, Knee, Hip, Ankle, Wrist, Elbow, Neck, Other)
- For each selected area: brief description field + severity (Minor / Moderate / Significant)
- Movements to avoid: multi-select from common movements (Overhead pressing, Running, Heavy squatting, Deadlifting from floor, etc.) + "Other" free text

**Screen 8: Generating Your Program**
- Premium loading animation
- "Constructing your training protocol..."
- Shows a brief summary of what the AI understood from their inputs
- Transitions to dashboard with their first week's session pool (including benchmark discovery sessions)

#### Deep Path (Additional Screens)

Everything in Quick, plus these screens inserted at logical points:

**After Screen 3 (Experience) — Screen 3b: Recent Training Detail**
- Per each modality they rated Intermediate or Advanced:
  - "What does a typical week look like?" — structured inputs:
    - Frequency (sessions/week)
    - Approximate volume (e.g., running: miles/week; lifting: hours/week)
  - Known benchmarks / PRs (optional, all can be skipped):
    - Lifting: Squat, Deadlift, Bench Press, OHP (weight × reps format, system calculates estimated 1RM)
    - Endurance: Recent best efforts (mile time, 5K time, longest ruck distance/weight, FTP if cyclist)
    - Conditioning: Benchmark WOD times, max cal/min on assault bike, etc.
  - "Don't know my numbers" option at every benchmark field — system will discover via benchmark weeks

**After Screen 4 (Equipment) — Screen 4b: Modality & Usage Preferences**
- Endurance modality ranking: drag-to-rank or numbered preference of selected endurance modalities
- Conditioning style preferences (multi-select): Metcon/CrossFit style, Machine-based intervals, Circuit training, HIIT, Other
- Equipment usage intent (for dual-purpose equipment): For each piece of equipment that serves both endurance and conditioning (rower, assault bike, ski erg, stationary bike), ask:
  - "How do you primarily use your [equipment]?"
  - Long steady sessions (→ Endurance)
  - Intervals / sprints (→ Conditioning)
  - Both (→ AI programs both)

**After Screen 5 (Availability) — Screen 5b: Lifestyle Factors**
- Work type: Desk job / Active job / Physical labor / Mixed
- General stress level: Low / Moderate / High / Variable
- Travel frequency: Rarely / Monthly / Weekly
- Time of day preference: Morning / Midday / Evening / No preference / Varies

**After Screen 6 (Goals) — Screen 6b: Methodology & Transparency Preferences**
- "Do you follow a specific training methodology?" (labeled as optional, with context: "The AI selects the best approach for you by default")
- Strength methodology: Let AI decide (default) / Linear Progression / 5/3/1 / Percentage-based periodization / Conjugate / Other
- Hypertrophy approach: Let AI decide (default) / RP Volume-based / High frequency / Traditional bodybuilding split / Other
- Endurance methodology: Let AI decide (default) / Polarized 80/20 / MAF aerobic base / Daniels formula / Hybrid mixed / Other
- Programming transparency: "Just tell me what to do" / "Show me the science" (expandable rationale per session)

**After Screen 7 (Injuries) — Screen 7b: Body Composition (Optional)**
- Clearly marked as optional
- Current body fat % (if known)
- Body comp goal: Gain muscle / Lose fat / Recomp / Maintain / No preference
- This data is context for the AI, not a primary programming driver

### Database Requirements

The existing `profiles` table must be extended significantly. New tables may be needed for structured data that doesn't fit cleanly into the profiles row.

**Profiles table extensions (or new related tables):**
- `onboarding_path` — 'quick' | 'deep' (which path they chose)
- `age` — integer
- `height_cm` — numeric
- `unit_preference` — 'metric' | 'imperial'
- Experience levels per modality (consider a `modality_experience` join table or JSONB column):
  - lifting_experience, running_experience, rucking_experience, rowing_experience, swimming_experience, cycling_experience, conditioning_experience
  - Each: 'beginner' | 'intermediate' | 'advanced'
- `primary_training_environment` — enum: COMMERCIAL_GYM, HOME_GYM, OUTDOOR_MINIMAL, MIX
- Equipment access: expand the existing `equipment_type` enum to cover all items in the checklist above
- `endurance_modality_preferences` — ordered array or JSONB (ranked modalities)
- `conditioning_style_preferences` — text array (multi-select values)
- Equipment usage intent: JSONB mapping equipment → usage ('endurance' | 'conditioning' | 'both')
- `session_duration_minutes` — integer
- `two_a_day_willingness` — 'yes' | 'sometimes' | 'no'
- `time_of_day_preference` — 'morning' | 'midday' | 'evening' | 'no_preference' | 'varies'
- `work_type` — 'desk' | 'active' | 'physical_labor' | 'mixed'
- `stress_level` — 'low' | 'moderate' | 'high' | 'variable'
- `travel_frequency` — 'rarely' | 'monthly' | 'weekly'
- `goal_archetype` — replace current limited enum with the 5 archetypes listed above
- `strength_methodology_preference` — enum with 'ai_decides' default
- `hypertrophy_methodology_preference` — enum with 'ai_decides' default
- `endurance_methodology_preference` — enum with 'ai_decides' default
- `transparency_preference` — 'minimal' | 'detailed'
- `body_fat_percentage` — numeric, nullable
- `body_comp_goal` — enum, nullable
- `onboarding_completed_at` — timestamp (replaces `benchmark_week_complete` as the onboarding gate)
- `benchmark_discovery_status` — 'pending' | 'in_progress' | 'complete' (tracks the phase 2 discovery)

**New table: `athlete_injuries`**
- `id`, `user_id`, `body_area` (enum), `description` (text), `severity` ('minor' | 'moderate' | 'significant'), `movements_to_avoid` (text array), `is_active` (boolean), `created_at`, `updated_at`
- Supports multiple injuries per athlete
- `is_active` allows marking injuries as resolved without deleting history

**New table: `athlete_benchmarks`**
- `id`, `user_id`, `modality` (enum), `benchmark_name` (e.g., 'back_squat_1rm', '5k_time', 'fran_time'), `value` (numeric), `unit` (text), `source` ('self_reported' | 'tested' | 'estimated'), `tested_at` (timestamp), `created_at`
- Append-only — new benchmarks create new rows, preserving history
- The AI reads the latest benchmark per name to calibrate programming

**New table: `recent_training_activity`**
- `id`, `user_id`, `modality`, `frequency_per_week` (integer), `approximate_volume` (text — e.g., "20 miles/week", "4 hours/week"), `captured_at` (timestamp)
- Snapshot of what the athlete was doing when they onboarded
- Used by AI for initial programming calibration, becomes less relevant as logged data accumulates

**New table: `external_load_logs`**
- `id`, `user_id`, `activity_type` (text — e.g., 'BJJ', 'Hiking', 'Moving day'), `duration_minutes` (integer), `perceived_intensity` ('low' | 'moderate' | 'high' | 'very_high'), `notes` (text, nullable), `logged_at` (timestamp)
- Ad hoc logging, not captured during onboarding
- AI uses this to adjust remaining session pool for the week

### Server Actions

**Onboarding actions (rebuild `onboarding.actions.ts`):**

`updateOnboardingProfile(input)` — Accepts partial onboarding data at each step. Upserts to profiles and related tables. Must handle both quick and deep path fields.

`saveInjuries(injuries[])` — Bulk upsert to `athlete_injuries` table. Marks any previously active injuries not in the new array as inactive.

`saveBenchmarks(benchmarks[])` — Appends new rows to `athlete_benchmarks`. Does not overwrite — preserves history.

`saveRecentTraining(activities[])` — Upserts to `recent_training_activity` for the current user.

`completeOnboarding()` — Sets `onboarding_completed_at` timestamp. Sets `benchmark_discovery_status = 'pending'`. Triggers initial session pool generation (this is where the AI generates the first week including benchmark discovery sessions). Does NOT set benchmarks as complete — that happens after discovery.

`getOnboardingProfile()` — Returns all onboarding data for the authenticated user, hydrating the form if they return to edit.

### Middleware Updates

The onboarding gate in `middleware.ts` should check `onboarding_completed_at IS NOT NULL` instead of `benchmark_week_complete`. Athletes who have completed onboarding but not benchmark discovery should proceed to the dashboard (their first session pool will include discovery sessions).

### How Onboarding Data Feeds Programming

Every onboarding input maps to a specific programming decision:

| Onboarding Input | Programming Decision |
|---|---|
| Days available + session duration | Total weekly volume, session structure, number of sessions in pool |
| Experience level per modality | Starting intensity, movement complexity, volume tolerance, methodology selection |
| Equipment access | Exercise selection pool — the AI NEVER prescribes a movement the athlete can't perform with their equipment |
| Equipment usage intent | Whether dual-purpose equipment appears in endurance programming, conditioning programming, or both |
| Endurance modality preferences | Which endurance modalities appear in programming, weighted by preference rank |
| Conditioning style preferences | What type of conditioning sessions the AI generates |
| Goals/focus archetype | Volume distribution across domains, block emphasis pattern |
| Injuries/limitations | Movement exclusions, substitution rules, affected body area gets reduced loading |
| Lifestyle (desk job, stress) | Recovery day frequency, mobility primer selection, volume buffer |
| Two-a-day willingness | Option to split sessions (AM lift / PM run) when scheduling allows |
| Methodology preferences | Which domain engine the AI uses for programming per domain |
| Transparency preference | Whether sessions show "just the workout" or expandable methodology rationale |
| Body comp goal (if provided) | Influences volume/intensity bias (e.g., hypertrophy emphasis for "gain muscle") |
| Recent training activity | Calibrates initial volume to avoid dramatic jumps or drops from what they've been doing |
| Known benchmarks | Seeds the AI's intensity calculations from day one (e.g., squat at 80% of reported 1RM) |

### UX Notes

- Every screen must feel premium. Framer Motion entrance/exit animations. Large, legible inputs. Glowing accent on selected items.
- The Quick path should feel fast and decisive — big cards, single taps, minimal scrolling.
- The Deep path should feel thorough but not tedious — progressive disclosure, clear "skip" options, contextual explanations of why each data point matters.
- The equipment checklist should use high-fidelity icons with a glowing selection state.
- Experience level selectors should be visual (segmented control or slider with Beginner/Intermediate/Advanced labels), not dropdowns.
- The injury screen should offer a visual body map (tap to select area) with a fallback list selector.
- The "Generating Your Program" screen should feel like the AI is doing real work — show a brief summary of what it understood, then transition to the dashboard.

### What This Section Does NOT Cover

This build section covers the onboarding wizard only. It does NOT cover:
- The dashboard UI (separate build section)
- The workout logger UI (separate build section)
- The AI session pool generation logic (separate build section — "Programming Engine")
- The weekly review / AI coach interaction (separate build section)
- The session scheduling and traffic light sequencing system (separate build section)

The onboarding must capture and persist all data described above. The programming engine build section (next) will consume this data to generate session pools.

---

# FUTURE BUILD SECTIONS (Stubs)

The following sections will be detailed in subsequent iterations of this prompt. They are listed here for architectural awareness.

## BUILD SECTION 2: Programming Engine
The AI logic that consumes onboarding data + logged performance to generate weekly session pools. Includes the hybrid mediator layer, methodology selection, benchmark discovery session generation, and volume distribution.

## BUILD SECTION 3: Dashboard & Session Pool UI
The athlete's home screen. Displays the weekly session pool, allows scheduling with traffic light sequencing feedback, shows current block/phase context, and surfaces AI coach alerts.

## BUILD SECTION 4: Workout Logger
The in-session experience. Set logging for lifting, duration/distance/HR logging for endurance and conditioning, ruck-specific logging. Must work under physical duress (large inputs, high contrast).

## BUILD SECTION 5: AI Coach Weekly Review
The Anthropic-powered weekly analysis. Aggregates all logged data, evaluates fatigue signals, makes volume/exercise/intensity adjustments, and presents them to the athlete with accept/reject/feedback options.

## BUILD SECTION 6: Settings & Profile Management
Where athletes update equipment, injuries, goals, methodology preferences, transparency toggle, and all onboarding data post-completion. Also where they manually input benchmarks and view PR history.

## BUILD SECTION 7: External Load & Adaptive Responses
Ad hoc external activity logging and the AI's real-time response to unplanned load (adjusting remaining session pool for the week).

## BUILD SECTION 8: Schema Migration Plan
Reconciliation between existing database tables and the new schema requirements. Migration strategy to extend profiles, add new tables, update enums, and preserve existing data.
