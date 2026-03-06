'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { createClient } from '@/lib/supabase/client'
import {
  Rocket,
  CheckCircle2,
  Dumbbell,
  Mountain,
  Timer,
  Calendar,
  Loader2
} from 'lucide-react'
import { generateMesocycle, type MesocycleConfig } from '@/lib/mesocycle-generator'
import { saveMesocycleToDatabase, saveLiftMax, saveVolumeLandmarks, getUserLiftMaxes } from '@/lib/services/mesocycle-service'
import { type Equipment } from '@/lib/exercise-library'
import { DEFAULT_VOLUME_LANDMARKS } from '@/lib/strength'

export function StepComplete() {
  const router = useRouter()
  const { data, reset } = useOnboardingStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFinish = async () => {
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      // Upsert user profile with onboarding data (handles case where signup didn't create row)
      const { data: upsertData, error: upsertError } = await supabase
        .from('users')
        .upsert({
          auth_id: user.id,
          email: user.email!,
          name: data.name,
          weight_kg: data.weightKg,
          height_cm: data.heightCm,
          date_of_birth: data.dateOfBirth,
          training_age_years: data.trainingAgeYears,
          strength_level: data.strengthLevel,
          endurance_level: data.enduranceLevel,
          available_days: data.availableDays,
          preferred_session_duration_mins: data.preferredSessionDuration,
          max_sessions_per_day: data.maxSessionsPerDay,
          updated_at: new Date().toISOString(),
        } as never, {
          onConflict: 'auth_id',
        })
        .select()

      if (upsertError) {
        throw upsertError
      }

      // Verify the save actually worked
      if (!upsertData || upsertData.length === 0) {
        throw new Error('Failed to save profile - no data returned')
      }

      const userId = (upsertData[0] as { id: string }).id

      // Save volume landmarks (use custom or defaults based on training level)
      if (data.useDefaultVolumeLandmarks && data.strengthLevel) {
        const landmarks = Object.entries(DEFAULT_VOLUME_LANDMARKS).map(([muscle, values]) => ({
          muscle_group: muscle,
          ...values,
        }))
        await saveVolumeLandmarks(userId, landmarks)
      } else if (data.customVolumeLandmarks.length > 0) {
        const landmarks = data.customVolumeLandmarks.map(l => ({
          muscle_group: l.muscle,
          mv: l.mv,
          mev: l.mev,
          mav: l.mav,
          mrv: l.mrv,
        }))
        await saveVolumeLandmarks(userId, landmarks)
      }

      // Save lift maxes from assessment
      if (data.liftAssessment?.liftMaxes) {
        for (const lift of data.liftAssessment.liftMaxes) {
          if (lift.e1rm && lift.trainingMax) {
            // Map 'calculated' method to 'estimated' for database
            const dbSource = lift.method === 'tested' ? 'tested' : 'estimated' as const
            await saveLiftMax(userId, lift.exerciseKey, {
              estimated_1rm_kg: lift.e1rm,
              tested_1rm_kg: lift.method === 'tested' ? lift.testedMax : undefined,
              training_max_kg: lift.trainingMax,
              training_max_percentage: data.liftAssessment.tmPercentage,
              source: dbSource,
            })
          }
        }
      }

      // Fetch saved lift maxes for suggested weight calculation
      const savedLiftMaxes = await getUserLiftMaxes(userId)
      console.log(`[Onboarding] Saved ${savedLiftMaxes.length} lift maxes`)

      // Generate mesocycle
      const mesocycleConfig: MesocycleConfig = {
        name: `Mesocycle ${new Date().toLocaleDateString()}`,
        totalWeeks: data.mesocycleLengthWeeks,
        startDate: getThisWeekMonday(),
        availableDays: data.availableDays,
        strengthPriority: data.strengthPriority,
        ruckingPriority: data.ruckingPriority,
        cardioPriority: data.runningPriority,
        preferredSessionDuration: data.preferredSessionDuration,
        maxSessionsPerDay: data.maxSessionsPerDay,
        userEquipment: mapEquipment(data.equipment),
      }

      const mesocycle = generateMesocycle(mesocycleConfig)

      // Save mesocycle to database with lift maxes for suggested weight calculation
      const saveResult = await saveMesocycleToDatabase(userId, mesocycle, savedLiftMaxes)
      if (!saveResult) {
        throw new Error('Failed to save your training program. Please try again.')
      }
      console.log(`[Onboarding] Saved mesocycle ${saveResult.mesocycleId} with ${saveResult.sessionCount} sessions`)

      // Clear onboarding state
      reset()

      // Redirect to dashboard
      router.push('/today')
      router.refresh()
    } catch (err) {
      console.error('Error saving profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to save profile')
      setSaving(false)
    }
  }

  // Summary calculations
  const sessionsPerWeek = {
    strength: data.strengthPriority === 'primary' ? 4 : data.strengthPriority === 'secondary' ? 3 : 2,
    rucking: data.ruckingPriority === 'primary' ? 3 : data.ruckingPriority === 'secondary' ? 2 : 1,
    cardio: data.runningPriority === 'primary' ? 4 : data.runningPriority === 'secondary' ? 3 : 2,
  }

  const totalSessions = sessionsPerWeek.strength + sessionsPerWeek.rucking + sessionsPerWeek.cardio
  const weeklyHours = Math.round((totalSessions * data.preferredSessionDuration) / 60)

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mb-4">
            <Rocket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            You&apos;re All Set, {data.name}!
          </h1>
          <p className="text-zinc-400">
            Here&apos;s a summary of your training setup.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="space-y-4 mb-8">
          {/* Weekly Schedule */}
          <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-purple-400" />
              <h3 className="font-medium text-white">Weekly Schedule</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 bg-zinc-800 rounded">
                <Dumbbell className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <span className="text-lg font-semibold text-white">{sessionsPerWeek.strength}x</span>
                <p className="text-xs text-zinc-500">Strength</p>
              </div>
              <div className="text-center p-2 bg-zinc-800 rounded">
                <Mountain className="w-4 h-4 text-green-400 mx-auto mb-1" />
                <span className="text-lg font-semibold text-white">{sessionsPerWeek.rucking}x</span>
                <p className="text-xs text-zinc-500">Rucking</p>
              </div>
              <div className="text-center p-2 bg-zinc-800 rounded">
                <Timer className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                <span className="text-lg font-semibold text-white">{sessionsPerWeek.cardio}x</span>
                <p className="text-xs text-zinc-500">Cardio</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 text-center">
              {totalSessions} sessions/week · ~{weeklyHours} hours
            </p>
          </div>

          {/* Training Days */}
          <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <h3 className="font-medium text-white mb-3">Training Days</h3>
            <div className="flex gap-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                const dayValue = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][i]
                const isActive = data.availableDays.includes(dayValue as any)
                return (
                  <div
                    key={day}
                    className={`flex-1 py-2 rounded text-center text-xs font-medium ${
                      isActive
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-zinc-800 text-zinc-600'
                    }`}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mesocycle Info */}
          <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <h3 className="font-medium text-white mb-2">Your First Mesocycle</h3>
            <p className="text-sm text-zinc-400">
              {data.mesocycleLengthWeeks} weeks · {data.mesocycleLengthWeeks - (data.includeDeload ? 1 : 0)} accumulation + {data.includeDeload ? '1 deload' : 'no deload'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Starting at MEV, progressing toward MAV
            </p>
          </div>
        </div>

        {/* What's Next */}
        <div className="p-4 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
          <h3 className="font-medium text-white mb-2">What&apos;s Next?</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              View your first week&apos;s planned sessions
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Log your workouts as you complete them
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Track progress and adjust as needed
            </li>
          </ul>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Finish Button */}
      <button
        onClick={handleFinish}
        disabled={saving}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-70 flex items-center justify-center gap-2 mt-6"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving your profile...
          </>
        ) : (
          <>
            <Rocket className="w-5 h-5" />
            Start Training
          </>
        )}
      </button>
    </div>
  )
}

// Helper: Get the start of the current week (Monday) as start date
// This ensures users can start training immediately, not wait until next week
function getThisWeekMonday(): Date {
  const today = new Date()
  const dayOfWeek = today.getDay()
  // Calculate days to go back to reach Monday
  // Sunday (0) -> go back 6 days
  // Monday (1) -> go back 0 days
  // Tuesday (2) -> go back 1 day, etc.
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - daysToSubtract)
  thisMonday.setHours(0, 0, 0, 0)
  return thisMonday
}

// Helper: Map onboarding equipment names to library equipment types
function mapEquipment(onboardingEquipment: string[]): Equipment[] {
  // Map onboarding equipment IDs to exercise library equipment types
  // Onboarding IDs come from step-equipment.tsx EQUIPMENT_OPTIONS
  const EQUIPMENT_MAP: Record<string, Equipment[]> = {
    // Free weights
    barbell: ['barbell'],
    dumbbells: ['dumbbells'],
    kettlebells: ['kettlebells'],
    // Stations
    squat_rack: ['squat_rack', 'barbell'], // Squat rack implies barbell
    bench: ['bench'],
    pull_up_bar: ['pull_up_bar'],
    rings: ['gymnastic_rings'],
    dip_bars: ['dip_station'],
    // Machines
    cable_machine: ['cable_machine'],
    leg_press: ['leg_press', 'machines'],
    smith_machine: ['machines', 'barbell'], // Smith machine as a barbell alternative
    lat_pulldown: ['cable_machine', 'machines'],
    leg_curl: ['machines'], // Leg curl/extension machine
    // Accessories
    resistance_bands: ['bands'],
    ab_wheel: ['bodyweight'], // Ab wheel is essentially bodyweight
    // Cardio equipment
    ruck_plate: ['bodyweight'], // Ruck plate doesn't affect exercise selection much
    treadmill: ['bodyweight'],
    rower: ['rowing_machine'],
    air_bike: ['air_bike'],
    spin_bike: ['spin_bike'],
  }

  const equipment = new Set<Equipment>()
  equipment.add('bodyweight') // Always include bodyweight

  for (const item of onboardingEquipment) {
    const mapped = EQUIPMENT_MAP[item]
    if (mapped) {
      mapped.forEach(e => equipment.add(e))
    }
  }

  return Array.from(equipment)
}
