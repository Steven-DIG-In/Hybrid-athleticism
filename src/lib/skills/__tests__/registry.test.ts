import { describe, it, expect } from 'vitest'
import { SkillRegistry } from '../registry'
import { SkillInputError } from '../types'
import { z } from 'zod'
import type { Skill } from '../types'

const testSkill: Skill<{ value: number }, { result: number }> = {
  name: 'test-double',
  domain: 'strength',
  tier: 1,
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.number() }),
  execute: (input) => ({ result: input.value * 2 }),
}

describe('SkillRegistry', () => {
  it('registers and retrieves a skill by name', () => {
    const registry = new SkillRegistry()
    registry.register(testSkill)
    expect(registry.getSkill('test-double')).toBe(testSkill)
  })

  it('returns undefined for unknown skill', () => {
    const registry = new SkillRegistry()
    expect(registry.getSkill('nonexistent')).toBeUndefined()
  })

  it('retrieves skills by domain', () => {
    const registry = new SkillRegistry()
    registry.register(testSkill)
    const skills = registry.getSkillsForDomain('strength')
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('test-double')
  })

  it('executeSkill validates input and returns output', () => {
    const registry = new SkillRegistry()
    registry.register(testSkill)
    const result = registry.executeSkill('test-double', { value: 5 })
    expect(result).toEqual({ result: 10 })
  })

  it('executeSkill throws SkillInputError on invalid input', () => {
    const registry = new SkillRegistry()
    registry.register(testSkill)
    expect(() => registry.executeSkill('test-double', { value: 'not a number' }))
      .toThrow(SkillInputError)
  })

  it('executeSkill throws on unknown skill', () => {
    const registry = new SkillRegistry()
    expect(() => registry.executeSkill('nonexistent', {}))
      .toThrow('Skill not found: nonexistent')
  })
})
