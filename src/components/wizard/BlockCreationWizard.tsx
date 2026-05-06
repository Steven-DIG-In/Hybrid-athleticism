'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BlockRetrospectiveSnapshot } from '@/lib/types/block-retrospective.types'
import type { PendingPlannerNotes } from '@/lib/types/pending-planner-notes.types'
import type { MesocycleStrategyValidated } from '@/lib/ai/schemas/week-brief'
import type { CoachDomain } from '@/lib/skills/types'
import { type Archetype, ARCHETYPE_LABELS } from '@/lib/wizard/archetypes'
import { createBlockShell } from '@/lib/engine/mesocycle/create-shell'
import { runHeadCoachStrategy } from '@/lib/engine/mesocycle/strategy-generation'
import { generateMesocycleInventory } from '@/lib/actions/inventory-generation.actions'
import { regenerateBlockPlan } from '@/lib/engine/mesocycle/regenerate'
import { approveBlockPlan } from '@/lib/engine/mesocycle/approve'
import { loadWeek1Preview, type Week1PreviewSession } from '@/lib/engine/mesocycle/load-week1-preview'

import { RetrospectiveSummaryTile } from './RetrospectiveSummaryTile'
import { CarryoverSummary } from './CarryoverSummary'
import { AvailabilityForm, type AvailabilityValue } from './AvailabilityForm'
import { ArchetypePicker } from './ArchetypePicker'
import { SessionCountSteppers } from './SessionCountSteppers'
import { DurationSelector } from './DurationSelector'
import { GenerationProgress } from './GenerationProgress'
import { StrategySummaryTile } from './StrategySummaryTile'
import { WeekSessionPoolPreview } from './WeekSessionPoolPreview'

export interface BlockCreationWizardProps {
  retrospective: BlockRetrospectiveSnapshot | null
  pendingNotes: PendingPlannerNotes | null
}

type WizardStep = 'review' | 'generating' | 'preview'
type GenStage = 'strategy' | 'week1'

const FIRST_BLOCK_DEFAULTS: AvailabilityValue = {
  daysPerWeek: 5,
  sessionMinutes: 60,
  warmupMinutes: 10,
  cooldownMinutes: 0,
  freeText: '',
}

const CUSTOM_DEFAULTS: Record<CoachDomain, number> = {
  hypertrophy: 2,
  strength: 2,
  conditioning: 1,
  endurance: 0,
  mobility: 2,
  recovery: 0,
}

export function BlockCreationWizard({ retrospective, pendingNotes }: BlockCreationWizardProps) {
  const router = useRouter()
  const mode: 'first-block' | 'post-block' = retrospective ? 'post-block' : 'first-block'

  // Wizard state
  const [step, setStep] = useState<WizardStep>('review')
  const [genStage, setGenStage] = useState<GenStage>('strategy')
  const [error, setError] = useState<string | null>(null)
  const [mesocycleId, setMesocycleId] = useState<string | null>(null)
  const [strategy, setStrategy] = useState<MesocycleStrategyValidated | null>(null)
  const [week1Sessions, setWeek1Sessions] = useState<Week1PreviewSession[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [archetype, setArchetype] = useState<Archetype>('hypertrophy')
  const [customCounts, setCustomCounts] = useState<Record<CoachDomain, number>>(CUSTOM_DEFAULTS)
  const [durationWeeks, setDurationWeeks] = useState<4 | 6 | 8>(6)

  // Carryover form (first-block edits inline; post-block edits via RealityCheckForm modal)
  const initialCarryover: AvailabilityValue =
    pendingNotes?.availability
      ? {
          daysPerWeek: pendingNotes.availability.daysPerWeek,
          sessionMinutes: pendingNotes.availability.sessionMinutes,
          warmupMinutes: pendingNotes.availability.warmupMinutes,
          cooldownMinutes: pendingNotes.availability.cooldownMinutes,
          freeText: pendingNotes.freeText ?? '',
        }
      : FIRST_BLOCK_DEFAULTS
  const [carryover, setCarryover] = useState<AvailabilityValue>(initialCarryover)

  async function handleGenerate() {
    setError(null)
    setSubmitting(true)
    setStep('generating')
    setGenStage('strategy')

    // 1) createBlockShell (skip if already created — supports Edit/Regenerate flow)
    let mid = mesocycleId
    if (!mid) {
      const shellResult = await createBlockShell({
        mode,
        archetype,
        customCounts: archetype === 'custom' ? customCounts : undefined,
        durationWeeks,
        carryover,
      })
      if (!shellResult.success) {
        setError(shellResult.error)
        setStep('review')
        setSubmitting(false)
        return
      }
      mid = shellResult.data.mesocycleId
      setMesocycleId(mid)
    }

    // 2) runHeadCoachStrategy
    const stratResult = await runHeadCoachStrategy(mid)
    if (!stratResult.success) {
      setError(stratResult.error)
      setStep('review')
      setSubmitting(false)
      return
    }
    setStrategy(stratResult.data)

    // 3) generate week 1 inventory (writes to session_inventory)
    setGenStage('week1')
    const inventoryResult = await generateMesocycleInventory(mid, 1)
    if (!inventoryResult.success) {
      setError(inventoryResult.error)
      setStep('review')
      setSubmitting(false)
      return
    }

    // Reload preview from session_inventory (now populated)
    const refreshed = await loadWeek1Preview(mid)
    if (refreshed.success) setWeek1Sessions(refreshed.data.sessions)

    setStep('preview')
    setSubmitting(false)
  }

  async function handleRegenerate() {
    if (!mesocycleId) return
    setError(null)
    setSubmitting(true)
    setStep('generating')
    setGenStage('strategy')

    const r = await regenerateBlockPlan(mesocycleId)
    if (!r.success) {
      setError(r.error)
      setStep('preview')
      setSubmitting(false)
      return
    }
    setStrategy(r.data.strategy)

    // Reload week 1 inventory (regenerate doesn't return the pool, so requery)
    setGenStage('week1')
    const refreshed = await loadWeek1Preview(mesocycleId)
    if (refreshed.success) setWeek1Sessions(refreshed.data.sessions)

    setStep('preview')
    setSubmitting(false)
  }

  async function handleApprove() {
    if (!mesocycleId) return
    setError(null)
    setSubmitting(true)

    const r = await approveBlockPlan(mesocycleId)
    if (!r.success) {
      setError(r.error)
      setSubmitting(false)
      return
    }
    router.push('/dashboard')
  }

  function handleEditPlan() {
    setStep('review')
    setStrategy(null)
    setWeek1Sessions([])
    // Strategy + week 1 inventory remain in DB until next handleGenerate (which re-runs
    // runHeadCoachStrategy and overwrites the existing strategy) or until the user
    // clicks Regenerate explicitly (which clears + re-runs).
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (step === 'generating') {
    return <GenerationProgress stage={genStage} onCancel={!submitting ? handleEditPlan : undefined} />
  }

  if (step === 'preview' && strategy) {
    return (
      <div className="max-w-2xl mx-auto">
        <header className="px-6 py-5 border-b border-neutral-800 flex justify-between items-center">
          <div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Block plan</div>
            <h1 className="text-[18px] font-space-grotesk font-bold text-white">{strategy.blockName}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleEditPlan}
              disabled={submitting}
              className="px-3 py-2 border border-neutral-800 hover:border-neutral-700 text-[11px] font-mono text-neutral-300 uppercase tracking-wider disabled:opacity-50"
            >
              ← Edit plan
            </button>
            <button
              onClick={handleRegenerate}
              disabled={submitting}
              className="px-3 py-2 border border-neutral-800 hover:border-neutral-700 text-[11px] font-mono text-neutral-300 uppercase tracking-wider disabled:opacity-50"
            >
              Regenerate
            </button>
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-mono font-bold uppercase tracking-wider disabled:opacity-50"
            >
              Approve & start
            </button>
          </div>
        </header>

        <StrategySummaryTile strategy={strategy} />

        {week1Sessions.length > 0 && (
          <WeekSessionPoolPreview
            weekNumber={1}
            emphasis={strategy.weeklyEmphasis[0]?.emphasis ?? ''}
            sessions={week1Sessions}
          />
        )}

        {error && <div className="text-red-500 text-[12px] px-6 py-3">{error}</div>}
      </div>
    )
  }

  // step === 'review'
  return (
    <div className="max-w-2xl mx-auto">
      <header className="px-6 py-6 border-b border-neutral-800">
        <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
          {mode === 'first-block' ? 'Set up your first block' : 'Plan next block'}
        </div>
        <h1 className="text-[20px] font-space-grotesk font-bold text-white mt-1">
          {ARCHETYPE_LABELS[archetype]} · {durationWeeks} weeks
        </h1>
      </header>

      {mode === 'post-block' && retrospective && <RetrospectiveSummaryTile retrospective={retrospective} />}
      {mode === 'post-block' && pendingNotes && <CarryoverSummary notes={pendingNotes} />}
      {mode === 'first-block' && <AvailabilityForm value={carryover} onChange={setCarryover} />}

      <ArchetypePicker value={archetype} onChange={setArchetype} />
      {archetype === 'custom' && (
        <SessionCountSteppers
          value={customCounts}
          daysPerWeekBudget={carryover.daysPerWeek}
          onChange={setCustomCounts}
        />
      )}
      <DurationSelector value={durationWeeks} onChange={setDurationWeeks} />

      {error && <div className="text-red-500 text-[12px] px-6 py-3">{error}</div>}

      <div className="px-6 py-6">
        <button
          onClick={handleGenerate}
          disabled={submitting}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black py-3 text-[12px] font-mono font-bold uppercase tracking-wider disabled:opacity-50"
        >
          Generate plan →
        </button>
      </div>
    </div>
  )
}
