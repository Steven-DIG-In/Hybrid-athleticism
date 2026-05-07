'use client'

import { useState, useTransition, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { submitRealityCheck } from '@/lib/actions/pending-notes.actions'
import type {
  AvailabilityAnswers,
  PendingPlannerNoteSource,
  SignalEvidence,
} from '@/lib/types/pending-planner-notes.types'

const FREE_TEXT_LIMIT = 200

export type RealityCheckFormProps = {
  source: PendingPlannerNoteSource
  /** Profile defaults shown as placeholder + initial value if no prefill. */
  defaults: { daysPerWeek: number; sessionMinutes: number; warmupMinutes: number; cooldownMinutes: number }
  /** Pre-fill from existing pending notes (overrides defaults if set). */
  prefill?: Partial<AvailabilityAnswers> & { freeText?: string }
  /** Optional signal evidence to forward into the write. */
  signalEvidence?: SignalEvidence
  /** Called when the form successfully submits or is skipped. */
  onComplete: (action: 'saved' | 'skipped') => void
}

export function RealityCheckForm({
  source, defaults, prefill, signalEvidence, onComplete,
}: RealityCheckFormProps) {
  const [daysPerWeek, setDaysPerWeek] = useState(prefill?.daysPerWeek ?? defaults.daysPerWeek)
  const [sessionMinutes, setSessionMinutes] = useState(prefill?.sessionMinutes ?? defaults.sessionMinutes)
  const [warmupMinutes, setWarmupMinutes] = useState(prefill?.warmupMinutes ?? defaults.warmupMinutes)
  const [cooldownMinutes, setCooldownMinutes] = useState(prefill?.cooldownMinutes ?? defaults.cooldownMinutes)
  const [freeText, setFreeText] = useState(prefill?.freeText ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Submit-enabled rule: any field changed from defaults OR free-text non-empty.
  const dirty =
    daysPerWeek !== defaults.daysPerWeek ||
    sessionMinutes !== defaults.sessionMinutes ||
    warmupMinutes !== defaults.warmupMinutes ||
    cooldownMinutes !== defaults.cooldownMinutes ||
    freeText.trim().length > 0

  const handleSave = () => {
    startTransition(async () => {
      const result = await submitRealityCheck({
        source,
        availability: { daysPerWeek, sessionMinutes, warmupMinutes, cooldownMinutes },
        ...(freeText.trim() ? { freeText: freeText.trim() } : {}),
        ...(signalEvidence ? { signalEvidence } : {}),
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      onComplete('saved')
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-[12px] font-inter text-amber-400 border border-amber-500/30 bg-amber-500/5 p-2">
          {error}
        </p>
      )}

      <Field label="Days you actually trained per week"
             help={`Setting: ${defaults.daysPerWeek} days`}>
        <NumberInput value={daysPerWeek} onChange={setDaysPerWeek} min={1} max={7} />
      </Field>

      <Field label="Real session window (minutes)"
             help={`Setting: ${defaults.sessionMinutes} min`}>
        <NumberInput value={sessionMinutes} onChange={setSessionMinutes} min={15} max={180} step={5} />
      </Field>

      <Field label="Warm-up overhead (minutes)"
             help="What you do BEFORE prescribed work. 0 if you skip warm-up.">
        <NumberInput value={warmupMinutes} onChange={setWarmupMinutes} min={0} max={60} step={5} />
      </Field>

      <Field label="Cool-down / self-added cardio (minutes)"
             help="What you do AFTER prescribed work. 0 if none.">
        <NumberInput value={cooldownMinutes} onChange={setCooldownMinutes} min={0} max={60} step={5} />
      </Field>

      <Field label="Anything else?" help={`${FREE_TEXT_LIMIT - freeText.length} chars left`}>
        <textarea
          value={freeText}
          onChange={e => setFreeText(e.target.value.slice(0, FREE_TEXT_LIMIT))}
          rows={3}
          className="w-full px-2.5 py-1.5 bg-[#111] border border-neutral-800 text-white text-[12px] font-inter placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50 resize-none"
          placeholder="Free-form note for the next block planner..."
        />
      </Field>

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={() => onComplete('skipped')}
          disabled={pending}
          className="px-3 py-1.5 border border-neutral-700 hover:border-neutral-500 text-[11px] font-mono text-neutral-400 uppercase tracking-wider transition-colors"
        >
          Skip — no changes
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-[11px] font-mono uppercase tracking-wider transition-colors"
        >
          {pending && <Loader2 className="w-3 h-3 animate-spin" />}
          Save & continue
        </button>
      </div>
    </div>
  )
}

function Field({ label, help, children }: {
  label: string; help?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {help && <p className="text-[10px] font-mono text-neutral-600">{help}</p>}
    </div>
  )
}

function NumberInput({ value, onChange, min, max, step = 1 }: {
  value: number; onChange: (v: number) => void
  min: number; max: number; step?: number
}) {
  const [text, setText] = useState<string>(String(value))

  // Sync local text when parent value changes externally (e.g., form reset)
  useEffect(() => {
    // Only sync when the displayed text would parse to a different number than value
    const parsed = parseInt(text, 10)
    if (isNaN(parsed) || parsed !== value) {
      setText(String(value))
    }
  }, [value])

  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      step={step}
      onChange={e => {
        const next = e.target.value
        setText(next)
        const n = parseInt(next, 10)
        if (!isNaN(n)) onChange(n)
      }}
      onBlur={() => {
        // If the field was left empty or invalid, snap back to current value
        const n = parseInt(text, 10)
        if (isNaN(n)) setText(String(value))
      }}
      className="w-full px-2.5 py-1.5 bg-[#111] border border-neutral-800 text-white text-[12px] font-mono focus:outline-none focus:border-amber-500/50"
    />
  )
}
