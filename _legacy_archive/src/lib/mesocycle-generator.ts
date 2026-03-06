/**
 * Mesocycle Generator
 *
 * Creates a multi-week training block with:
 * - Progressive volume (MEV → MAV)
 * - RPE/RIR periodization
 * - Auto-generated sessions based on user equipment
 * - Deload week at the end
 */

import { type WeeklyPlan, type PlannedSession, generateWeeklyPlan, type WeekDay, type DomainPriority } from './program-generator'
import {
  type SessionTemplate,
  type GeneratedSession,
  type PlannedExercise,
  getTemplateForSession,
  generateSessionExercises,
  getVolumeMultiplierForWeek,
  getRPEForWeek,
} from './session-templates'
import { type Equipment } from './exercise-library'

export interface MesocycleConfig {
  name: string
  totalWeeks: number
  startDate: Date
  // User settings
  availableDays: WeekDay[]
  strengthPriority: DomainPriority
  ruckingPriority: DomainPriority
  cardioPriority: DomainPriority
  preferredSessionDuration: number
  maxSessionsPerDay: number
  userEquipment: Equipment[]
  // Volume landmarks (optional - will use defaults if not provided)
  volumeLandmarks?: MuscleVolumeLandmarks[]
}

export interface MuscleVolumeLandmarks {
  muscle: string
  mv: number
  mev: number
  mav: number
  mrv: number
}

export interface MesocycleWeek {
  weekNumber: number
  startDate: Date
  endDate: Date
  isDeload: boolean
  volumeMultiplier: number
  targetRPE: number
  sessions: MesocycleSession[]
}

export interface MesocycleSession {
  id: string
  dayOfWeek: WeekDay
  date: Date
  sessionType: string
  domain: 'strength' | 'rucking' | 'cardio'
  template: SessionTemplate | null // null for cardio sessions
  exercises: PlannedExercise[]
  totalSets: number
  estimatedDuration: number
  targetRPE: number
  completed: boolean
}

export interface Mesocycle {
  id: string
  config: MesocycleConfig
  weeks: MesocycleWeek[]
  createdAt: Date
  status: 'active' | 'completed' | 'archived'
}

/**
 * Generate a complete mesocycle
 */
export function generateMesocycle(config: MesocycleConfig): Mesocycle {
  const mesocycleId = `meso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Generate base weekly plan
  const weeklyPlan = generateWeeklyPlan({
    availableDays: config.availableDays,
    strengthPriority: config.strengthPriority,
    ruckingPriority: config.ruckingPriority,
    cardioPriority: config.cardioPriority,
    preferredSessionDuration: config.preferredSessionDuration,
    maxSessionsPerDay: config.maxSessionsPerDay,
  })

  // Generate each week
  const weeks: MesocycleWeek[] = []

  for (let weekNum = 1; weekNum <= config.totalWeeks; weekNum++) {
    const isDeload = weekNum === config.totalWeeks
    const volumeMultiplier = getVolumeMultiplierForWeek(weekNum, config.totalWeeks)
    const targetRPE = getRPEForWeek(weekNum, config.totalWeeks)

    // Calculate week dates
    const weekStart = new Date(config.startDate)
    weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    // Generate sessions for this week
    const sessions: MesocycleSession[] = weeklyPlan.sessions.map((plannedSession, index) => {
      const sessionDate = getDateForDay(weekStart, plannedSession.day)

      if (plannedSession.domain === 'strength') {
        // Generate full strength session with exercises
        const template = getTemplateForSession(plannedSession.sessionType)
        const generatedSession = generateSessionExercises(
          template,
          config.userEquipment,
          weekNum,
          volumeMultiplier
        )

        // Debug: Log session generation summary (only for week 1)
        if (weekNum === 1) {
          console.log(`[Mesocycle] ${plannedSession.day} ${plannedSession.sessionType}: ${generatedSession.exercises.length} exercises, ${generatedSession.totalSets} sets`)
          generatedSession.exercises.forEach((ex, i) => {
            console.log(`  ${i + 1}. ${ex.exercise.name} (${ex.muscle}) - ${ex.sets} sets`)
          })
        }

        return {
          id: `${mesocycleId}_w${weekNum}_s${index}`,
          dayOfWeek: plannedSession.day,
          date: sessionDate,
          sessionType: plannedSession.sessionType,
          domain: 'strength' as const,
          template,
          exercises: generatedSession.exercises,
          totalSets: generatedSession.totalSets,
          estimatedDuration: generatedSession.estimatedDuration,
          targetRPE,
          completed: false,
        }
      } else {
        // Cardio/Rucking sessions (simpler structure for now)
        return {
          id: `${mesocycleId}_w${weekNum}_s${index}`,
          dayOfWeek: plannedSession.day,
          date: sessionDate,
          sessionType: plannedSession.sessionType,
          domain: plannedSession.domain as 'rucking' | 'cardio',
          template: null,
          exercises: [],
          totalSets: 0,
          estimatedDuration: plannedSession.estimatedDuration,
          targetRPE: isDeload ? 6 : 7, // Cardio RPE
          completed: false,
        }
      }
    })

    weeks.push({
      weekNumber: weekNum,
      startDate: weekStart,
      endDate: weekEnd,
      isDeload,
      volumeMultiplier,
      targetRPE,
      sessions,
    })
  }

  return {
    id: mesocycleId,
    config,
    weeks,
    createdAt: new Date(),
    status: 'active',
  }
}

/**
 * Get the date for a specific day of the week starting from a week start date
 */
function getDateForDay(weekStart: Date, day: WeekDay): Date {
  const dayOffsets: Record<WeekDay, number> = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  }

  const result = new Date(weekStart)
  // Adjust weekStart to Monday if needed
  const currentDay = result.getDay()
  const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay
  result.setDate(result.getDate() + daysToMonday + dayOffsets[day])

  return result
}

/**
 * Get today's session from a mesocycle
 */
export function getTodaysSession(mesocycle: Mesocycle): MesocycleSession | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const week of mesocycle.weeks) {
    for (const session of week.sessions) {
      const sessionDate = new Date(session.date)
      sessionDate.setHours(0, 0, 0, 0)

      if (sessionDate.getTime() === today.getTime()) {
        return session
      }
    }
  }

  return null
}

/**
 * Get current week from a mesocycle
 */
export function getCurrentWeek(mesocycle: Mesocycle): MesocycleWeek | null {
  const today = new Date()

  for (const week of mesocycle.weeks) {
    if (today >= week.startDate && today <= week.endDate) {
      return week
    }
  }

  return null
}

/**
 * Get session for a specific date
 */
export function getSessionForDate(mesocycle: Mesocycle, date: Date): MesocycleSession | null {
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)

  for (const week of mesocycle.weeks) {
    for (const session of week.sessions) {
      const sessionDate = new Date(session.date)
      sessionDate.setHours(0, 0, 0, 0)

      if (sessionDate.getTime() === targetDate.getTime()) {
        return session
      }
    }
  }

  return null
}

/**
 * Calculate mesocycle progress
 */
export function getMesocycleProgress(mesocycle: Mesocycle): {
  totalSessions: number
  completedSessions: number
  percentComplete: number
  currentWeek: number
  totalWeeks: number
} {
  let totalSessions = 0
  let completedSessions = 0

  for (const week of mesocycle.weeks) {
    for (const session of week.sessions) {
      totalSessions++
      if (session.completed) {
        completedSessions++
      }
    }
  }

  const currentWeek = getCurrentWeek(mesocycle)?.weekNumber || 1

  return {
    totalSessions,
    completedSessions,
    percentComplete: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
    currentWeek,
    totalWeeks: mesocycle.config.totalWeeks,
  }
}

/**
 * Format session summary for display
 */
export function formatSessionSummary(session: MesocycleSession): string {
  if (session.domain === 'strength') {
    return `${session.totalSets} sets · RPE ${session.targetRPE} · ~${session.estimatedDuration}min`
  }
  return `RPE ${session.targetRPE} · ~${session.estimatedDuration}min`
}
