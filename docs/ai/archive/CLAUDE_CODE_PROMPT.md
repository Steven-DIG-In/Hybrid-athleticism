# CLAUDE CODE INSTRUCTIONS: BACKEND ENGINE BUILD

**Role:** You are the Lead Backend & Logic Engineer for "Project Apex" (a hyper-premium hybrid-athleticism app built in Next.js 15 App Router). 

**The Setup:**
You are working in a Dual-Agent system. 
- **The Frontend Agent (Antigravity)** is currently building the React UI components, Tailwind styling, and Framer Motion animations.
- **Your Job (Claude)** is to build the "Engine" — the Supabase APIs, Next.js Server Actions, Auth logic, and AI integrations that power the UI. 

**Do NOT build UI components, CSS, or `page.tsx` rendering logic unless it is strictly necessary to test your APIs. Antigravity owns the "Glass", you own the "Engine."**

---

## 📚 Required Reading Before You Code
Before you write any code, you MUST review these files to understand the project architecture:
1. `docs/ai/PROJECT_STATUS.md` (Crucial: Shows what DB tables and basic actions already exist)
2. `docs/ai/TRAINING_METHODOLOGY.md` (The logic you must enforce in the backend)
3. `supabase/migrations/` (Read the SQL to understand the exact data shapes)

---

## ⚙️ Your Current Mission: Phase 3 & 4 Backend (Data & AI)

Antigravity (the Frontend Agent) has just finished building the React UI for the Dashboard (`/dashboard`), Active Workout (`/workout/[id]`), and Weekly Review (`/coach`) screens. They are currently full of hardcoded **mock data**. 

Your job is to build the Server Actions in `src/lib/actions/` that power these screens:

### Task 1: Dashboard Data Fetching (`workout.actions.ts`)
- Build **`getTodaysWorkout()`**: This needs to aggregate the current user's state. It should fetch their active `mesocycle`, active `microcycle`, and see if there are any pending `workouts` for "Today". 
- Return a payload that the Dashboard can consume: Week number, Fatigue score, Next session modality, and the array of `exercise_sets` for the "Today" tactical brief.

### Task 2: Workout Logging Mutators (`logging.actions.ts`)
- Build **`logExerciseSet(setId, data)`**: Updates an `exercise_set` with `actual_reps`, `actual_weight_kg`, and `rir_actual`. 
- Build **`completeWorkout(workoutId)`**: Marks the workout complete and calculates the duration.

### Task 3: The AI Coach API (`ai-coach.actions.ts`)
- Build **`generateWeeklyReview(microcycleId)`**: This is the flagship feature. It aggregates all completed `workouts` and `rucking_logs` for a given microcycle, reads the `TRAINING_METHODOLOGY.md` file for context, and sends a prompt to the Anthropic API (Claude 3.5 Sonnet).
- The prompt must ask the AI to evaluate if there is systemic fatigue or interference (e.g., "Rucking volume is crushing the squat numbers"), and output recommended `volume_adjustments` and `exercise_swaps`.
- Save the result to the `ai_coach_interventions` table.

---

## 📝 Rules of Engagement
1. **Always use Server Actions** (`"use server"`) for database mutations.
2. Return a standardized result object: `{ success: boolean, data?: T, error?: string }`.
3. Do **NOT** touch the React UI files (`page.tsx`, `layout.tsx`). The frontend agent will handle wiring your actions into the components.
4. When you finish these tasks, update **`docs/ai/PROJECT_STATUS.md`** so the Frontend Agent (Antigravity) knows to begin wiring Phase 5!

**Begin Execution:** Review the DB schema, complete Tasks 1-3, and prove they work via simple CLI test scripts in `/scripts`.
