'use client'

import { useState } from 'react'
import { differenceInDays } from 'date-fns'
import { AlertCircle } from 'lucide-react'
import { CloseBlockConfirmModal } from './CloseBlockConfirmModal'

export function CloseBlockNudgeBanner({
  mesocycleId, blockName, endDate,
}: {
  mesocycleId: string; blockName: string; endDate: string
}) {
  const [open, setOpen] = useState(false)
  const daysOver = differenceInDays(new Date(), new Date(endDate))

  return (
    <>
      <div className="border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-[12px] font-inter text-neutral-200 flex-1">
          <span className="font-bold">{blockName}</span>{' '}
          {daysOver > 0
            ? `wrapped ${daysOver} day${daysOver === 1 ? '' : 's'} ago.`
            : 'is ready to close.'} Ready to review?
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-mono uppercase tracking-wider transition-colors"
        >
          Close & review
        </button>
      </div>
      {open && (
        <CloseBlockConfirmModal
          mesocycleId={mesocycleId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
