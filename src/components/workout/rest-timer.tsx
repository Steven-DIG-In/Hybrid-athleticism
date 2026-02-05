import { useState, useEffect } from 'react'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface RestTimerProps {
    targetDate: Date
    onDismiss: () => void
    onAddSeconds: (seconds: number) => void
}

export function RestTimer({ targetDate, onDismiss, onAddSeconds }: RestTimerProps) {
    const [timeLeft, setTimeLeft] = useState(0)

    useEffect(() => {
        const updateTime = () => {
            const diff = Math.ceil((targetDate.getTime() - Date.now()) / 1000)
            if (diff <= 0) {
                setTimeLeft(0)
            } else {
                setTimeLeft(diff)
            }
        }

        updateTime() // Update immediately
        const interval = setInterval(updateTime, 200) // Update frequently to avoid lag
        return () => clearInterval(interval)
    }, [targetDate])

    // Format mm:ss
    const mins = Math.floor(timeLeft / 60)
    const secs = timeLeft % 60
    const timeString = `${mins}:${secs.toString().padStart(2, '0')}`

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 p-4 pb-8 flex items-center justify-between z-50 animate-in slide-in-from-bottom duration-300">
            <div className="flex flex-col">
                <span className="text-zinc-400 text-xs uppercase font-medium tracking-wider">Resting</span>
                <span className={cn(
                    "text-4xl font-mono font-bold tabular-nums",
                    timeLeft === 0 ? "text-green-500" : "text-white"
                )}>{timeString}</span>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onAddSeconds(-30)}
                        className="h-10 w-10 rounded-full border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white"
                    >
                        <Minus className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onAddSeconds(30)}
                        className="h-10 w-10 rounded-full border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
                <Button
                    variant="default"
                    size="lg"
                    onClick={onDismiss}
                    className="h-10 px-6 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                    {timeLeft === 0 ? 'Next' : 'Skip'}
                </Button>
            </div>
        </div>
    )
}
