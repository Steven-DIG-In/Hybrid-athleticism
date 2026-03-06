'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudOff } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { StepWelcome } from '@/components/onboarding/step-welcome'
import { StepPhysicalProfile } from '@/components/onboarding/step-physical-profile'
import { StepTrainingExperience } from '@/components/onboarding/step-training-experience'
import { StepAvailability } from '@/components/onboarding/step-availability'
import { StepDomainPriorities } from '@/components/onboarding/step-domain-priorities'
import { StepStrengthGoals } from '@/components/onboarding/step-strength-goals'
import { StepLiftAssessment } from '@/components/onboarding/step-lift-assessment'
import { StepCardioGoals } from '@/components/onboarding/step-cardio-goals'
import { StepEquipment } from '@/components/onboarding/step-equipment'
import { StepVolumeLandmarks } from '@/components/onboarding/step-volume-landmarks'
import { StepProgramGeneration } from '@/components/onboarding/step-program-generation'
import { StepGarminConnect } from '@/components/onboarding/step-garmin-connect'
import { StepSummary } from '@/components/onboarding/step-summary'
import { StepComplete } from '@/components/onboarding/step-complete'

export default function OnboardingPage() {
  const { currentStep, totalSteps, data } = useOnboardingStore()
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')

  // Show saving indicator briefly when data changes
  useEffect(() => {
    setSaveStatus('saving')
    const timer = setTimeout(() => setSaveStatus('saved'), 500)
    return () => clearTimeout(timer)
  }, [data, currentStep])

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepWelcome />
      case 2:
        return <StepPhysicalProfile />
      case 3:
        return <StepTrainingExperience />
      case 4:
        return <StepAvailability />
      case 5:
        return <StepDomainPriorities />
      case 6:
        return <StepStrengthGoals />
      case 7:
        return <StepLiftAssessment />  // NEW - Lift Assessment
      case 8:
        return <StepCardioGoals />
      case 9:
        return <StepEquipment />
      case 10:
        return <StepVolumeLandmarks />
      case 11:
        return <StepProgramGeneration />
      case 12:
        return <StepSummary />  // Review before generation
      case 13:
        return <StepGarminConnect />
      case 14:
        return <StepComplete />
      default:
        return <StepWelcome />
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress Bar */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">Step {currentStep} of {totalSteps}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              {saveStatus === 'saving' ? (
                <>
                  <Cloud className="w-3 h-3 animate-pulse" />
                  Saving...
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-green-500" />
                  Progress saved
                </>
              )}
            </span>
            <span className="text-zinc-700">|</span>
            <span className="text-xs text-zinc-500">{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 flex flex-col">
        {renderStep()}
      </div>
    </div>
  )
}
