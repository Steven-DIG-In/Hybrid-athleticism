'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  title: string
  content: React.ReactNode
  example?: string
  className?: string
}

export function Tooltip({ title, content, example, className }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className={cn('relative inline-flex', className)} ref={tooltipRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-label={`Learn more about ${title}`}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-white text-sm">{title}</h4>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-zinc-300">{content}</div>
            {example && (
              <div className="mt-3 p-2 bg-zinc-900 rounded text-xs text-zinc-400 font-mono">
                {example}
              </div>
            )}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-8 border-transparent border-t-zinc-700" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Pre-defined tooltips for common concepts
export const TOOLTIPS = {
  e1rm: {
    title: 'Estimated 1-Rep Max (E1RM)',
    content: (
      <>
        <p className="mb-2">Your estimated maximum weight for a single rep, calculated from a working set.</p>
        <p className="text-zinc-400">Formula: weight × (1 + reps/30)</p>
        <p className="text-zinc-400 mt-1">RIR is added to reps for accuracy.</p>
      </>
    ),
    example: '100kg × 5 reps @ 2 RIR = 100 × (1 + 7/30) = 123kg E1RM',
  },
  trainingMax: {
    title: 'Training Max (TM)',
    content: (
      <>
        <p className="mb-2">A conservative percentage (85-90%) of your E1RM used to calculate working weights.</p>
        <p className="text-zinc-400">Benefits:</p>
        <ul className="text-zinc-400 mt-1 space-y-1">
          <li>• Leaves room for progression</li>
          <li>• Better form on all sets</li>
          <li>• Reduces injury risk</li>
        </ul>
      </>
    ),
    example: 'E1RM: 120kg × 90% = 108kg Training Max',
  },
  rir: {
    title: 'Reps in Reserve (RIR)',
    content: (
      <>
        <p className="mb-2">How many more reps you could have done before failure.</p>
        <ul className="text-zinc-400 space-y-1">
          <li><strong className="text-zinc-300">0 RIR</strong> = Failure (no reps left)</li>
          <li><strong className="text-zinc-300">1 RIR</strong> = 1 more rep possible</li>
          <li><strong className="text-zinc-300">2 RIR</strong> = 2 more reps possible</li>
          <li><strong className="text-zinc-300">3+ RIR</strong> = Moderate effort</li>
        </ul>
      </>
    ),
  },
  mv: {
    title: 'Maintenance Volume (MV)',
    content: (
      <p>The minimum sets per week needed to maintain current muscle size. Below this, you may lose gains.</p>
    ),
    example: 'Chest MV: ~6 sets/week',
  },
  mev: {
    title: 'Minimum Effective Volume (MEV)',
    content: (
      <p>The minimum sets per week needed to make progress. This is where hypertrophy starts.</p>
    ),
    example: 'Chest MEV: ~10 sets/week',
  },
  mav: {
    title: 'Maximum Adaptive Volume (MAV)',
    content: (
      <p>The optimal training volume range. Most gains occur here without excessive fatigue.</p>
    ),
    example: 'Chest MAV: ~12-20 sets/week',
  },
  mrv: {
    title: 'Maximum Recoverable Volume (MRV)',
    content: (
      <>
        <p className="mb-2">The most volume you can recover from. Exceeding this leads to overtraining.</p>
        <p className="text-zinc-400">Signs of exceeding MRV: persistent soreness, declining performance, poor sleep.</p>
      </>
    ),
    example: 'Chest MRV: ~22+ sets/week',
  },
  mesocycle: {
    title: 'Mesocycle',
    content: (
      <>
        <p className="mb-2">A training block typically lasting 4-6 weeks with progressive overload.</p>
        <p className="text-zinc-400">Structure:</p>
        <ul className="text-zinc-400 mt-1 space-y-1">
          <li>• Weeks 1-4: Accumulation (increasing volume)</li>
          <li>• Week 5: Deload (reduced volume for recovery)</li>
        </ul>
      </>
    ),
  },
  rpe: {
    title: 'Rate of Perceived Exertion (RPE)',
    content: (
      <>
        <p className="mb-2">A 1-10 scale measuring exercise intensity.</p>
        <ul className="text-zinc-400 space-y-1">
          <li><strong className="text-zinc-300">RPE 10</strong> = Maximum effort (failure)</li>
          <li><strong className="text-zinc-300">RPE 9</strong> = Could do 1 more rep</li>
          <li><strong className="text-zinc-300">RPE 8</strong> = Could do 2 more reps</li>
          <li><strong className="text-zinc-300">RPE 7</strong> = Could do 3 more reps</li>
        </ul>
        <p className="text-zinc-400 mt-2">RPE = 10 - RIR</p>
      </>
    ),
  },
}
