'use client'

import { useState } from 'react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, Watch, Link2, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StepGarminConnect() {
  const { nextStep, prevStep } = useOnboardingStore()
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'skipped'>('idle')

  const handleConnect = async () => {
    setConnectionStatus('connecting')
    // In a real implementation, this would initiate OAuth flow
    // For now, simulate the connection process
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setConnectionStatus('connected')
  }

  const handleSkip = () => {
    setConnectionStatus('skipped')
    nextStep()
  }

  const handleContinue = () => {
    nextStep()
  }

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Watch className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">
              Connect Garmin
            </h1>
          </div>
          <p className="text-zinc-400">
            Automatically sync your rucking and running activities from Garmin.
          </p>
        </div>

        {/* Benefits */}
        <div className="mb-8 space-y-3">
          <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
            <div>
              <p className="text-white font-medium">Automatic Activity Sync</p>
              <p className="text-sm text-zinc-500">
                Rucking and running sessions sync automatically
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
            <div>
              <p className="text-white font-medium">Heart Rate Data</p>
              <p className="text-sm text-zinc-500">
                Better fatigue estimation with HR metrics
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
            <div>
              <p className="text-white font-medium">GPS & Elevation</p>
              <p className="text-sm text-zinc-500">
                Track routes, distance, and elevation gain
              </p>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="mb-8">
          {connectionStatus === 'idle' && (
            <button
              onClick={handleConnect}
              className="w-full py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
            >
              <Link2 className="w-5 h-5" />
              Connect Garmin Account
            </button>
          )}

          {connectionStatus === 'connecting' && (
            <div className="w-full py-4 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center gap-3">
              <Clock className="w-5 h-5 text-blue-400 animate-pulse" />
              <span className="text-zinc-300">Connecting to Garmin...</span>
            </div>
          )}

          {connectionStatus === 'connected' && (
            <div className="w-full py-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">Garmin Connected!</span>
            </div>
          )}
        </div>

        {/* Skip Option */}
        {connectionStatus === 'idle' && (
          <div className="text-center">
            <button
              onClick={handleSkip}
              className="text-zinc-500 hover:text-white text-sm transition-colors"
            >
              Skip for now — I&apos;ll log manually
            </button>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 p-4 bg-zinc-900/30 rounded-lg">
          <p className="text-xs text-zinc-500">
            <strong className="text-zinc-400">Privacy:</strong> We only access your
            activity data (workouts, heart rate). We never access personal health
            records or share your data with third parties.
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
          disabled={connectionStatus === 'connecting'}
          className="flex-1 py-4 bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {connectionStatus === 'connected' ? 'Continue' : 'Continue Without Garmin'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
