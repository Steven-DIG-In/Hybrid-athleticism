'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, format, startOfWeek } from 'date-fns'
import { rebindCalendarDate } from '@/lib/actions/inventory.actions'
import { startWorkout } from '@/lib/actions/workout.actions'

export type WeekViewSessionStatus = 'pending' | 'active' | 'completed' | 'missed' | 'off_plan'

export interface WeekViewSession {
    id: string              // session_inventory.id
    training_day: number
    session_slot: number | null
    scheduled_date: string | null
    status: WeekViewSessionStatus
    modality: string        // 'LIFTING' | 'CARDIO' | 'METCON' | 'RUCKING' | 'MOBILITY'
    name: string            // display name
    workout_id: string | null
    estimated_duration_minutes: number | null
}

interface Props {
    sessions: WeekViewSession[]
    /** Override week start for tests. Defaults to the Monday of the current week. */
    weekStart?: Date
}

const MODALITY_COLOR: Record<string, string> = {
    LIFTING: 'border-amber-500/40 bg-amber-950/20',
    CARDIO: 'border-cyan-500/40 bg-cyan-950/20',
    METCON: 'border-fuchsia-500/40 bg-fuchsia-950/20',
    RUCKING: 'border-emerald-500/40 bg-emerald-950/20',
    MOBILITY: 'border-sky-500/40 bg-sky-950/20'
}

export function WeekViewClient({ sessions, weekStart }: Props) {
    const [isPending, startTransition] = useTransition()
    const [dragSessionId, setDragSessionId] = useState<string | null>(null)
    const router = useRouter()

    const start = weekStart ?? startOfWeek(new Date(), { weekStartsOn: 1 })
    const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i))

    const sessionsByDate = sessions.reduce<Record<string, WeekViewSession[]>>((acc, s) => {
        if (!s.scheduled_date) return acc
        acc[s.scheduled_date] = [...(acc[s.scheduled_date] ?? []), s]
        return acc
    }, {})

    function onDragStart(sessionId: string) {
        setDragSessionId(sessionId)
    }

    function onDragOver(e: React.DragEvent) {
        e.preventDefault()
    }

    function onDrop(targetDate: string) {
        if (!dragSessionId) return
        const sessionId = dragSessionId
        setDragSessionId(null)
        startTransition(async () => {
            const result = await rebindCalendarDate(sessionId, targetDate)
            if (!result.success) {
                console.error('rebindCalendarDate failed:', result.error)
            }
            router.refresh()
        })
    }

    function onLaunch(session: WeekViewSession) {
        if (!session.workout_id) return
        const workoutId = session.workout_id
        startTransition(async () => {
            const result = await startWorkout(workoutId)
            if (result.success) {
                router.push(`/workout/${workoutId}`)
            } else {
                console.error('startWorkout failed:', result.error)
            }
        })
    }

    return (
        <div className="grid grid-cols-7 gap-2 text-sm" aria-busy={isPending}>
            {days.map(day => {
                const key = format(day, 'yyyy-MM-dd')
                const list = sessionsByDate[key] ?? []
                const isToday = key === format(new Date(), 'yyyy-MM-dd')
                return (
                    <div
                        key={key}
                        onDragOver={onDragOver}
                        onDrop={() => onDrop(key)}
                        className={
                            'min-h-40 rounded-md border p-2 ' +
                            (isToday
                                ? 'border-white/20 bg-neutral-900'
                                : 'border-white/5 bg-neutral-950')
                        }
                    >
                        <div className="flex items-baseline justify-between">
                            <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                                {format(day, 'EEE')}
                            </span>
                            <span className={
                                'text-[11px] ' +
                                (isToday ? 'font-semibold text-white' : 'text-neutral-400')
                            }>
                                {format(day, 'd MMM')}
                            </span>
                        </div>

                        <div className="mt-2 space-y-2">
                            {list.map(s => (
                                <SessionCard
                                    key={s.id}
                                    session={s}
                                    dragging={dragSessionId === s.id}
                                    onDragStart={onDragStart}
                                    onLaunch={onLaunch}
                                />
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

interface CardProps {
    session: WeekViewSession
    dragging: boolean
    onDragStart: (id: string) => void
    onLaunch: (session: WeekViewSession) => void
}

function SessionCard({ session, dragging, onDragStart, onLaunch }: CardProps) {
    const color = MODALITY_COLOR[session.modality] ?? 'border-white/10 bg-neutral-900'
    const isDone = session.status === 'completed'
    const isMissed = session.status === 'missed'
    const isLaunchable =
        !isDone && !isMissed && !!session.workout_id

    return (
        <div
            draggable
            onDragStart={() => onDragStart(session.id)}
            className={
                'rounded border p-2 transition-opacity ' +
                color +
                (dragging ? ' opacity-40' : '') +
                (isDone ? ' opacity-70' : '') +
                (isMissed ? ' opacity-50' : '')
            }
        >
            <div className="flex items-baseline justify-between">
                <div className="text-xs font-medium text-neutral-100">
                    {session.name}
                </div>
                {isDone ? (
                    <span className="text-[10px] text-emerald-400">✓</span>
                ) : null}
            </div>
            <div className="mt-1 text-[10px] text-neutral-500">
                Day {session.training_day} · {session.modality}
                {session.estimated_duration_minutes
                    ? ` · ${session.estimated_duration_minutes}m`
                    : ''}
            </div>
            {isLaunchable ? (
                <button
                    onClick={() => onLaunch(session)}
                    className="mt-2 text-xs text-amber-400 underline"
                >
                    Start
                </button>
            ) : isMissed ? (
                <span className="mt-2 inline-block text-[10px] italic text-red-400">
                    Missed — drag to reschedule
                </span>
            ) : null}
        </div>
    )
}
