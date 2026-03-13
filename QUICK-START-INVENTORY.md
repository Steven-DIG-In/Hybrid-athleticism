# Quick Start: Session Inventory System

## What's Been Built

✅ **Database Schema** (`010_session_inventory_architecture.sql`)
- 4 new tables: session_inventory, training_constraints, session_assessments, coaching_adjustments
- Complete RLS policies

✅ **TypeScript Types** (`src/lib/types/inventory.types.ts`)
- All interfaces for new architecture

✅ **Inventory Actions** (`src/lib/actions/inventory.actions.ts`)
- getUnscheduledInventory() - Fetch sessions grouped by week
- suggestAllocation() - AI scheduling suggestions
- applyAllocation() - Batch schedule sessions
- scheduleSession() / unscheduleSession() - Manual control

✅ **Inventory Generation** (`src/lib/actions/inventory-generation.actions.ts`)
- generateMesocycleInventory() - Create full block inventory
- regenerateWeekInventory() - Regenerate specific week only

✅ **UI Component** (`src/components/dashboard/UnscheduledInventory.tsx`)
- Display grouped by week
- Allocate/Schedule buttons

---

## To Test Right Now

### 1. Apply Migration (Supabase Dashboard)

**Open:** [Supabase Dashboard](https://supabase.com) → Your Project → SQL Editor

**Run this SQL:**
```sql
-- Copy entire contents of:
-- supabase/migrations/010_session_inventory_architecture.sql
-- Paste and execute
```

**Verify tables created:**
- Go to Table Editor
- Should see: session_inventory, training_constraints, session_assessments, coaching_adjustments

---

### 2. Generate Test Inventory

**In Supabase SQL Editor, run:**

```sql
-- Get your user_id and mesocycle_id
SELECT
    u.id as user_id,
    m.id as mesocycle_id,
    m.name as mesocycle_name
FROM auth.users u
CROSS JOIN mesocycles m
WHERE m.user_id = u.id
AND m.is_active = true
LIMIT 1;
```

**Copy the IDs, then run (replace with your IDs):**

```sql
-- Insert test inventory sessions for Week 1
INSERT INTO session_inventory (
    mesocycle_id, user_id, week_number, session_priority,
    modality, name, coach_notes, estimated_duration_minutes,
    load_budget, scheduled_date, is_approved
) VALUES
    ('YOUR_MESOCYCLE_ID', 'YOUR_USER_ID', 1, 1, 'LIFTING', 'Lower Body Strength',
     'Focus on compound movements. Build foundation strength.', 60, 7.5, NULL, false),

    ('YOUR_MESOCYCLE_ID', 'YOUR_USER_ID', 1, 1, 'LIFTING', 'Upper Body Push',
     'Chest, shoulders, and triceps. Maintain strict form.', 60, 7.0, NULL, false),

    ('YOUR_MESOCYCLE_ID', 'YOUR_USER_ID', 1, 1, 'CARDIO', 'Zone 2 Easy Run',
     'SESSION:\n6km @ 6:15/km\n\nZONE_2 · running · ~38 min\n\nEasy conversational pace. Build aerobic base.', 40, 4.0, NULL, false),

    ('YOUR_MESOCYCLE_ID', 'YOUR_USER_ID', 1, 1, 'LIFTING', 'Upper Body Pull',
     'Back and biceps focus. Pull exercises for balanced development.', 60, 6.5, NULL, false),

    ('YOUR_MESOCYCLE_ID', 'YOUR_USER_ID', 1, 2, 'METCON', 'CrossFit-Style Metcon',
     'WORKOUT:\n21-15-9\nThrusters @ 43kg\nPull-ups\n\nFOR_TIME · high · ~15 min', 20, 8.5, NULL, false);

-- Verify inserted
SELECT week_number, name, modality, scheduled_date
FROM session_inventory
WHERE user_id = 'YOUR_USER_ID'
ORDER BY week_number, session_priority;
```

---

### 3. Test UI Display

**Option A: Quick Test Component**

Create `src/app/test-inventory/page.tsx`:

```typescript
import { getUnscheduledInventory } from '@/lib/actions/inventory.actions'
import { UnscheduledInventory } from '@/components/dashboard/UnscheduledInventory'

export default async function TestInventoryPage() {
    // Replace with your mesocycle_id
    const result = await getUnscheduledInventory('YOUR_MESOCYCLE_ID')

    if (!result.success) {
        return <div>Error: {result.error}</div>
    }

    return (
        <div className="p-6 bg-black min-h-screen">
            <UnscheduledInventory
                inventory={result.data}
                onAllocateWeek={(week) => console.log('Allocate week:', week)}
                onScheduleSession={(id) => console.log('Schedule session:', id)}
            />
        </div>
    )
}
```

**Navigate to:** http://localhost:3000/test-inventory

**Should see:**
- Week 1 group with 5 sessions
- Collapsible section
- Session cards with duration and load budget
- "Allocate Week" button

---

### 4. Test Allocation

**In browser console:**

```javascript
// Get suggestions
const result = await fetch('/api/inventory/suggest', {
    method: 'POST',
    body: JSON.stringify({
        mesocycleId: 'YOUR_MESOCYCLE_ID',
        weekNumber: 1,
        startDate: '2026-03-12' // Tomorrow
    })
})
const data = await result.json()
console.log('Suggestions:', data)
```

---

### 5. Test Full Generation

**In Supabase SQL Editor:**

```sql
-- Find a microcycle for week 1
SELECT id FROM microcycles
WHERE user_id = 'YOUR_USER_ID'
AND week_number = 1
LIMIT 1;
```

**Then in your app, call:**

```typescript
import { generateMesocycleInventory } from '@/lib/actions/inventory-generation.actions'

// This will generate 6 weeks of inventory
const result = await generateMesocycleInventory('YOUR_MESOCYCLE_ID', 6)
console.log('Generated:', result)
```

**Verify in database:**

```sql
SELECT week_number, COUNT(*) as session_count
FROM session_inventory
WHERE mesocycle_id = 'YOUR_MESOCYCLE_ID'
GROUP BY week_number
ORDER BY week_number;
```

Should show sessions for weeks 1-6.

---

## Next Steps

1. **Apply migration** ✅ (do this first!)
2. **Insert test data** ✅
3. **Test UI display** ✅
4. **Test allocation** (manual SQL for now)
5. **Integrate into dashboard** (next session)
6. **Add allocation modal** (next session)
7. **Update regeneration UI** (next session)

---

## Current Status

**What works NOW:**
- ✅ Database schema
- ✅ Server actions for CRUD
- ✅ Inventory generation (converts workouts → inventory)
- ✅ Unscheduled inventory UI component
- ✅ Allocation suggestion algorithm

**What needs integration:**
- 🔨 Dashboard integration (add UnscheduledInventory component)
- 🔨 Allocation modal (UI for accepting/modifying suggestions)
- 🔨 Week selector in regeneration drawer
- 🔨 Onboarding flow update (ask for block duration)

**Your immediate action:**
1. Copy migration SQL to Supabase Dashboard
2. Run it
3. Insert test data
4. Test inventory display

Let me know when migration is applied and I'll help with next steps!
