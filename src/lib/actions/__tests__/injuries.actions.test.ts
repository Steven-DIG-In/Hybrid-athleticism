import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    user: { id: 'u1' } as any,
    rows: [] as any[],
    updateError: null as any,
    filters: [] as Array<[string, unknown]>,
    patch: null as any,
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
  const chain = (result: () => any) => {
    const c: any = {
      eq: vi.fn((col: string, val: unknown) => { state.filters.push([col, val]); return c }),
      order: vi.fn(() => c),
      select: vi.fn(() => c),
      then: (resolve: any) => resolve(result()),
    }
    return c
  }
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => chain(() => ({ data: state.rows, error: null }))),
      update: vi.fn((patch: any) => {
        state.patch = patch
        return chain(() => ({ data: state.updateError ? null : [{ id: 'inj1' }], error: state.updateError }))
      }),
    })),
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
  }
  return { createClient: vi.fn(async () => client) }
})

import { getActiveInjuries, resolveInjury } from '../injuries.actions'

describe('injuries actions', () => {
  beforeEach(() => {
    state.user = { id: 'u1' }
    state.rows = []
    state.updateError = null
    state.filters = []
    state.patch = null
  })

  it('getActiveInjuries reads only the caller’s active rows', async () => {
    state.rows = [{ id: 'inj1', body_area: 'other', is_active: true }]
    const r = await getActiveInjuries()
    expect(r).toEqual({ success: true, data: state.rows })
    expect(state.filters).toContainEqual(['user_id', 'u1'])
    expect(state.filters).toContainEqual(['is_active', true])
  })

  it('resolveInjury deactivates the row, scoped to id and caller', async () => {
    const r = await resolveInjury('inj1')
    expect(r.success).toBe(true)
    expect(state.patch.is_active).toBe(false)
    expect(typeof state.patch.updated_at).toBe('string')
    expect(state.filters).toContainEqual(['id', 'inj1'])
    expect(state.filters).toContainEqual(['user_id', 'u1'])
  })

  it('resolveInjury surfaces a failed update instead of reporting success', async () => {
    state.updateError = { message: 'permission denied' }
    const r = await resolveInjury('inj1')
    expect(r).toEqual({ success: false, error: 'permission denied' })
  })

  it('refuses unauthenticated callers', async () => {
    state.user = null
    expect((await resolveInjury('inj1')).success).toBe(false)
    expect((await getActiveInjuries()).success).toBe(false)
  })
})
