'use client'

export interface GenerationProgressProps {
  stage: 'strategy' | 'week1'
  onCancel?: () => void
}

const LABEL: Record<GenerationProgressProps['stage'], string> = {
  strategy: 'Head coach strategy…',
  week1: 'Generating week 1 sessions…',
}

const PROGRESS: Record<GenerationProgressProps['stage'], number> = {
  strategy: 30,
  week1: 75,
}

export function GenerationProgress({ stage, onCancel }: GenerationProgressProps) {
  return (
    <div className="px-6 py-12 text-center space-y-4">
      <div className="text-[14px] font-space-grotesk text-neutral-200">Generating Block…</div>
      <div className="max-w-sm mx-auto h-1 bg-neutral-900 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-500"
          style={{ width: `${PROGRESS[stage]}%` }}
        />
      </div>
      <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">{LABEL[stage]}</div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 uppercase tracking-wider mt-4"
        >
          Cancel and edit plan
        </button>
      )}
    </div>
  )
}
