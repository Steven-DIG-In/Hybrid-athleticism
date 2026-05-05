export type PendingPlannerNoteSource =
  | 'block_close'
  | 'block_start_wizard'
  | 'mid_block_signal'

export type AvailabilityAnswers = {
  daysPerWeek: number
  sessionMinutes: number
  warmupMinutes: number   // 0 means skipped
  cooldownMinutes: number // 0 means none
}

export type SignalEvidence = {
  overrunSessions: Array<{
    workoutId: string
    estimatedMinutes: number
    actualMinutes: number
  }>
  avgOverrunMinutes: number
  avgOverrunPct: number
  sessionsConsidered: number
}

export type PendingPlannerNotes = {
  schemaVersion: 1
  source: PendingPlannerNoteSource
  capturedAt: string  // ISO timestamp
  availability?: AvailabilityAnswers
  freeText?: string  // max 200 chars, sanitized
  signalEvidence?: SignalEvidence
  dismissedWithoutAnswer?: boolean  // only when source='mid_block_signal' + dismiss
}

/** Deep-merges `next` into `prev` per the spec's merge rule.
 *  - schemaVersion / source / capturedAt: overwritten by `next`
 *  - availability: deep-merged (next keys override; prev keys preserved)
 *  - freeText: appended with \n separator, truncated to 200 chars
 *  - signalEvidence: overwritten by `next`
 *  - dismissedWithoutAnswer: overwritten by `next` (next answer-bearing write clears the flag)
 */
export function mergePendingPlannerNotes(
  prev: PendingPlannerNotes | null,
  next: PendingPlannerNotes,
): PendingPlannerNotes {
  if (!prev) return next

  const availability: AvailabilityAnswers | undefined =
    prev.availability || next.availability
      ? { ...(prev.availability ?? {}), ...(next.availability ?? {}) } as AvailabilityAnswers
      : undefined

  let freeText: string | undefined
  if (prev.freeText && next.freeText) {
    freeText = `${prev.freeText}\n${next.freeText}`.slice(0, 200)
  } else {
    freeText = next.freeText ?? prev.freeText
  }

  return {
    schemaVersion: 1,
    source: next.source,
    capturedAt: next.capturedAt,
    ...(availability ? { availability } : {}),
    ...(freeText ? { freeText } : {}),
    ...(next.signalEvidence ? { signalEvidence: next.signalEvidence } : {}),
    ...(next.dismissedWithoutAnswer != null
      ? { dismissedWithoutAnswer: next.dismissedWithoutAnswer }
      : {}),
  }
}
