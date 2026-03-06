'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ValidationRule {
  test: (value: string) => boolean
  message: string
}

interface ValidatedInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date' | 'email'
  placeholder?: string
  suffix?: string
  rules?: ValidationRule[]
  required?: boolean
  inputMode?: 'text' | 'decimal' | 'numeric'
  className?: string
  showValidIcon?: boolean
}

export function ValidatedInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  suffix,
  rules = [],
  required = false,
  inputMode,
  className,
  showValidIcon = true,
}: ValidatedInputProps) {
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate on value change (after first touch)
  useEffect(() => {
    if (!touched) return

    // Check required
    if (required && !value.trim()) {
      setError('This field is required')
      return
    }

    // Check custom rules
    for (const rule of rules) {
      if (!rule.test(value)) {
        setError(rule.message)
        return
      }
    }

    setError(null)
  }, [value, touched, rules, required])

  const isValid = touched && !error && value.trim().length > 0

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300 mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          className={cn(
            'w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent transition-colors',
            error && touched
              ? 'border-red-500 focus:ring-red-500'
              : isValid
              ? 'border-green-500/50 focus:ring-green-500'
              : 'border-zinc-800 focus:ring-blue-500',
            suffix ? 'pr-16' : 'pr-10'
          )}
          placeholder={placeholder}
        />
        {suffix && (
          <span className="absolute right-10 top-1/2 -translate-y-1/2 text-zinc-500">
            {suffix}
          </span>
        )}
        {/* Status icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {error && touched && (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          {isValid && showValidIcon && (
            <Check className="w-5 h-5 text-green-400" />
          )}
        </div>
      </div>
      {/* Error message */}
      {error && touched && (
        <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
          {error}
        </p>
      )}
    </div>
  )
}

// Common validation rules
export const ValidationRules = {
  positiveNumber: {
    test: (v: string) => !v || parseFloat(v) > 0,
    message: 'Must be a positive number',
  },
  weight: {
    test: (v: string) => {
      if (!v) return true
      const num = parseFloat(v)
      return num >= 30 && num <= 300
    },
    message: 'Enter a weight between 30-300 kg',
  },
  height: {
    test: (v: string) => {
      if (!v) return true
      const num = parseFloat(v)
      return num >= 100 && num <= 250
    },
    message: 'Enter a height between 100-250 cm',
  },
  notFutureDate: {
    test: (v: string) => {
      if (!v) return true
      return new Date(v) <= new Date()
    },
    message: 'Date cannot be in the future',
  },
  minAge: (min: number) => ({
    test: (v: string) => {
      if (!v) return true
      const birth = new Date(v)
      const today = new Date()
      let age = today.getFullYear() - birth.getFullYear()
      const monthDiff = today.getMonth() - birth.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--
      }
      return age >= min
    },
    message: `Must be at least ${min} years old`,
  }),
  maxAge: (max: number) => ({
    test: (v: string) => {
      if (!v) return true
      const birth = new Date(v)
      const today = new Date()
      let age = today.getFullYear() - birth.getFullYear()
      const monthDiff = today.getMonth() - birth.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--
      }
      return age <= max
    },
    message: `Must be ${max} years old or younger`,
  }),
  reps: {
    test: (v: string) => {
      if (!v) return true
      const num = parseInt(v)
      return num >= 1 && num <= 100
    },
    message: 'Enter reps between 1-100',
  },
}
