'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { CloseBlockConfirmModal } from './CloseBlockConfirmModal'

export function CloseBlockCta({ mesocycleId }: { mesocycleId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-neutral-700 hover:border-neutral-500 text-[11px] font-mono text-neutral-400 hover:text-neutral-200 uppercase tracking-wider transition-colors"
      >
        <CheckCircle2 className="w-3 h-3" />
        Close block
      </button>
      {open && (
        <CloseBlockConfirmModal
          mesocycleId={mesocycleId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
