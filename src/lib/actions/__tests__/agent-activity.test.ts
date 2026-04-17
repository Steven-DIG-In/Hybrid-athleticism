import { describe, it, expect, beforeEach, vi } from 'vitest'

const { insertsLog } = vi.hoisted(() => ({
    insertsLog: [] as any[]
}))

vi.mock('@/lib/supabase/server', () => {
    const client = {
        from: vi.fn((table: string) => {
            if (table !== 'agent_activity') throw new Error(`unexpected table ${table}`)
            const chain: any = {
                insert: vi.fn((row: any) => {
                    insertsLog.push(row)
                    return {
                        select: vi.fn(() => ({
                            single: vi.fn(async () => ({
                                data: { ...row, id: 'a1', created_at: new Date().toISOString() },
                                error: null
                            }))
                        }))
                    }
                })
            }
            return chain
        }),
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
        }
    }
    return { createClient: vi.fn(async () => client) }
})

import { logDecision } from '../agent-activity.actions'

describe('logDecision', () => {
    beforeEach(() => {
        insertsLog.length = 0
        vi.clearAllMocks()
    })

    it('writes row with all required fields', async () => {
        await logDecision({
            coach: 'strength',
            decisionType: 'recalibration',
            targetEntity: { type: 'training_max', lift: 'squat' },
            reasoningStructured: { previousMax: 140, newMax: 132, driftPct: -0.057 },
            reasoningText: 'Training max 140→132kg'
        })
        expect(insertsLog).toHaveLength(1)
        expect(insertsLog[0]).toMatchObject({
            user_id: 'u1',
            coach: 'strength',
            decision_type: 'recalibration',
            target_entity: { type: 'training_max', lift: 'squat' },
            reasoning_text: 'Training max 140→132kg'
        })
    })

    it('passes mesocycle_id and week_number through when provided', async () => {
        await logDecision({
            coach: 'endurance',
            decisionType: 'intervention_fired',
            targetEntity: { type: 'intervention', id: 'int-1' },
            reasoningStructured: { pattern: 'metcon-too-hard' },
            reasoningText: 'Pattern triggered',
            mesocycleId: 'meso-42',
            weekNumber: 3
        })
        expect(insertsLog[0]).toMatchObject({
            mesocycle_id: 'meso-42',
            week_number: 3
        })
    })

    it('defaults mesocycle_id and week_number to null when omitted', async () => {
        await logDecision({
            coach: 'head',
            decisionType: 'recalibration',
            targetEntity: { type: 'training_max' },
            reasoningStructured: {},
            reasoningText: 'x'
        })
        expect(insertsLog[0].mesocycle_id).toBeNull()
        expect(insertsLog[0].week_number).toBeNull()
    })

    it('returns the inserted row', async () => {
        const row = await logDecision({
            coach: 'strength',
            decisionType: 'recalibration',
            targetEntity: {},
            reasoningStructured: {},
            reasoningText: 'test'
        })
        expect(row.id).toBe('a1')
        expect(row.created_at).toBeDefined()
    })

    it('throws when unauthenticated', async () => {
        const mod: any = await import('@/lib/supabase/server')
        const client = await mod.createClient()
        const orig = client.auth.getUser
        client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        try {
            await expect(
                logDecision({
                    coach: 'strength',
                    decisionType: 'recalibration',
                    targetEntity: {},
                    reasoningStructured: {},
                    reasoningText: 'x'
                })
            ).rejects.toThrow('unauthenticated')
        } finally {
            client.auth.getUser = orig
        }
    })
})
