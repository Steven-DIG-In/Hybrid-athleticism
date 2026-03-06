'use client'

import { useOnboardingStore } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, Check, Edit2, Calendar, Dumbbell, Target, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StepSummary() {
  const { data, nextStep, prevStep, setStep } = useOnboardingStore()

  const availableDays = data.availableDays || []
  const liftMaxes = data.liftAssessment?.liftMaxes?.filter(l => l.e1rm && l.e1rm > 0) || []

  // Format day for display
  const formatDay = (day: string) => day.charAt(0).toUpperCase() + day.slice(1, 3)

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 overflow-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Review Your Program</h2>
          <p className="text-zinc-400">
            Check everything looks good before we generate your training plan.
          </p>
        </div>

        {/* Schedule Summary */}
        <SummaryCard
          icon={<Calendar className="w-5 h-5" />}
          title="Training Schedule"
          onEdit={() => setStep(4)}
        >
          <div className="flex gap-2 flex-wrap">
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
              <span
                key={day}
                className={cn(
                  'px-3 py-1 rounded-lg text-sm',
                  availableDays.includes(day as typeof availableDays[number])
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-zinc-800 text-zinc-600'
                )}
              >
                {formatDay(day)}
              </span>
            ))}
          </div>
          <p className="text-sm text-zinc-400 mt-2">
            {availableDays.length} training days per week • {data.preferredSessionDuration || 60} min sessions
          </p>
        </SummaryCard>

        {/* Lift Maxes Summary */}
        <SummaryCard
          icon={<Dumbbell className="w-5 h-5" />}
          title="Your Lift Maxes"
          onEdit={() => setStep(7)}
        >
          {liftMaxes.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {liftMaxes.map(lift => (
                <div key={lift.exerciseKey} className="flex justify-between items-center bg-zinc-800/50 rounded-lg p-2">
                  <span className="text-sm text-zinc-300">{lift.exerciseName}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-white">{lift.trainingMax}kg</span>
                    <span className="text-xs text-zinc-500 ml-1">TM</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500">No lift maxes entered</p>
          )}
          <p className="text-sm text-zinc-400 mt-2">
            Training Max: {((data.liftAssessment?.tmPercentage || 0.9) * 100).toFixed(0)}% of E1RM
          </p>
        </SummaryCard>

        {/* Training Focus Summary */}
        <SummaryCard
          icon={<Target className="w-5 h-5" />}
          title="Training Focus"
          onEdit={() => setStep(6)}
        >
          <div className="space-y-2">
            {data.strengthGoals.focusMuscles.length > 0 && (
              <div>
                <span className="text-xs text-zinc-500 uppercase">Priority Muscles</span>
                <p className="text-sm text-zinc-300">
                  {data.strengthGoals.focusMuscles.map(m => m.replace('_', ' ')).join(', ') || 'None selected'}
                </p>
              </div>
            )}
            {data.strengthGoals.priorityMovements.length > 0 && (
              <div>
                <span className="text-xs text-zinc-500 uppercase">Movement Patterns</span>
                <p className="text-sm text-zinc-300">
                  {data.strengthGoals.priorityMovements.join(', ') || 'None selected'}
                </p>
              </div>
            )}
          </div>
        </SummaryCard>

        {/* Program Structure Summary */}
        <SummaryCard
          icon={<Activity className="w-5 h-5" />}
          title="Program Structure"
          onEdit={() => setStep(11)}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-zinc-500 uppercase">Mesocycle Length</span>
              <p className="text-lg font-medium text-white">{data.mesocycleLengthWeeks || 4} weeks</p>
            </div>
            <div>
              <span className="text-xs text-zinc-500 uppercase">Deload Week</span>
              <p className="text-lg font-medium text-white">{data.includeDeload ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="text-xs text-zinc-500 uppercase">Volume Strategy</span>
              <p className="text-sm text-zinc-300">
                {data.useDefaultVolumeLandmarks ? 'Default (RP-based)' : 'Custom landmarks'}
              </p>
            </div>
            <div>
              <span className="text-xs text-zinc-500 uppercase">Training Level</span>
              <p className="text-sm text-zinc-300 capitalize">{data.strengthLevel || 'Intermediate'}</p>
            </div>
          </div>
        </SummaryCard>

        {/* Info */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-300">
            Click <Edit2 className="w-4 h-4 inline mx-1" /> on any section to go back and make changes.
            Your progress is automatically saved.
          </p>
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
          onClick={nextStep}
          className="flex-1 py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 transition-colors flex items-center justify-center gap-2"
        >
          Generate My Program
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

// Reusable summary card component
function SummaryCard({
  icon,
  title,
  children,
  onEdit
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  onEdit: () => void
}) {
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-zinc-400">
          {icon}
          <h3 className="font-medium text-white">{title}</h3>
        </div>
        <button
          onClick={onEdit}
          className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  )
}

export default StepSummary
