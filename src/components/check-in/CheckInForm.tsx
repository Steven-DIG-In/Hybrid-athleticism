'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, AlertTriangle } from 'lucide-react'
import { completeWeeklyCheckIn } from '@/lib/actions/check-in.actions'

/* 1-5 everywhere, matching the recovery-scorer's zod schema. Direction is NOT uniform:
   sleep / energy / motivation score higher-is-better, while stress and soreness are
   inverted by the scorer. `inverted` is spelled out on every row rather than left off
   the higher-is-better ones, so the direction is readable at a glance — and so a 5 can
   never render as "good" on a scale where it means "wrecked". */
const SCALES = [
  { key: 'sleepQuality', label: 'Sleep', low: 'Terrible', high: 'Great', inverted: false },
  { key: 'energyLevel', label: 'Energy', low: 'Empty', high: 'Full', inverted: false },
  { key: 'stressLevel', label: 'Stress', low: 'Calm', high: 'Maxed', inverted: true },
  { key: 'motivation', label: 'Motivation', low: 'None', high: 'Fired up', inverted: false },
] as const

type ScaleKey = (typeof SCALES)[number]['key']

/** Colour follows GOODNESS, not the raw number, so the inverted scales read correctly. */
function toneFor(goodness: number): string {
  if (goodness >= 4) return 'bg-emerald-500 border-emerald-400'
  if (goodness === 3) return 'bg-yellow-500 border-yellow-400'
  if (goodness === 2) return 'bg-orange-500 border-orange-400'
  return 'bg-red-500 border-red-400'
}

interface ScaleProps {
  label: string
  low: string
  high: string
  value: number
  inverted?: boolean
  onChange: (value: number) => void
}

function Scale({ label, low, high, value, inverted, onChange }: ScaleProps) {
  const tone = toneFor(inverted ? 6 - value : value)

  return (
    <div className="py-3 border-b border-white/5 last:border-b-0">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-300">{label}</span>
        <span className="text-[10px] font-mono text-neutral-600">{low} → {high}</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} of 5`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={`flex-1 h-10 border text-[12px] font-mono transition-colors ${
              value === n
                ? `${tone} text-black font-bold`
                : 'bg-[#0c0c0c] border-[#222] text-neutral-500 hover:border-neutral-600'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

interface CheckInFormProps {
  mesocycleId: string
  weekNumber: number
  muscleGroups: string[]
}

export function CheckInForm({ mesocycleId, weekNumber, muscleGroups }: CheckInFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ adjustments: number } | null>(null)

  const [scores, setScores] = useState<Record<ScaleKey, number>>({
    sleepQuality: 3, energyLevel: 3, stressLevel: 3, motivation: 3,
  })
  const [soreness, setSoreness] = useState<Record<string, number>>(
    Object.fromEntries(muscleGroups.map((g) => [g, 1])),
  )
  const [notes, setNotes] = useState('')

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await completeWeeklyCheckIn(mesocycleId, weekNumber, {
        ...scores, soreness, notes: notes.trim() || undefined,
      })
      if (!res.success) {
        setError(res.error)
        return
      }
      setDone({ adjustments: res.data.adjustments.length })
      router.refresh()
    })
  }

  if (done) {
    return (
      <div className="border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="font-space-grotesk font-bold text-white">Week {weekNumber} checked in</span>
        </div>
        <p className="text-[12px] font-inter text-neutral-300">
          {done.adjustments === 0
            ? 'Recovery scored, no adjustments needed. Next week stands as planned.'
            : `Recovery scored and ${done.adjustments} adjustment${done.adjustments === 1 ? '' : 's'} queued for your next sessions.`}
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mt-3 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-mono uppercase tracking-wider transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="border border-[#222] bg-[#080808] px-4 py-2">
        <h2 className="text-[11px] font-mono uppercase tracking-widest text-neutral-500 py-2">How the week felt</h2>
        {SCALES.map((s) => (
          <Scale
            key={s.key}
            label={s.label}
            low={s.low}
            high={s.high}
            inverted={s.inverted}
            value={scores[s.key]}
            onChange={(v) => setScores((prev) => ({ ...prev, [s.key]: v }))}
          />
        ))}
      </section>

      <section className="border border-[#222] bg-[#080808] px-4 py-2">
        <h2 className="text-[11px] font-mono uppercase tracking-widest text-neutral-500 py-2">
          Soreness <span className="text-neutral-700">— 1 fresh, 5 wrecked</span>
        </h2>
        {muscleGroups.map((g) => (
          <Scale
            key={g}
            label={g}
            low="Fresh"
            high="Wrecked"
            inverted
            value={soreness[g] ?? 1}
            onChange={(v) => setSoreness((prev) => ({ ...prev, [g]: v }))}
          />
        ))}
      </section>

      <section className="border border-[#222] bg-[#080808] p-4">
        <label htmlFor="checkin-notes" className="block text-[11px] font-mono uppercase tracking-widest text-neutral-500 mb-2">
          Anything else <span className="text-neutral-700">(optional)</span>
        </label>
        <textarea
          id="checkin-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Travel, illness, a session that felt off…"
          className="w-full bg-[#0c0c0c] border border-[#222] p-2 text-[13px] font-inter text-neutral-200 placeholder:text-neutral-700 focus:border-cyan-700 focus:outline-none"
        />
      </section>

      {error && (
        <div className="border border-red-500/30 bg-red-500/5 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[12px] font-inter text-neutral-200">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white text-[12px] font-mono uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        {pending ? 'Scoring recovery…' : `Submit week ${weekNumber} check-in`}
      </button>
    </div>
  )
}
