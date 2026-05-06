// src/lib/coaches/types.ts
import type { CoachDomain } from '@/lib/skills/types'
import type { ProgrammingMeta } from '@/lib/engine/types'

export interface CoachConfig {
  id: CoachDomain
  persona: {
    name: string
    title: string
    bio: string
    voiceGuidelines: string
  }
  methodology: {
    philosophy: string
    principles: string[]
    references: string[]
  }
  assignedSkills: string[]
  checkIn: {
    assessmentPrompt: string
    signalWeights: {
      rpeDeviation: number
      rirDeviation: number
      completionRate: number
      earlyCompletion: number
      missedSessions: number
      selfReportEnergy: number
      selfReportSoreness: number
      selfReportSleep: number
      selfReportStress: number
      selfReportMotivation: number
    }
  }
  governance: {
    tier1Auto: string[]
    tier2CoachDecides: string[]
    tier3AthleteConfirms: string[]
  }
  alwaysActive: boolean
  programming?: ProgrammingMeta
}
