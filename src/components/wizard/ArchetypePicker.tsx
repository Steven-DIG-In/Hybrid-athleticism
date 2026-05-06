'use client'

import { ARCHETYPE_LABELS, ARCHETYPE_DESCRIPTIONS, type Archetype } from '@/lib/wizard/archetypes'

const ORDER: Archetype[] = ['hypertrophy', 'strength', 'endurance_event', 'conditioning', 'hybrid', 'custom']

export interface ArchetypePickerProps {
  value: Archetype
  onChange: (next: Archetype) => void
}

export function ArchetypePicker({ value, onChange }: ArchetypePickerProps) {
  return (
    <section className="border-b border-neutral-800 px-6 py-5">
      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-3">Block goal</div>
      <div className="grid grid-cols-3 gap-2">
        {ORDER.map(a => {
          const selected = a === value
          return (
            <button
              key={a}
              type="button"
              onClick={() => onChange(a)}
              className={`px-3 py-3 border text-left transition-colors ${
                selected
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className={`text-[11px] font-mono uppercase tracking-wider ${selected ? 'text-amber-500' : 'text-neutral-300'}`}>
                {ARCHETYPE_LABELS[a]}
              </div>
              <div className="text-[10px] font-inter text-neutral-500 mt-1 line-clamp-2">{ARCHETYPE_DESCRIPTIONS[a]}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
