/**
 * Where a workout should sit on a calendar surface.
 *
 * Planned sessions live on their scheduled day; once completed, the session
 * belongs to the day the athlete actually did it (`workouts.completed_date`,
 * stamped by `completeWorkout`). Legacy completed rows without a
 * completed_date stay on their scheduled day.
 */
export function effectiveCalendarDate(workout: {
    scheduled_date: string
    completed_date: string | null
    is_completed: boolean
}): string {
    return workout.is_completed && workout.completed_date
        ? workout.completed_date
        : workout.scheduled_date
}
