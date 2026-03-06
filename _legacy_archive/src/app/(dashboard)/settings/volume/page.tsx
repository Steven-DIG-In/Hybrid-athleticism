'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MuscleVolumeLandmarks {
  muscle: string
  mv: number
  mev: number
  mav: number
  mrv: number
}

// Default volume landmarks based on RP recommendations
const getDefaultLandmarks = (level: string | null): MuscleVolumeLandmarks[] => {
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

export default function VolumeLandmarksPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [useDefaults, setUseDefaults] = useState(true)
  const [strengthLevel, setStrengthLevel] = useState<string | null>('intermediate')
  const [customLandmarks, setCustomLandmarks] = useState<MuscleVolumeLandmarks[]>([])
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    // Load from localStorage
    try {
      const stored = localStorage.getItem('hybrid-onboarding')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.state?.data) {
          const data = parsed.state.data
          setStrengthLevel(data.strengthLevel || 'intermediate')
          setUseDefaults(data.useDefaultVolumeLandmarks !== false)
          if (data.customVolumeLandmarks?.length > 0) {
            setCustomLandmarks(data.customVolumeLandmarks)
          } else {
            setCustomLandmarks(getDefaultLandmarks(data.strengthLevel || 'intermediate'))
          }
        }
      } else {
        setCustomLandmarks(getDefaultLandmarks('intermediate'))
      }
    } catch {
      setCustomLandmarks(getDefaultLandmarks('intermediate'))
    }
    setLoading(false)
  }, [])

  const updateLandmark = (muscle: string, field: keyof MuscleVolumeLandmarks, value: number) => {
    setCustomLandmarks((prev) =>
      prev.map((l) =>
        l.muscle === muscle ? { ...l, [field]: value } : l
      )
    )
  }

  const handleSave = async () => {
    setSaving(true)

    // Save to localStorage
    try {
      const stored = localStorage.getItem('hybrid-onboarding')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.state?.data) {
          parsed.state.data.useDefaultVolumeLandmarks = useDefaults
          parsed.state.data.customVolumeLandmarks = useDefaults ? [] : customLandmarks
          localStorage.setItem('hybrid-onboarding', JSON.stringify(parsed))
        }
      } else {
        const newData = {
          state: {
            data: {
              useDefaultVolumeLandmarks: useDefaults,
              customVolumeLandmarks: useDefaults ? [] : customLandmarks,
            },
          },
        }
        localStorage.setItem('hybrid-onboarding', JSON.stringify(newData))
      }
    } catch {
      // Ignore errors
    }

    setSaving(false)
    router.push('/settings')
  }

  const defaultLandmarks = getDefaultLandmarks(strengthLevel)

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-32 mb-6"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-12 bg-zinc-900 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Volume Landmarks</h1>
              <p className="text-zinc-500 text-sm">Sets per muscle group per week</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </header>

      {/* Info Toggle */}
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="w-full mb-4 p-3 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-between text-left hover:border-zinc-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-zinc-300">What are Volume Landmarks?</span>
        </div>
        {showInfo ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {/* Info Panel */}
      {showInfo && (
        <div className="mb-6 p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-zinc-400 mb-3">
            Volume = weekly sets per muscle. These landmarks tell us how much work you need:
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2 bg-zinc-900/50 rounded">
              <span className="text-blue-400 font-medium text-sm">MV</span>
              <p className="text-xs text-zinc-500">Maintenance — don&apos;t lose muscle</p>
            </div>
            <div className="p-2 bg-zinc-900/50 rounded">
              <span className="text-green-400 font-medium text-sm">MEV</span>
              <p className="text-xs text-zinc-500">Minimum Effective — start growing</p>
            </div>
            <div className="p-2 bg-zinc-900/50 rounded">
              <span className="text-yellow-400 font-medium text-sm">MAV</span>
              <p className="text-xs text-zinc-500">Maximum Adaptive — optimal growth</p>
            </div>
            <div className="p-2 bg-zinc-900/50 rounded">
              <span className="text-red-400 font-medium text-sm">MRV</span>
              <p className="text-xs text-zinc-500">Max Recoverable — overtraining limit</p>
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            Your mesocycle starts at MEV and progresses toward MAV, then deloads before hitting MRV.
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
              Based on {strengthLevel || 'intermediate'} level
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
      <div className="mt-4 p-3 bg-zinc-900/30 rounded-lg border border-zinc-800">
        <p className="text-xs text-zinc-500">
          <strong className="text-zinc-400">Tip:</strong> If unsure, use defaults. Adjust based
          on how you respond to training over time — if a muscle recovers easily, increase MAV.
          If it&apos;s always sore, decrease it.
        </p>
      </div>
    </div>
  )
}
