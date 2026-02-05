'use client'

import { useState, useEffect } from 'react'
import { Dumbbell, Calculator, HelpCircle, ChevronDown, ChevronUp, Check, ArrowLeft, ArrowRight, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOnboardingStore, type LiftMaxEntry } from '@/stores/onboarding-store'
import {
  calculateE1RM,
  calculateTrainingMax,
  estimateE1RMFromBodyWeight,
  KEY_LIFTS,
  getSuggestedTMPercentage,
} from '@/lib/strength'
import { Tooltip, TOOLTIPS } from '@/components/ui/tooltip'

// Strength standards (multiplier of body weight) for reference
const STRENGTH_STANDARDS: Record<string, { beginner: number; intermediate: number; advanced: number; elite: number }> = {
  bench_press: { beginner: 0.5, intermediate: 1.0, advanced: 1.5, elite: 2.0 },
  squat: { beginner: 0.75, intermediate: 1.25, advanced: 2.0, elite: 2.5 },
  deadlift: { beginner: 1.0, intermediate: 1.5, advanced: 2.5, elite: 3.0 },
  overhead_press: { beginner: 0.35, intermediate: 0.65, advanced: 1.0, elite: 1.35 },
  barbell_row: { beginner: 0.5, intermediate: 0.85, advanced: 1.25, elite: 1.6 },
}

interface LiftInputProps {
  lift: typeof KEY_LIFTS[number]
  entry: LiftMaxEntry | undefined
  bodyWeight: number | null
  strengthLevel: string | null
  tmPercentage: number
  onChange: (entry: LiftMaxEntry) => void
}

function LiftInput({ lift, entry, bodyWeight, strengthLevel, tmPercentage, onChange }: LiftInputProps) {
  const [expanded, setExpanded] = useState(false)
  const [method, setMethod] = useState<'tested' | 'calculated' | 'estimated'>(entry?.method || 'calculated')
  const [testedMax, setTestedMax] = useState(entry?.testedMax?.toString() || '')
  const [workingWeight, setWorkingWeight] = useState(entry?.workingWeight?.toString() || '')
  const [workingReps, setWorkingReps] = useState(entry?.workingReps?.toString() || '5')
  const [workingRIR, setWorkingRIR] = useState(entry?.workingRIR?.toString() || '2')

  // Calculate E1RM and TM whenever inputs change
  useEffect(() => {
    let e1rm: number | null = null

    if (method === 'tested' && testedMax) {
      e1rm = parseFloat(testedMax)
    } else if (method === 'calculated' && workingWeight && workingReps) {
      const result = calculateE1RM({
        weight: parseFloat(workingWeight),
        reps: parseInt(workingReps),
        rir: parseInt(workingRIR) || 0,
      })
      e1rm = result.e1rm
    } else if (method === 'estimated' && bodyWeight && strengthLevel) {
      e1rm = estimateE1RMFromBodyWeight(
        lift.key,
        bodyWeight,
        strengthLevel as 'beginner' | 'intermediate' | 'advanced' | 'elite'
      )
    }

    const trainingMax = e1rm ? calculateTrainingMax(e1rm, tmPercentage) : null

    onChange({
      exerciseKey: lift.key,
      exerciseName: lift.name,
      method,
      testedMax: method === 'tested' ? parseFloat(testedMax) || undefined : undefined,
      workingWeight: method === 'calculated' ? parseFloat(workingWeight) || undefined : undefined,
      workingReps: method === 'calculated' ? parseInt(workingReps) || undefined : undefined,
      workingRIR: method === 'calculated' ? parseInt(workingRIR) || undefined : undefined,
      e1rm,
      trainingMax,
    })
  }, [method, testedMax, workingWeight, workingReps, workingRIR, bodyWeight, strengthLevel, tmPercentage])

  const hasValue = entry?.e1rm && entry.e1rm > 0

  return (
    <div className={cn(
      'rounded-lg border transition-all',
      hasValue ? 'bg-zinc-900 border-green-500/30' : 'bg-zinc-900/50 border-zinc-800'
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            hasValue ? 'bg-green-500/20' : 'bg-zinc-800'
          )}>
            {hasValue ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <Dumbbell className="w-5 h-5 text-zinc-500" />
            )}
          </div>
          <div>
            <h3 className="font-medium text-white">{lift.name}</h3>
            <p className="text-xs text-zinc-500 capitalize">{lift.muscle.replace('_', ' ')} • {lift.pattern}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasValue && (
            <div className="text-right">
              <p className="text-sm font-medium text-white">TM: {entry?.trainingMax}kg</p>
              <p className="text-xs text-zinc-500">E1RM: {entry?.e1rm?.toFixed(1)}kg</p>
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-zinc-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Expanded Input */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-4 space-y-4">
          {/* Method Selection */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMethod('calculated')}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm transition-colors',
                method === 'calculated'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                  : 'bg-zinc-800 text-zinc-400 border border-transparent'
              )}
            >
              <Calculator className="w-4 h-4 inline mr-1" />
              Calculate
            </button>
            <button
              type="button"
              onClick={() => setMethod('tested')}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm transition-colors',
                method === 'tested'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                  : 'bg-zinc-800 text-zinc-400 border border-transparent'
              )}
            >
              <Dumbbell className="w-4 h-4 inline mr-1" />
              Tested Max
            </button>
            <button
              type="button"
              onClick={() => setMethod('estimated')}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm transition-colors',
                method === 'estimated'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                  : 'bg-zinc-800 text-zinc-400 border border-transparent'
              )}
            >
              <HelpCircle className="w-4 h-4 inline mr-1" />
              Estimate
            </button>
          </div>

          {/* Method-specific inputs */}
          {method === 'tested' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Your tested 1RM (kg)
              </label>
              <input
                type="number"
                value={testedMax}
                onChange={(e) => setTestedMax(e.target.value)}
                placeholder="e.g., 100"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {method === 'calculated' && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                Enter a recent working set to calculate your estimated max
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={workingWeight}
                    onChange={(e) => setWorkingWeight(e.target.value)}
                    placeholder="80"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Reps</label>
                  <input
                    type="number"
                    value={workingReps}
                    onChange={(e) => setWorkingReps(e.target.value)}
                    placeholder="5"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="flex items-center text-xs text-zinc-500 mb-1">
                    RIR
                    <Tooltip {...TOOLTIPS.rir} />
                  </label>
                  <select
                    value={workingRIR}
                    onChange={(e) => setWorkingRIR(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">0 (max effort)</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4+</option>
                  </select>
                </div>
              </div>
              {/* Live calculation example */}
              {workingWeight && workingReps && (
                <p className="text-xs text-zinc-500 bg-zinc-800/50 p-2 rounded">
                  📊 {workingWeight}kg × {workingReps} reps @ {workingRIR} RIR = <span className="text-blue-400 font-medium">{entry?.e1rm?.toFixed(1) || '...'} kg E1RM</span>
                </p>
              )}
              {/* Strength standards reference */}
              {bodyWeight && STRENGTH_STANDARDS[lift.key] && (
                <div className="text-xs text-zinc-500 p-2 bg-zinc-800/30 rounded">
                  <p className="mb-1 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Reference for {bodyWeight}kg bodyweight:
                  </p>
                  <div className="flex gap-3 text-zinc-400">
                    <span>Beginner: {Math.round(bodyWeight * STRENGTH_STANDARDS[lift.key].beginner)}kg</span>
                    <span>•</span>
                    <span>Intermediate: {Math.round(bodyWeight * STRENGTH_STANDARDS[lift.key].intermediate)}kg</span>
                    <span>•</span>
                    <span className="text-zinc-300">Advanced: {Math.round(bodyWeight * STRENGTH_STANDARDS[lift.key].advanced)}kg</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {method === 'estimated' && (
            <div className="p-3 bg-zinc-800/50 rounded-lg">
              <p className="text-sm text-zinc-400">
                Based on your body weight ({bodyWeight || '?'}kg) and training level ({strengthLevel || 'unknown'}),
                we estimate your {lift.name} 1RM.
              </p>
              {!bodyWeight || !strengthLevel ? (
                <p className="text-sm text-amber-400 mt-2">
                  Complete your profile first for accurate estimates.
                </p>
              ) : null}
            </div>
          )}

          {/* Result Display */}
          {hasValue && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-green-400">Estimated 1RM</p>
                  <p className="text-2xl font-bold text-white">{entry?.e1rm?.toFixed(1)} kg</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-400">Training Max ({(tmPercentage * 100).toFixed(0)}%)</p>
                  <p className="text-2xl font-bold text-white">{entry?.trainingMax} kg</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function StepLiftAssessment() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore()
  const [liftMaxes, setLiftMaxes] = useState<LiftMaxEntry[]>(data.liftAssessment?.liftMaxes || [])
  const [tmPercentage, setTmPercentage] = useState(data.liftAssessment?.tmPercentage || 0.90)

  // Get suggested TM percentage based on training level
  useEffect(() => {
    if (data.strengthLevel) {
      const suggested = getSuggestedTMPercentage(data.strengthLevel)
      setTmPercentage(suggested)
    }
  }, [data.strengthLevel])

  // Update store when lifts change
  useEffect(() => {
    const completedCount = liftMaxes.filter(l => l.e1rm && l.e1rm > 0).length
    updateData({
      liftAssessment: {
        liftMaxes,
        tmPercentage,
        assessmentComplete: completedCount >= 3,  // At least 3 lifts assessed
      }
    })
  }, [liftMaxes, tmPercentage])

  const handleLiftChange = (entry: LiftMaxEntry) => {
    setLiftMaxes(prev => {
      const existing = prev.findIndex(l => l.exerciseKey === entry.exerciseKey)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = entry
        return updated
      }
      return [...prev, entry]
    })
  }

  const completedCount = liftMaxes.filter(l => l.e1rm && l.e1rm > 0).length
  const canContinue = completedCount >= 3

  const handleContinue = () => {
    updateData({
      liftAssessment: {
        liftMaxes,
        tmPercentage,
        assessmentComplete: true,
      }
    })
    nextStep()
  }

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 overflow-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Dumbbell className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Lift Assessment</h2>
        <p className="text-zinc-400">
          Enter your current strength levels so we can personalize your program with appropriate weights.
        </p>
      </div>

      {/* TM Percentage Selector */}
      <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-zinc-800 rounded-lg">
            <Calculator className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-white mb-1 flex items-center">
              Training Max Percentage
              <Tooltip {...TOOLTIPS.trainingMax} />
            </h3>
            <p className="text-sm text-zinc-500 mb-3">
              Your Training Max is used to calculate working weights. A conservative TM (85%) builds in more buffer.
            </p>
            <div className="flex gap-2">
              {[0.85, 0.90, 0.95].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setTmPercentage(pct)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                    tmPercentage === pct
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  )}
                >
                  {(pct * 100).toFixed(0)}%
                  {pct === 0.85 && <span className="block text-xs opacity-70">Conservative</span>}
                  {pct === 0.90 && <span className="block text-xs opacity-70">Standard</span>}
                  {pct === 0.95 && <span className="block text-xs opacity-70">Aggressive</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">
          {completedCount} of {KEY_LIFTS.length} lifts assessed
        </span>
        <span className={cn(
          'px-2 py-1 rounded text-xs',
          completedCount >= 3
            ? 'bg-green-500/20 text-green-400'
            : 'bg-zinc-800 text-zinc-500'
        )}>
          {completedCount >= 3 ? 'Minimum met' : 'Enter at least 3'}
        </span>
      </div>

      {/* Lift Inputs */}
      <div className="space-y-3">
        {KEY_LIFTS.map(lift => {
          const entry = liftMaxes.find(l => l.exerciseKey === lift.key)
          return (
            <LiftInput
              key={lift.key}
              lift={lift}
              entry={entry}
              bodyWeight={data.weightKg}
              strengthLevel={data.strengthLevel}
              tmPercentage={tmPercentage}
              onChange={handleLiftChange}
            />
          )
        })}
      </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <h4 className="font-medium text-blue-400 mb-2">Why Training Max?</h4>
          <p className="text-sm text-blue-300/80">
            Using a Training Max (TM) instead of your true 1RM provides a buffer for:
          </p>
          <ul className="text-sm text-blue-300/80 mt-2 space-y-1">
            <li>• Consistent progress without hitting walls</li>
            <li>• Better form under moderate loads</li>
            <li>• Reduced injury risk from grinding reps</li>
            <li>• Room to progress over the mesocycle</li>
          </ul>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={prevStep}
          className="px-6 py-4 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className={cn(
            'flex-1 py-4 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2',
            canContinue
              ? 'bg-white text-zinc-900 hover:bg-zinc-100'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          )}
        >
          {canContinue ? 'Continue' : `Enter ${3 - completedCount} more lift${3 - completedCount > 1 ? 's' : ''}`}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

export default StepLiftAssessment
