'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LogOut,
  User,
  Dumbbell,
  Bell,
  Database,
  Calendar,
  Target,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserProfile {
  name: string | null
  email: string
  height_cm: number | null
  weight_kg: number | null
  date_of_birth: string | null
  strength_level: string | null
  endurance_level: string | null
  training_age_years: number | null
  available_days: string[] | null
  preferred_session_duration_mins: number | null
  max_sessions_per_day: number | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', user.id)
          .single()

        if (data) {
          setProfile(data as UserProfile)
        }
      }
      setLoading(false)
    }

    loadProfile()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Clear onboarding data
    localStorage.removeItem('hybrid-onboarding')
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-32 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-zinc-900 rounded-lg"></div>
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
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/today"
            className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-zinc-500 text-sm">Manage your account and preferences</p>
          </div>
        </div>
      </header>

      {/* Profile Summary */}
      {profile && (
        <div className="bg-zinc-900 rounded-lg p-4 mb-6 border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-400">
                {profile.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{profile.name || 'User'}</h2>
              <p className="text-sm text-zinc-400">{profile.email}</p>
              <div className="flex gap-2 mt-1">
                {profile.strength_level && (
                  <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full capitalize">
                    {profile.strength_level}
                  </span>
                )}
                {profile.training_age_years && (
                  <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full">
                    {profile.training_age_years}yr training
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Profile Section */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-2">Profile</h2>
          <div className="bg-zinc-900 rounded-lg divide-y divide-zinc-800">
            <Link
              href="/settings/profile"
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-zinc-400" />
                <div className="text-left">
                  <p className="text-white">Personal Info</p>
                  <p className="text-sm text-zinc-500">Name, height, weight, age</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </Link>
            <Link
              href="/settings/availability"
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors rounded-b-lg"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-zinc-400" />
                <div className="text-left">
                  <p className="text-white">Availability</p>
                  <p className="text-sm text-zinc-500">
                    {profile?.available_days?.length || 0} days/week · {profile?.preferred_session_duration_mins || 60}min sessions
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </Link>
          </div>
        </section>

        {/* Training Section */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-2">Training</h2>
          <div className="bg-zinc-900 rounded-lg divide-y divide-zinc-800">
            <Link
              href="/settings/priorities"
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-zinc-400" />
                <div className="text-left">
                  <p className="text-white">Domain Priorities</p>
                  <p className="text-sm text-zinc-500">Strength, rucking, cardio focus</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </Link>
            <Link
              href="/settings/volume"
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Dumbbell className="w-5 h-5 text-zinc-400" />
                <div className="text-left">
                  <p className="text-white">Volume Landmarks</p>
                  <p className="text-sm text-zinc-500">MV, MEV, MAV, MRV settings</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </Link>
            <Link
              href="/settings/garmin"
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors rounded-b-lg"
            >
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-zinc-400" />
                <div className="text-left">
                  <p className="text-white">Garmin Connect</p>
                  <p className="text-sm text-zinc-500">Sync your activities</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </Link>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-2">Preferences</h2>
          <div className="bg-zinc-900 rounded-lg">
            <Link
              href="/settings/notifications"
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-zinc-400" />
                <div className="text-left">
                  <p className="text-white">Notifications</p>
                  <p className="text-sm text-zinc-500">Reminders and alerts</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </Link>
          </div>
        </section>

        {/* Logout */}
        <section className="pt-2">
          <button
            onClick={handleLogout}
            className="w-full p-4 bg-zinc-900 rounded-lg flex items-center gap-3 text-red-400 hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign out</span>
          </button>
        </section>

        {/* Version */}
        <p className="text-center text-zinc-600 text-sm pt-2">
          Hybrid Athleticism v0.1.0
        </p>
      </div>
    </div>
  )
}
