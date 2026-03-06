'use client'

import { useState, useMemo } from 'react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StepPhysicalProfile() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore()
  const [weightKg, setWeightKg] = useState(data.weightKg?.toString() || '')
  const [heightCm, setHeightCm] = useState(data.heightCm?.toString() || '')
  const [dateOfBirth, setDateOfBirth] = useState(data.dateOfBirth || '')
  const [useImperial, setUseImperial] = useState(false)
  const [touched, setTouched] = useState({ weight: false, height: false, dob: false })

  // Validation
  const errors = useMemo(() => {
    const errs: { weight?: string; height?: string; dob?: string } = {}

    if (weightKg) {
      const w = parseFloat(weightKg)
      if (isNaN(w) || w <= 0) errs.weight = 'Weight must be positive'
      else if (w < 30) errs.weight = 'Weight seems too low (min 30 kg)'
      else if (w > 300) errs.weight = 'Weight seems too high (max 300 kg)'
    }

    if (heightCm) {
      const h = parseFloat(heightCm)
      if (isNaN(h) || h <= 0) errs.height = 'Height must be positive'
      else if (h < 100) errs.height = 'Height seems too low (min 100 cm)'
      else if (h > 250) errs.height = 'Height seems too high (max 250 cm)'
    }

    if (dateOfBirth) {
      const birth = new Date(dateOfBirth)
      const today = new Date()
      if (birth > today) errs.dob = 'Date cannot be in the future'
      else {
        let age = today.getFullYear() - birth.getFullYear()
        const monthDiff = today.getMonth() - birth.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
        if (age < 13) errs.dob = 'Must be at least 13 years old'
        else if (age > 100) errs.dob = 'Please enter a valid date of birth'
      }
    }

    return errs
  }, [weightKg, heightCm, dateOfBirth])

  const hasErrors = Object.keys(errors).length > 0

  const handleContinue = () => {
    updateData({
      weightKg: weightKg ? parseFloat(weightKg) : null,
      heightCm: heightCm ? parseFloat(heightCm) : null,
      dateOfBirth: dateOfBirth || null,
    })
    nextStep()
  }

  // Convert display values for imperial
  const displayWeight = useImperial && weightKg ? (parseFloat(weightKg) * 2.205).toFixed(0) : weightKg
  const displayHeight = useImperial && heightCm ? (parseFloat(heightCm) / 2.54).toFixed(0) : heightCm

  const handleWeightChange = (value: string) => {
    if (useImperial) {
      // Convert lbs to kg
      setWeightKg(value ? (parseFloat(value) / 2.205).toFixed(1) : '')
    } else {
      setWeightKg(value)
    }
  }

  const handleHeightChange = (value: string) => {
    if (useImperial) {
      // Convert inches to cm
      setHeightCm(value ? (parseFloat(value) * 2.54).toFixed(0) : '')
    } else {
      setHeightCm(value)
    }
  }

  const calculateAge = () => {
    if (!dateOfBirth) return null
    const today = new Date()
    const birth = new Date(dateOfBirth)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const age = calculateAge()

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Physical Profile
          </h1>
          <p className="text-zinc-400">
            This helps us estimate your baseline and scale recommendations appropriately.
          </p>
        </div>

        {/* Unit Toggle */}
        <div className="flex items-center gap-3 mb-6">
          <span className={`text-sm ${!useImperial ? 'text-white' : 'text-zinc-500'}`}>Metric</span>
          <button
            onClick={() => setUseImperial(!useImperial)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              useImperial ? 'bg-blue-500' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                useImperial ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm ${useImperial ? 'text-white' : 'text-zinc-500'}`}>Imperial</span>
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Weight */}
          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-zinc-300 mb-2">
              Body Weight
            </label>
            <div className="relative">
              <input
                id="weight"
                type="number"
                inputMode="decimal"
                value={displayWeight}
                onChange={(e) => handleWeightChange(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, weight: true }))}
                className={cn(
                  "w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent pr-16",
                  touched.weight && errors.weight
                    ? "border-red-500 focus:ring-red-500"
                    : "border-zinc-800 focus:ring-blue-500"
                )}
                placeholder={useImperial ? '180' : '82'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                {useImperial ? 'lbs' : 'kg'}
              </span>
            </div>
            {touched.weight && errors.weight && (
              <p className="text-sm text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.weight}
              </p>
            )}
          </div>

          {/* Height */}
          <div>
            <label htmlFor="height" className="block text-sm font-medium text-zinc-300 mb-2">
              Height
            </label>
            <div className="relative">
              <input
                id="height"
                type="number"
                inputMode="numeric"
                value={displayHeight}
                onChange={(e) => handleHeightChange(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, height: true }))}
                className={cn(
                  "w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent pr-16",
                  touched.height && errors.height
                    ? "border-red-500 focus:ring-red-500"
                    : "border-zinc-800 focus:ring-blue-500"
                )}
                placeholder={useImperial ? '70' : '178'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                {useImperial ? 'in' : 'cm'}
              </span>
            </div>
            {useImperial && heightCm && !errors.height && (
              <p className="text-xs text-zinc-500 mt-1">
                {Math.floor(parseFloat(displayHeight) / 12)}&apos;{Math.round(parseFloat(displayHeight) % 12)}&quot;
              </p>
            )}
            {touched.height && errors.height && (
              <p className="text-sm text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.height}
              </p>
            )}
          </div>

          {/* Date of Birth */}
          <div>
            <label htmlFor="dob" className="block text-sm font-medium text-zinc-300 mb-2">
              Date of Birth
            </label>
            <input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, dob: true }))}
              className={cn(
                "w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent",
                touched.dob && errors.dob
                  ? "border-red-500 focus:ring-red-500"
                  : "border-zinc-800 focus:ring-blue-500"
              )}
            />
            {age !== null && !errors.dob && (
              <p className="text-sm text-zinc-400 mt-2">
                {age} years old
              </p>
            )}
            {touched.dob && errors.dob && (
              <p className="text-sm text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.dob}
              </p>
            )}
          </div>
        </div>

        {/* Helper Text */}
        <p className="text-xs text-zinc-500 mt-6">
          All fields are optional but help us provide better recommendations.
        </p>

        {/* Error Summary */}
        {hasErrors && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">
              Please fix the errors above before continuing.
            </p>
          </div>
        )}
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
          disabled={hasErrors}
          className={cn(
            "flex-1 py-4 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2",
            hasErrors
              ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
              : "bg-white text-zinc-900 hover:bg-zinc-100"
          )}
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
