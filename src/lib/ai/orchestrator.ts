/**
 * Multi-Agent Coaching Orchestrator — DRAINED.
 *
 * Pipeline A (Mesocycle Generation) was relocated to
 * `@/lib/engine/mesocycle/generate.ts` in Task 11 of the engine refactor.
 *
 * Pipeline B (`runWeeklyAdjustment` + `runAdjustmentPipeline`) was
 * relocated to `@/lib/engine/microcycle/adjust.ts` in Task 12 of the
 * engine refactor — merged with `coaching.actions.runWeeklyRecoveryCheck`
 * into a single canonical action `runWeeklyRecoveryCheck`.
 *
 * Re-exports preserved here for backwards-compat type imports until the
 * file is deleted in Task 14 (drained-files sweep).
 */

export type { MesocycleGenerationResult, WeeklyAdjustmentResult } from '@/lib/engine/types'
