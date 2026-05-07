'use client'

const OPTIONS: Array<4 | 6 | 8> = [4, 6, 8]

export interface DurationSelectorProps {
  value: 4 | 6 | 8
  onChange: (next: 4 | 6 | 8) => void
}

export function DurationSelector({ value, onChange }: DurationSelectorProps) {
  return (
    <section className="border-b border-neutral-800 px-6 py-5">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">Duration</div>
      <div className="flex gap-2">
        {OPTIONS.map(n => {
          const selected = n === value
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`px-4 py-2 border text-[11px] font-mono uppercase tracking-wider transition-colors ${
                selected
                  ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                  : 'border-neutral-800 text-neutral-300 hover:border-neutral-700'
              }`}
            >
              {n} weeks
            </button>
          )
        })}
      </div>
    </section>
  )
}
