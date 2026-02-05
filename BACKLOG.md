# Hybrid Athleticism - Backlog

## High Priority

### Running → Cardio Refactor
- [ ] Rename `running` → `cardio` in DB enum (`training_domain_type`) — *requires DB migration*
- [x] Update TypeScript types throughout (onboarding store updated)
- [x] Add `activity_type` field to cardio sessions (running, rowing, swimming, cycling, air bike)
- [x] Update onboarding "Running Goals" → "Cardio Goals" with activity selection
- [x] Add VO2 Max as a cardio training focus option
- [x] Update all UI labels and icons

### Onboarding UX Fixes
- [x] **BUG FIX**: Wizard looping back to start after completion (fixed: changed update → upsert)
- [x] Domain priorities: Improve "Maintenance" selection visibility (added amber highlight + border)
- [ ] Priority muscle groups: Refine category selection UX (needs work on groupings/presentation)
- [x] Volume Landmarks: Add better explanation of RP terminology (info panel shown by default with examples)
- [x] Equipment Access: Add Air Bike, Rower, Spin Bike to cardio
- [x] Equipment Access: Add Rings to stations, moved Dip Bars to stations

### Mobile-First UX
- [ ] Audit all components for touch targets (min 44px)
- [ ] Ensure inputs are thumb-friendly (bottom of screen when possible)
- [ ] Large, tappable buttons during workout logging
- [ ] Swipe gestures for common actions (complete set, next exercise)
- [ ] Haptic feedback on key actions (if supported)
- [ ] Test on actual devices (iOS Safari, Android Chrome)
- [ ] Prevent accidental navigation during active workout

### Theme Support (Light/Dark)
- [ ] Add theme context/provider
- [ ] Define color tokens for both themes
- [ ] Update Tailwind config with CSS variables
- [ ] Add theme toggle in Settings
- [ ] Respect system preference by default (`prefers-color-scheme`)
- [ ] Persist preference to localStorage/user profile

### Settings / Profile Page
- [ ] Build functional Settings page (currently a stub)
- [ ] Profile section: Edit name, weight, height, DOB
- [ ] Training section: Edit training levels, training age
- [ ] Availability section: Edit available days, session duration
- [ ] Domain priorities section: Edit strength/cardio/rucking priorities
- [ ] Equipment section: Edit equipment inventory
- [ ] Volume landmarks section: Edit MV/MEV/MAV/MRV per muscle group
- [ ] Goals section: Edit strength and cardio goals
- [ ] Garmin section: Connect/disconnect, sync settings
- [ ] Reuse onboarding components where possible (DRY)

---

## Medium Priority

### Program Generation
- [x] Build program generator from user preferences (in-memory)
- [x] Display weekly schedule on Today page
- [x] Create full Program page with weekly view
- [ ] Persist generated program to database (planned_sessions table)
- [ ] Allow manual adjustments to generated schedule

### Complete Onboarding Data Flow
- [ ] Save domain priorities to `training_domains` table
- [ ] Save equipment to user profile or new table
- [ ] Save volume landmarks to `muscle_group_config` table
- [ ] Actually generate mesocycle records in database

### Garmin Integration
- [ ] Implement OAuth flow
- [ ] **Pull**: Sync completed activities automatically
- [ ] Map Garmin activity types to our cardio types
- [ ] **Push**: Send planned workouts to Garmin watch (like TrainingPeaks)
  - Structured strength workouts
  - Cardio workouts with targets (pace, HR zones, intervals)
  - Requires Garmin Connect IQ or Workout API

### Program Generation
- [ ] Build mesocycle generator based on:
  - Domain priorities
  - Available days
  - Training level
  - Volume landmarks
- [ ] Create microcycle (weekly) breakdown
- [ ] Generate planned sessions with exercises

---

## Low Priority / Future

### Progress Tracking
- [ ] E1RM trend charts
- [ ] Volume over time graphs
- [ ] Cardio metrics (pace, distance, load)
- [ ] Body weight tracking

### Advanced RP Features
- [ ] Fatigue accumulation tracking
- [ ] Auto-deload recommendations
- [ ] Volume landmark adjustments based on performance
- [ ] Readiness scores

### Social / Export
- [ ] Export workout history
- [ ] Share achievements
- [ ] Coach view (if applicable)
