import { z } from 'zod'
import type { Skill } from '../../types'

const sessionSchema = z.object({
  date: z.string(), // ISO date string
  modality: z.enum(['LIFTING', 'CARDIO', 'METCON', 'RUCKING', 'MOBILITY']),
  domain: z.string(),
  isHeavyLegs: z.boolean(),
})

const inputSchema = z.object({
  sessions: z.array(sessionSchema),
})

type Input = z.infer<typeof inputSchema>
type Session = z.infer<typeof sessionSchema>

type ViolationType = 'strength_spacing' | 'cardio_spacing' | 'legs_before_run'

interface Violation {
  type: ViolationType
  sessionA: string
  sessionB: string
  hoursGap: number
  rule: string
}

interface Output {
  violations: Violation[]
  isClean: boolean
}

const outputSchema = z.object({
  violations: z.array(
    z.object({
      type: z.enum(['strength_spacing', 'cardio_spacing', 'legs_before_run']),
      sessionA: z.string(),
      sessionB: z.string(),
      hoursGap: z.number(),
      rule: z.string(),
    }),
  ),
  isClean: z.boolean(),
})

function hoursGap(a: Session, b: Session): number {
  const aTime = new Date(a.date).getTime()
  const bTime = new Date(b.date).getTime()
  return Math.abs(bTime - aTime) / (1000 * 60 * 60)
}

function sameDay(a: Session, b: Session): boolean {
  const aDate = a.date.slice(0, 10)
  const bDate = b.date.slice(0, 10)
  return aDate === bDate
}

function execute(input: Input): Output {
  const violations: Violation[] = []
  const sessions = input.sessions

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i]
      const b = sessions[j]
      const gap = hoursGap(a, b)

      // Rule: 48hr minimum between LIFTING sessions
      if (a.modality === 'LIFTING' && b.modality === 'LIFTING') {
        if (gap < 48) {
          violations.push({
            type: 'strength_spacing',
            sessionA: a.date,
            sessionB: b.date,
            hoursGap: Math.round(gap * 10) / 10,
            rule: 'Minimum 48 hours required between LIFTING sessions',
          })
        }
      }

      // Rule: 24hr minimum between CARDIO sessions
      if (a.modality === 'CARDIO' && b.modality === 'CARDIO') {
        if (gap < 24) {
          violations.push({
            type: 'cardio_spacing',
            sessionA: a.date,
            sessionB: b.date,
            hoursGap: Math.round(gap * 10) / 10,
            rule: 'Minimum 24 hours required between CARDIO sessions',
          })
        }
      }

      // Rule: LIFTING with heavy legs on the same day as CARDIO
      const liftWithLegs = a.modality === 'LIFTING' && a.isHeavyLegs
      const liftWithLegsB = b.modality === 'LIFTING' && b.isHeavyLegs
      const cardioA = a.modality === 'CARDIO'
      const cardioB = b.modality === 'CARDIO'

      if (liftWithLegs && cardioB && sameDay(a, b)) {
        violations.push({
          type: 'legs_before_run',
          sessionA: a.date,
          sessionB: b.date,
          hoursGap: Math.round(gap * 10) / 10,
          rule: 'Heavy leg LIFTING and CARDIO on the same day impairs run performance',
        })
      } else if (liftWithLegsB && cardioA && sameDay(a, b)) {
        violations.push({
          type: 'legs_before_run',
          sessionA: b.date,
          sessionB: a.date,
          hoursGap: Math.round(gap * 10) / 10,
          rule: 'Heavy leg LIFTING and CARDIO on the same day impairs run performance',
        })
      }
    }
  }

  return {
    violations,
    isClean: violations.length === 0,
  }
}

export const interferenceCheckerSkill: Skill<Input, Output> = {
  name: 'interference-checker',
  domain: 'shared',
  tier: 1,
  inputSchema,
  outputSchema,
  execute,
}
