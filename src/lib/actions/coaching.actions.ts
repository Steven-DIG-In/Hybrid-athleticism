'use server'

/**
 * Multi-Agent Coaching Actions — DRAINED.
 *
 * Pipeline A (mesocycle generation) was relocated to
 * `@/lib/engine/mesocycle/generate.ts` in Task 11 of the engine refactor.
 *
 * Pipeline B (`runWeeklyRecoveryCheck`) and its private helpers
 * (`computeMuscleGroupVolumes`, `loadNextWeekSessions`) were relocated to
 * `@/lib/engine/microcycle/adjust.ts` in Task 12 of the engine refactor —
 * merged with `orchestrator.runWeeklyAdjustment` + `runAdjustmentPipeline`
 * into a single canonical action.
 *
 * This file is intentionally empty and will be deleted in Task 14
 * (drained-files sweep).
 */

export {}
