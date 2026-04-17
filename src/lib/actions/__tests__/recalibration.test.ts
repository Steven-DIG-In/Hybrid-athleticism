import { describe, it, expect, beforeEach, vi } from 'vitest'

const { decisionLog, interventionsLog } = vi.hoisted(() => ({
    decisionLog: [] as any[],
    interventionsLog: [] as any[]
}))

vi.mock('../agent-activity.actions', () => ({
    logDecision: vi.fn(async (input: any) => {
        decisionLog.push(input)
        return { id: `a${decisionLog.length}` }
    })
}))

vi.mock('../ai-coach.actions', () => ({
    saveCoachIntervention: vi.fn(async (input: any) => {
        interventionsLog.push(input)
        return { success: true, data: { id: `i${interventionsLog.length}` } }
    })
}))

import { evaluateRecalibration } from '../recalibration.actions'

describe('evaluateRecalibration — tiered gate', () => {
    beforeEach(() => {
        decisionLog.length = 0
        interventionsLog.length = 0
        vi.clearAllMocks()
    })

    it('drift < 5%: tier=visible, applied=true, one agent_activity row (recalibration), no intervention', async () => {
        const res = await evaluateRecalibration({
            coach: 'strength',
            previousMax: 100,
            observedMax: 97,
            evidence: { sessionIds: ['s1'] }
        })
        expect(res.tier).toBe('visible')
        expect(res.applied).toBe(true)
        expect(res.newMax).toBe(97)
        expect(decisionLog).toHaveLength(1)
        expect(decisionLog[0].decisionType).toBe('recalibration')
        expect(interventionsLog).toHaveLength(0)
    })

    it('drift 5–10%: tier=logged, applied=true, one agent_activity row, no intervention', async () => {
        const res = await evaluateRecalibration({
            coach: 'strength',
            previousMax: 100,
            observedMax: 93,
            evidence: { sessionIds: ['s1'] }
        })
        expect(res.tier).toBe('logged')
        expect(res.applied).toBe(true)
        expect(decisionLog).toHaveLength(1)
        expect(decisionLog[0].decisionType).toBe('recalibration')
        expect(interventionsLog).toHaveLength(0)
    })

    it('drift > 10% with microcycleId: tier=intervention, applied=false, intervention created, one agent_activity row (intervention_fired)', async () => {
        const res = await evaluateRecalibration({
            coach: 'strength',
            previousMax: 100,
            observedMax: 85,
            evidence: { sessionIds: ['s1', 's2', 's3'] },
            microcycleId: 'mc-1'
        })
        expect(res.tier).toBe('intervention')
        expect(res.applied).toBe(false)
        expect(res.newMax).toBe(100) // not recalibrated
        expect(interventionsLog).toHaveLength(1)
        expect(interventionsLog[0].microcycleId).toBe('mc-1')
        expect(interventionsLog[0].triggerType).toBe('recalibration_prompt')
        expect(decisionLog).toHaveLength(1)
        expect(decisionLog[0].decisionType).toBe('intervention_fired')
        expect(decisionLog[0].reasoningStructured.interventionId).toBe('i1')
    })

    it('drift > 10% without microcycleId: skips intervention, still logs agent_activity', async () => {
        const res = await evaluateRecalibration({
            coach: 'strength',
            previousMax: 100,
            observedMax: 85,
            evidence: { sessionIds: ['s1'] }
        })
        expect(res.tier).toBe('intervention')
        expect(interventionsLog).toHaveLength(0)
        expect(decisionLog).toHaveLength(1)
        expect(decisionLog[0].decisionType).toBe('intervention_fired')
        expect(decisionLog[0].reasoningStructured.interventionId).toBeNull()
    })

    it('drift > 10% when saveCoachIntervention fails: logs agent_activity and continues', async () => {
        const ai = await import('../ai-coach.actions')
        const orig = ai.saveCoachIntervention
        ;(ai as any).saveCoachIntervention = vi.fn(async () => ({
            success: false, error: 'db down'
        }))
        try {
            const res = await evaluateRecalibration({
                coach: 'strength',
                previousMax: 100,
                observedMax: 85,
                evidence: { sessionIds: ['s1'] },
                microcycleId: 'mc-1'
            })
            expect(res.tier).toBe('intervention')
            expect(decisionLog).toHaveLength(1)
            expect(decisionLog[0].decisionType).toBe('intervention_fired')
        } finally {
            ;(ai as any).saveCoachIntervention = orig
        }
    })

    it('throws when previousMax is 0', async () => {
        await expect(
            evaluateRecalibration({
                coach: 'strength',
                previousMax: 0,
                observedMax: 50,
                evidence: { sessionIds: ['s1'] }
            })
        ).rejects.toThrow('previousMax cannot be zero')
    })

    it('drift magnitude uses absolute value (negative drift still triggers correct tier)', async () => {
        const res = await evaluateRecalibration({
            coach: 'strength',
            previousMax: 100,
            observedMax: 115, // +15% — over-performance
            evidence: { sessionIds: ['s1'] },
            microcycleId: 'mc-1'
        })
        expect(res.tier).toBe('intervention')
        expect(interventionsLog).toHaveLength(1)
    })
})
