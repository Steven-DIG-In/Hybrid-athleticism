import type { Skill, SkillDomain } from './types'
import { SkillInputError } from './types'

export class SkillRegistry {
  private skills = new Map<string, Skill>()

  register(skill: Skill): void {
    this.skills.set(skill.name, skill)
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  getSkillsForDomain(domain: SkillDomain): Skill[] {
    return Array.from(this.skills.values()).filter(s => s.domain === domain)
  }

  executeSkill<TOutput = unknown>(name: string, input: unknown): TOutput {
    const skill = this.skills.get(name)
    if (!skill) throw new Error(`Skill not found: ${name}`)

    const parsed = skill.inputSchema.safeParse(input)
    if (!parsed.success) {
      throw new SkillInputError(name, parsed.error)
    }

    return skill.execute(parsed.data) as TOutput
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values())
  }
}
