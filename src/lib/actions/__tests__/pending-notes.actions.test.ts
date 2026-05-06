import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    profile: { id: 'u1', pending_planner_notes: null } as any,
    updates: [] as Array<{ table: string; patch: any }>,
    user: { id: 'u1' } as any,
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
  const handler = (table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: state.profile, error: null })),
            single: vi.fn(async () => ({ data: state.profile, error: null })),
          })),
        })),
        update: vi.fn((patch: any) => ({
          eq: vi.fn(async () => {
            state.updates.push({ table, patch })
            // Mutate fixture so subsequent reads see the new value (merge tests need this).
            state.profile = { ...state.profile, ...patch }
            return { data: null, error: null }
          }),
        })),
      }
    }
    return {}
  }
  const client = {
    from: vi.fn(handler),
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
  }
  return { createClient: vi.fn(async () => client) }
})

import {
  submitRealityCheck,
  dismissOverrunSignal,
  getPendingPlannerNotes,
  clearPendingPlannerNotes,
} from '../pending-notes.actions'

describe('pending-notes actions', () => {
  beforeEach(() => {
    state.profile = { id: 'u1', pending_planner_notes: null }
    state.updates.length = 0
    state.user = { id: 'u1' }
    vi.clearAllMocks()
  })

  describe('submitRealityCheck', () => {
    it('happy path — empty profile, writes new entry', async () => {
      const r = await submitRealityCheck({
        source: 'block_close',
        availability: { daysPerWeek: 5, sessionMinutes: 50, warmupMinutes: 15, cooldownMinutes: 5 },
      })
      expect(r.success).toBe(true)
      expect(state.updates).toHaveLength(1)
      const note = state.updates[0].patch.pending_planner_notes
      expect(note.schemaVersion).toBe(1)
      expect(note.source).toBe('block_close')
      expect(note.availability.daysPerWeek).toBe(5)
      expect(note.capturedAt).toBeTruthy()
    })

    it('merges with existing pending notes (deep merge on availability)', async () => {
      state.profile = {
        id: 'u1',
        pending_planner_notes: {
          schemaVersion: 1,
          source: 'block_close',
          capturedAt: '2026-05-01T00:00:00Z',
          availability: { daysPerWeek: 5, sessionMinutes: 60, warmupMinutes: 10, cooldownMinutes: 5 },
        },
      }
      const r = await submitRealityCheck({
        source: 'mid_block_signal',
        availability: { daysPerWeek: 5, sessionMinutes: 60, warmupMinutes: 20, cooldownMinutes: 5 },
        signalEvidence: {
          overrunSessions: [], avgOverrunMinutes: 18, avgOverrunPct: 25, sessionsConsidered: 3,
        },
      })
      expect(r.success).toBe(true)
      const note = state.updates[0].patch.pending_planner_notes
      expect(note.source).toBe('mid_block_signal')
      expect(note.availability.warmupMinutes).toBe(20)  // overridden
      expect(note.signalEvidence.avgOverrunMinutes).toBe(18)
    })

    it('truncates freeText to 200 chars', async () => {
      const longText = 'x'.repeat(300)
      const r = await submitRealityCheck({ source: 'block_close', freeText: longText })
      expect(r.success).toBe(true)
      const note = state.updates[0].patch.pending_planner_notes
      expect(note.freeText.length).toBe(200)
    })

    it('rejects when not authenticated', async () => {
      state.user = null
      const r = await submitRealityCheck({ source: 'block_close' })
      expect(r.success).toBe(false)
      if (!r.success) expect(r.error).toMatch(/not authenticated/i)
    })
  })

  describe('dismissOverrunSignal', () => {
    it('writes minimal dismiss-marker', async () => {
      const r = await dismissOverrunSignal({
        overrunSessions: [{ workoutId: 'w1', estimatedMinutes: 60, actualMinutes: 78 }],
        avgOverrunMinutes: 18, avgOverrunPct: 30, sessionsConsidered: 1,
      })
      expect(r.success).toBe(true)
      const note = state.updates[0].patch.pending_planner_notes
      expect(note.source).toBe('mid_block_signal')
      expect(note.dismissedWithoutAnswer).toBe(true)
      expect(note.signalEvidence.avgOverrunMinutes).toBe(18)
      expect(note.availability).toBeUndefined()
    })

    it('idempotent — second dismiss merges, doesn\'t error', async () => {
      const evidence = {
        overrunSessions: [], avgOverrunMinutes: 18, avgOverrunPct: 30, sessionsConsidered: 3,
      }
      await dismissOverrunSignal(evidence)
      const r = await dismissOverrunSignal(evidence)
      expect(r.success).toBe(true)
    })
  })

  describe('getPendingPlannerNotes', () => {
    it('returns null when none', async () => {
      const r = await getPendingPlannerNotes()
      expect(r.success).toBe(true)
      if (r.success) expect(r.data).toBeNull()
    })

    it('returns typed entry when present', async () => {
      state.profile = {
        id: 'u1',
        pending_planner_notes: {
          schemaVersion: 1, source: 'block_close', capturedAt: '2026-05-01T00:00:00Z',
        },
      }
      const r = await getPendingPlannerNotes()
      expect(r.success).toBe(true)
      if (r.success) expect(r.data?.source).toBe('block_close')
    })
  })

  describe('clearPendingPlannerNotes', () => {
    it('sets profile.pending_planner_notes to null', async () => {
      state.profile = {
        id: 'u1',
        pending_planner_notes: { schemaVersion: 1, source: 'block_close', capturedAt: '2026-05-01T00:00:00Z' },
      }
      const r = await clearPendingPlannerNotes()
      expect(r.success).toBe(true)
      expect(state.updates[0].patch.pending_planner_notes).toBeNull()
    })
  })
})
