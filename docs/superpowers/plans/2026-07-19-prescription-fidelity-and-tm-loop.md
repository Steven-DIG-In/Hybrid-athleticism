# Prescription Fidelity + Training-Max Loop Repair — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live workout surface show exactly what the coach prescribed (never a client-side recalculation), surface the 5/3/1 AMRAP set and true %TM, and repair the severed training-max feedback loop so main-lift TMs actually move with the athlete's performance.

**Architecture:** Three seams. (1) A single shared `normalizeExerciseKey()` becomes the only vocabulary for training-max storage and lookup, replacing three disagreeing key conventions. (2) `exercise_sets` gains an `is_amrap` column so the max-effort set survives generation → storage → logger instead of dying as English in `notes`. (3) `WorkoutLogger` becomes a pure renderer of the stored prescription — it never derives a weight — and `completeWorkout` returns a recalibration summary that the logger renders as a session-close screen.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase (Postgres 17), Vitest 4, Tailwind 4.

## Global Constraints

- **`exercise_sets.target_*` columns are WRITE-ONCE**, owned by generation. The execution surface must never write targets. (Existing contract at `src/lib/actions/logging.actions.ts:87-90` — do not weaken it.)
- **Never run destructive tests against live data.** Steven's Supabase auth user `incubatepro@gmail.com` is the single production row and he is actively training. No `DELETE`/wipe scoped to a live user id. Use `vi.mock` + `vi.hoisted` in-memory Supabase mocks (reference: `src/lib/actions/__tests__/log-off-plan.test.ts`), or additive-only fixtures cleaned by explicit id.
- **The training-max rekey migration (Task 2) must be non-destructive.** Existing `profiles.training_maxes` entries that are not main lifts are *preserved untouched*, not deleted.
- **Prod deploy = `git push origin main`.** Gate before pushing: `npm install` first (local `node_modules` misses `garmin-connect` + `@react-pdf/renderer`), then full `npx vitest run` and `npx next build` both green.
- **Supabase type regen clobbers hand-written aliases.** After applying any migration, snapshot the hand-written alias appendix at the end of `src/lib/types/database.types.ts` before regenerating, and re-append it after. See `~/.claude/memory/feedback/supabase-type-regen-clobbers-aliases.md`.
- **Migration numbering:** next sequential file is `024_`. Latest existing is `023_workouts_endurance_prescription.sql`.
- Canonical main-lift keys are exactly the four strength keys already in `src/lib/athlete/capability-registry.ts`: `back_squat`, `bench_press`, `deadlift`, `overhead_press`.

---

## File Structure

**Create:**
- `src/lib/training/exercise-key.ts` — the single normalizer. Pure, no I/O, no `'use server'`.
- `src/lib/training/__tests__/exercise-key.test.ts`
- `supabase/migrations/025_exercise_sets_is_amrap.sql`
- `supabase/migrations/024_normalize_training_max_keys.sql`
- `src/components/workout/SessionSummary.tsx` — session-close screen.

**Modify:**
- `src/lib/actions/training-maxes.actions.ts` — normalize on read + write; skip non-main lifts.
- `src/lib/actions/recalibrate-from-top-set.actions.ts` — group by normalized key, prefer AMRAP set, derive rpe from `rir_actual`, return a summary.
- `src/lib/actions/workout.actions.ts:327-331` — await recalibration, return summary.
- `src/lib/engine/_shared/methodology-context.ts:69-96` — look up TM by normalized key; stop gating 5/3/1 behind `if (bm)`.
- `src/lib/engine/mesocycle/context.ts:345-390` — same lookup, unified precedence.
- `src/lib/ai/schemas/programming.ts` + `src/lib/ai/schemas/week-brief.ts` — add `isAmrap`.
- `src/lib/engine/microcycle/persistence.ts:130-170` — persist `is_amrap`.
- `src/components/workout/WorkoutLogger.tsx` — remove the weight override; render AMRAP, %TM, ramp; show summary.
- `src/app/log-session/page.tsx` — load training maxes and pass to logger.

---

### Task 1: The shared exercise-key normalizer

The root cause of the severed loop. `setTrainingMax` writes `"Back Squat"`; readers ask for `'Squat'` and `'OHP'`. Exact JSONB string match, so they never meet. One normalizer, used by both sides.

**Files:**
- Create: `src/lib/training/exercise-key.ts`
- Test: `src/lib/training/__tests__/exercise-key.test.ts`

**Interfaces:**
- Consumes: `CAPABILITY_REGISTRY` from `src/lib/athlete/capability-registry.ts` (keys only — do not import server code).
- Produces: `normalizeExerciseKey(name: string): MainLiftKey | null` and `type MainLiftKey = 'back_squat' | 'bench_press' | 'deadlift' | 'overhead_press'`. Tasks 2, 3 and 6 all call this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/training/__tests__/exercise-key.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeExerciseKey } from '../exercise-key'

describe('normalizeExerciseKey', () => {
    it('maps the four main lifts from their canonical display names', () => {
        expect(normalizeExerciseKey('Back Squat')).toBe('back_squat')
        expect(normalizeExerciseKey('Bench Press')).toBe('bench_press')
        expect(normalizeExerciseKey('Deadlift')).toBe('deadlift')
        expect(normalizeExerciseKey('Overhead Press')).toBe('overhead_press')
    })

    it('maps the short forms the generation readers use', () => {
        expect(normalizeExerciseKey('Squat')).toBe('back_squat')
        expect(normalizeExerciseKey('OHP')).toBe('overhead_press')
        expect(normalizeExerciseKey('Bench')).toBe('bench_press')
    })

    it('strips parenthetical qualifiers so variants collapse to the parent lift', () => {
        expect(normalizeExerciseKey('Back Squat (Warm-up)')).toBe('back_squat')
        expect(normalizeExerciseKey('Back Squat (FSL)')).toBe('back_squat')
        expect(normalizeExerciseKey('Deadlift (Supplemental BBB)')).toBe('deadlift')
        expect(normalizeExerciseKey('Bench Press (Warm-up)')).toBe('bench_press')
    })

    it('tolerates barbell prefixes and loose whitespace/casing', () => {
        expect(normalizeExerciseKey('Barbell Back Squat')).toBe('back_squat')
        expect(normalizeExerciseKey('  BARBELL   BENCH PRESS ')).toBe('bench_press')
    })

    it('returns null for accessories so they never pollute training_maxes', () => {
        expect(normalizeExerciseKey('Romanian Deadlift')).toBeNull()
        expect(normalizeExerciseKey('Single-Leg Romanian Deadlift')).toBeNull()
        expect(normalizeExerciseKey('Bulgarian Split Squat')).toBeNull()
        expect(normalizeExerciseKey('Front Squat')).toBeNull()
        expect(normalizeExerciseKey('Kettlebell Goblet Squat')).toBeNull()
        expect(normalizeExerciseKey('Hanging Leg Raises')).toBeNull()
    })

    it('returns null for empty or junk input', () => {
        expect(normalizeExerciseKey('')).toBeNull()
        expect(normalizeExerciseKey('   ')).toBeNull()
    })
})
```

Note the accessory cases: `Romanian Deadlift` must NOT become `deadlift`, and `Front Squat` / `Bulgarian Split Squat` / `Kettlebell Goblet Squat` must NOT become `back_squat`. These are genuinely different lifts with different maxes. This forces exact-phrase matching after qualifier-stripping rather than substring matching.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/training/__tests__/exercise-key.test.ts`
Expected: FAIL — `Failed to resolve import "../exercise-key"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/training/exercise-key.ts`:

```ts
/**
 * Single vocabulary for main-lift identity.
 *
 * The training-max loop was severed because the writer keyed on raw
 * `exercise_sets.exercise_name` ("Back Squat") while readers looked up
 * 'Squat' / 'OHP'. Every training-max read and write now goes through here.
 *
 * Returns null for anything that is not one of the four main lifts —
 * accessories progress via the week-to-week LLM loop, not via training maxes,
 * and writing TMs for them only pollutes `profiles.training_maxes`.
 */

export type MainLiftKey =
    | 'back_squat'
    | 'bench_press'
    | 'deadlift'
    | 'overhead_press'

/**
 * Exact phrases only. Substring matching is unsafe here: "Romanian Deadlift"
 * contains "deadlift" but is a different lift with a different max, and
 * "Front Squat" / "Bulgarian Split Squat" are not the back squat.
 */
const MAIN_LIFT_PHRASES: Record<string, MainLiftKey> = {
    'back squat': 'back_squat',
    'squat': 'back_squat',
    'bench press': 'bench_press',
    'bench': 'bench_press',
    'deadlift': 'deadlift',
    'conventional deadlift': 'deadlift',
    'overhead press': 'overhead_press',
    'ohp': 'overhead_press',
    'shoulder press': 'overhead_press',
    'strict press': 'overhead_press',
}

/** Equipment prefixes that don't change lift identity. */
const STRIPPABLE_PREFIXES = ['barbell', 'bb']

export function normalizeExerciseKey(name: string): MainLiftKey | null {
    if (!name) return null

    let s = name
        .toLowerCase()
        // Drop parenthetical qualifiers: "(Warm-up)", "(FSL)", "(Supplemental BBB)".
        .replace(/\([^)]*\)/g, ' ')
        // Drop trailing em-dash / hyphen annotations: "Back Squat — AMRAP".
        .replace(/[—–-]\s*[^-—–]*$/, m => (m.includes('leg') || m.includes('arm') ? m : ' '))
        .replace(/\s+/g, ' ')
        .trim()

    for (const prefix of STRIPPABLE_PREFIXES) {
        if (s.startsWith(`${prefix} `)) s = s.slice(prefix.length + 1).trim()
    }

    return MAIN_LIFT_PHRASES[s] ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/training/__tests__/exercise-key.test.ts`
Expected: PASS, 6 tests.

If the em-dash rule proves too clever and breaks a case, simplify it to `.replace(/\s*[—–]\s*.*$/, ' ')` (em/en dash only, leaving hyphens alone so "Single-Leg" survives) and re-run.

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/exercise-key.ts src/lib/training/__tests__/exercise-key.test.ts
git commit -m "feat(training): single normalizeExerciseKey vocabulary for main lifts"
```

---

### Task 2: Route all training-max reads and writes through the normalizer

**Files:**
- Modify: `src/lib/actions/training-maxes.actions.ts`
- Create: `supabase/migrations/024_normalize_training_max_keys.sql`
- Test: `src/lib/actions/__tests__/training-maxes-normalization.test.ts`

**Interfaces:**
- Consumes: `normalizeExerciseKey`, `MainLiftKey` from Task 1.
- Produces: `getTrainingMax(exercise: string)` and `setTrainingMax({exercise, trainingMaxKg, source})` keep their existing signatures but now key on `MainLiftKey`. `setTrainingMax` returns `TrainingMaxEntry | null` — **null when the exercise is not a main lift** (callers must tolerate null). Task 6 relies on this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/actions/__tests__/training-maxes-normalization.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockState, mockFrom } = vi.hoisted(() => {
    const mockState = { profile: { training_maxes: {} as Record<string, unknown> } }
    const mockFrom = vi.fn()
    return { mockState, mockFrom }
})

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
        from: mockFrom,
    }),
}))
vi.mock('@/lib/athlete/capabilities.actions', () => ({
    recordCapability: vi.fn(async () => undefined),
}))

import { getTrainingMax, setTrainingMax } from '../training-maxes.actions'

beforeEach(() => {
    mockState.profile = { training_maxes: {} }
    mockFrom.mockImplementation(() => ({
        select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockState.profile, error: null }) }),
        }),
        update: (patch: { training_maxes: Record<string, unknown> }) => {
            mockState.profile.training_maxes = patch.training_maxes
            return { eq: async () => ({ error: null }) }
        },
    }))
})

describe('training-max key normalization', () => {
    it('stores under the canonical key regardless of the display name used', async () => {
        await setTrainingMax({ exercise: 'Back Squat', trainingMaxKg: 78.5, source: 'recalibration' })
        expect(Object.keys(mockState.profile.training_maxes)).toEqual(['back_squat'])
    })

    it('closes the loop: written as "Back Squat", read as "Squat"', async () => {
        await setTrainingMax({ exercise: 'Back Squat', trainingMaxKg: 78.5, source: 'recalibration' })
        const found = await getTrainingMax('Squat')
        expect(found?.trainingMaxKg).toBe(78.5)
    })

    it('closes the loop for OHP too', async () => {
        await setTrainingMax({ exercise: 'Overhead Press', trainingMaxKg: 49.5, source: 'recalibration' })
        expect((await getTrainingMax('OHP'))?.trainingMaxKg).toBe(49.5)
    })

    it('collapses warm-up and supplemental variants onto the parent lift', async () => {
        await setTrainingMax({ exercise: 'Back Squat (Warm-up)', trainingMaxKg: 31.5, source: 'recalibration' })
        expect(Object.keys(mockState.profile.training_maxes)).toEqual(['back_squat'])
    })

    it('refuses to write a training max for an accessory', async () => {
        const res = await setTrainingMax({ exercise: 'Romanian Deadlift', trainingMaxKg: 87, source: 'recalibration' })
        expect(res).toBeNull()
        expect(mockState.profile.training_maxes).toEqual({})
    })

    it('returns null when reading an accessory', async () => {
        expect(await getTrainingMax('Bulgarian Split Squat')).toBeNull()
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/actions/__tests__/training-maxes-normalization.test.ts`
Expected: FAIL — first test gets `['Back Squat']`, not `['back_squat']`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/actions/training-maxes.actions.ts`, add the import below the existing ones:

```ts
import { normalizeExerciseKey } from '@/lib/training/exercise-key'
```

Replace the body of `getTrainingMax` after the auth guard:

```ts
    const key = normalizeExerciseKey(exercise)
    if (!key) return null

    const { data, error } = await supabase
        .from('profiles')
        .select('training_maxes')
        .eq('id', user.id)
        .maybeSingle()
    if (error) throw error
    const map = (data?.training_maxes ?? {}) as Record<string, TrainingMaxEntry>
    return map[key] ?? null
```

Change the `setTrainingMax` signature and key:

```ts
export async function setTrainingMax(input: SetTrainingMaxInput): Promise<TrainingMaxEntry | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('unauthenticated')

    // Only the four main lifts carry a training max. Accessories progress via
    // the week-to-week LLM loop; writing TMs for them polluted this map with
    // "Bench Press (Warm-up)" / "Back Squat (Supplemental BBB)" entries.
    const key = normalizeExerciseKey(input.exercise)
    if (!key) return null
```

then replace the merge line:

```ts
    const next = { ...current, [key]: entry }
```

and the write-through call, which should use the canonical label so the capability registry resolves it:

```ts
        await recordCapability({
            name: key.replace(/_/g, ' '),
            value: entry.trainingMaxKg,
            source: input.source === 'intervention_response' ? 'recalibration' : input.source,
            evidence: { from: 'training_max', source: input.source },
        })
```

(`'back_squat'` → `'back squat'`, which is an existing alias in `capability-registry.ts:26`. This also fixes break #3 — capabilities were being silently dropped by `recordCapability`'s unmapped-name warning.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/actions/__tests__/training-maxes-normalization.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the data migration**

Create `supabase/migrations/024_normalize_training_max_keys.sql`:

```sql
-- Rekey profiles.training_maxes onto canonical main-lift keys.
--
-- The writer stored raw exercise names ("Back Squat", "Overhead Press") while
-- readers looked up 'Squat' / 'OHP', so squat and OHP training maxes never
-- resolved and silently fell back to the onboarding benchmark forever.
--
-- NON-DESTRUCTIVE: entries that are not main lifts are preserved untouched.
-- Where several source names map to one canonical key, the most recently
-- updated entry wins.

with expanded as (
    select
        p.id as user_id,
        e.key as src_key,
        e.value as entry,
        case
            when lower(regexp_replace(e.key, '\([^)]*\)', '', 'g')) ~ '^\s*(barbell\s+)?(back\s+)?squat\s*$'
                then 'back_squat'
            when lower(regexp_replace(e.key, '\([^)]*\)', '', 'g')) ~ '^\s*(barbell\s+)?bench( press)?\s*$'
                then 'bench_press'
            when lower(regexp_replace(e.key, '\([^)]*\)', '', 'g')) ~ '^\s*(barbell\s+)?(conventional\s+)?deadlift\s*$'
                then 'deadlift'
            when lower(regexp_replace(e.key, '\([^)]*\)', '', 'g')) ~ '^\s*(barbell\s+)?(overhead press|ohp|shoulder press|strict press)\s*$'
                then 'overhead_press'
            else null
        end as canonical_key
    from profiles p,
         lateral jsonb_each(coalesce(p.training_maxes, '{}'::jsonb)) e
),
winners as (
    select distinct on (user_id, canonical_key)
        user_id, canonical_key, entry
    from expanded
    where canonical_key is not null
    -- Unqualified names win over parenthetical variants REGARDLESS of recency.
    -- Steven's data proves why: "Overhead Press" = 49.5 (2026-04-24) but
    -- "Overhead Press (Supplemental BBB)" = 39 (2026-06-20). Recency alone
    -- would crown the supplemental BBB load as his OHP training max.
    order by user_id, canonical_key, (src_key ~ '\(') asc, (entry->>'updatedAt') desc nulls last
),
rekeyed as (
    select user_id, jsonb_object_agg(canonical_key, entry) as main_lifts
    from winners group by user_id
),
preserved as (
    select user_id, jsonb_object_agg(src_key, entry) as others
    from expanded where canonical_key is null group by user_id
)
update profiles p
set training_maxes =
        coalesce((select others from preserved where user_id = p.id), '{}'::jsonb)
     || coalesce((select main_lifts from rekeyed where user_id = p.id), '{}'::jsonb)
where exists (select 1 from expanded where user_id = p.id);
```

- [ ] **Step 6: Apply the migration and verify against live data**

Apply via the Supabase MCP `apply_migration` tool against project `kuqgtholljrxnbxtmrnz`.

Then verify:

```sql
select jsonb_object_keys(training_maxes) from profiles;
```

Expected: `back_squat`, `bench_press`, `deadlift`, `overhead_press` present, each once. Non-main-lift keys (`Romanian Deadlift`, `Front Squat`, `Barbell Curl`, …) still present and unchanged. `Bench Press (Warm-up)` should be GONE (it collapsed into `bench_press`) — confirm `bench_press` holds **59.5**, the 2026-06-04 entry, not the warm-up's 31.5.

```sql
select training_maxes->'back_squat'->>'trainingMaxKg' as squat,
       training_maxes->'bench_press'->>'trainingMaxKg' as bench,
       training_maxes->'deadlift'->>'trainingMaxKg'   as dl,
       training_maxes->'overhead_press'->>'trainingMaxKg' as ohp
from profiles;
```

Expected: `78.5 | 59.5 | 94.5 | 49.5`.

**If any value is wrong, stop and report — do not proceed.** This is production training data.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/training-maxes.actions.ts \
        src/lib/actions/__tests__/training-maxes-normalization.test.ts \
        supabase/migrations/024_normalize_training_max_keys.sql
git commit -m "fix(training): key training maxes by canonical lift, repairing the read/write mismatch"
```

---

### Task 3: Make the generation readers use the normalizer

Two readers key on `'Squat'`/`'OHP'` and one on `'back squat'`. With Task 2 they now all resolve — but `methodology-context.ts` still refuses to emit a 5/3/1 protocol at all unless a matching `athlete_benchmarks` row exists (`if (bm)`), even when a fresh recalibrated TM is available. Fix both.

**Files:**
- Modify: `src/lib/engine/_shared/methodology-context.ts:69-96`
- Modify: `src/lib/engine/mesocycle/context.ts:345-390`
- Test: `src/lib/engine/_shared/__tests__/methodology-context-tm.test.ts`

**Interfaces:**
- Consumes: `getTrainingMax` (Task 2), `normalizeExerciseKey` (Task 1).
- Produces: no new exports. Behaviour change only.

- [ ] **Step 1: Write the failing test**

Create `src/lib/engine/_shared/__tests__/methodology-context-tm.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getTrainingMaxMock } = vi.hoisted(() => ({ getTrainingMaxMock: vi.fn() }))

vi.mock('@/lib/actions/training-maxes.actions', () => ({
    getTrainingMax: getTrainingMaxMock,
}))

import { resolveTrainingMaxForExercise } from '@/lib/training/methodology-helpers'

beforeEach(() => getTrainingMaxMock.mockReset())

describe('resolveTrainingMaxForExercise', () => {
    it('prefers a stored training max over the onboarding benchmark estimate', async () => {
        getTrainingMaxMock.mockResolvedValue({ trainingMaxKg: 78.5, updatedAt: '', source: 'recalibration' })
        // Benchmark says 105kg 1RM (=> ~94.5 TM); the stored TM must win.
        expect(await resolveTrainingMaxForExercise('Squat', 105, 1)).toBe(78.5)
    })

    it('resolves the stored max even when the caller uses a different display name', async () => {
        getTrainingMaxMock.mockResolvedValue({ trainingMaxKg: 49.5, updatedAt: '', source: 'recalibration' })
        expect(await resolveTrainingMaxForExercise('OHP', 60, 1)).toBe(49.5)
        expect(getTrainingMaxMock).toHaveBeenCalledWith('OHP')
    })

    it('falls back to the benchmark estimate when nothing is stored', async () => {
        getTrainingMaxMock.mockResolvedValue(null)
        const tm = await resolveTrainingMaxForExercise('Squat', 100, 1)
        expect(tm).toBeCloseTo(90, 0)
    })
})
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run src/lib/engine/_shared/__tests__/methodology-context-tm.test.ts`

`resolveTrainingMaxForExercise` already delegates to `getTrainingMax`, so tests 1 and 3 should PASS immediately. Test 2 documents that the *normalizer inside `getTrainingMax`* (Task 2) is what makes `'OHP'` resolve. If all three pass, that is the correct outcome — this test is a regression guard for the Task 2 seam. Record the result and continue.

- [ ] **Step 3: Remove the `if (bm)` gate in `methodology-context.ts`**

In `src/lib/engine/_shared/methodology-context.ts`, replace the `for (const [displayName, keywords] of liftMap)` body (currently lines ~79-90):

```ts
        for (const [displayName, keywords] of liftMap) {
            const bm = benchmarks.find(b =>
                keywords.some(kw => b.benchmark_name.toLowerCase().includes(kw))
            )
            // A stored training max is authoritative and must not require a
            // benchmark row to exist — recalibration keeps it fresher than
            // onboarding ever was. Fall back to the benchmark only when no TM
            // is stored, and skip the lift entirely when we have neither.
            const stored = await getTrainingMax(displayName)
            let tm: number | null = null
            if (stored) {
                tm = stored.trainingMaxKg
            } else if (bm) {
                tm = await resolveTrainingMaxForExercise(displayName, bm.value, 1)
            }
            if (tm == null) continue

            const wave = calculate531Wave(tm, weekInCycle)
            const setsStr = wave.sets.map(s =>
                `${s.reps}${s.isAmrap ? '+' : ''} @ ${s.weightKg}kg (${Math.round(s.percentTM * 100)}%TM)`
            ).join(', ')
            lines.push(`  ${displayName} (TM: ${tm}kg): ${wave.weekLabel} — ${setsStr}`)
        }
```

Add the import at the top of the file:

```ts
import { getTrainingMax } from '@/lib/actions/training-maxes.actions'
```

- [ ] **Step 4: Unify precedence in `mesocycle/context.ts`**

`src/lib/engine/mesocycle/context.ts:358-382` prefers `athlete_capabilities` over `profiles.training_maxes`, while the pool path ignores capabilities entirely. Since `setTrainingMax` now write-throughs to both (Task 2, Step 3), they agree — but make the precedence explicit and identical. Replace the TM resolution inside `buildStrengthMethodologyContext`'s lift loop with the same block as Step 3 (stored TM → benchmark → skip), dropping the `trainingMaxFromCapability` branch.

Add a comment recording the decision:

```ts
// Precedence is intentionally identical to buildMethodologyContext:
// stored training max → onboarding benchmark estimate → skip the lift.
// Capabilities are a write-through mirror of training_maxes (see
// setTrainingMax), not an independent source, so reading them here would
// only reintroduce drift.
```

- [ ] **Step 5: Run the full engine suite**

Run: `npx vitest run src/lib/engine`
Expected: PASS. If a snapshot test on prompt text fails because a lift now appears that previously didn't, inspect the diff — a *new* lift line appearing is the intended fix; update the snapshot. Any other change, stop and report.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/_shared/methodology-context.ts \
        src/lib/engine/mesocycle/context.ts \
        src/lib/engine/_shared/__tests__/methodology-context-tm.test.ts
git commit -m "fix(engine): stored training max is authoritative and no longer needs a benchmark row"
```

---

### Task 4: Carry the AMRAP flag from generation to the database

The 5/3/1 skill emits `isAmrap` per set, but no AI schema, no column, and no UI carries it — it survives only as English in `notes` ("AMRAP set, push for 3-5 reps"). Give it a real column.

**Files:**
- Create: `supabase/migrations/025_exercise_sets_is_amrap.sql`
- Modify: `src/lib/ai/schemas/programming.ts` (`ExerciseSetSchema`)
- Modify: `src/lib/ai/schemas/week-brief.ts` (`StrengthExerciseSchema`)
- Modify: `src/lib/engine/microcycle/persistence.ts` (`insertLiftingSets`)
- Modify: `src/lib/ai/prompts/programming.ts` (instruct the model to set it)
- Test: `src/lib/engine/microcycle/__tests__/persistence-amrap.test.ts`

**Interfaces:**
- Produces: `exercise_sets.is_amrap boolean not null default false`; `ExerciseSetSchema.isAmrap?: boolean`. Task 5 reads the column; Task 6 prefers the AMRAP set when recalibrating.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/025_exercise_sets_is_amrap.sql`:

```sql
-- Surface the 5/3/1 max-effort set as structured data.
--
-- The 531-progression skill has always emitted isAmrap per set, but no AI
-- schema or column carried it, so the top set reached the athlete as a flat
-- rep target with the "+" only mentioned in free-text notes.
alter table exercise_sets
    add column if not exists is_amrap boolean not null default false;

comment on column exercise_sets.is_amrap is
    'True for max-effort (AMRAP / "+") sets — target_reps is a floor, not a cap.';

-- Backfill from the notes the coach has been writing all along.
update exercise_sets
set is_amrap = true
where is_amrap = false
  and notes is not null
  and (notes ilike '%amrap%' or notes ilike '%max effort%');
```

- [ ] **Step 2: Apply the migration and regenerate types**

Apply via Supabase MCP `apply_migration` on project `kuqgtholljrxnbxtmrnz`.

**Before regenerating types**, copy the hand-written alias appendix at the end of `src/lib/types/database.types.ts` to a scratch file — regen clobbers it (see Global Constraints). Regenerate, then re-append.

Verify the backfill caught your current week:

```sql
select exercise_name, set_number, target_weight_kg, is_amrap
from exercise_sets
where workout_id = 'b4c77c77-1a89-4e94-a85c-27c68008b723'
order by set_number;
```

Expected: `is_amrap = true` on Deadlift set 4 (85 kg) and Overhead Press set 8 (47.5 kg) — the two sets whose notes say "AMRAP set, push for 3-5 reps". Everything else false.

- [ ] **Step 3: Write the failing test**

Create `src/lib/engine/microcycle/__tests__/persistence-amrap.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { insertLiftingSets } from '../persistence'

function fakeSupabase(captured: { rows?: unknown[] }) {
    return {
        from: () => ({
            insert: async (rows: unknown[]) => { captured.rows = rows; return { error: null } },
        }),
    } as never
}

describe('insertLiftingSets — AMRAP', () => {
    it('persists isAmrap onto every set row of the exercise', async () => {
        const captured: { rows?: Array<Record<string, unknown>> } = {}
        await insertLiftingSets(fakeSupabase(captured), 'w1', 'u1', {
            name: 'Lower', modality: 'LIFTING', estimatedDurationMinutes: 60, coachNotes: null,
            exercises: [
                { exerciseName: 'Deadlift', muscleGroup: 'Back', sets: 1, targetReps: 3, targetWeightKg: 85, targetRir: 1, notes: null, isAmrap: true },
                { exerciseName: 'Deadlift (FSL)', muscleGroup: 'Back', sets: 2, targetReps: 5, targetWeightKg: 65, targetRir: 3, notes: null },
            ],
        } as never)

        expect(captured.rows).toHaveLength(3)
        expect(captured.rows![0].is_amrap).toBe(true)
        expect(captured.rows![1].is_amrap).toBe(false)
        expect(captured.rows![2].is_amrap).toBe(false)
    })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/lib/engine/microcycle/__tests__/persistence-amrap.test.ts`
Expected: FAIL — `expected undefined to be true`.

- [ ] **Step 5: Implement**

In `src/lib/ai/schemas/programming.ts`, add to `ExerciseSetSchema` after `isBenchmarkTest`:

```ts
    isAmrap: z.boolean().optional().describe('True if this is a max-effort / AMRAP ("+") set — the athlete pushes past targetReps. Required for the final set of a 5/3/1 wave.'),
```

Add the identical field to `StrengthExerciseSchema` in `src/lib/ai/schemas/week-brief.ts`.

In `src/lib/engine/microcycle/persistence.ts`, add `is_amrap: boolean` to the `rows` type declaration, and add to the pushed object:

```ts
                is_amrap: exercise.isAmrap ?? false,
```

In `src/lib/ai/prompts/programming.ts`, immediately after the `── METHODOLOGY-SPECIFIC TARGETS (use these exact numbers) ──` block (around line 169), append:

```
IMPORTANT: When the protocol above marks a set with "+" (e.g. "5+ @ 85kg"), that set is
an AMRAP / max-effort set. Emit it as its own exercise entry with "isAmrap": true and
targetReps set to the MINIMUM rep target. Never merge a "+" set with the sets before it —
each rung of the ramp is a separate entry with its own targetWeightKg.
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/engine/microcycle/__tests__/persistence-amrap.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/025_exercise_sets_is_amrap.sql \
        src/lib/ai/schemas/programming.ts src/lib/ai/schemas/week-brief.ts \
        src/lib/ai/prompts/programming.ts \
        src/lib/engine/microcycle/persistence.ts \
        src/lib/engine/microcycle/__tests__/persistence-amrap.test.ts \
        src/lib/types/database.types.ts
git commit -m "feat(strength): carry the 5/3/1 AMRAP flag from generation into exercise_sets"
```

---

### Task 5: The logger renders the prescription and never derives a weight

The bug Steven hit: completing set 1 at 65 kg overwrote set 2's prescribed 75 kg with 65 kg, then set 3's 85 kg with 75 kg. `WorkoutLogger.tsx:911-941` discards `nextSet.target_weight_kg` and substitutes `previous actual ± RIR nudge` — a double-progression rule applied to a fixed-percentage ramp.

**Files:**
- Modify: `src/components/workout/WorkoutLogger.tsx`
- Modify: `src/app/log-session/page.tsx`
- Test: `src/components/workout/__tests__/auto-suggest.test.ts`

**Interfaces:**
- Consumes: `exercise_sets.is_amrap` (Task 4); `getTrainingMax` (Task 2).
- Produces: `suggestNextSetWeight(...)` exported from `WorkoutLogger.tsx` for testability; `trainingMaxes` prop on `<WorkoutLogger>`.

- [ ] **Step 1: Write the failing test**

Create `src/components/workout/__tests__/auto-suggest.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { suggestNextSetWeight } from '../WorkoutLogger'

describe('suggestNextSetWeight', () => {
    it('returns null when the next set has a prescribed weight — the coach wins', () => {
        expect(suggestNextSetWeight({
            nextTargetWeightKg: 75, previousActualWeightKg: 65, actualRir: 3, targetRir: 3,
        })).toBeNull()
    })

    it('never overrides a ramp even when the athlete missed the target badly', () => {
        expect(suggestNextSetWeight({
            nextTargetWeightKg: 85, previousActualWeightKg: 75, actualRir: 0, targetRir: 2,
        })).toBeNull()
    })

    it('fills an unprescribed set from the previous actual, nudged by RIR', () => {
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 60, actualRir: 4, targetRir: 2,
        })).toBe(65)
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 60, actualRir: 3, targetRir: 2,
        })).toBe(62.5)
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 60, actualRir: 2, targetRir: 2,
        })).toBe(60)
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 60, actualRir: 0, targetRir: 2,
        })).toBe(55)
    })

    it('never suggests a negative weight', () => {
        expect(suggestNextSetWeight({
            nextTargetWeightKg: null, previousActualWeightKg: 2, actualRir: 0, targetRir: 2,
        })).toBe(0)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/workout/__tests__/auto-suggest.test.ts`
Expected: FAIL — `suggestNextSetWeight` is not exported.

- [ ] **Step 3: Extract and gate the suggestion**

In `src/components/workout/WorkoutLogger.tsx`, add near the other module-level helpers (above the component):

```ts
/**
 * Next-set weight suggestion.
 *
 * THE PRESCRIPTION ALWAYS WINS. If generation gave this set a weight, we show
 * that weight — full stop. Previously this function's ancestor overwrote the
 * next set's target with `previous actual ± RIR nudge`, which silently
 * destroyed every fixed-percentage ramp (5/3/1's 65 → 75 → 85 became
 * 65 → 65 → 65) and, worse, poisoned the week-to-week feedback loop: the
 * coach reads last week's ACTUALS to program the next week, so an accepted
 * bad suggestion regressed the athlete.
 *
 * The RIR nudge survives only for sets with no prescribed weight.
 */
export function suggestNextSetWeight(input: {
    nextTargetWeightKg: number | null
    previousActualWeightKg: number
    actualRir: number
    targetRir: number
}): number | null {
    if (input.nextTargetWeightKg != null) return null

    const rirDiff = input.actualRir - input.targetRir
    let suggested = input.previousActualWeightKg
    if (rirDiff >= 2) suggested += 5
    else if (rirDiff >= 1) suggested += 2.5
    else if (rirDiff <= -2) suggested -= 5
    else if (rirDiff <= -1) suggested -= 2.5

    return Math.max(0, suggested)
}
```

Then replace the auto-suggest block at `WorkoutLogger.tsx:911-941` — everything from `// Auto-suggest next set weight based on RIR feedback (Issue #11)` through the closing `}` of `if (nextSet) { ... }` — with:

```ts
                        // Auto-suggest next set weight (Issue #11) — only for
                        // sets generation left unprescribed. See suggestNextSetWeight.
                        const sameSets = workout.exercise_sets
                            .filter(s => s.exercise_name === set.exercise_name)
                            .sort((a, b) => a.set_number - b.set_number)
                        const nextSet = sameSets.find(s =>
                            s.set_number > set.set_number && s.actual_reps === null
                        )
                        if (nextSet) {
                            const suggested = suggestNextSetWeight({
                                nextTargetWeightKg: nextSet.target_weight_kg,
                                previousActualWeightKg: parseFloat(values.weight) || 0,
                                actualRir: values.rir,
                                targetRir: set.target_rir ?? 2,
                            })
                            if (suggested !== null) {
                                setLocalSets(prev => ({
                                    ...prev,
                                    [nextSet.id]: {
                                        ...prev[nextSet.id],
                                        weight: suggested.toString(),
                                        reps: prev[nextSet.id]?.reps ?? values.reps,
                                    }
                                }))
                            }
                        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/workout/__tests__/auto-suggest.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/workout/WorkoutLogger.tsx src/components/workout/__tests__/auto-suggest.test.ts
git commit -m "fix(logger): never overwrite a prescribed set weight with a client-side recalculation"
```

- [ ] **Step 6: Pass training maxes into the logger**

In `src/app/log-session/page.tsx`, after the workout is loaded, build a per-exercise TM map. Add the import:

```ts
import { getTrainingMax } from '@/lib/actions/training-maxes.actions'
```

and before rendering `<WorkoutLogger>`:

```tsx
    // Training maxes for the %TM display. Keyed by the raw exercise_name the
    // logger renders; getTrainingMax normalizes internally and returns null
    // for accessories, which the logger renders without a percentage.
    const exerciseNames = Array.from(
        new Set((workout.exercise_sets ?? []).map(s => s.exercise_name))
    )
    const trainingMaxes: Record<string, number> = {}
    await Promise.all(exerciseNames.map(async name => {
        const tm = await getTrainingMax(name)
        if (tm) trainingMaxes[name] = tm.trainingMaxKg
    }))
```

then pass `trainingMaxes={trainingMaxes}` to `<WorkoutLogger>`.

In `WorkoutLogger.tsx`, add `trainingMaxes?: Record<string, number>` to the component's props interface, defaulting to `{}`.

- [ ] **Step 7: Replace the working-max percentage with true %TM**

Replace the `workingMaxData` `useMemo` (`WorkoutLogger.tsx:811-826`) with:

```ts
    // Percentage is of the TRAINING MAX, not of the heaviest stored set.
    // The old version took max(target_weight_kg) across the exercise and
    // called it the working max, so a 65/75/85 ramp rendered 76%/88%/100%
    // instead of 70%/80%/90% — and a flat block always rendered 100%.
    const trainingMaxKg = trainingMaxes[currentExerciseName] ?? null
    const estimated1RM = useMemo(
        () => (trainingMaxKg ? Math.round((trainingMaxKg / 0.9) * 10) / 10 : null),
        [trainingMaxKg]
    )
```

Update the per-set percentage render (`:1490-1495`) to:

```tsx
                                        {trainingMaxKg && set.target_weight_kg && (
                                            <div className="text-[10px] font-mono text-cyan-400">
                                                {Math.round((set.target_weight_kg / trainingMaxKg) * 100)}%
                                            </div>
                                        )}
```

Update the "Est. 1RM" tile (`:1381-1394`) to read `estimated1RM` and to label the source, rendering `TM {trainingMaxKg}kg` alongside it. Where the tile previously rendered nothing because `workingMaxData` was null, render nothing still.

- [ ] **Step 8: Fix the TARGET LOAD tile and render the AMRAP badge**

Replace the TARGET LOAD tile body (`:1403-1408`) — it currently shows `activeSets[0].target_weight_kg`, i.e. the *lightest* rung of a ramp — with a range:

```tsx
                    <div className="flex-1 bg-[#0a0a0a] border border-[#222222] p-3 text-center">
                        <span className="block text-[10px] font-mono text-neutral-500 mb-1">TARGET LOAD</span>
                        <span className="text-lg font-space-grotesk font-bold">
                            {(() => {
                                const w = activeSets
                                    .map(s => s.target_weight_kg)
                                    .filter((x): x is number => x != null && x > 0)
                                if (!w.length) return '--'
                                const lo = Math.min(...w), hi = Math.max(...w)
                                return lo === hi ? `${lo} kg` : `${lo}–${hi} kg`
                            })()}
                        </span>
                    </div>
```

Apply the same treatment to TARGET REPS (`:1397-1402`), which has the identical `activeSets[0]` flaw.

In the per-set row (inside the `activeSets.map` at `:1449`), render the AMRAP badge next to the rep target:

```tsx
                                        {set.is_amrap && (
                                            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-mono font-bold
                                                             text-amber-400 border border-amber-400/50 bg-amber-400/10">
                                                {set.target_reps}+ MAX EFFORT
                                            </span>
                                        )}
```

- [ ] **Step 9: Verify in the running app**

Run `npm run dev`, open the Week 2 Deadlift session (`b4c77c77-1a89-4e94-a85c-27c68008b723`), and confirm by screenshot:
- Deadlift shows sets at **65 / 75 / 85 kg** with **70% / 80% / 90%** beside them.
- Set 3 carries the amber **3+ MAX EFFORT** badge.
- TARGET LOAD reads **65–85 kg**, not 65 kg.
- Logging set 1 at any weight leaves set 2's field showing **75**, unchanged.

Report the screenshot. Per `~/.claude/memory/confidence-gates.md`, a UI claim needs visual evidence.

- [ ] **Step 10: Commit**

```bash
git add src/components/workout/WorkoutLogger.tsx src/app/log-session/page.tsx
git commit -m "feat(logger): show true %TM, the full load ramp, and the AMRAP set"
```

---

### Task 6: Recalibration reads real effort and reports at session close

Three defects here: `rpe_actual` is never written by the logger so the effort correction is dead; `rir_actual` — the field the athlete *does* log — is never read; and the whole result is fire-and-forget with no UI, which is why "closing session should indicate potential new 1RM" has nowhere to render.

**Files:**
- Modify: `src/lib/actions/recalibrate-from-top-set.actions.ts`
- Modify: `src/lib/actions/workout.actions.ts:327-331`
- Create: `src/components/workout/SessionSummary.tsx`
- Modify: `src/components/workout/WorkoutLogger.tsx` (`handleEndWorkout`)
- Test: `src/lib/actions/__tests__/recalibrate-from-top-set.test.ts` (extend existing)

**Interfaces:**
- Consumes: `normalizeExerciseKey` (Task 1), `setTrainingMax` returning `| null` (Task 2), `exercise_sets.is_amrap` (Task 4).
- Produces: `interface RecalibrationSummaryEntry { exercise: string; previousTrainingMaxKg: number; observedTrainingMaxKg: number; estimated1RMKg: number; applied: boolean; isPR: boolean }` and `recalibrateFromTopSet(workoutId): Promise<RecalibrationSummaryEntry[]>`. `completeWorkout` returns `{ ...existing, recalibration: RecalibrationSummaryEntry[] }`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/actions/__tests__/recalibrate-from-top-set.test.ts` (follow the existing mock scaffolding in that file):

```ts
describe('recalibrateFromTopSet — effort and top-set selection', () => {
    it('derives rpe from rir_actual so logged effort reaches the estimator', async () => {
        // 85kg x 3 @ RIR 1 => rpe 9 => effectiveReps 4 => 1RM ~96.3 => TM ~86.5
        const summary = await runWith([
            { exercise_name: 'Deadlift', set_number: 4, is_amrap: true,
              target_weight_kg: 85, target_reps: 3,
              actual_weight_kg: 85, actual_reps: 3, rir_actual: 1, rpe_actual: null },
        ])
        expect(summary[0].observedTrainingMaxKg).toBeGreaterThan(85)
    })

    it('prefers the AMRAP set over a heavier-targeted non-AMRAP set', async () => {
        const summary = await runWith([
            { exercise_name: 'Deadlift', set_number: 3, is_amrap: false,
              target_weight_kg: 90, target_reps: 3,
              actual_weight_kg: 90, actual_reps: 3, rir_actual: 2, rpe_actual: null },
            { exercise_name: 'Deadlift', set_number: 4, is_amrap: true,
              target_weight_kg: 85, target_reps: 3,
              actual_weight_kg: 85, actual_reps: 8, rir_actual: 0, rpe_actual: null },
        ])
        // The 8-rep AMRAP is the real strength signal.
        expect(summary[0].estimated1RMKg).toBeGreaterThan(100)
    })

    it('groups warm-up and FSL variants under the parent lift', async () => {
        const summary = await runWith([
            { exercise_name: 'Back Squat (Warm-up)', set_number: 1, is_amrap: false,
              target_weight_kg: 52.5, target_reps: 5,
              actual_weight_kg: 52.5, actual_reps: 5, rir_actual: 4, rpe_actual: null },
            { exercise_name: 'Back Squat', set_number: 4, is_amrap: true,
              target_weight_kg: 85, target_reps: 3,
              actual_weight_kg: 85, actual_reps: 5, rir_actual: 1, rpe_actual: null },
        ])
        expect(summary).toHaveLength(1)
        expect(summary[0].exercise).toBe('Back Squat')
    })

    it('does not emit a summary entry for accessories', async () => {
        const summary = await runWith([
            { exercise_name: 'Romanian Deadlift', set_number: 8, is_amrap: false,
              target_weight_kg: 67.5, target_reps: 10,
              actual_weight_kg: 67.5, actual_reps: 10, rir_actual: 2, rpe_actual: null },
        ])
        expect(summary).toEqual([])
    })
})
```

Write the `runWith(sets)` helper in the same file: it seeds the mocked Supabase client with a `LIFTING` workout carrying those `exercise_sets`, calls `recalibrateFromTopSet('w1')`, and returns the resolved summary.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/actions/__tests__/recalibrate-from-top-set.test.ts`
Expected: FAIL — `recalibrateFromTopSet` currently resolves to `void`.

- [ ] **Step 3: Implement**

In `src/lib/actions/recalibrate-from-top-set.actions.ts`:

Add imports:

```ts
import { normalizeExerciseKey } from '@/lib/training/exercise-key'
import { estimate1RM } from '@/lib/training/methodology-helpers'
```

Export the summary type:

```ts
export interface RecalibrationSummaryEntry {
    exercise: string
    previousTrainingMaxKg: number
    observedTrainingMaxKg: number
    estimated1RMKg: number
    applied: boolean
    isPR: boolean
}
```

Add `is_amrap` and `rir_actual` to the `exercise_sets(...)` select list in the workout query.

Replace `pickTopSet` — the old version picked `max(target_weight_kg)`, which ignores an athlete who self-regulates up and can't tell a 3-rep top single from an 8-rep AMRAP:

```ts
/**
 * The set that best reveals current strength: the AMRAP if there is one
 * (its rep count is the whole point), otherwise the heaviest actual load.
 */
function pickTopSet(sets: any[]): TopSet | null {
    const usable = sets.filter(
        s => s.target_weight_kg != null && s.target_reps != null &&
             s.actual_weight_kg != null && s.actual_reps != null
    )
    if (!usable.length) return null
    const amraps = usable.filter(s => s.is_amrap)
    const pool = amraps.length ? amraps : usable
    return pool.reduce((top: any, s: any) =>
        s.actual_weight_kg > (top?.actual_weight_kg ?? -Infinity) ? s : top, null)
}
```

Change the grouping loop to key on the normalized lift and skip accessories:

```ts
    const byExercise = new Map<string, { label: string; sets: any[] }>()
    for (const s of sets) {
        const key = normalizeExerciseKey(s.exercise_name)
        // Accessories have no training max — they progress via the
        // week-to-week LLM loop that reads last week's actuals.
        if (!key) continue
        if (!byExercise.has(key)) {
            byExercise.set(key, { label: s.exercise_name, sets: [] })
        }
        const group = byExercise.get(key)!
        group.sets.push(s)
        // Prefer the plainest display label for the summary UI.
        if (s.exercise_name.length < group.label.length) group.label = s.exercise_name
    }
```

Feed logged effort into the estimator — this is what makes the correction live:

```ts
        // The athlete logs RIR, never RPE, so rpe_actual is always null.
        // RPE and RIR are complements on the 1-10 scale: rpe = 10 - rir.
        const effectiveRpe = top.rpe_actual ?? (top.rir_actual != null ? 10 - top.rir_actual : undefined)

        const observedMaxOut = trainingMaxSkill.execute({
            weightKg: top.actual_weight_kg,
            reps: top.actual_reps,
            rpe: effectiveRpe
        })
```

Accumulate and return the summary, recording whether `setTrainingMax` actually applied (it returns `null` for non-main lifts):

```ts
        const applied = (result.tier === 'visible' || result.tier === 'logged')
            ? (await setTrainingMax({ exercise: label, trainingMaxKg: observedMaxOut.trainingMax, source: 'recalibration' })) !== null
            : false

        summary.push({
            exercise: label,
            previousTrainingMaxKg: previousMaxOut.trainingMax,
            observedTrainingMaxKg: observedMaxOut.trainingMax,
            estimated1RMKg: estimate1RM(top.actual_weight_kg, top.actual_reps),
            applied,
            isPR: observedMaxOut.trainingMax > previousMaxOut.trainingMax,
        })
```

Change the signature to `Promise<RecalibrationSummaryEntry[]>` and return `summary`. Keep every existing `try/catch` — a failure on one lift must not lose the others; push nothing for a failed lift.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/actions/__tests__/recalibrate-from-top-set.test.ts`
Expected: PASS, including the pre-existing tests in that file.

- [ ] **Step 5: Await recalibration in `completeWorkout`**

In `src/lib/actions/workout.actions.ts:327-331`, replace the fire-and-forget call:

```ts
    // Awaited (was fire-and-forget) so the session-close summary can report
    // the new estimated 1RM. Still non-fatal: a recalibration failure must
    // never block the athlete from finishing a session.
    let recalibration: RecalibrationSummaryEntry[] = []
    try {
        recalibration = await recalibrateFromTopSet(workoutId)
    } catch (err) {
        console.error('[completeWorkout] recalibration failed:', err)
    }
```

Import the type, and add `recalibration` to the returned object.

- [ ] **Step 6: Build the session-close summary**

Create `src/components/workout/SessionSummary.tsx` — a client component taking `entries: RecalibrationSummaryEntry[]`, `durationMinutes: number`, `onDone: () => void`. Match the app's aesthetic (deep earth tones, volcanic blacks, warm amber accents; `font-space-grotesk` headings, `font-mono` labels — copy the tile styling from `WorkoutLogger.tsx:1396-1412`).

Render per entry:
- exercise name;
- `Est. 1RM {estimated1RMKg} kg`;
- when `isPR`, an amber **NEW BEST** badge and the delta `+{observed - previous} kg TM`;
- when `!applied`, the muted note `logged — awaiting your confirmation` (the `intervention` tier waits on athlete acknowledgment).

When `entries` is empty, render the duration and a single line: `No new strength signal this session.` Never fabricate a number.

In `WorkoutLogger.tsx`, change `handleEndWorkout` (`:1013-1025`) to store `res.recalibration` in state and render `<SessionSummary>` instead of calling `router.push('/dashboard')` immediately; `onDone` performs the push.

- [ ] **Step 7: Verify end-to-end in the running app**

With `npm run dev`, complete a session and screenshot the summary screen. Then confirm the write landed:

```sql
select training_maxes->'deadlift' from profiles;
```

Expected: `updatedAt` is today's date and `source` is `recalibration` — proof the loop that has been severed since April now closes. Report both the screenshot and the query output.

- [ ] **Step 8: Commit**

```bash
git add src/lib/actions/recalibrate-from-top-set.actions.ts \
        src/lib/actions/workout.actions.ts \
        src/components/workout/SessionSummary.tsx \
        src/components/workout/WorkoutLogger.tsx \
        src/lib/actions/__tests__/recalibrate-from-top-set.test.ts
git commit -m "feat(strength): recalibration reads logged RIR, prefers the AMRAP set, and reports at session close"
```

---

### Task 6b: Seed training maxes from recent logged performance

Added mid-execution (2026-07-19), after Task 3 revealed the stored TMs are stale-low
and now actually drive the program: squat 78.5 (29 Jun) despite an 85 kg × 3 @ RIR 1
top set logged today; OHP 49.5 unchanged since 24 Apr.

Requires Task 6's recalibration logic (AMRAP-aware top-set selection + `rir_actual`
→ rpe derivation), so it runs after it.

- [ ] **Step 1: Dry-run over the last 8 weeks of completed main-lift sets**

Query `exercise_sets` joined to completed `workouts` for the four main lifts,
group by normalized key, apply the new `pickTopSet` + `trainingMaxSkill` logic,
and print a proposed table: current TM → proposed TM → the exact set it came from.

- [ ] **Step 2: Present the table to Steven and get explicit approval**

**Write nothing until approved.** This is production training data.

- [ ] **Step 3: Apply approved values via `setTrainingMax` with source `'recalibration'`**

- [ ] **Step 4: Verify and report**

```sql
select jsonb_pretty(training_maxes) from profiles;
```

---

### Task 7: Full verification and deploy

- [ ] **Step 1: Install and run the whole suite**

```bash
npm install
npx vitest run
```

Expected: all green. Baseline before this work was 373 passing.

- [ ] **Step 2: Production build**

```bash
npx next build
```

Expected: clean. Watch for type errors in `database.types.ts` — if the hand-written alias appendix was lost during the Task 4 regen, this is where it surfaces.

- [ ] **Step 3: Confirm the fix against the real prescription**

```sql
select exercise_name, set_number, target_weight_kg, target_rir, is_amrap
from exercise_sets
where workout_id = 'b4c77c77-1a89-4e94-a85c-27c68008b723'
  and exercise_name like 'Deadlift%'
order by set_number;
```

Expected: 65 / 75 / 85 with `is_amrap = true` on the 85. Targets must be **byte-identical to before this work** — nothing in this plan may rewrite a prescription. If they changed, stop and report.

- [ ] **Step 4: Deploy**

```bash
git push origin main
```

Then confirm the Vercel deployment reaches READY before telling Steven it is live. Rollback candidate is the deployment for `0e90d58`.

---

## Out of scope (filed, not fixed)

Deliberately excluded to keep this shippable. Add to the audit backlog:

- **Week-to-week progression is 100% LLM prompt instruction** (`programming.ts:365-371`) with no deterministic computation or post-generation validation. The biggest remaining trust gap in the engine.
- **Three near-identical copies** of the prior-week actuals aggregation (`generate-pool.ts:159-227`, `regenerate.ts:245-290`, `mesocycle/context.ts:240-285`), free to drift.
- **PR detection is weight-only and rep-agnostic** (`logging.actions.ts:58-60`) — 100 kg × 1 beats 95 kg × 10, and `is_pr` never feeds back into TM or prescription.
- **Deload divergence**: `createBlockShell` hardcodes deload = final week; the head coach picks its own `deloadWeek`; generation keys off `microcycle.is_deload`.
- **`set_number` is global across the workout**, so a 3-set exercise renders as "Set 2 / 3 / 4". Cosmetic.
