/**
 * When is a weekly check-in due?
 *
 * Extracted from checkAndTriggerCheckIn 2026-09-07. The rule needs two callers with
 * different rights: the dashboard has to ASK whether a check-in is due (a read, during
 * render) while the check-in flow has to ACT on it (a write, on submit). Having the rule
 * live inside the writing action meant the read path would have had to duplicate it, and
 * two copies of a scheduling rule drift.
 *
 * Pure: no Supabase, no clock of its own. `now` is passed in so the boundary cases are
 * testable rather than dependent on when the suite runs.
 */

export type CheckInWindowStatus = 'open' | 'triggered' | 'completed'

export interface CheckInTriggerInput {
  status: CheckInWindowStatus
  /** Sessions allocated to a training day for this week. */
  totalAllocated: number
  /** Of those, how many are completed. */
  completed: number
  allocationStart: Date
  now: Date
}

export interface CheckInTriggerDecision {
  due: boolean
  reason: string
  /** Only meaningful when `due` — the counters the window should record. */
  missedSessions: number
  earlyCompletion: boolean
}

/** The allocation window an athlete gets to finish a week's sessions. */
export const ALLOCATION_WINDOW_DAYS = 7

const MS_PER_DAY = 1000 * 60 * 60 * 24

function notDue(reason: string): CheckInTriggerDecision {
  return { due: false, reason, missedSessions: 0, earlyCompletion: false }
}

export function evaluateCheckInTrigger(input: CheckInTriggerInput): CheckInTriggerDecision {
  const { status, totalAllocated, completed, allocationStart, now } = input

  if (status !== 'open') {
    return notDue(`Check-in already in status: ${status}`)
  }

  const daysSinceAllocation = (now.getTime() - allocationStart.getTime()) / MS_PER_DAY

  // Condition 1: the athlete finished everything that was allocated.
  if (totalAllocated > 0 && completed >= totalAllocated) {
    return {
      due: true,
      reason: 'All allocated sessions completed',
      missedSessions: 0,
      // Finished before the window closed — the recovery scorer treats this as a
      // positive signal, so it must not be set when the week merely timed out.
      earlyCompletion: daysSinceAllocation < ALLOCATION_WINDOW_DAYS,
    }
  }

  // Condition 2: the window elapsed, finished or not.
  if (daysSinceAllocation >= ALLOCATION_WINDOW_DAYS) {
    return {
      due: true,
      reason: `${ALLOCATION_WINDOW_DAYS}-day allocation window elapsed`,
      missedSessions: Math.max(0, totalAllocated - completed),
      earlyCompletion: false,
    }
  }

  return notDue('Trigger conditions not yet met')
}
