'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft, Loader2 } from 'lucide-react'
import { moveSessionToDay } from '@/lib/actions/inventory.actions'

interface MoveSessionMenuProps {
    sessionId: string
    currentDay: number
    allDayNumbers: number[]
}

export function MoveSessionMenu({ sessionId, currentDay, allDayNumbers }: MoveSessionMenuProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    const targetDays = allDayNumbers.filter(d => d !== currentDay)

    const handleMove = (day: number) => {
        setOpen(false)
        startTransition(async () => {
            const result = await moveSessionToDay(sessionId, day)
            if (result.success) {
                router.refresh()
            } else {
                console.error('Move failed:', result.error)
            }
        })
    }

    if (targetDays.length === 0) return null

    return (
        <div className="relative">
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen(prev => !prev)
                }}
                disabled={isPending}
                className="p-1.5 text-neutral-600 hover:text-amber-400 transition-colors disabled:opacity-50"
                title="Move to different day"
                aria-label="Move session to different training day"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                )}
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={(e) => { e.stopPropagation(); setOpen(false) }}
                    />

                    {/* Dropdown */}
                    <div
                        role="menu"
                        className="absolute right-0 top-full mt-1 z-20 bg-[#111111] border border-[#333333] shadow-xl min-w-[120px]"
                    >
                        <p className="px-3 py-1.5 text-[9px] font-mono text-neutral-600 uppercase tracking-widest border-b border-[#222222]">
                            Move to
                        </p>
                        {targetDays.map(day => (
                            <button
                                key={day}
                                role="menuitem"
                                onClick={(e) => { e.stopPropagation(); handleMove(day) }}
                                className="w-full text-left px-3 py-2 text-xs font-inter text-neutral-300 hover:bg-[#1a1a1a] hover:text-amber-400 transition-colors"
                            >
                                Day {day}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
