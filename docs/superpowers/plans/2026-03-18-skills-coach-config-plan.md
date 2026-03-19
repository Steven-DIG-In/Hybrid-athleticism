# Skills & Coach Config Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI reasoning with deterministic runtime skills for formula-based work, restructure coaches as config-driven units, and refactor the orchestrator into a generic engine with three-tier governance.

**Architecture:** Skills are pure TypeScript functions with Zod-validated I/O, registered in a central registry. Coach configs define persona, methodology, assigned skills, and governance tiers. The orchestrator reads configs, routes deterministic work to skills, and only calls Claude for strategy/check-ins/coaching notes. A new check-in system triggers on session completion or 7-day window expiry.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Supabase (PostgreSQL + RLS), Zod 4, Vitest (new), Claude Sonnet (AI). Use Context7 for up-to-date library docs during implementation.

**Spec:** `docs/superpowers/specs/2026-03-18-skills-coach-config-design.md`

---

## File Structure Overview

### New Files

```
# Test framework
vitest.config.ts

# Skills system
src/lib/skills/types.ts                              — Skill interface, SkillInputError, CoachDomain type
src/lib/skills/registry.ts                            — Auto-discovery, getSkill(), executeSkill()
src/lib/skills/domains/strength/531-progression.ts    — Wendler 5/3/1 wave calculation
src/lib/skills/domains/strength/training-max-estimation.ts — 1RM estimation (Epley + Brzycki)
src/lib/skills/domains/strength/progression-engine.ts — Auto weight/rep progression from logged data
src/lib/skills/domains/hypertrophy/volume-landmarks.ts — MEV/MAV/MRV per muscle group
src/lib/skills/domains/hypertrophy/hypertrophy-volume-tracker.ts — Running set counts vs landmarks
src/lib/skills/domains/endurance/vdot-pacer.ts        — Daniels VDOT → training paces
src/lib/skills/domains/endurance/zone-distributor.ts  — 80/20 polarized split
src/lib/skills/domains/conditioning/conditioning-scaler.ts — EMOM/AMRAP/interval scaling
src/lib/skills/domains/recovery/recovery-scorer.ts    — Formula-based readiness score
src/lib/skills/domains/shared/deload-calculator.ts    — Volume/intensity reduction
src/lib/skills/domains/shared/interference-checker.ts — Session spacing rules

# Coach configs
src/lib/coaches/types.ts                              — CoachConfig interface
src/lib/coaches/registry.ts                           — getCoach(), getAllCoaches()
src/lib/coaches/configs/strength.ts                   — Marcus Cole config
src/lib/coaches/configs/hypertrophy.ts                — Dr. Adriana Voss config
src/lib/coaches/configs/endurance.ts                  — Nadia Okafor config
src/lib/coaches/configs/conditioning.ts               — Kai Reeves config
src/lib/coaches/configs/mobility.ts                   — Sofia Nguyen config
src/lib/coaches/configs/recovery.ts                   — James Whitfield config

# Database migration
supabase/migrations/012_skills_coach_config.sql       — New tables + column additions

# Check-in system
src/lib/actions/check-in.actions.ts                   — Check-in trigger, self-report, tiered adjustments
src/lib/actions/performance-deltas.actions.ts         — Auto-generate deltas after session completion

# Tests
src/lib/skills/__tests__/531-progression.test.ts
src/lib/skills/__tests__/training-max-estimation.test.ts
src/lib/skills/__tests__/progression-engine.test.ts
src/lib/skills/__tests__/volume-landmarks.test.ts
src/lib/skills/__tests__/hypertrophy-volume-tracker.test.ts
src/lib/skills/__tests__/vdot-pacer.test.ts
src/lib/skills/__tests__/zone-distributor.test.ts
src/lib/skills/__tests__/conditioning-scaler.test.ts
src/lib/skills/__tests__/recovery-scorer.test.ts
src/lib/skills/__tests__/deload-calculator.test.ts
src/lib/skills/__tests__/interference-checker.test.ts
src/lib/skills/__tests__/registry.test.ts
src/lib/skills/__tests__/index.test.ts
src/lib/coaches/__tests__/registry.test.ts
src/lib/coaches/__tests__/configs.test.ts
```

### Modified Files

```
src/lib/training/methodology-helpers.ts               — Thin re-export shim (functions move to skills)
src/lib/ai/orchestrator.ts                            — Generic engine reading coach configs + skills
src/lib/ai/prompts/strength-coach.ts                  — Slim down, methodology from config
src/lib/ai/prompts/endurance-coach.ts                 — Slim down, methodology from config
src/lib/ai/prompts/hypertrophy-coach.ts               — Slim down, methodology from config
src/lib/ai/prompts/conditioning-coach.ts              — Slim down, methodology from config
src/lib/ai/prompts/mobility-coach.ts                  — Slim down, methodology from config
src/lib/ai/prompts/recovery-coach.ts                  — Slim down, readiness now deterministic
src/lib/coaching-staff.ts                             — Add re-export bridge to new coach configs
src/lib/actions/logging.actions.ts                    — Hook performance delta generation after session log
src/lib/actions/inventory.actions.ts                  — Hook check-in window creation on allocation
package.json                                          — Add vitest devDependency
```

---

## Task 1: Add Vitest Test Framework

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

```bash
cd "/Users/steven/Vibe Projects/hybrid-athleticism"
npm install --save-dev vitest
```

- [ ] **Step 2: Create vitest config**

Use Context7 to check latest Vitest + Next.js 16 config patterns, then create:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

Run: `npm test`
Expected: "No test files found" (clean exit, no errors)

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest test framework"
```

---

## Task 2: Skill Types & Registry Foundation

**Files:**
- Create: `src/lib/skills/types.ts`
- Create: `src/lib/skills/registry.ts`
- Create: `src/lib/skills/__tests__/registry.test.ts`

- [ ] **Step 1: Write registry test**

```typescript
// src/lib/skills/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest'
import { SkillRegistry } from '../registry'
import { SkillInputError } from '../types'
import { z } from 'zod'
import type { Skill } from '../types'

// Minimal test skill
const testSkill: Skill<{ value: number }, { result: number }> = {
  name: 'test-double',
  domain: 'strength',
  tier: 1,
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.number() }),
  execute: (input) => ({ result: input.value * 2 }),
}

describe('SkillRegistry', () => {
  it('registers and retrieves a skill by name', () => {
    const registry = new SkillRegistry()
    registry.register(testSkill)
    expect(registry.getSkill('test-double')).toBe(testSkill)
  })

  it('returns undefined for unknown skill', () => {
    const registry = new SkillRegistry()
    expect(registry.getSkill('nonexistent')).toBeUndefined()
  })

  it('retrieves skills by domain', () => {
    const registry = new SkillRegistry()
    registry.register(testSkill)
    const skills = registry.getSkillsForDomain('strength')
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('test-double')
  })

  it('executeSkill validates input and returns output', () => {
    const registry = new SkillRegistry()
    registry.register(testSkill)
    const result = registry.executeSkill('test-double', { value: 5 })
    expect(result).toEqual({ result: 10 })
  })

  it('executeSkill throws SkillInputError on invalid input', () => {
    const registry = new SkillRegistry()
    registry.register(testSkill)
    expect(() => registry.executeSkill('test-double', { value: 'not a number' }))
      .toThrow(SkillInputError)
  })

  it('executeSkill throws on unknown skill', () => {
    const registry = new SkillRegistry()
    expect(() => registry.executeSkill('nonexistent', {}))
      .toThrow('Skill not found: nonexistent')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/skills/__tests__/registry.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create types.ts**

```typescript
// src/lib/skills/types.ts
import type { ZodType } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CoachDomain = 'strength' | 'endurance' | 'hypertrophy' | 'conditioning' | 'mobility' | 'recovery'
export type SharedDomain = 'shared'
export type SkillDomain = CoachDomain | SharedDomain

export interface Skill<TInput = unknown, TOutput = unknown> {
  name: string
  domain: SkillDomain
  tier: 1
  inputSchema: ZodType<TInput>
  outputSchema: ZodType<TOutput>
  execute(input: TInput): TOutput
  apply?(output: TOutput, supabase: SupabaseClient): Promise<void>
}

export class SkillInputError extends Error {
  constructor(
    public skillName: string,
    public zodError: unknown,
  ) {
    super(`SkillInputError [${skillName}]: ${JSON.stringify(zodError)}`)
    this.name = 'SkillInputError'
  }
}
```

- [ ] **Step 4: Create registry.ts**

```typescript
// src/lib/skills/registry.ts
import type { Skill, SkillDomain } from './types'
import { SkillInputError } from './types'

export class SkillRegistry {
  private skills = new Map<string, Skill>()

  register(skill: Skill): void {
    this.skills.set(skill.name, skill)
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  getSkillsForDomain(domain: SkillDomain): Skill[] {
    return Array.from(this.skills.values()).filter(s => s.domain === domain)
  }

  executeSkill<TOutput = unknown>(name: string, input: unknown): TOutput {
    const skill = this.skills.get(name)
    if (!skill) throw new Error(`Skill not found: ${name}`)

    const parsed = skill.inputSchema.safeParse(input)
    if (!parsed.success) {
      throw new SkillInputError(name, parsed.error)
    }

    return skill.execute(parsed.data) as TOutput
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values())
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/lib/skills/__tests__/registry.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/skills/types.ts src/lib/skills/registry.ts src/lib/skills/__tests__/registry.test.ts
git commit -m "feat: add skill types and registry foundation"
```

---

## Task 3: 5/3/1 Progression Skill

**Files:**
- Create: `src/lib/skills/domains/strength/531-progression.ts`
- Create: `src/lib/skills/__tests__/531-progression.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/lib/skills/__tests__/531-progression.test.ts
import { describe, it, expect } from 'vitest'
import { fiveThreeOneSkill } from '../domains/strength/531-progression'

describe('531-progression skill', () => {
  it('has correct metadata', () => {
    expect(fiveThreeOneSkill.name).toBe('531-progression')
    expect(fiveThreeOneSkill.domain).toBe('strength')
    expect(fiveThreeOneSkill.tier).toBe(1)
  })

  it('week 1: 3x5+ at 65/75/85%', () => {
    const result = fiveThreeOneSkill.execute({ trainingMaxKg: 100, weekInCycle: 1 })
    expect(result.weekLabel).toBe('5+')
    expect(result.sets).toHaveLength(3)
    expect(result.sets[0]).toEqual({ reps: 5, percentTM: 0.65, weightKg: 65, isAmrap: false })
    expect(result.sets[1]).toEqual({ reps: 5, percentTM: 0.75, weightKg: 75, isAmrap: false })
    expect(result.sets[2]).toEqual({ reps: 5, percentTM: 0.85, weightKg: 85, isAmrap: true })
  })

  it('week 2: 3x3+ at 70/80/90%', () => {
    const result = fiveThreeOneSkill.execute({ trainingMaxKg: 100, weekInCycle: 2 })
    expect(result.weekLabel).toBe('3+')
    expect(result.sets[2]).toEqual({ reps: 3, percentTM: 0.90, weightKg: 90, isAmrap: true })
  })

  it('week 3: 5/3/1+ at 75/85/95%', () => {
    const result = fiveThreeOneSkill.execute({ trainingMaxKg: 100, weekInCycle: 3 })
    expect(result.weekLabel).toBe('5/3/1')
    expect(result.sets[2]).toEqual({ reps: 1, percentTM: 0.95, weightKg: 95, isAmrap: true })
  })

  it('week 4: deload at 40/50/60%', () => {
    const result = fiveThreeOneSkill.execute({ trainingMaxKg: 100, weekInCycle: 4 })
    expect(result.weekLabel).toBe('Deload')
    expect(result.sets.every(s => !s.isAmrap)).toBe(true)
  })

  it('rounds to nearest 2.5kg', () => {
    const result = fiveThreeOneSkill.execute({ trainingMaxKg: 97, weekInCycle: 1 })
    // 97 * 0.65 = 63.05 → 62.5; 97 * 0.75 = 72.75 → 72.5; 97 * 0.85 = 82.45 → 82.5
    expect(result.sets[0].weightKg).toBe(62.5)
    expect(result.sets[1].weightKg).toBe(72.5)
    expect(result.sets[2].weightKg).toBe(82.5)
  })

  it('validates input schema rejects negative weight', () => {
    expect(() => fiveThreeOneSkill.inputSchema.parse({ trainingMaxKg: -10, weekInCycle: 1 }))
      .toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/skills/__tests__/531-progression.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the skill**

Move the `calculate531Wave` logic from `methodology-helpers.ts` into the skill format:

```typescript
// src/lib/skills/domains/strength/531-progression.ts
import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  trainingMaxKg: z.number().positive(),
  weekInCycle: z.number().int().min(1).max(4),
})

const setSchema = z.object({
  reps: z.number(),
  percentTM: z.number(),
  weightKg: z.number(),
  isAmrap: z.boolean(),
})

const outputSchema = z.object({
  weekLabel: z.string(),
  sets: z.array(setSchema),
})

type Input = z.infer<typeof inputSchema>
type Output = z.infer<typeof outputSchema>

function execute(input: Input): Output {
  const { trainingMaxKg, weekInCycle } = input
  const round = (kg: number) => Math.round(kg / 2.5) * 2.5

  switch (weekInCycle) {
    case 1:
      return {
        weekLabel: '5+',
        sets: [
          { reps: 5, percentTM: 0.65, weightKg: round(trainingMaxKg * 0.65), isAmrap: false },
          { reps: 5, percentTM: 0.75, weightKg: round(trainingMaxKg * 0.75), isAmrap: false },
          { reps: 5, percentTM: 0.85, weightKg: round(trainingMaxKg * 0.85), isAmrap: true },
        ],
      }
    case 2:
      return {
        weekLabel: '3+',
        sets: [
          { reps: 3, percentTM: 0.70, weightKg: round(trainingMaxKg * 0.70), isAmrap: false },
          { reps: 3, percentTM: 0.80, weightKg: round(trainingMaxKg * 0.80), isAmrap: false },
          { reps: 3, percentTM: 0.90, weightKg: round(trainingMaxKg * 0.90), isAmrap: true },
        ],
      }
    case 3:
      return {
        weekLabel: '5/3/1',
        sets: [
          { reps: 5, percentTM: 0.75, weightKg: round(trainingMaxKg * 0.75), isAmrap: false },
          { reps: 3, percentTM: 0.85, weightKg: round(trainingMaxKg * 0.85), isAmrap: false },
          { reps: 1, percentTM: 0.95, weightKg: round(trainingMaxKg * 0.95), isAmrap: true },
        ],
      }
    case 4:
    default:
      return {
        weekLabel: 'Deload',
        sets: [
          { reps: 5, percentTM: 0.40, weightKg: round(trainingMaxKg * 0.40), isAmrap: false },
          { reps: 5, percentTM: 0.50, weightKg: round(trainingMaxKg * 0.50), isAmrap: false },
          { reps: 5, percentTM: 0.60, weightKg: round(trainingMaxKg * 0.60), isAmrap: false },
        ],
      }
  }
}

export const fiveThreeOneSkill: Skill<Input, Output> = {
  name: '531-progression',
  domain: 'strength',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/skills/__tests__/531-progression.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills/domains/strength/531-progression.ts src/lib/skills/__tests__/531-progression.test.ts
git commit -m "feat: add 531-progression skill with tests"
```

---

## Task 4: Training Max Estimation Skill

**Files:**
- Create: `src/lib/skills/domains/strength/training-max-estimation.ts`
- Create: `src/lib/skills/__tests__/training-max-estimation.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/lib/skills/__tests__/training-max-estimation.test.ts
import { describe, it, expect } from 'vitest'
import { trainingMaxSkill } from '../domains/strength/training-max-estimation'

describe('training-max-estimation skill', () => {
  it('estimates 1RM from single rep (1RM = weight)', () => {
    const result = trainingMaxSkill.execute({ weightKg: 100, reps: 1 })
    expect(result.estimated1RM).toBe(100)
    expect(result.trainingMax).toBe(90) // 100 * 0.90
  })

  it('estimates 1RM using Epley formula for multi-rep', () => {
    // Epley: 1RM = 80 * (1 + 5/30) = 80 * 1.1667 = 93.33
    // TM = 93.33 * 0.90 = 84.0 (rounded to nearest 0.5)
    const result = trainingMaxSkill.execute({ weightKg: 80, reps: 5 })
    expect(result.estimated1RM).toBeCloseTo(93.3, 0)
    expect(result.trainingMax).toBe(84)
  })

  it('adjusts for RPE when provided', () => {
    // RPE 8 = 2 RIR → effectively add 2 reps to the formula
    const withRpe = trainingMaxSkill.execute({ weightKg: 80, reps: 5, rpe: 8 })
    const withoutRpe = trainingMaxSkill.execute({ weightKg: 80, reps: 7 })
    // RPE-adjusted should be close to doing 7 reps (5 done + 2 RIR)
    expect(withRpe.estimated1RM).toBeCloseTo(withoutRpe.estimated1RM, 0)
  })

  it('rejects zero or negative values', () => {
    expect(() => trainingMaxSkill.inputSchema.parse({ weightKg: 0, reps: 5 })).toThrow()
    expect(() => trainingMaxSkill.inputSchema.parse({ weightKg: 80, reps: 0 })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/skills/__tests__/training-max-estimation.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the skill**

Move logic from `estimateTrainingMax` and `estimate1RM` in `methodology-helpers.ts`. Add RPE adjustment.

```typescript
// src/lib/skills/domains/strength/training-max-estimation.ts
import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  weightKg: z.number().positive(),
  reps: z.number().int().positive(),
  rpe: z.number().min(1).max(10).optional(),
})

const outputSchema = z.object({
  estimated1RM: z.number(),
  trainingMax: z.number(),
})

type Input = z.infer<typeof inputSchema>
type Output = z.infer<typeof outputSchema>

function execute(input: Input): Output {
  const { weightKg, reps, rpe } = input

  // Adjust reps for RPE: RIR = 10 - RPE, effective reps = reps + RIR
  const effectiveReps = rpe !== undefined ? reps + (10 - rpe) : reps

  // Epley formula: 1RM = weight * (1 + reps/30)
  const estimated1RM = effectiveReps === 1
    ? weightKg
    : Math.round(weightKg * (1 + effectiveReps / 30) * 10) / 10

  // Training max = 90% of estimated 1RM, rounded to nearest 0.5kg
  const trainingMax = Math.round(estimated1RM * 0.90 * 2) / 2

  return { estimated1RM, trainingMax }
}

export const trainingMaxSkill: Skill<Input, Output> = {
  name: 'training-max-estimation',
  domain: 'strength',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/skills/__tests__/training-max-estimation.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills/domains/strength/training-max-estimation.ts src/lib/skills/__tests__/training-max-estimation.test.ts
git commit -m "feat: add training-max-estimation skill with tests"
```

---

## Task 5: Progression Engine Skill

**Files:**
- Create: `src/lib/skills/domains/strength/progression-engine.ts`
- Create: `src/lib/skills/__tests__/progression-engine.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/lib/skills/__tests__/progression-engine.test.ts
import { describe, it, expect } from 'vitest'
import { progressionEngineSkill } from '../domains/strength/progression-engine'

describe('progression-engine skill', () => {
  it('increases weight when prescribed reps exceeded with low RPE', () => {
    const result = progressionEngineSkill.execute({
      exerciseName: 'Back Squat',
      prescribedWeightKg: 100,
      prescribedReps: 5,
      prescribedRpe: 8,
      actualWeightKg: 100,
      actualReps: 8,
      actualRpe: 7,
    })
    expect(result.nextWeightKg).toBeGreaterThan(100)
    expect(result.adjustment).toBe('increase')
  })

  it('maintains weight when on track', () => {
    const result = progressionEngineSkill.execute({
      exerciseName: 'Bench Press',
      prescribedWeightKg: 80,
      prescribedReps: 5,
      prescribedRpe: 8,
      actualWeightKg: 80,
      actualReps: 5,
      actualRpe: 8,
    })
    expect(result.nextWeightKg).toBe(80)
    expect(result.adjustment).toBe('maintain')
  })

  it('decreases weight when underperforming significantly', () => {
    const result = progressionEngineSkill.execute({
      exerciseName: 'Deadlift',
      prescribedWeightKg: 140,
      prescribedReps: 5,
      prescribedRpe: 8,
      actualWeightKg: 140,
      actualReps: 3,
      actualRpe: 10,
    })
    expect(result.nextWeightKg).toBeLessThan(140)
    expect(result.adjustment).toBe('decrease')
  })

  it('uses standard increments: 2.5kg upper, 5kg lower', () => {
    const upperResult = progressionEngineSkill.execute({
      exerciseName: 'Bench Press',
      prescribedWeightKg: 80,
      prescribedReps: 5,
      prescribedRpe: 8,
      actualWeightKg: 80,
      actualReps: 8,
      actualRpe: 6,
    })
    expect(upperResult.incrementKg).toBe(2.5)

    const lowerResult = progressionEngineSkill.execute({
      exerciseName: 'Back Squat',
      prescribedWeightKg: 100,
      prescribedReps: 5,
      prescribedRpe: 8,
      actualWeightKg: 100,
      actualReps: 8,
      actualRpe: 6,
    })
    expect(lowerResult.incrementKg).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/skills/__tests__/progression-engine.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the skill**

```typescript
// src/lib/skills/domains/strength/progression-engine.ts
import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  exerciseName: z.string(),
  prescribedWeightKg: z.number().positive(),
  prescribedReps: z.number().int().positive(),
  prescribedRpe: z.number().min(1).max(10),
  actualWeightKg: z.number().positive(),
  actualReps: z.number().int().min(0),
  actualRpe: z.number().min(1).max(10),
})

const outputSchema = z.object({
  exerciseName: z.string(),
  nextWeightKg: z.number(),
  incrementKg: z.number(),
  adjustment: z.enum(['increase', 'maintain', 'decrease']),
  reason: z.string(),
})

type Input = z.infer<typeof inputSchema>
type Output = z.infer<typeof outputSchema>

// Lower body compounds get 5kg increments, upper body get 2.5kg
const LOWER_BODY_PATTERNS = /squat|deadlift|leg press|hip thrust|lunge|romanian/i
const UPPER_BODY_INCREMENT = 2.5
const LOWER_BODY_INCREMENT = 5

function execute(input: Input): Output {
  const { exerciseName, prescribedWeightKg, prescribedReps, prescribedRpe, actualReps, actualRpe } = input
  const isLowerBody = LOWER_BODY_PATTERNS.test(exerciseName)
  const increment = isLowerBody ? LOWER_BODY_INCREMENT : UPPER_BODY_INCREMENT

  const repsDelta = actualReps - prescribedReps
  const rpeDelta = actualRpe - prescribedRpe // positive = harder than expected

  // Over-performing: hit more reps AND lower RPE → increase
  if (repsDelta >= 2 && rpeDelta <= -1) {
    return {
      exerciseName,
      nextWeightKg: prescribedWeightKg + increment,
      incrementKg: increment,
      adjustment: 'increase',
      reason: `Exceeded prescribed reps by ${repsDelta} at lower RPE (${actualRpe} vs ${prescribedRpe})`,
    }
  }

  // Under-performing: missed reps significantly OR RPE way too high
  if (repsDelta <= -2 || (rpeDelta >= 2 && repsDelta < 0)) {
    return {
      exerciseName,
      nextWeightKg: Math.round((prescribedWeightKg - increment) / 2.5) * 2.5,
      incrementKg: increment,
      adjustment: 'decrease',
      reason: `Missed ${Math.abs(repsDelta)} reps or RPE too high (${actualRpe} vs ${prescribedRpe})`,
    }
  }

  // On track
  return {
    exerciseName,
    nextWeightKg: prescribedWeightKg,
    incrementKg: increment,
    adjustment: 'maintain',
    reason: 'Performance on track with prescription',
  }
}

export const progressionEngineSkill: Skill<Input, Output> = {
  name: 'progression-engine',
  domain: 'strength',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/skills/__tests__/progression-engine.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills/domains/strength/progression-engine.ts src/lib/skills/__tests__/progression-engine.test.ts
git commit -m "feat: add progression-engine skill with tests"
```

---

## Task 6: Volume Landmarks Skill

**Files:**
- Create: `src/lib/skills/domains/hypertrophy/volume-landmarks.ts`
- Create: `src/lib/skills/__tests__/volume-landmarks.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/lib/skills/__tests__/volume-landmarks.test.ts
import { describe, it, expect } from 'vitest'
import { volumeLandmarksSkill } from '../domains/hypertrophy/volume-landmarks'

describe('volume-landmarks skill', () => {
  it('returns correct landmarks for intermediate quads', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'quads',
      experienceLevel: 'intermediate',
    })
    expect(result.mev).toBe(8)
    expect(result.mav).toBe(14)
    expect(result.mrv).toBe(18)
  })

  it('calculates weekly volume target ramping from MEV toward MAV', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'chest',
      experienceLevel: 'intermediate',
      weekNumber: 1,
      totalWeeks: 4,
    })
    // Week 1 of 4: near MEV+1
    expect(result.weeklyTarget).toBeGreaterThanOrEqual(result.mev)
    expect(result.weeklyTarget).toBeLessThanOrEqual(result.mav)
  })

  it('deload week drops to 60% MEV', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'chest',
      experienceLevel: 'intermediate',
      weekNumber: 4,
      totalWeeks: 4,
      isDeload: true,
    })
    expect(result.weeklyTarget).toBe(Math.round(result.mev * 0.6))
  })

  it('normalizes muscle group names (case, hyphens, spaces)', () => {
    const r1 = volumeLandmarksSkill.execute({ muscleGroup: 'Rear Delts', experienceLevel: 'beginner' })
    const r2 = volumeLandmarksSkill.execute({ muscleGroup: 'rear-delts', experienceLevel: 'beginner' })
    const r3 = volumeLandmarksSkill.execute({ muscleGroup: 'rear_delts', experienceLevel: 'beginner' })
    expect(r1.mev).toBe(r2.mev)
    expect(r2.mev).toBe(r3.mev)
  })

  it('returns defaults for unknown muscle group', () => {
    const result = volumeLandmarksSkill.execute({
      muscleGroup: 'some_obscure_muscle',
      experienceLevel: 'intermediate',
    })
    expect(result.mev).toBe(6)  // intermediate default
    expect(result.mav).toBe(10)
    expect(result.mrv).toBe(14)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/skills/__tests__/volume-landmarks.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the skill**

Move the `VOLUME_LANDMARK_TABLE`, `calculateRPVolumeLandmarks`, and `calculateWeeklyVolumeTarget` logic from `methodology-helpers.ts` into the skill.

```typescript
// src/lib/skills/domains/hypertrophy/volume-landmarks.ts
import { z } from 'zod'
import type { Skill } from '../../types'

const inputSchema = z.object({
  muscleGroup: z.string(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  weekNumber: z.number().int().positive().optional(),
  totalWeeks: z.number().int().positive().optional(),
  isDeload: z.boolean().optional(),
})

const outputSchema = z.object({
  muscleGroup: z.string(),
  mev: z.number(),
  mav: z.number(),
  mrv: z.number(),
  weeklyTarget: z.number().optional(),
})

type Input = z.infer<typeof inputSchema>
type Output = z.infer<typeof outputSchema>

interface VolumeLandmarks { mev: number; mav: number; mrv: number }

const VOLUME_TABLE: Record<string, Record<string, VolumeLandmarks>> = {
  quads:      { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 14, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
  quadriceps: { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 14, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
  hamstrings: { beginner: { mev: 4, mav: 8, mrv: 12 },  intermediate: { mev: 6, mav: 10, mrv: 14 }, advanced: { mev: 8, mav: 12, mrv: 18 } },
  chest:      { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 12, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
  pecs:       { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 12, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
  back:       { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 14, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
  lats:       { beginner: { mev: 6, mav: 10, mrv: 14 }, intermediate: { mev: 8, mav: 14, mrv: 18 }, advanced: { mev: 10, mav: 16, mrv: 22 } },
  shoulders:  { beginner: { mev: 4, mav: 8, mrv: 12 },  intermediate: { mev: 6, mav: 10, mrv: 14 }, advanced: { mev: 8, mav: 12, mrv: 18 } },
  delts:      { beginner: { mev: 4, mav: 8, mrv: 12 },  intermediate: { mev: 6, mav: 10, mrv: 14 }, advanced: { mev: 8, mav: 12, mrv: 18 } },
  deltoids:   { beginner: { mev: 4, mav: 8, mrv: 12 },  intermediate: { mev: 6, mav: 10, mrv: 14 }, advanced: { mev: 8, mav: 12, mrv: 18 } },
  biceps:     { beginner: { mev: 4, mav: 8, mrv: 10 },  intermediate: { mev: 6, mav: 10, mrv: 14 }, advanced: { mev: 8, mav: 14, mrv: 18 } },
  triceps:    { beginner: { mev: 4, mav: 6, mrv: 10 },  intermediate: { mev: 4, mav: 8, mrv: 12 },  advanced: { mev: 6, mav: 10, mrv: 16 } },
  glutes:     { beginner: { mev: 4, mav: 8, mrv: 12 },  intermediate: { mev: 6, mav: 12, mrv: 16 }, advanced: { mev: 8, mav: 14, mrv: 20 } },
  calves:     { beginner: { mev: 4, mav: 6, mrv: 10 },  intermediate: { mev: 6, mav: 8, mrv: 12 },  advanced: { mev: 8, mav: 12, mrv: 16 } },
  core:       { beginner: { mev: 2, mav: 4, mrv: 8 },   intermediate: { mev: 4, mav: 6, mrv: 10 },  advanced: { mev: 4, mav: 8, mrv: 12 } },
  abs:        { beginner: { mev: 2, mav: 4, mrv: 8 },   intermediate: { mev: 4, mav: 6, mrv: 10 },  advanced: { mev: 4, mav: 8, mrv: 12 } },
  traps:      { beginner: { mev: 2, mav: 6, mrv: 10 },  intermediate: { mev: 4, mav: 8, mrv: 12 },  advanced: { mev: 6, mav: 10, mrv: 16 } },
  forearms:   { beginner: { mev: 2, mav: 4, mrv: 8 },   intermediate: { mev: 4, mav: 6, mrv: 10 },  advanced: { mev: 4, mav: 8, mrv: 12 } },
  rear_delts: { beginner: { mev: 4, mav: 6, mrv: 10 },  intermediate: { mev: 6, mav: 8, mrv: 12 },  advanced: { mev: 6, mav: 10, mrv: 14 } },
}

const DEFAULTS: Record<string, VolumeLandmarks> = {
  beginner:     { mev: 4, mav: 8, mrv: 12 },
  intermediate: { mev: 6, mav: 10, mrv: 14 },
  advanced:     { mev: 8, mav: 12, mrv: 18 },
}

function execute(input: Input): Output {
  const { experienceLevel, weekNumber, totalWeeks, isDeload } = input
  const normalized = input.muscleGroup.toLowerCase().replace(/[\s-]/g, '_')

  const entry = VOLUME_TABLE[normalized]
  const landmarks = entry?.[experienceLevel] ?? DEFAULTS[experienceLevel]

  let weeklyTarget: number | undefined
  if (weekNumber !== undefined && totalWeeks !== undefined) {
    if (isDeload) {
      weeklyTarget = Math.round(landmarks.mev * 0.6)
    } else {
      const trainingWeeks = totalWeeks - 1
      const progress = Math.min((weekNumber - 1) / Math.max(trainingWeeks - 1, 1), 1)
      const startVolume = landmarks.mev + 1
      const endVolume = landmarks.mav
      weeklyTarget = Math.round(startVolume + (endVolume - startVolume) * progress)
    }
  }

  return {
    muscleGroup: normalized,
    mev: landmarks.mev,
    mav: landmarks.mav,
    mrv: landmarks.mrv,
    weeklyTarget,
  }
}

export const volumeLandmarksSkill: Skill<Input, Output> = {
  name: 'volume-landmarks',
  domain: 'hypertrophy',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/skills/__tests__/volume-landmarks.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills/domains/hypertrophy/volume-landmarks.ts src/lib/skills/__tests__/volume-landmarks.test.ts
git commit -m "feat: add volume-landmarks skill with tests"
```

---

## Task 7: Remaining Skills (8 skills)

Each follows the exact same TDD pattern as Tasks 3-6: write test first, verify fail, implement skill with Zod schemas, verify pass, commit. Listed here as a batch for brevity — each is a separate commit. Reference the spec's skill descriptions and the existing `methodology-helpers.ts` for formula details. Use Context7 to verify Zod v4 patterns if needed.

### 7a: Hypertrophy Volume Tracker

**Files:**
- Create: `src/lib/skills/domains/hypertrophy/hypertrophy-volume-tracker.ts`
- Create: `src/lib/skills/__tests__/hypertrophy-volume-tracker.test.ts`

- [ ] **Step 1: Write test** — test cases: counts sets per muscle group across sessions, flags when approaching MRV (within 2 sets), flags when exceeding MRV, handles empty session list
- [ ] **Step 2: Run test → FAIL**
- [ ] **Step 3: Implement** — takes array of `{ muscleGroup, sets }` + experience level, computes running total per muscle group, compares against volume landmarks, returns `{ muscleGroup, currentSets, mev, mav, mrv, status: 'below_mev' | 'in_range' | 'approaching_mrv' | 'exceeds_mrv' }[]`
- [ ] **Step 4: Run test → PASS**
- [ ] **Step 5: Commit** — `"feat: add hypertrophy-volume-tracker skill with tests"`

### 7b: VDOT Pacer

**Files:**
- Create: `src/lib/skills/domains/endurance/vdot-pacer.ts`
- Create: `src/lib/skills/__tests__/vdot-pacer.test.ts`

- [ ] **Step 1: Write test** — test cases: known race result → expected VDOT within tolerance, training paces decrease as VDOT increases, rejects zero/negative inputs
- [ ] **Step 2: Run test → FAIL**
- [ ] **Step 3: Implement** — move `calculateDanielsVDOT` and `formatPace` from `methodology-helpers.ts`
- [ ] **Step 4: Run test → PASS**
- [ ] **Step 5: Commit** — `"feat: add vdot-pacer skill with tests"`

### 7c: Zone Distributor

**Files:**
- Create: `src/lib/skills/domains/endurance/zone-distributor.ts`
- Create: `src/lib/skills/__tests__/zone-distributor.test.ts`

- [ ] **Step 1: Write test** — test cases: 300 min → 240 easy + 60 hard, percentages always 80/20, handles small values (10 min)
- [ ] **Step 2: Run test → FAIL**
- [ ] **Step 3: Implement** — move `calculatePolarizedZoneDistribution` from `methodology-helpers.ts`
- [ ] **Step 4: Run test → PASS**
- [ ] **Step 5: Commit** — `"feat: add zone-distributor skill with tests"`

### 7d: Deload Calculator

**Files:**
- Create: `src/lib/skills/domains/shared/deload-calculator.ts`
- Create: `src/lib/skills/__tests__/deload-calculator.test.ts`

- [ ] **Step 1: Write test** — test cases: strength deload reduces to 40-60% TM, volume drops to 60% MEV, endurance deload reduces hard sessions to 0, maintains easy volume at 70%, per-domain configs respected
- [ ] **Step 2: Run test → FAIL**
- [ ] **Step 3: Implement** — configurable deload rules per domain: `{ intensityMultiplier: number, volumeMultiplier: number }`. Default: strength 0.6/0.5, endurance 0.7/0.5, hypertrophy 0.6/0.6, conditioning 0.5/0.5
- [ ] **Step 4: Run test → PASS**
- [ ] **Step 5: Commit** — `"feat: add deload-calculator skill with tests"`

### 7e: Interference Checker

**Files:**
- Create: `src/lib/skills/domains/shared/interference-checker.ts`
- Create: `src/lib/skills/__tests__/interference-checker.test.ts`

- [ ] **Step 1: Write test** — test cases: flags 48hr strength violation, flags 24hr cardio violation, flags heavy legs before run, returns clean when no violations, handles empty schedule
- [ ] **Step 2: Run test → FAIL**
- [ ] **Step 3: Implement** — takes array of `{ date, modality, domain, isHeavyLegs }`, returns `{ violations: { type, sessionA, sessionB, hoursGap, rule }[], isClean: boolean }`
- [ ] **Step 4: Run test → PASS**
- [ ] **Step 5: Commit** — `"feat: add interference-checker skill with tests"`

### 7f: Recovery Scorer

**Files:**
- Create: `src/lib/skills/domains/recovery/recovery-scorer.ts`
- Create: `src/lib/skills/__tests__/recovery-scorer.test.ts`

- [ ] **Step 1: Write test** — test cases: perfect data → GREEN (score > 0.7), moderate issues → YELLOW (0.4-0.7), severe issues → RED (< 0.4), respects signal weights, missed sessions heavily penalize score
- [ ] **Step 2: Run test → FAIL**
- [ ] **Step 3: Implement** — takes `{ performanceDeltas, completionRate, missedSessions, earlyCompletion, selfReport, signalWeights }`. Computes weighted score 0-1. Maps to GREEN/YELLOW/RED with numeric score. Replaces AI-driven assessment.
- [ ] **Step 4: Run test → PASS**
- [ ] **Step 5: Commit** — `"feat: add recovery-scorer skill with tests"`

### 7g: Conditioning Scaler

**Files:**
- Create: `src/lib/skills/domains/conditioning/conditioning-scaler.ts`
- Create: `src/lib/skills/__tests__/conditioning-scaler.test.ts`

- [ ] **Step 1: Write test** — test cases: beginner EMOM gets longer rest, advanced gets shorter, AMRAP scales round count, unknown format returns null, Tabata always 20s/10s but scales rounds
- [ ] **Step 2: Run test → FAIL**
- [ ] **Step 3: Implement** — lookup tables for formats (EMOM, AMRAP, Tabata, intervals) × fitness levels (beginner, intermediate, advanced). Returns `{ format, workSeconds, restSeconds, rounds, loadPercentage } | null`
- [ ] **Step 4: Run test → PASS**
- [ ] **Step 5: Commit** — `"feat: add conditioning-scaler skill with tests"`

### 7h: Register all skills in the global registry

**Files:**
- Create: `src/lib/skills/index.ts` — instantiates registry, registers all 11 skills, exports singleton

- [ ] **Step 1: Write test** — verify all 11 skills are registered, each domain returns expected skills
- [ ] **Step 2: Run test → FAIL**
- [ ] **Step 3: Implement** — import all skills, register in singleton `SkillRegistry`, export
- [ ] **Step 4: Run test → PASS**
- [ ] **Step 5: Commit** — `"feat: register all 11 skills in global registry"`

---

## Task 8: Refactor methodology-helpers.ts

**Files:**
- Modify: `src/lib/training/methodology-helpers.ts`

- [ ] **Step 1: Check all imports of methodology-helpers**

Run: `grep -r "methodology-helpers" src/ --include="*.ts" --include="*.tsx" -l`

Note every file that imports from this module.

- [ ] **Step 2: Replace methodology-helpers.ts with re-exports**

Replace the file body with thin re-exports from the new skill modules so existing UI code continues working:

```typescript
// src/lib/training/methodology-helpers.ts
// DEPRECATED: Use skills directly from src/lib/skills/
// This file re-exports for backward compatibility with UI components.

export { type FiveThreeOneSet, type FiveThreeOneWave } from '@/lib/skills/domains/strength/531-progression'
// Re-export the execute function under the old name
import { fiveThreeOneSkill } from '@/lib/skills/domains/strength/531-progression'
export const calculate531Wave = (trainingMaxKg: number, weekInCycle: number) =>
  fiveThreeOneSkill.execute({ trainingMaxKg, weekInCycle })

import { trainingMaxSkill } from '@/lib/skills/domains/strength/training-max-estimation'
export const estimateTrainingMax = (weight: number, reps: number) =>
  trainingMaxSkill.execute({ weightKg: weight, reps }).trainingMax
export const estimate1RM = (weight: number, reps: number) =>
  trainingMaxSkill.execute({ weightKg: weight, reps }).estimated1RM

import { volumeLandmarksSkill } from '@/lib/skills/domains/hypertrophy/volume-landmarks'
export type { VolumeLandmarks } from '@/lib/skills/domains/hypertrophy/volume-landmarks'
export const calculateRPVolumeLandmarks = (muscleGroup: string, experienceLevel: 'beginner' | 'intermediate' | 'advanced') => {
  const r = volumeLandmarksSkill.execute({ muscleGroup, experienceLevel })
  return { mev: r.mev, mav: r.mav, mrv: r.mrv }
}
// NOTE: The original function accepted pre-computed landmarks. The skill looks them up internally.
// This shim preserves the original behavior by computing directly from the passed landmarks,
// not delegating to the skill. Callers should migrate to the skill directly.
export function calculateWeeklyVolumeTarget(
  landmarks: { mev: number; mav: number; mrv: number },
  weekNumber: number,
  totalWeeks: number,
  isDeload: boolean
): number {
  if (isDeload) return Math.round(landmarks.mev * 0.6)
  const trainingWeeks = totalWeeks - 1
  const progress = Math.min((weekNumber - 1) / Math.max(trainingWeeks - 1, 1), 1)
  const startVolume = landmarks.mev + 1
  const endVolume = landmarks.mav
  return Math.round(startVolume + (endVolume - startVolume) * progress)
}

import { zoneDistributorSkill } from '@/lib/skills/domains/endurance/zone-distributor'
export type { PolarizedSplit } from '@/lib/skills/domains/endurance/zone-distributor'
export const calculatePolarizedZoneDistribution = (minutes: number) =>
  zoneDistributorSkill.execute({ weeklyEnduranceMinutes: minutes })

import { vdotPacerSkill } from '@/lib/skills/domains/endurance/vdot-pacer'
export type { TrainingPaces } from '@/lib/skills/domains/endurance/vdot-pacer'
export const calculateDanielsVDOT = (distanceKm: number, timeSeconds: number) =>
  vdotPacerSkill.execute({ raceDistanceKm: distanceKm, raceTimeSeconds: timeSeconds })
export const formatPace = (secPerKm: number): string => {
  const minutes = Math.floor(secPerKm / 60)
  const seconds = Math.round(secPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/methodology-helpers.ts
git commit -m "refactor: replace methodology-helpers with skill re-exports"
```

---

## Task 9: Coach Config Types & Registry

**Files:**
- Create: `src/lib/coaches/types.ts`
- Create: `src/lib/coaches/registry.ts`
- Create: `src/lib/coaches/__tests__/registry.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/lib/coaches/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest'
import { CoachRegistry } from '../registry'
import type { CoachConfig } from '../types'

const mockConfig: CoachConfig = {
  id: 'strength',
  persona: { name: 'Test Coach', title: 'Strength', bio: 'test', voiceGuidelines: 'direct' },
  methodology: { philosophy: 'test', principles: ['lift heavy'], references: ['5/3/1'] },
  assignedSkills: ['531-progression', 'training-max-estimation'],
  checkIn: {
    assessmentPrompt: 'test',
    signalWeights: {
      rpeDeviation: 0.9, rirDeviation: 0.8, completionRate: 0.5,
      earlyCompletion: 0.3, missedSessions: 0.7, selfReportEnergy: 0.4,
      selfReportSoreness: 0.6, selfReportSleep: 0.3, selfReportStress: 0.2,
      selfReportMotivation: 0.3,
    },
  },
  governance: {
    tier1Auto: ['weight_progression'],
    tier2CoachDecides: ['exercise_swap'],
    tier3AthleteConfirms: ['add_remove_session'],
  },
  alwaysActive: false,
}

describe('CoachRegistry', () => {
  it('registers and retrieves a coach config', () => {
    const registry = new CoachRegistry()
    registry.register(mockConfig)
    expect(registry.getCoach('strength')?.persona.name).toBe('Test Coach')
  })

  it('returns all coaches', () => {
    const registry = new CoachRegistry()
    registry.register(mockConfig)
    expect(registry.getAllCoaches()).toHaveLength(1)
  })

  it('returns always-active coaches', () => {
    const registry = new CoachRegistry()
    registry.register(mockConfig)
    registry.register({ ...mockConfig, id: 'recovery', alwaysActive: true })
    expect(registry.getAlwaysActiveCoaches()).toHaveLength(1)
    expect(registry.getAlwaysActiveCoaches()[0].id).toBe('recovery')
  })

  it('returns selectable coaches', () => {
    const registry = new CoachRegistry()
    registry.register(mockConfig)
    registry.register({ ...mockConfig, id: 'recovery', alwaysActive: true })
    expect(registry.getSelectableCoaches()).toHaveLength(1)
    expect(registry.getSelectableCoaches()[0].id).toBe('strength')
  })
})
```

- [ ] **Step 2: Run test → FAIL**
- [ ] **Step 3: Implement types.ts and registry.ts**

```typescript
// src/lib/coaches/types.ts
import type { CoachDomain } from '@/lib/skills/types'

export interface CoachConfig {
  id: CoachDomain
  persona: {
    name: string
    title: string
    bio: string
    voiceGuidelines: string
  }
  methodology: {
    philosophy: string
    principles: string[]
    references: string[]
  }
  assignedSkills: string[]
  checkIn: {
    assessmentPrompt: string
    signalWeights: {
      rpeDeviation: number
      rirDeviation: number
      completionRate: number
      earlyCompletion: number
      missedSessions: number
      selfReportEnergy: number
      selfReportSoreness: number
      selfReportSleep: number
      selfReportStress: number
      selfReportMotivation: number
    }
  }
  governance: {
    tier1Auto: string[]
    tier2CoachDecides: string[]
    tier3AthleteConfirms: string[]
  }
  alwaysActive: boolean
}
```

```typescript
// src/lib/coaches/registry.ts
import type { CoachConfig } from './types'
import type { CoachDomain } from '@/lib/skills/types'

export class CoachRegistry {
  private coaches = new Map<CoachDomain, CoachConfig>()

  register(config: CoachConfig): void {
    this.coaches.set(config.id, config)
  }

  getCoach(id: CoachDomain): CoachConfig | undefined {
    return this.coaches.get(id)
  }

  getAllCoaches(): CoachConfig[] {
    return Array.from(this.coaches.values())
  }

  getAlwaysActiveCoaches(): CoachConfig[] {
    return this.getAllCoaches().filter(c => c.alwaysActive)
  }

  getSelectableCoaches(): CoachConfig[] {
    return this.getAllCoaches().filter(c => !c.alwaysActive)
  }
}
```

- [ ] **Step 4: Run test → PASS**
- [ ] **Step 5: Commit**

```bash
git add src/lib/coaches/types.ts src/lib/coaches/registry.ts src/lib/coaches/__tests__/registry.test.ts
git commit -m "feat: add coach config types and registry"
```

---

## Task 10: Coach Config Files (6 coaches)

**Files:**
- Create: `src/lib/coaches/configs/strength.ts`
- Create: `src/lib/coaches/configs/hypertrophy.ts`
- Create: `src/lib/coaches/configs/endurance.ts`
- Create: `src/lib/coaches/configs/conditioning.ts`
- Create: `src/lib/coaches/configs/mobility.ts`
- Create: `src/lib/coaches/configs/recovery.ts`
- Create: `src/lib/coaches/index.ts`
- Create: `src/lib/coaches/__tests__/configs.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/lib/coaches/__tests__/configs.test.ts
import { describe, it, expect } from 'vitest'
import { coachRegistry } from '../index'
import { skillRegistry } from '@/lib/skills'

describe('Coach configs', () => {
  it('registers all 6 coaches', () => {
    expect(coachRegistry.getAllCoaches()).toHaveLength(6)
  })

  it('has 2 always-active coaches (mobility, recovery)', () => {
    const alwaysActive = coachRegistry.getAlwaysActiveCoaches()
    expect(alwaysActive).toHaveLength(2)
    const ids = alwaysActive.map(c => c.id)
    expect(ids).toContain('mobility')
    expect(ids).toContain('recovery')
  })

  it('has 4 selectable coaches', () => {
    expect(coachRegistry.getSelectableCoaches()).toHaveLength(4)
  })

  it('every assigned skill exists in the skill registry', () => {
    for (const coach of coachRegistry.getAllCoaches()) {
      for (const skillName of coach.assignedSkills) {
        expect(skillRegistry.getSkill(skillName), `${coach.id} references unknown skill: ${skillName}`).toBeDefined()
      }
    }
  })

  it('every coach has non-empty persona fields', () => {
    for (const coach of coachRegistry.getAllCoaches()) {
      expect(coach.persona.name.length).toBeGreaterThan(0)
      expect(coach.persona.bio.length).toBeGreaterThan(0)
      expect(coach.persona.voiceGuidelines.length).toBeGreaterThan(0)
    }
  })

  it('every coach has governance tiers defined', () => {
    for (const coach of coachRegistry.getAllCoaches()) {
      expect(coach.governance.tier1Auto.length).toBeGreaterThan(0)
      expect(coach.governance.tier2CoachDecides.length).toBeGreaterThan(0)
      expect(coach.governance.tier3AthleteConfirms.length).toBeGreaterThan(0)
    }
  })

  it('signal weights are all between 0 and 1', () => {
    for (const coach of coachRegistry.getAllCoaches()) {
      for (const [key, value] of Object.entries(coach.checkIn.signalWeights)) {
        expect(value, `${coach.id}.${key}`).toBeGreaterThanOrEqual(0)
        expect(value, `${coach.id}.${key}`).toBeLessThanOrEqual(1)
      }
    }
  })
})
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Create all 6 config files**

For each coach, pull persona data from `src/lib/coaching-staff.ts`, add methodology, assign skills, define signal weights and governance tiers. Reference the existing prompt files in `src/lib/ai/prompts/` for methodology details.

Example — `src/lib/coaches/configs/strength.ts`:
```typescript
import type { CoachConfig } from '../types'

export const strengthCoachConfig: CoachConfig = {
  id: 'strength',
  persona: {
    name: 'Marcus Cole',
    title: 'Strength Coach',
    bio: 'Marcus is a no-nonsense strength specialist who lives by the barbell. With a background in powerlifting coaching and Wendler\'s 5/3/1 methodology, he designs programs that put kilos on your squat, bench, deadlift, and press — week after week. He believes in program consistency, trusting the process, and never skipping a deload.',
    voiceGuidelines: 'Direct, confident, uses lifting terminology naturally. Encourages through data ("you hit 8 reps at RPE 7 — that\'s a clear sign we can push the weight up"). No fluff. Occasionally references old-school strength culture.',
  },
  methodology: {
    philosophy: 'Progressive overload through structured periodization. Wendler 5/3/1 as primary framework. Accessories support main lifts.',
    principles: [
      'Start light, progress slow',
      'Use training max (90% of true 1RM) for all percentage-based work',
      'AMRAP sets drive auto-regulation',
      'Never skip the deload week',
      'Same primary movements across all weeks (program continuity)',
    ],
    references: ['5/3/1 Forever (Wendler)', 'Practical Programming (Rippetoe)', 'Science and Practice of Strength Training (Zatsiorsky)'],
  },
  assignedSkills: ['531-progression', 'training-max-estimation', 'progression-engine', 'deload-calculator'],
  checkIn: {
    assessmentPrompt: 'Review RPE/RIR deviations on main lifts. Check if AMRAP sets are trending up or down. Flag any lifts where RPE exceeded 9.5. Assess whether training max needs adjustment.',
    signalWeights: {
      rpeDeviation: 0.9,
      rirDeviation: 0.85,
      completionRate: 0.6,
      earlyCompletion: 0.3,
      missedSessions: 0.7,
      selfReportEnergy: 0.4,
      selfReportSoreness: 0.5,
      selfReportSleep: 0.3,
      selfReportStress: 0.2,
      selfReportMotivation: 0.3,
    },
  },
  governance: {
    tier1Auto: ['weight_progression', 'training_max_update', 'rep_adjustment_within_1'],
    tier2CoachDecides: ['exercise_swap', 'volume_direction_change', 'accessory_modification', 'session_priority_shift'],
    tier3AthleteConfirms: ['add_remove_session', 'end_block_early', 'change_methodology', 'trigger_unscheduled_deload'],
  },
  alwaysActive: false,
}
```

Create similar configs for hypertrophy, endurance, conditioning, mobility, and recovery — pulling persona/bio from `coaching-staff.ts` and methodology from the corresponding prompt files.

- [ ] **Step 4: Create index.ts that registers all configs**

```typescript
// src/lib/coaches/index.ts
import { CoachRegistry } from './registry'
import { strengthCoachConfig } from './configs/strength'
import { hypertrophyCoachConfig } from './configs/hypertrophy'
import { enduranceCoachConfig } from './configs/endurance'
import { conditioningCoachConfig } from './configs/conditioning'
import { mobilityCoachConfig } from './configs/mobility'
import { recoveryCoachConfig } from './configs/recovery'

export const coachRegistry = new CoachRegistry()
coachRegistry.register(strengthCoachConfig)
coachRegistry.register(hypertrophyCoachConfig)
coachRegistry.register(enduranceCoachConfig)
coachRegistry.register(conditioningCoachConfig)
coachRegistry.register(mobilityCoachConfig)
coachRegistry.register(recoveryCoachConfig)

export type { CoachConfig } from './types'
export { CoachRegistry } from './registry'
```

- [ ] **Step 5: Run tests → PASS**
- [ ] **Step 6: Commit**

```bash
git add src/lib/coaches/
git commit -m "feat: add 6 coach config files with personas, methodologies, and governance"
```

---

## Task 11: Database Migration

**Files:**
- Create: `supabase/migrations/012_skills_coach_config.sql`

- [ ] **Step 1: Read existing migration 010 for RLS pattern reference**

File: `supabase/migrations/010_session_inventory_architecture.sql`

- [ ] **Step 2: Write the migration**

Follow the spec exactly — 4 new tables, column additions, expanded CHECK, indexes. Use the same RLS pattern as migration 010.

```sql
-- 012_skills_coach_config.sql
-- Skills & Coach Config Architecture: new tables + column additions

-- ─── New Tables ─────────────────────────────────────────────────────────────

-- Check-in windows: tracks allocation windows and check-in state
CREATE TABLE IF NOT EXISTS check_in_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mesocycle_id UUID NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    allocation_start DATE NOT NULL,
    total_allocated INT NOT NULL DEFAULT 0,
    total_completed INT NOT NULL DEFAULT 0,
    early_completion BOOLEAN NOT NULL DEFAULT FALSE,
    missed_sessions INT NOT NULL DEFAULT 0,
    incomplete_week BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triggered', 'completed')),
    triggered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE check_in_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own check-in windows" ON check_in_windows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own check-in windows" ON check_in_windows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own check-in windows" ON check_in_windows FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own check-in windows" ON check_in_windows FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_check_in_windows_user_meso_week ON check_in_windows(user_id, mesocycle_id, week_number);

-- Athlete self-reports: weekly subjective check-in
CREATE TABLE IF NOT EXISTS athlete_self_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mesocycle_id UUID NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    sleep_quality INT NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
    energy_level INT NOT NULL CHECK (energy_level BETWEEN 1 AND 5),
    stress_level INT NOT NULL CHECK (stress_level BETWEEN 1 AND 5),
    motivation INT NOT NULL CHECK (motivation BETWEEN 1 AND 5),
    soreness JSONB NOT NULL DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE athlete_self_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own self-reports" ON athlete_self_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own self-reports" ON athlete_self_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own self-reports" ON athlete_self_reports FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own self-reports" ON athlete_self_reports FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_athlete_self_reports_user_meso_week ON athlete_self_reports(user_id, mesocycle_id, week_number);

-- Performance deltas: actual vs prescribed per exercise
CREATE TABLE IF NOT EXISTS performance_deltas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_inventory_id UUID NOT NULL REFERENCES session_inventory(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    prescribed_weight NUMERIC,
    actual_weight NUMERIC,
    prescribed_reps INT,
    actual_reps INT,
    prescribed_rpe NUMERIC,
    actual_rpe NUMERIC,
    delta_classification TEXT NOT NULL CHECK (delta_classification IN ('over_performing', 'on_track', 'under_performing')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE performance_deltas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own performance deltas" ON performance_deltas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own performance deltas" ON performance_deltas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own performance deltas" ON performance_deltas FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own performance deltas" ON performance_deltas FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_performance_deltas_session ON performance_deltas(session_inventory_id);

-- Skill execution log: audit trail
CREATE TABLE IF NOT EXISTS skill_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    input_hash TEXT NOT NULL,
    input_snapshot JSONB NOT NULL,
    output_snapshot JSONB NOT NULL,
    applied BOOLEAN NOT NULL DEFAULT FALSE,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE skill_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skill logs" ON skill_execution_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own skill logs" ON skill_execution_log FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_skill_log_name_created ON skill_execution_log(user_id, skill_name, created_at);

-- ─── Column Additions ───────────────────────────────────────────────────────

-- session_inventory: link to check-in window
ALTER TABLE session_inventory ADD COLUMN IF NOT EXISTS check_in_window_id UUID REFERENCES check_in_windows(id);

-- coaching_adjustments: tiered governance columns
ALTER TABLE coaching_adjustments ADD COLUMN IF NOT EXISTS tier INT CHECK (tier IN (1, 2, 3));
ALTER TABLE coaching_adjustments ADD COLUMN IF NOT EXISTS auto_applied BOOLEAN DEFAULT FALSE;
ALTER TABLE coaching_adjustments ADD COLUMN IF NOT EXISTS athlete_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE coaching_adjustments ADD COLUMN IF NOT EXISTS coach_persona_note TEXT;

-- Expand adjustment_type CHECK constraint
ALTER TABLE coaching_adjustments DROP CONSTRAINT IF EXISTS coaching_adjustments_adjustment_type_check;
ALTER TABLE coaching_adjustments ADD CONSTRAINT coaching_adjustments_adjustment_type_check
    CHECK (adjustment_type IN (
        'reduce_intensity', 'reduce_volume', 'increase_rest', 'swap_exercise',
        'add_deload', 'modify_pace', 'skip_session', 'add_session',
        'remove_session', 'volume_direction_change', 'end_block_early',
        'change_focus', 'trigger_unscheduled_deload'
    ));
```

- [ ] **Step 3: Apply migration to Supabase**

Run: `npx supabase db push` (or apply via Supabase dashboard if using hosted)

- [ ] **Step 4: Regenerate Supabase types**

Run: `npx supabase gen types typescript --local > src/lib/types/supabase.ts` (or equivalent for hosted)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/012_skills_coach_config.sql src/lib/types/supabase.ts
git commit -m "feat: add database migration for skills & coach config tables"
```

---

## Task 12: Performance Deltas Server Action

**Files:**
- Create: `src/lib/actions/performance-deltas.actions.ts`

- [ ] **Step 1: Implement the action**

This action is called after a workout session is completed. It:
1. Loads the `session_inventory` record (prescribed values)
2. Loads the logged `exercise_sets` (actual values)
3. Computes deltas per exercise
4. Classifies: >5% above = `over_performing`, within +/-5% = `on_track`, >5% below = `under_performing`
5. Writes `performance_deltas` rows

Reference: `src/lib/actions/logging.actions.ts` for the existing session completion flow.

- [ ] **Step 2: Hook into session completion**

Modify `src/lib/actions/logging.actions.ts` — add a call to `generatePerformanceDeltas()` after the session is marked complete (same hook point as `session_assessments`).

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/performance-deltas.actions.ts src/lib/actions/logging.actions.ts
git commit -m "feat: add performance delta generation on session completion"
```

---

## Task 13: Check-in System

**Files:**
- Create: `src/lib/actions/check-in.actions.ts`
- Modify: `src/lib/actions/inventory.actions.ts`

- [ ] **Step 1: Implement check-in window creation**

Modify `inventory.actions.ts` — when `applyAllocation()` is called, create a `check_in_windows` record with `status: 'open'`, `allocation_start`, and `total_allocated`.

- [ ] **Step 2: Implement check-in trigger logic**

In `check-in.actions.ts`, create:
- `checkAndTriggerCheckIn(userId, mesocycleId, weekNumber)` — called after session completion and on app open. Implements the two trigger conditions from the spec.
- `submitSelfReport(userId, mesocycleId, weekNumber, data)` — saves athlete self-report to `athlete_self_reports`.
- `runCheckInCycle(userId, mesocycleId, weekNumber)` — orchestrates the full check-in:
  1. Gather signals (recovery scorer skill + performance deltas + self-report)
  2. Tier 1: run auto-adjustments via skills
  3. Tier 2: call AI coach reasoning if needed
  4. Tier 3: create pending adjustment for athlete confirmation

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/check-in.actions.ts src/lib/actions/inventory.actions.ts
git commit -m "feat: add check-in system with trigger logic and tiered adjustments"
```

---

## Task 14: Orchestrator Refactor

**Files:**
- Modify: `src/lib/ai/orchestrator.ts`
- Modify: `src/lib/ai/prompts/strength-coach.ts`
- Modify: `src/lib/ai/prompts/endurance-coach.ts`
- Modify: `src/lib/ai/prompts/hypertrophy-coach.ts`
- Modify: `src/lib/ai/prompts/conditioning-coach.ts`
- Modify: `src/lib/ai/prompts/mobility-coach.ts`
- Modify: `src/lib/ai/prompts/recovery-coach.ts`

This is the largest refactor. The orchestrator becomes a generic engine.

- [ ] **Step 1: Refactor Pipeline A to use coach configs + skills**

Replace the coach-specific blocks in `generateMesocycleProgram()` with a generic loop:
```typescript
// Track shared skills already executed this cycle to avoid duplication
const executedSharedSkills = new Set<string>()

for (const entry of ctx.coachingTeam) {
  const config = coachRegistry.getCoach(entry.coach)
  if (!config) continue

  // Run assigned skills to pre-compute
  // IMPORTANT: shared skills (domain === 'shared') run ONCE per cycle, not per coach.
  // Check executedSharedSkills before running, add after execution.
  const preComputed = runPreComputation(config, strategy, ctx, executedSharedSkills)

  // Build prompt from config (persona + methodology + pre-computed data)
  const systemPrompt = buildPromptFromConfig(config, preComputed)

  // Call AI for creative work only
  const result = await generateStructuredResponse({ ... })
}
```

- [ ] **Step 2: Refactor Pipeline B to use tiered governance**

Replace the current Recovery Coach AI call with the `recovery-scorer` skill. Replace the coach-specific modification blocks with a generic loop reading from coach configs.

- [ ] **Step 3: Slim down prompt files**

Each prompt file (`strength-coach.ts`, etc.) should:
- Remove hardcoded methodology (now comes from config)
- Remove hardcoded persona details (now comes from config)
- Keep the prompt template structure
- Accept config data as parameters

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/
git commit -m "refactor: orchestrator to generic config-driven engine with skill pre-computation"
```

---

## Task 15: Bridge coaching-staff.ts

**Files:**
- Modify: `src/lib/coaching-staff.ts`

- [ ] **Step 1: Check all imports of coaching-staff**

Run: `grep -r "coaching-staff" src/ --include="*.ts" --include="*.tsx" -l`

- [ ] **Step 2: Add bridge exports**

Keep the existing `CoachProfile` interface and `ALL_COACHES` array working by re-exporting from coach configs. The UI still needs `CoachProfile` for avatar images and display. The new `CoachConfig` extends this for the coaching pipeline.

Add at the bottom of `coaching-staff.ts`:
```typescript
// Bridge to new coach config system
export { coachRegistry } from './coaches'
export type { CoachConfig } from './coaches/types'
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/coaching-staff.ts
git commit -m "feat: bridge coaching-staff.ts to new coach config system"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 4: Verify skill count**

```typescript
// Quick check in a test or script
import { skillRegistry } from '@/lib/skills'
console.log(`Skills registered: ${skillRegistry.getAllSkills().length}`) // Should be 11
```

- [ ] **Step 5: Verify coach count**

```typescript
import { coachRegistry } from '@/lib/coaches'
console.log(`Coaches registered: ${coachRegistry.getAllCoaches().length}`) // Should be 6
```

- [ ] **Step 6: Final commit if any cleanup needed**

```bash
git commit -m "chore: final verification and cleanup"
```
