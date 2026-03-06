# HYBRID ATHLETICISM - PROJECT STATUS

**Current Phase:** Phase 3 & 4 Backend Complete — Dashboard, Workout Logging & AI Coach APIs Ready for Frontend
**Last Updated:** 2026-02-24

---

## 1. Active Milestones

- [x] Define Vision & Aesthetics (`DESIGN_SYSTEM.md`)
- [x] Define Training Logic & AI Coaching (`TRAINING_METHODOLOGY.md`)
- [x] Define Core User Flows (`USER_JOURNEY.md`)
- [x] Define Tech Stack (`SYSTEM_ARCHITECTURE.md`)
- [ ] Initialize Next.js App & Tailwind configuration
- [ ] Build global UI components (Buttons, Inputs, Cards) via Stitch
- [ ] Implement onboarding flow
- [x] **Scaffold Supabase Database Schema** ✅ DEPLOYED & VERIFIED
- [x] **Auth Middleware + Onboarding Gate** ✅ 2026-02-24
- [x] **Onboarding Server Actions** ✅ 2026-02-24

---

## 2. Backend Agent — Completed 2026-02-24 ✅

### Database (LIVE on Supabase `kuqgtholljrxnbxtmrnz`)

All 8 tables deployed and RLS-secured. All 5 legacy tables dropped.

| Table | RLS | Description |
|---|---|---|
| `profiles` | ✅ | User profile + progressive profiling data |
| `mesocycles` | ✅ | Training blocks (4–8 weeks) |
| `microcycles` | ✅ | Weekly periods; holds target RIR & deload flag |
| `workouts` | ✅ | Sessions with `modality` enum: `LIFTING \| CARDIO \| RUCKING \| METCON` |
| `exercise_sets` | ✅ | Set logs: target/actual reps, weight, RIR, RPE, is_pr |
| `cardio_logs` | ✅ | Zone 2 / VO2: duration, avg HR, distance, pace |
| `rucking_logs` | ✅ | Tactical: distance, pack weight, elevation, `total_load_index` (computed) |
| `ai_coach_interventions` | ✅ | AI coaching decisions: rationale, volume_adjustments JSON, exercise_swaps JSON |

**Enums:** `workout_modality`, `mesocycle_goal`, `equipment_type`
**Auto-triggers:** `updated_at` maintenance + profile auto-creation on signup

### Next.js Infrastructure (`src/`)

| File | Status |
|---|---|
| `src/middleware.ts` | ✅ Auth + onboarding gate (checks `benchmark_week_complete`) |
| `src/lib/supabase/server.ts` | ✅ SSR client |
| `src/lib/supabase/client.ts` | ✅ Browser client |
| `src/lib/types/database.types.ts` | ✅ Typed DB rows |
| `src/lib/types/training.types.ts` | ✅ Domain types + `ActionResult<T>` |

### Server Actions — Ready to consume

| File | Key Functions |
|---|---|
| `src/lib/actions/onboarding.actions.ts` | `getProfile`, `updateProfile`, `completeOnboarding` |
| `src/lib/actions/mesocycle.actions.ts` | `createMesocycle`, `getActiveMesocycle`, `getMesocycleById`, `completeMesocycle` |
| `src/lib/actions/workout.actions.ts` | `getTodaysWorkout`, `getWorkoutById`, `completeWorkout`, `swapExercise`, `getExerciseHistory` |
| `src/lib/actions/logging.actions.ts` | `logExerciseSet` (insert, auto-PR), `updateExerciseSet` (update pre-scaffolded, auto-PR), `logCardioSession`, `logRuckingSession` (auto-fatigue flag), `buildWeeklyPayload` |
| `src/lib/actions/ai-coach.actions.ts` | `generateWeeklyReview` (Anthropic Claude), `saveCoachIntervention`, `getLatestIntervention`, `getUnreviewedInterventions`, `markInterventionPresented`, `respondToIntervention` |

---

## 3. Middleware Routing Logic (2026-02-24)

| Condition | Behavior |
|---|---|
| Unauthenticated + protected route | Redirect to `/login?redirectTo=<path>` |
| Authenticated + `/login` or `/signup` | Redirect to `/dashboard` |
| Authenticated + `benchmark_week_complete = false` + NOT on `/onboarding` | Redirect to `/onboarding` |
| Authenticated + `benchmark_week_complete = true` + on `/onboarding` | Redirect to `/dashboard` |

**Protected prefixes:** `/dashboard`, `/onboarding`, `/workout`, `/coach`, `/profile`

---

## 4. Onboarding Actions API (2026-02-24)

### `getProfile()`
Returns the full `Profile` row for the authenticated user. Use to hydrate the onboarding form.

```typescript
import { getProfile } from '@/lib/actions/onboarding.actions'

const result = await getProfile()
if (result.success) {
  const profile = result.data // Profile type
}
```

### `updateProfile(input)`
Partial update of onboarding fields. Call at each step of the form.

```typescript
import { updateProfile } from '@/lib/actions/onboarding.actions'

// Step 1: Physical profile
await updateProfile({
  trainingAgeYears: 5,
  bodyweightKg: 88.5,
})

// Step 2: Equipment & goals
await updateProfile({
  equipmentAccess: ['FULL_GYM', 'BARBELL_RACK'],
  primaryGoal: 'HYBRID_PEAKING',
  availableDays: 5,
})
```

**Accepted fields:** `displayName`, `trainingAgeYears`, `primaryGoal`, `equipmentAccess`, `availableDays`, `bodyweightKg`

### `completeOnboarding()`
Final trigger — call from the last onboarding screen. Does three things:
1. Sets `benchmark_week_complete = true` on the profile
2. Creates a 6-week mesocycle (starts next Monday)
3. Scaffolds 6 microcycles with RIR ramp (3 → 0.5) + deload week

```typescript
import { completeOnboarding } from '@/lib/actions/onboarding.actions'

const result = await completeOnboarding()
if (result.success) {
  const { profileUpdated, mesocycleId } = result.data
  // Redirect to /dashboard — middleware will allow it now
}
```

---

## 5. Frontend Agent — Handoff

**The single call for the Today/Dashboard screen:**
```typescript
import { getTodaysWorkout } from '@/lib/actions/workout.actions'

const result = await getTodaysWorkout()
if (result.success) {
  const { workout, currentWeek, currentMesocycle, hasUnreviewedIntervention } = result.data
}
```

**All actions return** `{ success: true, data: T } | { success: false, error: string }` — always check `result.success` first.

**Auth:** Middleware auto-redirects unauthenticated users on protected routes AND enforces onboarding completion. No additional guards needed in components.

**Environment needed:**
```
NEXT_PUBLIC_SUPABASE_URL=https://kuqgtholljrxnbxtmrnz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
ANTHROPIC_API_KEY=<key>  # for AI coach endpoints (future)
```

---

## 6. Test Scripts

| Script | Usage |
|---|---|
| `scripts/introspect-db.ts` | `npx tsx scripts/introspect-db.ts` — probe live DB schema |
| `scripts/test-onboarding.ts` | `npx tsx scripts/test-onboarding.ts` — full onboarding flow test |

For `test-onboarding.ts`, set env vars or create a test user:
```bash
TEST_EMAIL=test@hybridathleticism.dev TEST_PASSWORD=testpassword123! npx tsx scripts/test-onboarding.ts
```

---

## 7. Phase 3 & 4 Backend — Completed 2026-02-24

### Workout Logging (Active Workout Flow)

The active workout screen uses pre-scaffolded `exercise_sets` (created with target values during mesocycle generation). During execution, the user fills in actuals:

```typescript
import { updateExerciseSet } from '@/lib/actions/logging.actions'

// Update a pre-scaffolded set with actual performance
const result = await updateExerciseSet(setId, {
  actualReps: 8,
  actualWeightKg: 100,
  rirActual: 1.5,
  rpeActual: 8.5,
})
// Auto-detects PRs (heaviest weight for that exercise)
```

For ad-hoc set logging (not pre-scaffolded):
```typescript
import { logExerciseSet } from '@/lib/actions/logging.actions'

const result = await logExerciseSet({
  workoutId: '...',
  exerciseName: 'Barbell Bench Press',
  muscleGroup: 'Chest',
  setNumber: 1,
  actualReps: 8,
  actualWeightKg: 100,
})
```

### AI Coach Weekly Review

The flagship feature. Call after a microcycle (training week) is complete:

```typescript
import { generateWeeklyReview } from '@/lib/actions/ai-coach.actions'

const result = await generateWeeklyReview(microcycleId)
if (result.success) {
  const intervention = result.data
  // intervention.rationale — human-readable coaching analysis
  // intervention.volume_adjustments — { "Chest": -1, "Back": +1 }
  // intervention.exercise_swaps — [{ from, to, reason }]
  // intervention.rir_adjustment — delta to target RIR
}
```

**Pipeline:** Aggregates all workout/cardio/rucking data for the microcycle -> enriches with profile context (equipment, goals) -> sends structured prompt to Anthropic Claude -> parses JSON response -> saves to `ai_coach_interventions` table -> marks microcycle as reviewed.

**Key intelligence:**
- Detects when heavy rucking (load index > 300) should suppress next-day spinal loading
- Identifies RPE spikes (>= 9.5) as fatigue red flags
- Tracks RIR deviation (training harder/easier than prescribed)
- Respects equipment constraints when suggesting exercise swaps

### Test Scripts (Phase 3 & 4)

| Script | Usage |
|---|---|
| `scripts/test-workout-logging.ts` | `npx tsx scripts/test-workout-logging.ts` — full workout execution flow |
| `scripts/test-ai-coach.ts` | `ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/test-ai-coach.ts` — AI Coach review |

**Run order:** `test-onboarding.ts` -> `test-workout-logging.ts` -> `test-ai-coach.ts`

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://kuqgtholljrxnbxtmrnz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
ANTHROPIC_API_KEY=<key>  # Required for generateWeeklyReview()
```

---

## 8. Frontend Agent — Phase 5 Handoff

**Antigravity:** The backend engine is ready. All mock data in the Dashboard, Active Workout, and Weekly Review screens can now be replaced with live server actions.

### Wiring Guide

**Dashboard (`/dashboard`):**
```typescript
import { getTodaysWorkout } from '@/lib/actions/workout.actions'

const result = await getTodaysWorkout()
// result.data.workout — today's workout with exercise_sets
// result.data.currentWeek — microcycle with target RIR
// result.data.currentMesocycle — active training block
// result.data.hasUnreviewedIntervention — show coach badge
```

**Active Workout (`/workout/[id]`):**
```typescript
import { getWorkoutById, completeWorkout } from '@/lib/actions/workout.actions'
import { updateExerciseSet } from '@/lib/actions/logging.actions'

// Load workout
const workout = await getWorkoutById(workoutId)

// During execution: update each set as user logs it
await updateExerciseSet(setId, { actualReps, actualWeightKg, rirActual })

// On finish
await completeWorkout(workoutId, durationMinutes)
```

**Weekly Review (`/coach`):**
```typescript
import { generateWeeklyReview, getLatestIntervention, respondToIntervention } from '@/lib/actions/ai-coach.actions'

// Trigger review (call once per microcycle)
await generateWeeklyReview(microcycleId)

// Display the review
const intervention = await getLatestIntervention(microcycleId)

// User responds
await respondToIntervention(interventionId, accepted, feedback)
```
