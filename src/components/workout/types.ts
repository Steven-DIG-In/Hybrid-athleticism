import { PlannedSession, PlannedExercise, UserLiftMax } from '@/types/database'

export interface WorkoutLoggerProps {
    session: PlannedSession
    exercises: PlannedExercise[]
    liftMaxes: UserLiftMax[]
    userId: string
}
