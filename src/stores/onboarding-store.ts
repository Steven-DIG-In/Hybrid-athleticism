import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite'
export type DomainPriority = 'primary' | 'secondary' | 'maintenance'
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface MuscleVolumeLandmarks {
  muscle: string
  mv: number  // Maintenance Volume
  mev: number // Minimum Effective Volume
  mav: number // Maximum Adaptive Volume
  mrv: number // Maximum Recoverable Volume
}

export interface StrengthGoal {
  focusMuscles: string[]
  priorityMovements: string[]
}

export interface LiftMaxEntry {
  exerciseKey: string      // bench_press, squat, etc.
  exerciseName: string     // Display name
  method: 'tested' | 'calculated' | 'estimated'  // How we got the value
  testedMax?: number       // Direct 1RM if tested
  workingWeight?: number   // Weight used for calculation
  workingReps?: number     // Reps used for calculation
  workingRIR?: number      // RIR used for calculation
  e1rm: number | null      // Estimated 1RM
  trainingMax: number | null  // TM = E1RM × TM%
}

export interface LiftAssessment {
  liftMaxes: LiftMaxEntry[]
  tmPercentage: number     // 0.85-0.95, default 0.90
  assessmentComplete: boolean
}

export interface CardioGoal {
  ruckingGoal: string | null
  ruckingTargetDistance: number | null
  ruckingTargetLoad: number | null
  // Legacy running fields (kept for backwards compat)
  runningGoal: string | null
  runningTargetDistance: number | null
  runningTargetPace: number | null
  // New cardio fields
  cardioActivities?: string[] // running, rowing, swimming, cycling, air_bike
  cardioGoal?: string | null  // general_fitness, vo2_max, endurance, speed, event_prep, weight_loss
}

export interface OnboardingData {
  // Step 1: Welcome
  name: string

  // Step 2: Physical Profile
  weightKg: number | null
  heightCm: number | null
  dateOfBirth: string | null

  // Step 3: Training Experience
  trainingAgeYears: number | null
  strengthLevel: TrainingLevel | null
  enduranceLevel: TrainingLevel | null

  // Step 4: Availability
  availableDays: WeekDay[]
  preferredSessionDuration: number
  maxSessionsPerDay: number

  // Step 5: Domain Priorities
  strengthPriority: DomainPriority
  ruckingPriority: DomainPriority
  runningPriority: DomainPriority

  // Step 6: Strength Goals
  strengthGoals: StrengthGoal

  // Step 7: Lift Assessment (NEW - strength-focused)
  liftAssessment: LiftAssessment

  // Step 8: Cardio Goals
  cardioGoals: CardioGoal

  // Step 9: Equipment
  equipment: string[]
  trainingLocation: 'gym' | 'home' | 'outdoor' | 'mixed'

  // Step 9: Volume Landmarks
  useDefaultVolumeLandmarks: boolean
  customVolumeLandmarks: MuscleVolumeLandmarks[]

  // Step 10: Program Preferences
  mesocycleLengthWeeks: number
  includeDeload: boolean
}

interface OnboardingStore {
  currentStep: number
  totalSteps: number
  data: OnboardingData

  // Actions
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  updateData: (updates: Partial<OnboardingData>) => void
  reset: () => void
}

const defaultData: OnboardingData = {
  name: '',
  weightKg: null,
  heightCm: null,
  dateOfBirth: null,
  trainingAgeYears: null,
  strengthLevel: null,
  enduranceLevel: null,
  availableDays: [],
  preferredSessionDuration: 60,
  maxSessionsPerDay: 1,
  strengthPriority: 'primary',
  ruckingPriority: 'secondary',
  runningPriority: 'secondary',
  strengthGoals: {
    focusMuscles: [],
    priorityMovements: [],
  },
  liftAssessment: {
    liftMaxes: [],
    tmPercentage: 0.90,
    assessmentComplete: false,
  },
  cardioGoals: {
    ruckingGoal: null,
    ruckingTargetDistance: null,
    ruckingTargetLoad: null,
    runningGoal: null,
    runningTargetDistance: null,
    runningTargetPace: null,
  },
  equipment: [],
  trainingLocation: 'gym',
  useDefaultVolumeLandmarks: true,
  customVolumeLandmarks: [],
  mesocycleLengthWeeks: 4,
  includeDeload: true,
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      currentStep: 1,
      totalSteps: 14,  // Updated: Added summary step (step 12)
      data: defaultData,

      setStep: (step) => set({ currentStep: step }),

      nextStep: () => set((state) => ({
        currentStep: Math.min(state.currentStep + 1, state.totalSteps)
      })),

      prevStep: () => set((state) => ({
        currentStep: Math.max(state.currentStep - 1, 1)
      })),

      updateData: (updates) => set((state) => ({
        data: { ...state.data, ...updates }
      })),

      reset: () => set({
        currentStep: 1,
        data: defaultData,
      }),
    }),
    {
      name: 'hybrid-onboarding',
      // Merge function ensures totalSteps always uses the latest value (not persisted)
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<OnboardingStore>),
        totalSteps: 14,  // Always use current totalSteps, never persisted
      }),
    }
  )
)
