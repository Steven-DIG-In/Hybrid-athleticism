'use client'

import { useEffect, useState } from 'react'

export interface AvailabilityValue {
  daysPerWeek: number
  sessionMinutes: number
  warmupMinutes: number
  cooldownMinutes: number
  freeText: string
}

export interface AvailabilityFormProps {
  value: AvailabilityValue
  onChange: (next: AvailabilityValue) => void
}

export function AvailabilityForm({ value, onChange }: AvailabilityFormProps) {
  return (
    <section className="border-b border-neutral-800 px-6 py-5 space-y-3">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Your availability</div>
      <div className="grid grid-cols-2 gap-3 text-[12px] font-inter">
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Days/week</span>
          <NumberField
            value={value.daysPerWeek}
            onChange={n => onChange({ ...value, daysPerWeek: n })}
            min={1}
            max={7}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Session min</span>
          <NumberField
            value={value.sessionMinutes}
            onChange={n => onChange({ ...value, sessionMinutes: n })}
            min={20}
            max={180}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Warm-up min</span>
          <NumberField
            value={value.warmupMinutes}
            onChange={n => onChange({ ...value, warmupMinutes: n })}
            min={0}
            max={60}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Cool-down min</span>
          <NumberField
            value={value.cooldownMinutes}
            onChange={n => onChange({ ...value, cooldownMinutes: n })}
            min={0}
            max={60}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-neutral-500 text-[10px] font-mono uppercase">Notes (optional)</span>
        <textarea
          value={value.freeText}
          onChange={e => onChange({ ...value, freeText: e.target.value })}
          className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200 text-[12px] resize-none"
          rows={2}
        />
      </label>
    </section>
  )
}

function NumberField({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  const [text, setText] = useState<string>(String(value))
  useEffect(() => {
    const parsed = parseInt(text, 10)
    if (isNaN(parsed) || parsed !== value) setText(String(value))
  }, [value])
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={text}
      onChange={e => {
        const next = e.target.value
        setText(next)
        const n = parseInt(next, 10)
        if (!isNaN(n)) onChange(n)
      }}
      onBlur={() => {
        const n = parseInt(text, 10)
        if (isNaN(n)) setText(String(value))
      }}
      className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200"
    />
  )
}
