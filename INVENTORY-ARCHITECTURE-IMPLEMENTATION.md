# Session Inventory Architecture - Implementation Guide

## Overview

This document outlines the implementation of the flexible, calendar-independent training programming system. This architecture decouples training sessions from fixed calendar weeks, allowing users to schedule training based on their availability.

## What's Been Built

### ✅ Phase 1: Database Foundation

**Created:**
- `010_session_inventory_architecture.sql` - Complete database migration with 4 new tables:
  - `session_inventory` - Unscheduled training sessions (logical week_number, no dates)
  - `training_constraints` - User scheduling preferences and rest days
  - `session_assessments` - Post-session feedback and AI coaching analysis
  - `coaching_adjustments` - Pending or resolved modifications from coaches

**Key Features:**
- Sessions use `week_number` (1, 2, 3...) instead of calendar dates
- `scheduled_date` column (nullable) - NULL = unscheduled inventory
- `session_priority` (1=must-do, 2=recommended, 3=optional)
- Carry-over notes from previous sessions
- Adjustment queue for coach-suggested modifications

### ✅ Phase 2: TypeScript Types

**Created:**
- `src/lib/types/inventory.types.ts` - Complete type definitions:
  - `SessionInventory` - Unscheduled session structure
  - `TrainingConstraints` - User availability preferences
  - `SessionAssessment` - Post-session check-in data
  - `CoachingAdjustment` - Modification queue item
  - Helper types for allocation and display

### ✅ Phase 3: Server Actions

**Created:**
- `src/lib/actions/inventory.actions.ts` - Complete CRUD operations:
  - `generateMesocycleInventory()` - Generate full block (placeholder)
  - `getUnscheduledInventory()` - Fetch grouped by week
  - `suggestAllocation()` - AI-suggested scheduling with interference rules
  - `applyAllocation()` - Batch schedule sessions
  - `scheduleSession()` - Manually schedule one session
  - `unscheduleSession()` - Move session back to inventory

**Allocation Logic:**
- Respects rest days (`unavailable_days`)
- Applies interference rules (e.g., rest day after heavy squats before run)
- Suggests optimal spacing
- Generates warnings for high training load

### ✅ Phase 4: UI Components

**Created:**
- `src/components/dashboard/UnscheduledInventory.tsx` - Main inventory view:
  - Grouped by week, collapsible sections
  - Shows session details, duration, load budget
  - Carry-over notes display
  - "Allocate Week" and individual "Schedule" buttons
  - Priority badges (Recommended, Optional)
  - Approval status indicators

---

## What Needs to Be Done

### 🔨 Phase 5: Integration (Next Steps)

#### 1. Run the Migration
```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
npx supabase migration up
```

#### 2. Update AI Programming Pipeline

**Modify:** `src/lib/actions/programming.actions.ts`

**Current flow:**
```typescript
generateSessionPool(microcycleId)
  → AI generates sessions
  → Creates workouts with scheduled_date
```

**New flow:**
```typescript
generateMesocycleInventory(mesocycleId, weekCount)
  → AI generates FULL BLOCK (all weeks)
  → Creates session_inventory entries (scheduled_date = NULL)
  → User allocates week-by-week
```

**Changes needed:**
- Extract AI programming logic from `generateSessionPool`
- Loop through all weeks (1 to weekCount)
- Insert into `session_inventory` instead of `workouts`
- Don't set `scheduled_date` yet

**Pseudocode:**
```typescript
export async function generateMesocycleInventory(
    mesocycleId: string,
    weekCount: number
): Promise<ActionResult<{ sessions: SessionInventory[] }>> {
    // 1. Load athlete context (same as generateSessionPool)
    // 2. Call Head Coach → get mesocycle strategy
    // 3. For each week (1 to weekCount):
    //    - Call domain coaches (strength, endurance, etc.)
    //    - For each session in week:
    //      - Insert into session_inventory with:
    //        - week_number = current week
    //        - scheduled_date = NULL
    //        - is_approved = false
    // 4. Return all created sessions
}
```

#### 3. Add Allocation Modal

**Create:** `src/components/dashboard/AllocationModal.tsx`

**Purpose:** Shows AI-suggested schedule, allows user to accept/modify before applying.

**Features:**
- Calendar view of suggested dates
- Drag-and-drop to adjust dates
- Warnings display (e.g., "3 consecutive training days")
- Accept button → calls `applyAllocation()`

**Flow:**
1. User clicks "Allocate Week 1" button
2. Modal opens, calls `suggestAllocation(mesocycleId, 1, userStartDate)`
3. Shows calendar with suggestions
4. User can drag sessions to different days
5. User clicks "Accept" → calls `applyAllocation()`
6. Sessions get `scheduled_date` set
7. Modal closes, dashboard refreshes

#### 4. Update Dashboard

**Modify:** `src/components/dashboard/SessionPoolClient.tsx`

**Add UnscheduledInventory section:**
```tsx
import { UnscheduledInventory } from './UnscheduledInventory'
import { AllocationModal } from './AllocationModal'

export function SessionPoolClient({ ... }) {
    const [allocationWeek, setAllocationWeek] = useState<number | null>(null)

    // Fetch unscheduled inventory
    const inventoryResult = await getUnscheduledInventory(mesocycleId)

    return (
        <div>
            {/* Existing calendar view */}

            {/* NEW: Unscheduled Inventory */}
            {inventoryResult.success && (
                <UnscheduledInventory
                    inventory={inventoryResult.data}
                    onAllocateWeek={(week) => setAllocationWeek(week)}
                    onScheduleSession={(sessionId) => {
                        // Open date picker for single session
                    }}
                />
            )}

            {/* NEW: Allocation Modal */}
            <AllocationModal
                isOpen={allocationWeek !== null}
                weekNumber={allocationWeek}
                mesocycleId={mesocycleId}
                onClose={() => setAllocationWeek(null)}
                onComplete={() => {
                    setAllocationWeek(null)
                    router.refresh()
                }}
            />
        </div>
    )
}
```

#### 5. Update Week Regeneration

**Modify:** `src/components/dashboard/SessionRegenDrawer.tsx`

**Add week number selector:**
```tsx
<select
    value={selectedWeek}
    onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
>
    {Array.from({ length: weekCount }, (_, i) => i + 1).map(week => (
        <option key={week} value={week}>Week {week}</option>
    ))}
</select>
```

**Update regenerate function:**
```typescript
async function regenerateWeek(weekNumber: number) {
    // Delete inventory for this week only
    await supabase
        .from('session_inventory')
        .delete()
        .eq('mesocycle_id', mesocycleId)
        .eq('week_number', weekNumber)
        .is('scheduled_date', null)  // Only delete unscheduled

    // Regenerate inventory for this week
    await generateWeekInventory(mesocycleId, weekNumber)
}
```

---

## Testing Plan

### Step 1: Database Migration
```bash
npx supabase migration up
npx supabase db pull  # Verify types generated
```

### Step 2: Generate Test Inventory
```typescript
// In Supabase SQL Editor or via migration
INSERT INTO session_inventory (mesocycle_id, user_id, week_number, modality, name, ...)
VALUES
    ('...', '...', 1, 'LIFTING', 'Lower Body Strength', ...),
    ('...', '...', 1, 'CARDIO', 'Zone 2 Run', ...),
    ...
```

### Step 3: Test Inventory Display
- Navigate to dashboard
- Verify UnscheduledInventory component renders
- Verify week grouping works
- Verify expand/collapse functionality

### Step 4: Test Allocation
- Click "Allocate Week 1"
- Verify allocation modal opens
- Verify suggestions follow interference rules
- Accept allocation
- Verify sessions get `scheduled_date` set
- Verify they appear in calendar

### Step 5: Test Drag-and-Drop (Future)
- Drag session from inventory to calendar date
- Verify `scheduled_date` updates
- Drag scheduled session to different date
- Verify update works

---

## Migration Path for Existing Users

### Option A: Fresh Start
1. Run migration
2. Mark existing workouts as "legacy" (add `is_legacy` flag)
3. Generate new inventory for next block
4. Continue with inventory system going forward

### Option B: Migrate Existing Data
```sql
-- Convert existing workouts → session_inventory
INSERT INTO session_inventory (
    mesocycle_id, user_id, week_number, modality, name,
    scheduled_date, completed_at, ...
)
SELECT
    microcycle.mesocycle_id,
    w.user_id,
    microcycle.week_number,
    w.modality,
    w.name,
    w.scheduled_date,
    w.completed_at,
    ...
FROM workouts w
JOIN microcycles microcycle ON w.microcycle_id = microcycle.id;

-- Link back to workouts
UPDATE workouts
SET session_inventory_id = (
    SELECT id FROM session_inventory
    WHERE session_inventory.scheduled_date = workouts.scheduled_date
    AND session_inventory.user_id = workouts.user_id
    LIMIT 1
);
```

---

## Onboarding Flow Changes

### Current Onboarding:
1. Collect profile data
2. Generate Week 1 immediately
3. Auto-allocate to this week

### New Onboarding:
1. Collect profile data
2. **Ask:** "How long should this training block be?" → 4/6/8/12 weeks
3. **Ask:** "Which days can you train?" → Select available days
4. **Ask:** "When do you want to start?" → Pick start date
5. Generate FULL BLOCK inventory (all weeks unscheduled)
6. Show Week 1 inventory for review/approval
7. User clicks "Allocate Week 1"
8. AI suggests schedule based on preferences
9. User accepts/modifies
10. Sessions allocated to calendar
11. Training begins

---

## Daily Coaching Loop (Phase C)

### Post-Session Assessment Flow:

**1. After workout completion:**
```tsx
<PostSessionAssessment
    workoutId={workoutId}
    onSubmit={async (assessment) => {
        await createAssessment(workoutId, assessment)
        // Triggers daily coach review
    }}
/>
```

**2. Daily coach review (server-side):**
```typescript
async function dailyCoachReview(workoutId: string) {
    // 1. Load workout + exercise_sets
    // 2. Compare actual vs target (RPE, RIR, weights)
    // 3. Generate performance summary
    // 4. If divergence detected:
    //    - Create coaching_adjustment for next session
    //    - Add carry_over_notes to next session's inventory
    // 5. Save session_assessment
}
```

**3. Next session display:**
```tsx
{session.adjustment_pending && (
    <AdjustmentBanner
        adjustment={session.adjustment_pending}
        onAccept={() => applyAdjustment(session.id)}
        onOverride={() => rejectAdjustment(session.id)}
    />
)}
```

---

## Summary

**What's Ready:**
- ✅ Database schema (4 new tables)
- ✅ TypeScript types
- ✅ Server actions for CRUD
- ✅ UI component for inventory display
- ✅ Allocation suggestion algorithm

**What's Next:**
1. Run migration
2. Update AI programming to generate inventory
3. Build AllocationModal
4. Integrate into dashboard
5. Add week selector to regeneration
6. Test allocation flow
7. Build post-session assessment (Phase C)
8. Build daily coaching review (Phase C)

**Your Current Situation:**
- You have 9 unallocated sessions from recent regeneration
- Once migration runs, you can manually insert these as inventory
- Then test the allocation flow before updating AI programming

Let me know if you want to:
1. Run the migration now
2. Test with manual inventory entries
3. Build the AllocationModal component
4. Something else

Ready to proceed?
