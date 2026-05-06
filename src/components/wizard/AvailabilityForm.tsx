'use client'

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
          <input
            type="number"
            min={1}
            max={7}
            value={value.daysPerWeek}
            onChange={e => onChange({ ...value, daysPerWeek: Number(e.target.value) })}
            className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Session min</span>
          <input
            type="number"
            min={20}
            max={180}
            value={value.sessionMinutes}
            onChange={e => onChange({ ...value, sessionMinutes: Number(e.target.value) })}
            className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Warm-up min</span>
          <input
            type="number"
            min={0}
            max={60}
            value={value.warmupMinutes}
            onChange={e => onChange({ ...value, warmupMinutes: Number(e.target.value) })}
            className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Cool-down min</span>
          <input
            type="number"
            min={0}
            max={60}
            value={value.cooldownMinutes}
            onChange={e => onChange({ ...value, cooldownMinutes: Number(e.target.value) })}
            className="bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-200"
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
