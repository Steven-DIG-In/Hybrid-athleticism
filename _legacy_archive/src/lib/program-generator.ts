/**
 * Program Generator
 *
 * Generates a weekly training schedule based on user's domain priorities,
 * available days, and training preferences from onboarding.
 *
 * Based on Renaissance Periodization (RP) principles:
 * - Primary domain: 4 sessions/week
 * - Secondary domain: 2-3 sessions/week
 * - Maintenance domain: 1-2 sessions/week
 */

export type DomainPriority = 'primary' | 'secondary' | 'maintenance'
export type TrainingDomain = 'strength' | 'rucking' | 'cardio'
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface DomainConfig {
  domain: TrainingDomain
  priority: DomainPriority
  sessionsPerWeek: number
}

export interface PlannedSession {
  id: string
  day: WeekDay
  dayIndex: number
  domain: TrainingDomain
  sessionType: string
  description: string
  estimatedDuration: number
  order: number // For multi-session days
}

export interface WeeklyPlan {
  sessions: PlannedSession[]
  totalSessions: number
  totalHours: number
  domainBreakdown: Record<TrainingDomain, number>
}

interface GeneratorInput {
  availableDays: WeekDay[]
  strengthPriority: DomainPriority
  ruckingPriority: DomainPriority
  cardioPriority: DomainPriority
  preferredSessionDuration: number
  maxSessionsPerDay: number
  strengthLevel?: string
  enduranceLevel?: string
  cardioActivities?: string[]
}

// Session count by priority
const SESSIONS_BY_PRIORITY: Record<DomainPriority, number> = {
  primary: 4,
  secondary: 2,
  maintenance: 1,
}

// Session types by domain and frequency
const STRENGTH_SESSIONS = [
  { type: 'Upper Push', description: 'Chest, shoulders, triceps focus' },
  { type: 'Lower', description: 'Quads, hamstrings, glutes focus' },
  { type: 'Upper Pull', description: 'Back, biceps, rear delts focus' },
  { type: 'Full Body', description: 'Compound movements all muscle groups' },
]

const RUCKING_SESSIONS = [
  { type: 'Endurance Ruck', description: 'Longer duration, moderate load' },
  { type: 'Heavy Ruck', description: 'Shorter duration, heavier load' },
  { type: 'Recovery Ruck', description: 'Light load, easy pace' },
]

const CARDIO_SESSIONS = [
  { type: 'Easy Cardio', description: 'Zone 2, conversational pace' },
  { type: 'Tempo', description: 'Moderate-high intensity, sustained' },
  { type: 'Intervals', description: 'High intensity intervals' },
  { type: 'Long Session', description: 'Extended duration, low intensity' },
]

// Day ordering for scheduling
const DAY_ORDER: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function getDayIndex(day: WeekDay): number {
  return DAY_ORDER.indexOf(day)
}

function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Distributes sessions across available days, respecting max sessions per day
 * and trying to space out same-domain sessions for recovery.
 */
function distributeSessions(
  domains: DomainConfig[],
  availableDays: WeekDay[],
  maxSessionsPerDay: number,
  sessionDuration: number
): PlannedSession[] {
  const sessions: PlannedSession[] = []
  const daySlots: Map<WeekDay, number> = new Map()

  // Initialize day slots
  availableDays.forEach(day => daySlots.set(day, 0))

  // Sort domains by priority (primary first)
  const sortedDomains = [...domains].sort((a, b) => {
    const priorityOrder: Record<DomainPriority, number> = { primary: 0, secondary: 1, maintenance: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  // Assign sessions for each domain
  for (const config of sortedDomains) {
    const sessionsNeeded = config.sessionsPerWeek
    let sessionsAssigned = 0

    // Get session templates for this domain
    let templates: { type: string; description: string }[]
    switch (config.domain) {
      case 'strength':
        templates = STRENGTH_SESSIONS
        break
      case 'rucking':
        templates = RUCKING_SESSIONS
        break
      case 'cardio':
        templates = CARDIO_SESSIONS
        break
    }

    // Calculate ideal spacing between sessions of the same domain
    const idealSpacing = Math.floor(availableDays.length / sessionsNeeded)

    // Sort available days by current load (prefer less loaded days)
    const sortedDays = [...availableDays].sort((a, b) => {
      const slotsA = daySlots.get(a) || 0
      const slotsB = daySlots.get(b) || 0
      if (slotsA !== slotsB) return slotsA - slotsB
      return getDayIndex(a) - getDayIndex(b)
    })

    // Assign sessions
    let lastAssignedDayIndex = -idealSpacing

    for (let i = 0; i < sessionsNeeded && sessionsAssigned < sessionsNeeded; i++) {
      // Find the best day for this session
      let bestDay: WeekDay | null = null
      let bestScore = -Infinity

      for (const day of sortedDays) {
        const currentSlots = daySlots.get(day) || 0
        if (currentSlots >= maxSessionsPerDay) continue

        const dayIndex = getDayIndex(day)
        const spacingFromLast = Math.abs(dayIndex - lastAssignedDayIndex)

        // Score based on spacing and current load
        const spacingScore = Math.min(spacingFromLast, idealSpacing) * 10
        const loadScore = (maxSessionsPerDay - currentSlots) * 5
        const score = spacingScore + loadScore

        if (score > bestScore) {
          bestScore = score
          bestDay = day
        }
      }

      if (bestDay) {
        const template = templates[sessionsAssigned % templates.length]
        const currentSlots = daySlots.get(bestDay) || 0

        sessions.push({
          id: generateId(),
          day: bestDay,
          dayIndex: getDayIndex(bestDay),
          domain: config.domain,
          sessionType: template.type,
          description: template.description,
          estimatedDuration: sessionDuration,
          order: currentSlots + 1,
        })

        daySlots.set(bestDay, currentSlots + 1)
        lastAssignedDayIndex = getDayIndex(bestDay)
        sessionsAssigned++
      }
    }
  }

  // Sort sessions by day and order
  return sessions.sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex
    return a.order - b.order
  })
}

/**
 * Main generator function - creates a weekly plan from user preferences
 */
export function generateWeeklyPlan(input: GeneratorInput): WeeklyPlan {
  const {
    availableDays,
    strengthPriority,
    ruckingPriority,
    cardioPriority,
    preferredSessionDuration,
    maxSessionsPerDay,
  } = input

  // Build domain configurations
  const domains: DomainConfig[] = [
    {
      domain: 'strength',
      priority: strengthPriority,
      sessionsPerWeek: SESSIONS_BY_PRIORITY[strengthPriority],
    },
    {
      domain: 'rucking',
      priority: ruckingPriority,
      sessionsPerWeek: SESSIONS_BY_PRIORITY[ruckingPriority],
    },
    {
      domain: 'cardio',
      priority: cardioPriority,
      sessionsPerWeek: SESSIONS_BY_PRIORITY[cardioPriority],
    },
  ]

  // Distribute sessions across days
  const sessions = distributeSessions(
    domains,
    availableDays,
    maxSessionsPerDay,
    preferredSessionDuration
  )

  // Calculate totals
  const totalSessions = sessions.length
  const totalHours = (totalSessions * preferredSessionDuration) / 60

  const domainBreakdown: Record<TrainingDomain, number> = {
    strength: sessions.filter(s => s.domain === 'strength').length,
    rucking: sessions.filter(s => s.domain === 'rucking').length,
    cardio: sessions.filter(s => s.domain === 'cardio').length,
  }

  return {
    sessions,
    totalSessions,
    totalHours,
    domainBreakdown,
  }
}

/**
 * Get sessions for a specific day
 */
export function getSessionsForDay(plan: WeeklyPlan, day: WeekDay): PlannedSession[] {
  return plan.sessions.filter(s => s.day === day)
}

/**
 * Get today's sessions
 */
export function getTodaysSessions(plan: WeeklyPlan): PlannedSession[] {
  const today = DAY_ORDER[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
  return getSessionsForDay(plan, today)
}

/**
 * Format day name for display
 */
export function formatDayName(day: WeekDay): string {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

/**
 * Get short day name
 */
export function getShortDayName(day: WeekDay): string {
  const shortNames: Record<WeekDay, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  }
  return shortNames[day]
}
