import { describe, expect, it } from 'vitest'
import { getDomainMeta } from '@/lib/ai/orchestrator'

describe('coach programming metadata', () => {
    it('matches captured shape', () => {
        const meta = getDomainMeta()
        expect(serializeProgrammingMeta(meta)).toMatchSnapshot()
    })
})

function serializeProgrammingMeta(meta: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(meta).map(([domain, m]) => {
            const entry = m as Record<string, unknown>
            return [domain, {
                schemaName: (entry.schema as { constructor: { name: string } }).constructor.name,
                schemaShape: Object.keys(
                    (entry.schema as { _def?: { shape?: Record<string, unknown> } })._def?.shape ?? {}
                ).sort(),
                buildSystemPromptName: (entry.buildSystemPrompt as { name: string }).name,
                buildUserPromptName: (entry.buildUserPrompt as { name: string }).name,
                buildModSystemPromptName: (entry.buildModSystemPrompt as { name: string }).name,
                buildModUserPromptName: (entry.buildModUserPrompt as { name: string }).name,
                resultKey: entry.resultKey,
                modifiedKey: entry.modifiedKey,
                maxTokens: entry.maxTokens,
                temperature: entry.temperature,
                modTemperature: entry.modTemperature,
                logLabel: entry.logLabel,
            }]
        })
    )
}
