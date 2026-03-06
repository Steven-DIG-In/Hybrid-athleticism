# Hybrid Athleticism

A Renaissance Periodization (RP) based training PWA for managing strength, rucking, and cardio training with intelligent periodization and autoregulation.

## Current Status: MVP Phase 1 - In Progress 🚧

**Last Updated:** February 5, 2026

### Overview

The core architecture is solid and most individual components work. The main gap is **integration** - onboarding generates a program but doesn't persist it to the database, so the Today page has nothing to display.

### What's Complete ✅

#### Database Schema (Supabase)
All tables exist with proper RLS policies:
| Table | Purpose |
|-------|---------|
| `mesocycles` | Training blocks (4-6 weeks) |
| `planned_sessions` | Generated workout plans per day |
| `planned_exercises` | Exercises with suggested weights |
| `user_lift_maxes` | E1RM and Training Max tracking |
| `lift_max_history` | Progression over time |
| `user_volume_landmarks` | Custom volume settings |
| `actual_sessions` | Completed workout records |
| `set_logs` | Individual set data |

#### Strength Utilities (`src/lib/strength/`)
- E1RM calculator (Epley formula with RIR adjustment)
- Training Max calculation (85-90% of E1RM)
- Suggested weight calculator based on TM and RPE
- Volume progression helpers (MEV → MAV)

#### Mesocycle Generator (`src/lib/mesocycle-generator.ts`)
- Generates multi-week training blocks in-memory
- Progressive volume (MEV → MAV)
- RPE/RIR periodization
- Auto-generated sessions based on equipment

#### Database Service (`src/lib/services/mesocycle-service.ts`)
- `saveMesocycleToDatabase()` - fully implemented
- `getActiveMesocycle()` - retrieves from DB
- `getPlannedSessions()` / `getPlannedExercises()`
- `saveLiftMax()` / `saveVolumeLandmarks()`

#### Workout Logger (`src/components/workout/strength-session.tsx`)
- Loads planned exercises from database
- Displays suggested weights
- Real-time E1RM calculation
- Set logging (weight, reps, RIR)
- Saves to `actual_sessions` and `set_logs`
- Updates E1RM when new bests achieved

### What's Missing ❌

#### Critical (Blocking MVP)
| Issue | Location | Fix |
|-------|----------|-----|
| Onboarding doesn't save to DB | `step-program-generation.tsx` | Call `saveMesocycleToDatabase()` |
| Lift maxes not persisted | Onboarding completion | Call `saveLiftMax()` for each lift |
| Volume landmarks not saved | Onboarding completion | Call `saveVolumeLandmarks()` |
| Today page has no data | `/today/page.tsx` | Blocked until above is fixed |
| No session start flow | Today page | Add "Start Workout" button |

#### High Priority
- Settings page (currently a stub)
- Progress page (currently empty)
- Error handling for DB failures

#### Nice to Have
- PR celebration screen
- Deload auto-detection
- Exercise substitution

---

### Architecture

```
src/
├── app/
│   ├── (auth)/           # Login/signup pages
│   ├── (dashboard)/      # Main app (today, session, progress)
│   └── (onboarding)/     # Multi-step onboarding flow
├── components/
│   ├── onboarding/       # Step components
│   └── workout/          # Strength session logger
├── lib/
│   ├── strength/         # E1RM, TM, volume calculations
│   ├── services/         # Database operations
│   ├── exercise-library.ts
│   ├── mesocycle-generator.ts
│   └── session-templates.ts
├── stores/
│   └── onboarding-store.ts  # Zustand (persisted)
└── types/
    └── database.ts       # Supabase types
```

---

### Key Concepts

**Training Max (TM):** Conservative working max (85-90% of E1RM). Prevents ego lifting, ensures quality reps.

**E1RM Calculation:** `weight × (1 + reps/30)` with RIR adjustment. Updated after each session.

**Volume Landmarks (RP):**
- MV = Maintenance Volume (minimum to maintain)
- MEV = Minimum Effective Volume (growth starts)
- MAV = Maximum Adaptive Volume (optimal zone)
- MRV = Maximum Recoverable Volume (upper limit)

**Mesocycle:** 4-5 weeks accumulation + 1 week deload. Volume ramps MEV → MAV, RPE 7 → 9.

---

### Running Locally

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase URL and anon key

# Run the database migration (in Supabase SQL Editor)
# Copy contents of: supabase/migrations/20260130_strength_tables.sql

# Start dev server
npm run dev
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## Roadmap

### Now: Complete MVP (Strength) 🏋️
- [ ] Fix onboarding → database persistence
- [ ] Wire up Today page to load sessions
- [ ] Add session start flow
- [ ] Build Settings page
- [ ] Add Progress page with E1RM charts

### Next: Rucking Integration 🎒
- [ ] Ruck session templates
- [ ] Load/distance/pace tracking
- [ ] Heart rate zone integration
- [ ] Weekly volume balancing with strength

### Later: Cardio & Integrations
- [ ] Running/cardio workout types
- [ ] Garmin OAuth + activity sync
- [ ] Advanced analytics

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| State | Zustand (persisted) |
| Styling | Tailwind CSS |
| Types | TypeScript |
| Icons | Lucide React |

---

## Known Issues

- **Onboarding state conflicts** - If steps change, clear localStorage (`hybrid-onboarding` key)
- **SWC binary** - Build may fail on ARM64 Linux (missing SWC binaries)

---

## License

MIT
