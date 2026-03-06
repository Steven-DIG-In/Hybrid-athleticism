# Hybrid Athleticism - Backlog

**Last Updated:** February 5, 2026

---

## Critical - MVP Blockers 🚨

### Onboarding → Database Integration
- [ ] **Save mesocycle to database** - `step-program-generation.tsx` generates but doesn't call `saveMesocycleToDatabase()`
- [ ] **Save lift maxes** - Call `saveLiftMax()` for each lift during onboarding completion
- [ ] **Save volume landmarks** - Call `saveVolumeLandmarks()` during onboarding completion

### Today Page
- [ ] **Load today's session from DB** - Currently shows empty state because nothing is persisted
- [ ] **Add "Start Workout" button** - Clear navigation to `/session/[id]/execute`

### Session Flow
- [ ] **Verify session execution works end-to-end** - Load planned → Log sets → Save actual

---

## High Priority

### Settings / Profile Page
- [ ] Build functional Settings page (currently a stub)
- [ ] Profile section: Edit name, weight, height
- [ ] Training section: Edit training levels, training age
- [ ] Availability section: Edit available days, session duration
- [ ] Equipment section: Edit equipment inventory
- [ ] Volume landmarks section: Edit MV/MEV/MAV/MRV per muscle group
- [ ] Reuse onboarding components where possible

### Progress Tracking
- [ ] E1RM trend charts per lift
- [ ] Volume over time graphs
- [ ] Recent PRs display

### Error Handling
- [ ] Add user-friendly error messages for DB failures
- [ ] Loading states for async operations
- [ ] Graceful fallbacks when data is missing

---

## Medium Priority

### Mobile-First UX
- [ ] Audit all components for touch targets (min 44px)
- [ ] Large, tappable buttons during workout logging
- [ ] Swipe gestures for common actions
- [ ] Test on actual devices (iOS Safari, Android Chrome)

### Theme Support (Light/Dark)
- [ ] Add theme context/provider
- [ ] Define color tokens for both themes
- [ ] Add theme toggle in Settings
- [ ] Respect system preference by default

### Onboarding UX Refinements
- [ ] Priority muscle groups: Improve category selection UX
- [ ] Running → Cardio DB migration (rename `training_domain_type` enum)

---

## Low Priority / Future

### Garmin Integration
- [ ] OAuth flow
- [ ] Pull: Sync completed activities
- [ ] Push: Send planned workouts to watch

### Advanced RP Features
- [ ] PR celebration screen
- [ ] Fatigue accumulation tracking
- [ ] Auto-deload recommendations
- [ ] Exercise substitution suggestions

### Export / Social
- [ ] Export workout history
- [ ] Share achievements

---

## Completed ✅

### Database Schema
- [x] All strength tables created with RLS policies
- [x] `mesocycle-service.ts` with full CRUD operations

### Core Utilities
- [x] E1RM calculator (Epley formula)
- [x] Training Max calculation
- [x] Volume progression helpers

### Onboarding Flow
- [x] Multi-step wizard with all data collection
- [x] Lift assessment step (collects data, needs persistence)
- [x] Volume landmarks step
- [x] Mesocycle generation (in-memory)

### Workout Logger
- [x] Load planned exercises from DB
- [x] Display suggested weights
- [x] Real-time E1RM calculation
- [x] Set logging to database

### Cardio Refactor (UI Only)
- [x] Update TypeScript types (running → cardio)
- [x] Add `activity_type` field to cardio sessions
- [x] Update onboarding "Running Goals" → "Cardio Goals"
- [x] Add VO2 Max as training focus option
- [x] Add cardio equipment (Air Bike, Rower, Spin Bike)
