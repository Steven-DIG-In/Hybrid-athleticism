'use client'

import { useState } from 'react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { ArrowLeft, ArrowRight, Check, Building2, Home, TreePine, Shuffle } from 'lucide-react'
import { cn } from '@/lib/utils'

const EQUIPMENT_OPTIONS = [
  { id: 'barbell', label: 'Barbell', category: 'free_weights' },
  { id: 'dumbbells', label: 'Dumbbells', category: 'free_weights' },
  { id: 'kettlebells', label: 'Kettlebells', category: 'free_weights' },
  { id: 'squat_rack', label: 'Squat Rack', category: 'stations' },
  { id: 'bench', label: 'Bench', category: 'stations' },
  { id: 'pull_up_bar', label: 'Pull-up Bar', category: 'stations' },
  { id: 'rings', label: 'Gymnastic Rings', category: 'stations' },
  { id: 'dip_bars', label: 'Dip Bars', category: 'stations' },
  { id: 'cable_machine', label: 'Cable Machine', category: 'machines' },
  { id: 'leg_press', label: 'Leg Press', category: 'machines' },
  { id: 'smith_machine', label: 'Smith Machine', category: 'machines' },
  { id: 'lat_pulldown', label: 'Lat Pulldown', category: 'machines' },
  { id: 'leg_curl', label: 'Leg Curl/Extension', category: 'machines' },
  { id: 'resistance_bands', label: 'Resistance Bands', category: 'accessories' },
  { id: 'ab_wheel', label: 'Ab Wheel', category: 'accessories' },
  { id: 'ruck_plate', label: 'Ruck Plate/Weight Vest', category: 'cardio' },
  { id: 'treadmill', label: 'Treadmill', category: 'cardio' },
  { id: 'rower', label: 'Rowing Machine', category: 'cardio' },
  { id: 'air_bike', label: 'Air Bike/Assault Bike', category: 'cardio' },
  { id: 'spin_bike', label: 'Spin Bike', category: 'cardio' },
]

const LOCATIONS = [
  {
    id: 'gym',
    label: 'Commercial Gym',
    description: 'Full equipment access',
    icon: Building2,
  },
  {
    id: 'home',
    label: 'Home Gym',
    description: 'Limited equipment',
    icon: Home,
  },
  {
    id: 'outdoor',
    label: 'Outdoor/Bodyweight',
    description: 'Minimal equipment',
    icon: TreePine,
  },
  {
    id: 'mixed',
    label: 'Mixed',
    description: 'Combination of locations',
    icon: Shuffle,
  },
] as const

export function StepEquipment() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore()
  const [equipment, setEquipment] = useState<string[]>(data.equipment)
  const [location, setLocation] = useState<'gym' | 'home' | 'outdoor' | 'mixed'>(data.trainingLocation)

  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    )
  }

  const handleContinue = () => {
    updateData({
      equipment,
      trainingLocation: location,
    })
    nextStep()
  }

  // Quick select based on location
  const selectGymEquipment = () => {
    setEquipment(EQUIPMENT_OPTIONS.map((e) => e.id))
  }

  const selectHomeEquipment = () => {
    setEquipment(['barbell', 'dumbbells', 'squat_rack', 'bench', 'pull_up_bar', 'resistance_bands'])
  }

  const selectMinimalEquipment = () => {
    setEquipment(['pull_up_bar', 'resistance_bands', 'ruck_plate'])
  }

  const groupedEquipment = {
    free_weights: EQUIPMENT_OPTIONS.filter((e) => e.category === 'free_weights'),
    stations: EQUIPMENT_OPTIONS.filter((e) => e.category === 'stations'),
    machines: EQUIPMENT_OPTIONS.filter((e) => e.category === 'machines'),
    accessories: EQUIPMENT_OPTIONS.filter((e) => e.category === 'accessories'),
    cardio: EQUIPMENT_OPTIONS.filter((e) => e.category === 'cardio'),
  }

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Equipment Access
          </h1>
          <p className="text-zinc-400">
            What equipment do you have access to? We&apos;ll customize exercise selection.
          </p>
        </div>

        {/* Training Location */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Where do you train?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LOCATIONS.map((loc) => {
              const Icon = loc.icon
              return (
                <button
                  key={loc.id}
                  onClick={() => {
                    setLocation(loc.id)
                    if (loc.id === 'gym') selectGymEquipment()
                    else if (loc.id === 'home') selectHomeEquipment()
                    else if (loc.id === 'outdoor') selectMinimalEquipment()
                  }}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    location === loc.id
                      ? 'bg-blue-500/20 border-blue-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{loc.label}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{loc.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Equipment Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-zinc-300">
              Available Equipment
            </label>
            <span className="text-xs text-zinc-500">{equipment.length} selected</span>
          </div>

          {/* Free Weights */}
          <div className="mb-3">
            <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Free Weights</p>
            <div className="flex flex-wrap gap-2">
              {groupedEquipment.free_weights.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleEquipment(item.id)}
                  className={cn(
                    'px-3 py-1.5 rounded text-sm transition-all flex items-center gap-1.5',
                    equipment.includes(item.id)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  {equipment.includes(item.id) && <Check className="w-3 h-3" />}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stations */}
          <div className="mb-3">
            <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Stations</p>
            <div className="flex flex-wrap gap-2">
              {groupedEquipment.stations.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleEquipment(item.id)}
                  className={cn(
                    'px-3 py-1.5 rounded text-sm transition-all flex items-center gap-1.5',
                    equipment.includes(item.id)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  {equipment.includes(item.id) && <Check className="w-3 h-3" />}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Machines */}
          <div className="mb-3">
            <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Machines</p>
            <div className="flex flex-wrap gap-2">
              {groupedEquipment.machines.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleEquipment(item.id)}
                  className={cn(
                    'px-3 py-1.5 rounded text-sm transition-all flex items-center gap-1.5',
                    equipment.includes(item.id)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  {equipment.includes(item.id) && <Check className="w-3 h-3" />}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accessories & Cardio */}
          <div>
            <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Accessories & Cardio</p>
            <div className="flex flex-wrap gap-2">
              {[...groupedEquipment.accessories, ...groupedEquipment.cardio].map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleEquipment(item.id)}
                  className={cn(
                    'px-3 py-1.5 rounded text-sm transition-all flex items-center gap-1.5',
                    equipment.includes(item.id)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  {equipment.includes(item.id) && <Check className="w-3 h-3" />}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
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
