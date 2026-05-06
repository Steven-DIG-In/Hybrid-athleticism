import type { ZodType } from 'zod'
import type {
    StrengthProgramValidated,
    EnduranceProgramValidated,
    HypertrophyProgramValidated,
    ConditioningProgramValidated,
    MobilityProgramValidated,
    RecoveryAssessmentValidated,
    AdjustmentDirectiveValidated,
    MesocycleStrategyValidated,
} from '@/lib/ai/schemas/week-brief'

export interface MesocycleGenerationResult {
    strategy: MesocycleStrategyValidated
    strengthProgram?: StrengthProgramValidated
    enduranceProgram?: EnduranceProgramValidated
    hypertrophyProgram?: HypertrophyProgramValidated
    conditioningProgram?: ConditioningProgramValidated
    mobilityProgram?: MobilityProgramValidated
}

export interface WeeklyAdjustmentResult {
    recovery: RecoveryAssessmentValidated
    directive?: AdjustmentDirectiveValidated
    modifiedStrengthSessions?: StrengthProgramValidated
    modifiedEnduranceSessions?: EnduranceProgramValidated
    modifiedHypertrophySessions?: HypertrophyProgramValidated
    modifiedConditioningSessions?: ConditioningProgramValidated
    modifiedMobilitySessions?: MobilityProgramValidated
}

export interface ProgrammingMeta {
    schema: ZodType
    buildSystemPrompt: () => string
    buildUserPrompt: (...args: unknown[]) => string
    buildModSystemPrompt: () => string
    buildModUserPrompt: (...args: unknown[]) => string
    resultKey: keyof MesocycleGenerationResult
    modifiedKey: keyof WeeklyAdjustmentResult
    maxTokens: number
    temperature: number
    modTemperature: number
    logLabel: string
    logSummary: (data: unknown) => string
}
