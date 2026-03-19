import type { ZodType } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CoachDomain = 'strength' | 'endurance' | 'hypertrophy' | 'conditioning' | 'mobility' | 'recovery'
export type SharedDomain = 'shared'
export type SkillDomain = CoachDomain | SharedDomain

export interface Skill<TInput = unknown, TOutput = unknown> {
  name: string
  domain: SkillDomain
  tier: 1
  inputSchema: ZodType<TInput>
  outputSchema: ZodType<TOutput>
  execute(input: TInput): TOutput
  apply?(output: TOutput, supabase: SupabaseClient): Promise<void>
}

export class SkillInputError extends Error {
  constructor(
    public skillName: string,
    public zodError: unknown,
  ) {
    super(`SkillInputError [${skillName}]: ${JSON.stringify(zodError)}`)
    this.name = 'SkillInputError'
  }
}
