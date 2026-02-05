# Hybrid Athleticism

A Renaissance Periodization (RP) based training PWA for managing strength, rucking, and cardio training with intelligent periodization and autoregulation.

## Current Status: MVP Phase 1 - Strength/Hypertrophy ✅

**Last Updated:** January 30, 2026

### What's Working

#### Database Schema (Supabase) ✅
| Table | Purpose | Status |
|-------|---------|--------|
| `mesocycles` | Training blocks (4-6 weeks) | ✅ Created |
| `planned_sessions` | Generated workout plans per day | ✅ Created |
| `planned_exercises` | Exercises within sessions with suggested weights | ✅ Created |
| `user_lift_maxes` | E1RM and Training Max tracking per lift | ✅ Created |
| `lift_max_history` | Progression tracking over time | ✅ Created |
| `user_volume_landmarks` | Custom volume settings per muscle group | ✅ Created |

All tables have Row Level Security (RLS) policies configured.

#### Strength Utilities (`src/lib/strength/`) ✅
- E1RM calculator using Epley formula with RIR adjustment
- Training Max calculation (85-90% of E1RM)
- Suggested weight calculator based on TM and target RPE
- Volume progression helpers (MEV → MAV ramping)
- Key lift definitions (Bench, Squat, Deadlift, OHP, Row)

#### Onboarding Flow ✅
- 13-step onboarding collecting user profile, goals, schedule
- **Lift assessment step** for entering maxes:
  - Tested 1RM (direct entry)
  - Calculated from working set (weight × reps @ RIR)
  - Estimated from body weight ratios
- Training Max percentage selection (85%/90%/95%)
- Mesocycle generation on completion
- Automatic database persistence of generated program

#### Workout Execution ✅
- Session page loads planned exercises from database
- Suggested weights displayed based on Training Max
- Real-time E1RM calculation during workout
- Set logging with weight, reps, RIR tracking
- Automatic E1RM updates when new bests achieved
- PR celebration screen
- Lift max history recording

---

### Architecture

```
src/
├── app/
│   ├── (auth)/           # Login/signup pages
│   ├── (dashboard)/      # Main app pages (today, session, progress)
│   └── (onboarding)/     # 13-step onboarding flow
├── components/
│   ├── onboarding/       # Step components including lift assessment
│   └── workout/          # Strength session logger
├── lib/
│   ├── strength/         # E1RM, TM, volume calculations
│   │   ├── e1rm-calculator.ts
│   │   ├── training-max.ts
│   │   ├── volume-calculator.ts
│   │   └── progression.ts
│   ├── services/         # Database operations
│   │   └── mesocycle-service.ts
│   ├── exercise-library.ts
│   ├── mesocycle-generator.ts
│   └── session-templates.ts
├── stores/
│   └── onboarding-store.ts  # Zustand store (persisted)
└── types/
    └── database.ts       # Supabase types
```

---

### Key Concepts

#### Training Max (TM)
Conservative working max (85-90% of E1RM) used to calculate suggested weights. Prevents ego lifting and ensures quality reps with room to progress.

#### E1RM Calculation
```
Epley Formula: weight × (1 + reps/30)
With RIR: effective_reps = actual_reps + RIR
```
Updated automatically after each session based on best performance.

#### Volume Landmarks (RP)
| Landmark | Definition |
|----------|------------|
| MV | Maintenance Volume - minimum to maintain gains |
| MEV | Minimum Effective Volume - where growth starts |
| MAV | Maximum Adaptive Volume - optimal growth zone |
| MRV | Maximum Recoverable Volume - upper limit |

#### Mesocycle Structure
- 4-5 weeks accumulation (progressive overload)
- 1 week deload (recovery)
- Volume ramps from MEV → MAV across weeks
- RPE increases from 7 → 9 across weeks

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

### Phase 2: Rucking Integration 🎒
- [ ] Ruck session templates
- [ ] Load/distance/pace tracking
- [ ] Heart rate zone integration
- [ ] Fatigue cost calculations
- [ ] Weekly volume balancing with strength

### Phase 3: Cardio/Running 🏃
- [ ] Running workout types (easy, tempo, intervals, long)
- [ ] Pace zone calculations
- [ ] Mileage progression
- [ ] Taper protocols for events

### Phase 4: Garmin Integration ⌚
- [ ] OAuth connection
- [ ] Activity sync
- [ ] Heart rate data import
- [ ] Training load correlation

### Phase 5: Advanced Features 📊
- [ ] Deload auto-detection
- [ ] Fatigue monitoring
- [ ] Exercise substitution suggestions
- [ ] Progress analytics and charts
- [ ] Export/backup functionality

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

1. **Persisted state conflicts** - If onboarding steps change, clear localStorage (`hybrid-onboarding` key) or the app handles it via merge function
2. **SWC binary** - Build may fail on some ARM64 Linux environments due to missing SWC binaries

---

## Contributing

This is a personal project but feel free to fork and adapt for your own training needs.

## License

MIT
