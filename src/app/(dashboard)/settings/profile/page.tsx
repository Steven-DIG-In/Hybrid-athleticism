'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileData {
  name: string
  height_cm: number | null
  weight_kg: number | null
  date_of_birth: string | null
  training_age_years: number | null
  strength_level: string | null
  endurance_level: string | null
}

const TRAINING_LEVELS = [
  { value: 'beginner', label: 'Beginner', description: '< 1 year' },
  { value: 'intermediate', label: 'Intermediate', description: '1-3 years' },
  { value: 'advanced', label: 'Advanced', description: '3-7 years' },
  { value: 'elite', label: 'Elite', description: '7+ years' },
]

export default function ProfileEditPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    height_cm: null,
    weight_kg: null,
    date_of_birth: null,
    training_age_years: null,
    strength_level: null,
    endurance_level: null,
  })

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('users')
          .select('name, height_cm, weight_kg, date_of_birth, training_age_years, strength_level, endurance_level')
          .eq('auth_id', user.id)
          .single()

        const profileData = data as ProfileData | null
        if (profileData) {
          setProfile({
            name: profileData.name || '',
            height_cm: profileData.height_cm,
            weight_kg: profileData.weight_kg,
            date_of_birth: profileData.date_of_birth,
            training_age_years: profileData.training_age_years,
            strength_level: profileData.strength_level,
            endurance_level: profileData.endurance_level,
          })
        }
      }
      setLoading(false)
    }

    loadProfile()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      await supabase
        .from('users')
        .update({
          name: profile.name,
          height_cm: profile.height_cm,
          weight_kg: profile.weight_kg,
          date_of_birth: profile.date_of_birth,
          training_age_years: profile.training_age_years,
          strength_level: profile.strength_level,
          endurance_level: profile.endurance_level,
        } as never)
        .eq('auth_id', user.id)

      // Also update localStorage onboarding data
      try {
        const stored = localStorage.getItem('hybrid-onboarding')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.state?.data) {
            parsed.state.data.name = profile.name
            parsed.state.data.heightCm = profile.height_cm
            parsed.state.data.weightKg = profile.weight_kg
            parsed.state.data.dateOfBirth = profile.date_of_birth
            parsed.state.data.trainingAgeYears = profile.training_age_years
            parsed.state.data.strengthLevel = profile.strength_level
            parsed.state.data.enduranceLevel = profile.endurance_level
            localStorage.setItem('hybrid-onboarding', JSON.stringify(parsed))
          }
        }
      } catch {
        // Ignore localStorage errors
      }
    }

    setSaving(false)
    router.push('/settings')
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-32 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-zinc-900 rounded-lg"></div>
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
              <h1 className="text-xl font-bold text-white">Personal Info</h1>
              <p className="text-zinc-500 text-sm">Edit your profile details</p>
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

      <div className="space-y-6">
        {/* Basic Info */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400">Basic Information</h2>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              placeholder="Your name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Height (cm)</label>
              <input
                type="number"
                value={profile.height_cm || ''}
                onChange={(e) => setProfile({ ...profile, height_cm: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                placeholder="175"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Weight (kg)</label>
              <input
                type="number"
                value={profile.weight_kg || ''}
                onChange={(e) => setProfile({ ...profile, weight_kg: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                placeholder="75"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Date of Birth</label>
            <input
              type="date"
              value={profile.date_of_birth || ''}
              onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value || null })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </section>

        {/* Training Experience */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400">Training Experience</h2>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Years Training</label>
            <input
              type="number"
              value={profile.training_age_years || ''}
              onChange={(e) => setProfile({ ...profile, training_age_years: e.target.value ? Number(e.target.value) : null })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              placeholder="3"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-3">Strength Level</label>
            <div className="grid grid-cols-2 gap-2">
              {TRAINING_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setProfile({ ...profile, strength_level: level.value })}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    profile.strength_level === level.value
                      ? 'bg-blue-500/20 border-blue-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  )}
                >
                  <p className="font-medium">{level.label}</p>
                  <p className="text-xs text-zinc-500">{level.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-3">Endurance Level</label>
            <div className="grid grid-cols-2 gap-2">
              {TRAINING_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setProfile({ ...profile, endurance_level: level.value })}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    profile.endurance_level === level.value
                      ? 'bg-green-500/20 border-green-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  )}
                >
                  <p className="font-medium">{level.label}</p>
                  <p className="text-xs text-zinc-500">{level.description}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
