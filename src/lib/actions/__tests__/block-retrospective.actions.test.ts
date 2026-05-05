import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    mesocycle: null as any,
    existingRetrospective: null as any,
    rpcCalls: [] as Array<{ name: string; args: any }>,
    rpcResult: null as any,
    rpcShouldThrow: null as Error | null,
    user: { id: 'u1' } as any,
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
  const handler = (table: string) => {
    if (table === 'mesocycles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: state.mesocycle, error: null })),
            })),
            maybeSingle: vi.fn(async () => ({ data: state.mesocycle, error: null })),
          })),
        })),
      }
    }
    if (table === 'block_retrospectives') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: state.existingRetrospective, error: null,
              })),
            })),
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: state.existingRetrospective, error: null,
                })),
              })),
            })),
          })),
        })),
      }
    }
    return {}
  }
  const client = {
    from: vi.fn(handler),
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
    rpc: vi.fn(async (name: string, args: any) => {
      state.rpcCalls.push({ name, args })
      if (state.rpcShouldThrow) throw state.rpcShouldThrow
      return { data: state.rpcResult, error: null }
    }),
  }
  return { createClient: vi.fn(async () => client) }
})

vi.mock('@/lib/analytics/block-retrospective', () => ({
  buildBlockRetrospectiveSnapshot: vi.fn(async (id: string) => ({
    schemaVersion: 1,
    block: { id, name: 'Test', goal: 'X', weekCount: 1,
      startDate: '2026-01-01', endDate: '2026-01-07', closedAt: '2026-01-08T00:00:00Z' },
    adherence: { overall: { prescribed: 1, completed: 1, missed: 0, pct: 100 },
      byCoachDomain: {} as any, byWeek: [] },
    executionQuality: { byCoachDomain: {} as any },
    recalibrations: [], interventions: [], missedSessions: [],
  })),
}))

import {
  closeMesocycle,
  getLatestBlockRetrospective,
  getBlockRetrospective,
} from '../block-retrospective.actions'

describe('block-retrospective actions', () => {
  beforeEach(() => {
    state.mesocycle = null
    state.existingRetrospective = null
    state.rpcCalls.length = 0
    state.rpcResult = null
    state.rpcShouldThrow = null
    state.user = { id: 'u1' }
    vi.clearAllMocks()
  })

  describe('closeMesocycle', () => {
    it('happy path — calls RPC with snapshot, returns success', async () => {
      state.mesocycle = { id: 'm1', user_id: 'u1', is_active: true, is_complete: false }
      state.rpcResult = { id: 'retro-1', mesocycle_id: 'm1' }

      const r = await closeMesocycle('m1')

      expect(r.success).toBe(true)
      expect(state.rpcCalls).toHaveLength(1)
      expect(state.rpcCalls[0].name).toBe('close_mesocycle')
      expect(state.rpcCalls[0].args.p_mesocycle_id).toBe('m1')
      expect(state.rpcCalls[0].args.p_snapshot.schemaVersion).toBe(1)
    })

    it('rejects when mesocycle is already closed', async () => {
      state.mesocycle = { id: 'm1', user_id: 'u1', is_active: false, is_complete: true }
      state.existingRetrospective = { id: 'retro-1', mesocycle_id: 'm1' }

      const r = await closeMesocycle('m1')

      expect(r.success).toBe(false)
      if (!r.success) expect(r.error).toMatch(/already closed/i)
      expect(state.rpcCalls).toHaveLength(0)
    })

    it('rejects when not authenticated', async () => {
      state.user = null
      const r = await closeMesocycle('m1')
      expect(r.success).toBe(false)
      if (!r.success) expect(r.error).toMatch(/not authenticated/i)
    })

    it('surfaces RPC throw as failure result', async () => {
      state.mesocycle = { id: 'm1', user_id: 'u1', is_active: true, is_complete: false }
      state.rpcShouldThrow = new Error('mesocycle already closed')

      const r = await closeMesocycle('m1')

      expect(r.success).toBe(false)
      if (!r.success) expect(r.error).toMatch(/already closed/i)
    })
  })

  describe('getLatestBlockRetrospective', () => {
    it('returns the snapshot when one exists', async () => {
      state.existingRetrospective = {
        id: 'r1', mesocycle_id: 'm1',
        snapshot: { schemaVersion: 1, block: { id: 'm1' } },
      }
      const r = await getLatestBlockRetrospective()
      expect(r.success).toBe(true)
      if (r.success) expect(r.data?.block.id).toBe('m1')
    })

    it('returns null when no retrospectives exist', async () => {
      state.existingRetrospective = null
      const r = await getLatestBlockRetrospective()
      expect(r.success).toBe(true)
      if (r.success) expect(r.data).toBeNull()
    })
  })

  describe('getBlockRetrospective', () => {
    it('returns the snapshot for a specific mesocycle', async () => {
      state.existingRetrospective = {
        id: 'r1', mesocycle_id: 'm1',
        snapshot: { schemaVersion: 1, block: { id: 'm1' } },
      }
      const r = await getBlockRetrospective('m1')
      expect(r.success).toBe(true)
      if (r.success) expect(r.data?.block.id).toBe('m1')
    })

    it('returns null when not found', async () => {
      state.existingRetrospective = null
      const r = await getBlockRetrospective('nope')
      expect(r.success).toBe(true)
      if (r.success) expect(r.data).toBeNull()
    })
  })
})
