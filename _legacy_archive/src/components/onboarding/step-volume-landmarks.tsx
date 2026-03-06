'use client'

import { useState } from 'react'
import { useOnboardingStore, MuscleVolumeLandmarks } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TOOLTIPS } from '@/components/ui/tooltip'

// Default volume landmarks based on RP recommendations
const getDefaultLandmarks = (level: string | null): MuscleVolumeLandmarks[] => {
  // Multiplier based on training level
  const multiplier = level === 'beginner' ? 0.7 : level === 'intermediate' ? 1.0 : level === 'advanced' ? 1.2 : 1.4

  const baseLandmarks = [
    { muscle: 'Chest', mv: 6, mev: 10, mav: 18, mrv: 22 },
    { muscle: 'Back', mv: 6, mev: 10, mav: 20, mrv: 25 },
    { muscle: 'Front Delts', mv: 0, mev: 0, mav: 12, mrv: 16 },
    { muscle: 'Side Delts', mv: 6, mev: 8, mav: 20, mrv: 26 },
    { muscle: 'Rear Delts', mv: 0, mev: 6, mav: 16, mrv: 22 },
    { muscle: 'Biceps', mv: 4, mev: 8, mav: 14, mrv: 20 },
    { muscle: 'Triceps', mv: 4, mev: 6, mav: 14, mrv: 18 },
    { muscle: 'Quads', mv: 6, mev: 8, mav: 18, mrv: 22 },
    { muscle: 'Hamstrings', mv: 4, mev: 6, mav: 14, mrv: 18 },
    { muscle: 'Glutes', mv: 0, mev: 4, mav: 12, mrv: 16 },
    { muscle: 'Calves', mv: 6, mev: 8, mav: 16, mrv: 20 },
    { muscle: 'Core', mv: 0, mev: 0, mav: 16, mrv: 20 },
  ]

  return baseLandmarks.map((l) => ({
    ...l,
    mv: Math.round(l.mv * multiplier),
    mev: Math.round(l.mev * multiplier),
    mav: Math.round(l.mav * multiplier),
    mrv: Math.round(l.mrv * multiplier),
  }))
}

export function StepVolumeLandmarks() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore()
  const [useDefaults, setUseDefaults] = useState(data.useDefaultVolumeLandmarks)
  const [customLandmarks, setCustomLandmarks] = useState<MuscleVolumeLandmarks[]>(
    data.customVolumeLandmarks.length > 0
      ? data.customVolumeLandmarks
      : getDefaultLandmarks(data.strengthLevel)
  )
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(true) // Show by default for better UX

  const handleContinue = () => {
    updateData({
      useDefaultVolumeLandmarks: useDefaults,
      customVolumeLandmarks: useDefaults ? [] : customLandmarks,
    })
    nextStep()
  }

  const updateLandmark = (muscle: string, field: keyof MuscleVolumeLandmarks, value: number) => {
    setCustomLandmarks((prev) =>
      prev.map((l) =>
        l.muscle === muscle ? { ...l, [field]: value } : l
      )
    )
  }

  const defaultLandmarks = getDefaultLandmarks(data.strengthLevel)

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white mb-2">
              Volume Landmarks
            </h1>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="text-zinc-500 hover:text-white"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
          <p className="text-zinc-400">
            These determine how much volume you&apos;ll do per muscle group each week.
          </p>
        </div>

        {/* Info Panel */}
        {showInfo && (
          <div className="mb-6 p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
            <h3 className="font-medium text-white mb-3">What are Volume Landmarks?</h3>
            <p className="text-sm text-zinc-400 mb-3">
              Volume = weekly sets per muscle. These landmarks tell us how much work you need for different goals:
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2 bg-zinc-900/50 rounded">
                <span className="text-blue-400 font-medium text-sm flex items-center">
                  MV <Tooltip {...TOOLTIPS.mv} className="ml-1" />
                </span>
                <p className="text-xs text-zinc-500">Maintenance — don&apos;t lose muscle</p>
              </div>
              <div className="p-2 bg-zinc-900/50 rounded">
                <span className="text-green-400 font-medium text-sm flex items-center">
                  MEV <Tooltip {...TOOLTIPS.mev} className="ml-1" />
                </span>
                <p className="text-xs text-zinc-500">Minimum Effective — start growing</p>
              </div>
              <div className="p-2 bg-zinc-900/50 rounded">
                <span className="text-yellow-400 font-medium text-sm flex items-center">
                  MAV <Tooltip {...TOOLTIPS.mav} className="ml-1" />
                </span>
                <p className="text-xs text-zinc-500">Maximum Adaptive — optimal growth</p>
              </div>
              <div className="p-2 bg-zinc-900/50 rounded">
                <span className="text-red-400 font-medium text-sm flex items-center">
                  MRV <Tooltip {...TOOLTIPS.mrv} className="ml-1" />
                </span>
                <p className="text-xs text-zinc-500">Max Recoverable — overtraining limit</p>
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              <strong className="text-white">Example:</strong> If your chest MEV is 10 and MAV is 18,
              we&apos;ll start your mesocycle at ~10 sets/week and add sets each week until you reach ~18 sets,
              then deload.
            </p>
          </div>
        )}

        {/* Default vs Custom Toggle */}
        <div className="mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setUseDefaults(true)}
              className={cn(
                'flex-1 py-3 rounded-lg border transition-all',
                useDefaults
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              )}
            >
              <span className="font-medium">Use Defaults</span>
              <p className="text-xs text-zinc-500 mt-0.5">
                Based on your {data.strengthLevel || 'intermediate'} level
              </p>
            </button>
            <button
              onClick={() => setUseDefaults(false)}
              className={cn(
                'flex-1 py-3 rounded-lg border transition-all',
                !useDefaults
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              )}
            >
              <span className="font-medium">Customize</span>
              <p className="text-xs text-zinc-500 mt-0.5">Fine-tune for your needs</p>
            </button>
          </div>
        </div>

        {/* Volume Landmarks List */}
        <div className="space-y-2">
          {(useDefaults ? defaultLandmarks : customLandmarks).map((landmark) => (
            <div
              key={landmark.muscle}
              className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden"
            >
              {/* Muscle Header */}
              <button
                onClick={() =>
                  !useDefaults &&
                  setExpandedMuscle(expandedMuscle === landmark.muscle ? null : landmark.muscle)
                }
                className="w-full p-3 flex items-center justify-between"
                disabled={useDefaults}
              >
                <span className="font-medium text-white">{landmark.muscle}</span>
                <div className="flex items-center gap-4">
                  {/* Volume Bar */}
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-blue-400 w-6 text-center">{landmark.mv}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-green-400 w-6 text-center">{landmark.mev}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-yellow-400 w-6 text-center">{landmark.mav}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-red-400 w-6 text-center">{landmark.mrv}</span>
                  </div>
                  {!useDefaults && (
                    expandedMuscle === landmark.muscle ? (
                      <ChevronUp className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    )
                  )}
                </div>
              </button>

              {/* Expanded Edit Panel */}
              {!useDefaults && expandedMuscle === landmark.muscle && (
                <div className="p-3 border-t border-zinc-800 grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-blue-400 mb-1">MV</label>
                    <input
                      type="number"
                      value={landmark.mv}
                      onChange={(e) =>
                        updateLandmark(landmark.muscle, 'mv', parseInt(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-green-400 mb-1">MEV</label>
                    <input
                      type="number"
                      value={landmark.mev}
                      onChange={(e) =>
                        updateLandmark(landmark.muscle, 'mev', parseInt(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-center text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-yellow-400 mb-1">MAV</label>
                    <input
                      type="number"
                      value={landmark.mav}
                      onChange={(e) =>
                        updateLandmark(landmark.muscle, 'mav', parseInt(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-center text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-red-400 mb-1">MRV</label>
                    <input
                      type="number"
                      value={landmark.mrv}
                      onChange={(e) =>
                        updateLandmark(landmark.muscle, 'mrv', parseInt(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-center text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className="mt-4 p-3 bg-zinc-900/30 rounded-lg">
          <p className="text-xs text-zinc-500">
            <strong className="text-zinc-400">Tip:</strong> If you&apos;re unsure, stick with
            defaults. You can adjust these based on how you respond to training over time.
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
          onClick={handleContinue}
          className="flex-1 py-4 bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
