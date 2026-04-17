import { describe, it, expect, beforeEach, vi } from 'vitest'

const { insertsLog } = vi.hoisted(() => ({ insertsLog: [] as any[] }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
    const client = {
        from: vi.fn(() => ({
            insert: vi.fn((row: any) => {
                insertsLog.push(row)
                return {
                    select: vi.fn(() => ({
                        single: vi.fn(async () => ({
                            data: { id: `op${insertsLog.length}` }, error: null
                        }))
                    }))
                }
            })
        })),
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }
    }
    return { createClient: vi.fn(async () => client) }
})

import { logOffPlanSession } from '../logging.actions'

describe('logOffPlanSession', () => {
    beforeEach(() => { insertsLog.length = 0; vi.clearAllMocks() })

    it('inserts with derived count_toward_load=true for run', async () => {
        const r = await logOffPlanSession({ modality: 'run', durationMinutes: 45 })
        expect(r.success).toBe(true)
        expect(insertsLog[0]).toMatchObject({
            modality: 'run',
            duration_minutes: 45,
            count_toward_load: true,
            linked_domain: 'endurance'
        })
    })

    it('inserts with derived count_toward_load=false for mobility', async () => {
        await logOffPlanSession({ modality: 'mobility', durationMinutes: 15 })
        expect(insertsLog[0]).toMatchObject({
            modality: 'mobility',
            count_toward_load: false,
            linked_domain: 'mobility'
        })
    })

    it('explicit countTowardLoad overrides default', async () => {
        await logOffPlanSession({ modality: 'mobility', durationMinutes: 15, countTowardLoad: true })
        expect(insertsLog[0].count_toward_load).toBe(true)
    })

    it('preserves rpe and notes when provided', async () => {
        await logOffPlanSession({
            modality: 'run', durationMinutes: 45, rpe: 7, notes: 'easy zone 2'
        })
        expect(insertsLog[0]).toMatchObject({ rpe: 7, notes: 'easy zone 2' })
    })

    it('other modality has linked_domain=null and count=false by default', async () => {
        await logOffPlanSession({ modality: 'other', durationMinutes: 60 })
        expect(insertsLog[0]).toMatchObject({
            linked_domain: null, count_toward_load: false
        })
    })

    it('returns failure for invalid duration', async () => {
        const r = await logOffPlanSession({ modality: 'run', durationMinutes: 0 })
        expect(r.success).toBe(false)
    })

    it('returns failure when unauthenticated', async () => {
        const mod: any = await import('@/lib/supabase/server')
        const client = await mod.createClient()
        const orig = client.auth.getUser
        client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        try {
            const r = await logOffPlanSession({ modality: 'run', durationMinutes: 30 })
            expect(r.success).toBe(false)
        } finally {
            client.auth.getUser = orig
        }
    })
})
