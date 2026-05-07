"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
    ArrowRight, ArrowLeft, Zap, Dumbbell, Mountain, Heart,
    Timer, AlertTriangle, Sparkles, ChevronRight, Check, X,
    Footprints, Bike, Waves, BarChart3, Brain, Shield, Target, Gauge,
    Users, GripVertical, Plus, Minus, ChevronDown,
} from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
    updateOnboardingProfile,
    saveInjuries,
    saveBenchmarks,
    saveRecentTraining,
    completeOnboarding,
} from "@/lib/actions/onboarding.actions"
import {
    SELECTABLE_COACHES,
    ALWAYS_ACTIVE_COACHES,
    getDefaultTeamForGoal,
} from "@/lib/coaching-staff"
import type { CoachProfile } from "@/lib/coaching-staff"
import type {
    ExperienceLevel,
    TrainingEnvironment,
    GoalArchetype,
    TwoADayWillingness,
    InjuryBodyArea,
    InjurySeverity,
    WorkType,
    StressLevel,
    TravelFrequency,
    TimeOfDayPreference,
    MethodologyPreference,
    TransparencyPreference,
    BodyCompGoal,
    EquipmentUsageIntent,
} from "@/lib/types/database.types"
import type { OnboardingInjury, OnboardingBenchmark, OnboardingRecentTraining } from "@/lib/types/training.types"

// ─── Constants ──────────────────────────────────────────────────────────────

const EQUIPMENT_OPTIONS = [
    { id: 'barbell_rack', label: 'Barbell + Rack', desc: 'Squat rack, bench, barbell' },
    { id: 'dumbbells', label: 'Dumbbells', desc: 'Adjustable or fixed range' },
    { id: 'kettlebells', label: 'Kettlebells', desc: 'Flow and ballistic work' },
    { id: 'pull_up_bar', label: 'Pull-up Bar', desc: 'Doorway or wall-mounted' },
    { id: 'cables_machines', label: 'Cable / Machines', desc: 'Cable crossover, smith, etc.' },
    { id: 'assault_bike', label: 'Assault / Air Bike', desc: 'Echo bike, Rogue, etc.' },
    { id: 'rower', label: 'Rower', desc: 'Concept2 or equivalent' },
    { id: 'ski_erg', label: 'Ski Erg', desc: 'Upper body cardio machine' },
    { id: 'treadmill', label: 'Treadmill', desc: 'Running / incline walking' },
    { id: 'stationary_bike', label: 'Stationary Bike', desc: 'Spin bike or recumbent' },
    { id: 'swimming_pool', label: 'Pool (Lap)', desc: 'Indoor/outdoor lap pool' },
    { id: 'open_water', label: 'Open Water', desc: 'Lake, ocean, river swimming' },
    { id: 'ruck', label: 'Ruck / Weighted Vest', desc: 'Rucksack + weights' },
    { id: 'sled', label: 'Sled / Prowler', desc: 'Push/pull sled' },
    { id: 'battle_ropes', label: 'Battle Ropes', desc: 'Upper body conditioning' },
    { id: 'resistance_bands', label: 'Resistance Bands', desc: 'Light to heavy bands' },
]

const GOAL_OPTIONS: { id: GoalArchetype; title: string; desc: string; icon: typeof Dumbbell }[] = [
    { id: 'hybrid_fitness', title: 'Hybrid Fitness', desc: 'Improve overall fitness across all domains.', icon: Zap },
    { id: 'strength_focus', title: 'Strength Focus', desc: 'Build strength while maintaining endurance.', icon: Dumbbell },
    { id: 'endurance_focus', title: 'Endurance Focus', desc: 'Build endurance while maintaining strength.', icon: Footprints },
    { id: 'conditioning_focus', title: 'Conditioning Focus', desc: 'Maximize work capacity and conditioning.', icon: Timer },
    { id: 'longevity', title: 'Health & Longevity', desc: 'General health, balanced movement, sustainability.', icon: Heart },
]

const BODY_AREAS: { id: InjuryBodyArea; label: string }[] = [
    { id: 'shoulder', label: 'Shoulder' },
    { id: 'lower_back', label: 'Lower Back' },
    { id: 'knee', label: 'Knee' },
    { id: 'hip', label: 'Hip' },
    { id: 'ankle', label: 'Ankle' },
    { id: 'wrist', label: 'Wrist' },
    { id: 'elbow', label: 'Elbow' },
    { id: 'neck', label: 'Neck' },
    { id: 'other', label: 'Other' },
]

const COMMON_MOVEMENTS_TO_AVOID = [
    'Overhead pressing',
    'Running',
    'Heavy squatting',
    'Deadlifting from floor',
    'Bench press',
    'Pull-ups / Chin-ups',
    'Jumping / Plyometrics',
    'Rowing (machine)',
    'Kipping movements',
]

const DUAL_PURPOSE_EQUIPMENT = ['assault_bike', 'rower', 'ski_erg', 'stationary_bike']

const CONDITIONING_STYLES = [
    'Metcon / CrossFit style',
    'Machine-based intervals',
    'Circuit training',
    'HIIT',
]

const ENDURANCE_MODALITIES = [
    { id: 'running', label: 'Running' },
    { id: 'rucking', label: 'Rucking' },
    { id: 'rowing', label: 'Rowing' },
    { id: 'cycling', label: 'Cycling' },
    { id: 'swimming', label: 'Swimming' },
]

// ─── Screen definitions ─────────────────────────────────────────────────────

type ScreenId =
    | 'welcome' | 'profile' | 'experience' | 'experience_detail'
    | 'equipment' | 'equipment_prefs' | 'availability' | 'lifestyle'
    | 'goals' | 'coaching_team' | 'methodology' | 'injuries' | 'body_comp' | 'benchmark_path' | 'generating'

type BenchmarkPath = 'ai_estimated' | 'user_provided' | 'discovery'

const QUICK_SCREENS: ScreenId[] = [
    'welcome', 'profile', 'experience', 'equipment', 'availability', 'goals', 'coaching_team', 'injuries', 'benchmark_path', 'generating'
]

const DEEP_SCREENS: ScreenId[] = [
    'welcome', 'profile', 'experience', 'experience_detail',
    'equipment', 'equipment_prefs', 'availability', 'lifestyle',
    'goals', 'coaching_team', 'methodology', 'injuries', 'body_comp', 'benchmark_path', 'generating'
]

const STRENGTH_BENCHMARKS = [
    { id: 'back_squat', name: 'Back Squat', unit: 'kg' },
    { id: 'bench_press', name: 'Bench Press', unit: 'kg' },
    { id: 'deadlift', name: 'Deadlift', unit: 'kg' },
    { id: 'overhead_press', name: 'Overhead Press', unit: 'kg' },
]

const CARDIO_BENCHMARKS = [
    { id: 'run_5k', name: 'Run 5km', unit: 'time', placeholder: 'MM:SS', enduranceId: 'running' },
    { id: 'row_2000m', name: 'Row 2000m', unit: 'time', placeholder: 'MM:SS', enduranceId: 'rowing' },
    { id: 'cycle_20km', name: 'Cycle 20km', unit: 'time', placeholder: 'MM:SS', enduranceId: 'cycling' },
    { id: 'swim_1km', name: 'Swim 1km', unit: 'time', placeholder: 'MM:SS', enduranceId: 'swimming' },
]

// ─── Animation variants ─────────────────────────────────────────────────────

const slideVariants = {
    enter: { opacity: 0, x: 30 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const router = useRouter()
    const [screenIndex, setScreenIndex] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ─── Form state ─────────────────────────────────────────────────────────

    // Path
    const [path, setPath] = useState<'quick' | 'deep' | null>(null)

    // Profile
    const [age, setAge] = useState("")
    const [sex, setSex] = useState<'MALE' | 'FEMALE' | ''>("")
    const [heightCm, setHeightCm] = useState("")
    const [weight, setWeight] = useState("")
    const [unitPref, setUnitPref] = useState<'metric' | 'imperial'>('metric')

    // Experience
    const [experience, setExperience] = useState<Record<string, ExperienceLevel | null>>({
        lifting: null,
        running: null,
        conditioning: null,
        rucking: null,
        rowing: null,
        swimming: null,
        cycling: null,
    })

    // Recent training (deep path)
    const [recentTraining, setRecentTraining] = useState<OnboardingRecentTraining[]>([])
    const [benchmarks, setBenchmarks] = useState<OnboardingBenchmark[]>([])

    // Equipment
    const [environment, setEnvironment] = useState<TrainingEnvironment | null>(null)
    const [equipmentList, setEquipmentList] = useState<string[]>([])

    // Equipment prefs (deep path)
    const [equipmentUsageIntents, setEquipmentUsageIntents] = useState<Record<string, EquipmentUsageIntent>>({})
    const [endurancePrefs, setEndurancePrefs] = useState<string[]>([])
    const [conditioningPrefs, setConditioningPrefs] = useState<string[]>([])

    // Availability
    const [availableDays, setAvailableDays] = useState(4)
    const [sessionDuration, setSessionDuration] = useState(60)
    const [twoADay, setTwoADay] = useState<TwoADayWillingness>('no')

    // Lifestyle (deep)
    const [workType, setWorkType] = useState<WorkType | null>(null)
    const [stressLevel, setStressLevel] = useState<StressLevel | null>(null)
    const [travelFreq, setTravelFreq] = useState<TravelFrequency | null>(null)
    const [timeOfDay, setTimeOfDay] = useState<TimeOfDayPreference>('no_preference')

    // Goals
    const [goalArchetype, setGoalArchetype] = useState<GoalArchetype | null>(null)

    // Coaching team (coach IDs in priority order)
    const [coachingTeam, setCoachingTeam] = useState<string[]>([])
    const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null)

    // Methodology (deep)
    const [strengthMeth, setStrengthMeth] = useState<MethodologyPreference>('ai_decides')
    const [hypertrophyMeth, setHypertrophyMeth] = useState<MethodologyPreference>('ai_decides')
    const [enduranceMeth, setEnduranceMeth] = useState<MethodologyPreference>('ai_decides')
    const [transparency, setTransparency] = useState<TransparencyPreference>('minimal')

    // Injuries
    const [hasInjuries, setHasInjuries] = useState(false)
    const [injuries, setInjuries] = useState<OnboardingInjury[]>([])
    const [movementsToAvoid, setMovementsToAvoid] = useState<string[]>([])

    // Body comp (deep)
    const [bodyFat, setBodyFat] = useState("")
    const [bodyCompGoal, setBodyCompGoal] = useState<BodyCompGoal | null>(null)

    // Benchmark path
    const [benchmarkPath, setBenchmarkPath] = useState<BenchmarkPath | null>(null)
    const [strengthBenchmarks, setStrengthBenchmarks] = useState<Record<string, string>>({})
    const [cardioBenchmarks, setCardioBenchmarks] = useState<Record<string, string>>({})

    // ─── Navigation ─────────────────────────────────────────────────────────

    const screens = path === 'deep' ? DEEP_SCREENS : QUICK_SCREENS
    const currentScreen = screens[screenIndex] as ScreenId
    const totalScreens = screens.length
    const progressPercent = currentScreen === 'generating' ? 100 : ((screenIndex) / (totalScreens - 1)) * 100

    const goNext = useCallback(() => {
        setError(null)
        setScreenIndex((i) => Math.min(i + 1, totalScreens - 1))
    }, [totalScreens])

    const goBack = useCallback(() => {
        setError(null)
        setScreenIndex((i) => Math.max(i - 1, 0))
    }, [])

    // ─── Submit handler ─────────────────────────────────────────────────────

    const handleComplete = async () => {
        setIsSubmitting(true)
        setError(null)

        try {
            // 1. Save profile data
            const profileRes = await updateOnboardingProfile({
                onboardingPath: path!,
                age: parseInt(age),
                sex: sex as 'MALE' | 'FEMALE',
                heightCm: parseFloat(heightCm),
                bodyweightKg: parseFloat(weight),
                unitPreference: unitPref,
                liftingExperience: experience.lifting ?? undefined,
                runningExperience: experience.running ?? undefined,
                conditioningExperience: experience.conditioning ?? undefined,
                ruckingExperience: experience.rucking,
                rowingExperience: experience.rowing,
                swimmingExperience: experience.swimming,
                cyclingExperience: experience.cycling,
                primaryTrainingEnvironment: environment ?? undefined,
                equipmentList,
                availableDays,
                sessionDurationMinutes: sessionDuration,
                twoADay,
                goalArchetype: goalArchetype ?? undefined,
                hasInjuries,
                movementsToAvoid,
                coachingTeam: coachingTeam.map((id, i) => ({ coach: id, priority: i + 1 })),
                // Deep path fields
                ...(path === 'deep' ? {
                    equipmentUsageIntents,
                    enduranceModalityPreferences: endurancePrefs,
                    conditioningStylePreferences: conditioningPrefs,
                    workType: workType ?? undefined,
                    stressLevel: stressLevel ?? undefined,
                    travelFrequency: travelFreq ?? undefined,
                    timeOfDay,
                    strengthMethodology: strengthMeth,
                    hypertrophyMethodology: hypertrophyMeth,
                    enduranceMethodology: enduranceMeth,
                    transparency,
                    bodyFatPercentage: bodyFat ? parseFloat(bodyFat) : null,
                    bodyCompGoal,
                } : {}),
            })

            if (!profileRes.success) {
                setError(profileRes.error)
                setIsSubmitting(false)
                return
            }

            // 2. Save injuries
            if (hasInjuries && injuries.length > 0) {
                const injRes = await saveInjuries(injuries)
                if (!injRes.success) console.error('[saveInjuries]', injRes.error)
            }

            // 3. Save benchmarks (user-provided from benchmark_path screen OR deep path)
            const allBenchmarks: OnboardingBenchmark[] = [...benchmarks]

            // Add strength benchmarks from benchmark_path screen
            if (benchmarkPath === 'user_provided') {
                for (const [id, value] of Object.entries(strengthBenchmarks)) {
                    if (value && parseFloat(value) > 0) {
                        const benchDef = STRENGTH_BENCHMARKS.find(b => b.id === id)
                        if (benchDef) {
                            allBenchmarks.push({
                                modality: 'LIFTING',
                                benchmarkName: benchDef.name,
                                value: parseFloat(value),
                                unit: benchDef.unit,
                            })
                        }
                    }
                }
                // Add cardio benchmarks (convert MM:SS to seconds)
                for (const [id, value] of Object.entries(cardioBenchmarks)) {
                    if (value && value.includes(':')) {
                        const parts = value.split(':')
                        const totalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1] || '0')
                        if (totalSeconds > 0) {
                            const benchDef = CARDIO_BENCHMARKS.find(b => b.id === id)
                            if (benchDef) {
                                allBenchmarks.push({
                                    modality: 'CARDIO',
                                    benchmarkName: benchDef.name,
                                    value: totalSeconds,
                                    unit: 'seconds',
                                })
                            }
                        }
                    }
                }
            }

            if (allBenchmarks.length > 0) {
                const benchRes = await saveBenchmarks(allBenchmarks)
                if (!benchRes.success) console.error('[saveBenchmarks]', benchRes.error)
            }

            // 4. Save recent training (deep path)
            if (path === 'deep' && recentTraining.length > 0) {
                const trainRes = await saveRecentTraining(recentTraining)
                if (!trainRes.success) console.error('[saveRecentTraining]', trainRes.error)
            }

            // 5. Complete onboarding (profile-only; block creation happens in the wizard)
            const completeRes = await completeOnboarding(benchmarkPath ?? 'ai_estimated')
            if (completeRes.success) {
                // Brief delay for the animation to show
                setTimeout(() => router.push('/data/blocks/new'), 2000)
            } else {
                setError(completeRes.error)
                setIsSubmitting(false)
            }
        } catch (err) {
            console.error('[handleComplete]', err)
            setError('An unexpected error occurred')
            setIsSubmitting(false)
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const toggleEquipment = (id: string) => {
        setEquipmentList((prev) =>
            prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
        )
    }

    const setExperienceLevel = (modality: string, level: ExperienceLevel) => {
        setExperience((prev) => ({ ...prev, [modality]: level }))
    }

    const toggleMovement = (m: string) => {
        setMovementsToAvoid((prev) =>
            prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
        )
    }

    const addInjury = (area: InjuryBodyArea) => {
        if (!injuries.find((i) => i.bodyArea === area)) {
            setInjuries((prev) => [...prev, { bodyArea: area, severity: 'minor' as InjurySeverity }])
        }
    }

    const removeInjury = (area: InjuryBodyArea) => {
        setInjuries((prev) => prev.filter((i) => i.bodyArea !== area))
    }

    const updateInjurySeverity = (area: InjuryBodyArea, severity: InjurySeverity) => {
        setInjuries((prev) => prev.map((i) => i.bodyArea === area ? { ...i, severity } : i))
    }

    // ─── Experience level selector component ────────────────────────────────

    const ExperiencePicker = ({ modality, label }: { modality: string; label: string }) => {
        const levels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced']
        const current = experience[modality]

        return (
            <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-neutral-500">{label}</label>
                <div className="flex gap-2">
                    {levels.map((level) => (
                        <button
                            key={level}
                            onClick={() => setExperienceLevel(modality, level)}
                            className={cn(
                                "flex-1 py-3 px-2 text-xs font-mono uppercase tracking-wider border transition-all duration-200",
                                current === level
                                    ? "border-cyan-500 bg-cyan-950/30 text-cyan-400"
                                    : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                            )}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // ─── Pill selector helper ───────────────────────────────────────────────

    const PillSelect = <T extends string>({
        options,
        value,
        onChange,
    }: {
        options: { id: T; label: string }[]
        value: T | null
        onChange: (v: T) => void
    }) => (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
                <button
                    key={opt.id}
                    onClick={() => onChange(opt.id)}
                    className={cn(
                        "px-4 py-2 text-xs font-mono uppercase tracking-wider border transition-all",
                        value === opt.id
                            ? "border-cyan-500 bg-cyan-950/30 text-cyan-400"
                            : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )

    // ─── Multi-select pills ─────────────────────────────────────────────────

    const MultiPill = ({
        options,
        selected,
        toggle,
    }: {
        options: string[]
        selected: string[]
        toggle: (v: string) => void
    }) => (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
                <button
                    key={opt}
                    onClick={() => toggle(opt)}
                    className={cn(
                        "px-4 py-2 text-xs font-mono uppercase tracking-wider border transition-all",
                        selected.includes(opt)
                            ? "border-cyan-500 bg-cyan-950/30 text-cyan-400"
                            : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                    )}
                >
                    {selected.includes(opt) && <Check className="w-3 h-3 inline mr-1" />}
                    {opt}
                </button>
            ))}
        </div>
    )

    // ─── Render screens ─────────────────────────────────────────────────────

    const renderScreen = () => {
        switch (currentScreen) {

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 1: WELCOME & PATH SELECTION
            // ═══════════════════════════════════════════════════════════════════
            case 'welcome':
                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-space-grotesk font-bold mb-4">
                                Calibrate Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Engine</span>.
                            </h1>
                            <p className="text-neutral-400 font-inter text-sm leading-relaxed">
                                We need structured data to build your programming. Choose your path.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={() => { setPath('quick'); goNext() }}
                                className={cn(
                                    "w-full flex items-start gap-5 p-6 border transition-all duration-300 text-left group",
                                    "border-[#222] bg-[#0c0c0c] hover:border-cyan-500/50"
                                )}
                            >
                                <div className="p-3 bg-white/5 flex-shrink-0">
                                    <Zap className="w-6 h-6 text-cyan-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-space-grotesk text-lg font-bold uppercase mb-1 text-white">Quick Setup</h3>
                                    <p className="text-sm text-neutral-400 font-inter">3-5 minutes. Get training today. The AI fills in the gaps.</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-cyan-400 transition-colors self-center" />
                            </button>

                            <button
                                onClick={() => { setPath('deep'); goNext() }}
                                className={cn(
                                    "w-full flex items-start gap-5 p-6 border transition-all duration-300 text-left group",
                                    "border-[#222] bg-[#0c0c0c] hover:border-cyan-500/50"
                                )}
                            >
                                <div className="p-3 bg-white/5 flex-shrink-0">
                                    <BarChart3 className="w-6 h-6 text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-space-grotesk text-lg font-bold uppercase mb-1 text-white">Deep Calibration</h3>
                                    <p className="text-sm text-neutral-400 font-inter">8-12 minutes. Full data set. More precise programming from day one.</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-blue-400 transition-colors self-center" />
                            </button>
                        </div>
                    </div>
                )

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 2: ATHLETE PROFILE
            // ═══════════════════════════════════════════════════════════════════
            case 'profile':
                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Athlete Profile.</h1>
                            <p className="text-neutral-400 font-inter text-sm">Baseline metrics for your volume engine.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Age</label>
                                <Input type="number" placeholder="28" value={age} onChange={(e) => setAge(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Sex</label>
                                <div className="flex gap-2">
                                    {(['MALE', 'FEMALE'] as const).map((s) => (
                                        <Button
                                            key={s}
                                            variant={sex === s ? 'default' : 'outline'}
                                            className={cn("flex-1", sex === s ? 'bg-cyan-500 text-black hover:bg-cyan-400' : 'border-[#333]')}
                                            onClick={() => setSex(s)}
                                        >
                                            {s === 'MALE' ? 'Male' : 'Female'}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                                    Height ({unitPref === 'metric' ? 'cm' : 'in'})
                                </label>
                                <Input type="number" placeholder={unitPref === 'metric' ? '180' : '71'} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                                    Weight ({unitPref === 'metric' ? 'kg' : 'lbs'})
                                </label>
                                <Input type="number" placeholder={unitPref === 'metric' ? '85' : '187'} value={weight} onChange={(e) => setWeight(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Unit System</label>
                            <div className="flex gap-2">
                                {(['metric', 'imperial'] as const).map((u) => (
                                    <button
                                        key={u}
                                        onClick={() => setUnitPref(u)}
                                        className={cn(
                                            "flex-1 py-3 text-xs font-mono uppercase tracking-wider border transition-all",
                                            unitPref === u
                                                ? "border-cyan-500 bg-cyan-950/30 text-cyan-400"
                                                : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                                        )}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <NavButtons
                            onBack={goBack}
                            onNext={goNext}
                            nextDisabled={!age || !sex || !heightCm || !weight}
                            nextLabel="Continue"
                        />
                    </div>
                )

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 3: EXPERIENCE SNAPSHOT
            // ═══════════════════════════════════════════════════════════════════
            case 'experience':
                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Experience Level.</h1>
                            <p className="text-neutral-400 font-inter text-sm">Rate your experience in each training domain.</p>
                        </div>

                        <div className="space-y-5">
                            <ExperiencePicker modality="lifting" label="Strength / Lifting" />
                            <ExperiencePicker modality="running" label="Running" />
                            <ExperiencePicker modality="conditioning" label="Conditioning / Metcon" />
                            <div className="border-t border-[#222] pt-4">
                                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 mb-4">Additional Modalities (optional)</p>
                                <div className="space-y-5">
                                    <ExperiencePicker modality="rucking" label="Rucking" />
                                    <ExperiencePicker modality="rowing" label="Rowing" />
                                    <ExperiencePicker modality="swimming" label="Swimming" />
                                    <ExperiencePicker modality="cycling" label="Cycling" />
                                </div>
                            </div>
                        </div>

                        <NavButtons
                            onBack={goBack}
                            onNext={goNext}
                            nextDisabled={!experience.lifting || !experience.running || !experience.conditioning}
                            nextLabel="Continue"
                        />
                    </div>
                )

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 3b: RECENT TRAINING DETAIL (Deep only)
            // ═══════════════════════════════════════════════════════════════════
            case 'experience_detail': {
                const activeModalities = Object.entries(experience)
                    .filter(([, level]) => level === 'intermediate' || level === 'advanced')
                    .map(([mod]) => mod)

                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Training History.</h1>
                            <p className="text-neutral-400 font-inter text-sm">Tell us about your recent training volume. Skip anything you don't know.</p>
                        </div>

                        {activeModalities.length === 0 ? (
                            <p className="text-neutral-500 font-inter text-sm">No intermediate/advanced modalities detected. You can skip this step.</p>
                        ) : (
                            <div className="space-y-6">
                                {activeModalities.map((mod) => (
                                    <div key={mod} className="border border-[#222] bg-[#0a0a0a] p-4 space-y-3">
                                        <h3 className="font-space-grotesk font-bold uppercase text-sm text-white">{mod}</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-mono uppercase text-neutral-600">Sessions/week</label>
                                                <Input
                                                    type="number"
                                                    placeholder="3"
                                                    className="h-10"
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value)
                                                        if (!val) return
                                                        setRecentTraining((prev) => {
                                                            const existing = prev.find((r) => r.modality === mod)
                                                            if (existing) return prev.map((r) => r.modality === mod ? { ...r, frequencyPerWeek: val } : r)
                                                            return [...prev, { modality: mod, frequencyPerWeek: val }]
                                                        })
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-mono uppercase text-neutral-600">Volume (approx)</label>
                                                <Input
                                                    placeholder={mod === 'running' ? '20 mi/wk' : '4 hrs/wk'}
                                                    className="h-10"
                                                    onChange={(e) => {
                                                        setRecentTraining((prev) => {
                                                            const existing = prev.find((r) => r.modality === mod)
                                                            if (existing) return prev.map((r) => r.modality === mod ? { ...r, approximateVolume: e.target.value } : r)
                                                            return [...prev, { modality: mod, frequencyPerWeek: 0, approximateVolume: e.target.value }]
                                                        })
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <NavButtons onBack={goBack} onNext={goNext} nextLabel="Continue" />
                    </div>
                )
            }

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 4: EQUIPMENT & ACCESS
            // ═══════════════════════════════════════════════════════════════════
            case 'equipment':
                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Equipment & Access.</h1>
                            <p className="text-neutral-400 font-inter text-sm">The AI will only prescribe movements you can actually do.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Training Environment</label>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { id: 'commercial_gym', label: 'Commercial Gym' },
                                    { id: 'home_gym', label: 'Home Gym' },
                                    { id: 'outdoor_minimal', label: 'Outdoor / Minimal' },
                                    { id: 'mix', label: 'Mix of Everything' },
                                ] as { id: TrainingEnvironment; label: string }[]).map((env) => (
                                    <button
                                        key={env.id}
                                        onClick={() => setEnvironment(env.id)}
                                        className={cn(
                                            "py-3 px-3 text-xs font-mono uppercase tracking-wider border transition-all",
                                            environment === env.id
                                                ? "border-cyan-500 bg-cyan-950/30 text-cyan-400"
                                                : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                                        )}
                                    >
                                        {env.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Equipment (select all that apply)</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-1">
                                {EQUIPMENT_OPTIONS.map((eq) => (
                                    <button
                                        key={eq.id}
                                        onClick={() => toggleEquipment(eq.id)}
                                        className={cn(
                                            "text-left p-4 border transition-all duration-200 relative",
                                            equipmentList.includes(eq.id)
                                                ? "border-cyan-500 bg-cyan-950/20"
                                                : "border-[#222] bg-[#0c0c0c] hover:border-[#333]"
                                        )}
                                    >
                                        {equipmentList.includes(eq.id) && (
                                            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 shadow-[0_0_10px_rgba(13,185,242,0.8)]" />
                                        )}
                                        <h4 className={cn("text-sm font-space-grotesk font-bold", equipmentList.includes(eq.id) ? "text-cyan-400" : "text-white")}>{eq.label}</h4>
                                        <p className="text-[10px] text-neutral-600 font-inter">{eq.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <NavButtons
                            onBack={goBack}
                            onNext={goNext}
                            nextDisabled={!environment || equipmentList.length === 0}
                            nextLabel="Continue"
                        />
                    </div>
                )

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 4b: EQUIPMENT PREFS (Deep only)
            // ═══════════════════════════════════════════════════════════════════
            case 'equipment_prefs': {
                const dualEquip = equipmentList.filter((e) => DUAL_PURPOSE_EQUIPMENT.includes(e))
                const activeEndurance = ENDURANCE_MODALITIES.filter((m) => {
                    if (m.id === 'rowing' && !equipmentList.includes('rower')) return false
                    if (m.id === 'cycling' && !equipmentList.includes('stationary_bike') && !equipmentList.includes('assault_bike')) return false
                    if (m.id === 'swimming' && !equipmentList.includes('swimming_pool') && !equipmentList.includes('open_water')) return false
                    return true
                })

                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Modality Preferences.</h1>
                            <p className="text-neutral-400 font-inter text-sm">How you use your equipment shapes your programming.</p>
                        </div>

                        {dualEquip.length > 0 && (
                            <div className="space-y-4">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Equipment Usage Intent</label>
                                {dualEquip.map((eq) => {
                                    const label = EQUIPMENT_OPTIONS.find((e) => e.id === eq)?.label ?? eq
                                    return (
                                        <div key={eq} className="border border-[#222] bg-[#0a0a0a] p-4 space-y-2">
                                            <p className="text-sm font-space-grotesk font-bold text-white">{label}</p>
                                            <div className="flex gap-2">
                                                {(['endurance', 'conditioning', 'both'] as EquipmentUsageIntent[]).map((intent) => (
                                                    <button
                                                        key={intent}
                                                        onClick={() => setEquipmentUsageIntents((prev) => ({ ...prev, [eq]: intent }))}
                                                        className={cn(
                                                            "flex-1 py-2 text-xs font-mono uppercase border transition-all",
                                                            equipmentUsageIntents[eq] === intent
                                                                ? "border-cyan-500 bg-cyan-950/30 text-cyan-400"
                                                                : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                                                        )}
                                                    >
                                                        {intent}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {activeEndurance.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Endurance Modality Preferences</label>
                                <div className="flex flex-wrap gap-2">
                                    {activeEndurance.map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => setEndurancePrefs((prev) =>
                                                prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                                            )}
                                            className={cn(
                                                "px-4 py-2 text-xs font-mono uppercase border transition-all",
                                                endurancePrefs.includes(m.id)
                                                    ? "border-cyan-500 bg-cyan-950/30 text-cyan-400"
                                                    : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                                            )}
                                        >
                                            {endurancePrefs.includes(m.id) && <Check className="w-3 h-3 inline mr-1" />}
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Conditioning Style Preferences</label>
                            <MultiPill
                                options={CONDITIONING_STYLES}
                                selected={conditioningPrefs}
                                toggle={(v) => setConditioningPrefs((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])}
                            />
                        </div>

                        <NavButtons onBack={goBack} onNext={goNext} nextLabel="Continue" />
                    </div>
                )
            }

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 5: TRAINING AVAILABILITY
            // ═══════════════════════════════════════════════════════════════════
            case 'availability':
                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Availability.</h1>
                            <p className="text-neutral-400 font-inter text-sm">How much time can you commit each week?</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Days per week</label>
                                <div className="flex gap-2">
                                    {[3, 4, 5, 6, 7].map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setAvailableDays(d)}
                                            className={cn(
                                                "flex-1 py-4 text-lg font-space-grotesk font-bold border transition-all",
                                                availableDays === d
                                                    ? "border-cyan-500 bg-cyan-950/30 text-cyan-400"
                                                    : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                                            )}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Session Duration</label>
                                <div className="flex gap-2">
                                    {[30, 45, 60, 75, 90].map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setSessionDuration(d)}
                                            className={cn(
                                                "flex-1 py-3 text-xs font-mono border transition-all",
                                                sessionDuration === d
                                                    ? "border-cyan-500 bg-cyan-950/30 text-cyan-400"
                                                    : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                                            )}
                                        >
                                            {d} min
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Two-a-days?</label>
                                <div className="flex gap-2">
                                    {([
                                        { id: 'yes', label: 'Yes' },
                                        { id: 'sometimes', label: 'Sometimes' },
                                        { id: 'no', label: 'No' },
                                    ] as { id: TwoADayWillingness; label: string }[]).map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setTwoADay(opt.id)}
                                            className={cn(
                                                "flex-1 py-3 text-xs font-mono uppercase border transition-all",
                                                twoADay === opt.id
                                                    ? "border-cyan-500 bg-cyan-950/30 text-cyan-400"
                                                    : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <NavButtons onBack={goBack} onNext={goNext} nextLabel="Continue" />
                    </div>
                )

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 5b: LIFESTYLE FACTORS (Deep only)
            // ═══════════════════════════════════════════════════════════════════
            case 'lifestyle':
                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Lifestyle Context.</h1>
                            <p className="text-neutral-400 font-inter text-sm">This shapes recovery expectations and volume buffers.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Work Type</label>
                                <PillSelect
                                    options={[
                                        { id: 'desk' as WorkType, label: 'Desk Job' },
                                        { id: 'active' as WorkType, label: 'Active' },
                                        { id: 'physical_labor' as WorkType, label: 'Physical Labor' },
                                        { id: 'mixed' as WorkType, label: 'Mixed' },
                                    ]}
                                    value={workType}
                                    onChange={setWorkType}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">General Stress Level</label>
                                <PillSelect
                                    options={[
                                        { id: 'low' as StressLevel, label: 'Low' },
                                        { id: 'moderate' as StressLevel, label: 'Moderate' },
                                        { id: 'high' as StressLevel, label: 'High' },
                                        { id: 'variable' as StressLevel, label: 'Variable' },
                                    ]}
                                    value={stressLevel}
                                    onChange={setStressLevel}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Travel Frequency</label>
                                <PillSelect
                                    options={[
                                        { id: 'rarely' as TravelFrequency, label: 'Rarely' },
                                        { id: 'monthly' as TravelFrequency, label: 'Monthly' },
                                        { id: 'weekly' as TravelFrequency, label: 'Weekly' },
                                    ]}
                                    value={travelFreq}
                                    onChange={setTravelFreq}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Preferred Training Time</label>
                                <PillSelect
                                    options={[
                                        { id: 'morning' as TimeOfDayPreference, label: 'Morning' },
                                        { id: 'midday' as TimeOfDayPreference, label: 'Midday' },
                                        { id: 'evening' as TimeOfDayPreference, label: 'Evening' },
                                        { id: 'no_preference' as TimeOfDayPreference, label: 'No Pref' },
                                    ]}
                                    value={timeOfDay}
                                    onChange={setTimeOfDay}
                                />
                            </div>
                        </div>

                        <NavButtons onBack={goBack} onNext={goNext} nextLabel="Continue" />
                    </div>
                )

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 6: GOAL SELECTION
            // ═══════════════════════════════════════════════════════════════════
            case 'goals':
                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Primary Focus.</h1>
                            <p className="text-neutral-400 font-inter text-sm">This drives volume distribution across your training domains.</p>
                        </div>

                        <div className="space-y-3">
                            {GOAL_OPTIONS.map((g) => (
                                <button
                                    key={g.id}
                                    onClick={() => setGoalArchetype(g.id)}
                                    className={cn(
                                        "w-full flex items-start gap-5 p-5 border transition-all duration-200 text-left",
                                        goalArchetype === g.id
                                            ? "border-cyan-500 bg-cyan-950/20"
                                            : "border-[#222] bg-[#0c0c0c] hover:border-white/20"
                                    )}
                                >
                                    <div className={cn("p-3 flex-shrink-0 transition-colors", goalArchetype === g.id ? "bg-cyan-500/10" : "bg-white/5")}>
                                        <g.icon className={cn("w-5 h-5", goalArchetype === g.id ? "text-cyan-400" : "text-neutral-400")} />
                                    </div>
                                    <div>
                                        <h3 className={cn("font-space-grotesk font-bold uppercase text-sm mb-1", goalArchetype === g.id ? "text-cyan-400" : "text-white")}>{g.title}</h3>
                                        <p className="text-xs text-neutral-400 font-inter">{g.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <NavButtons
                            onBack={goBack}
                            onNext={() => {
                                // Auto-populate coaching team from goal if team is empty
                                if (goalArchetype && coachingTeam.length === 0) {
                                    setCoachingTeam(getDefaultTeamForGoal(goalArchetype))
                                }
                                goNext()
                            }}
                            nextDisabled={!goalArchetype}
                            nextLabel="Continue"
                        />
                    </div>
                )

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 6a: BUILD YOUR COACHING TEAM
            // ═══════════════════════════════════════════════════════════════════
            case 'coaching_team': {
                const availableToAdd = SELECTABLE_COACHES.filter(c => !coachingTeam.includes(c.id))

                const addCoach = (id: string) => {
                    setCoachingTeam(prev => [...prev, id])
                }

                const removeCoach = (id: string) => {
                    setCoachingTeam(prev => prev.filter(c => c !== id))
                }

                const moveCoach = (fromIndex: number, toIndex: number) => {
                    setCoachingTeam(prev => {
                        const next = [...prev]
                        const [moved] = next.splice(fromIndex, 1)
                        next.splice(toIndex, 0, moved)
                        return next
                    })
                }

                const handleCoachDragStart = (e: React.DragEvent, index: number) => {
                    e.dataTransfer.setData('text/plain', String(index))
                    e.dataTransfer.effectAllowed = 'move'
                }

                const handleCoachDrop = (e: React.DragEvent, targetIndex: number) => {
                    e.preventDefault()
                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
                    if (!isNaN(fromIndex) && fromIndex !== targetIndex) {
                        moveCoach(fromIndex, targetIndex)
                    }
                }

                const getCoachById = (id: string): CoachProfile | undefined =>
                    SELECTABLE_COACHES.find(c => c.id === id) ?? ALWAYS_ACTIVE_COACHES.find(c => c.id === id)

                return (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">
                                Your Coaching <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Team</span>.
                            </h1>
                            <p className="text-neutral-400 font-inter text-sm">
                                These AI coaches build your program. Drag to set priority. Higher priority = more sessions and recovery budget.
                            </p>
                        </div>

                        {/* Active coaching team — draggable */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                                Your Team (drag to reorder priority)
                            </label>
                            <div className="space-y-2">
                                {coachingTeam.map((coachId, index) => {
                                    const coach = getCoachById(coachId)
                                    if (!coach) return null
                                    const isExpanded = expandedCoachId === coach.id
                                    return (
                                        <div
                                            key={coach.id}
                                            draggable
                                            onDragStart={(e) => handleCoachDragStart(e, index)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => handleCoachDrop(e, index)}
                                            className="border border-cyan-500/40 bg-cyan-950/10 transition-all cursor-grab active:cursor-grabbing hover:border-cyan-400/60"
                                        >
                                            <div className="flex items-center gap-3 p-3">
                                                <div className="flex items-center gap-1 text-cyan-500/50">
                                                    <span className="text-xs font-mono font-bold w-5 text-center">{index + 1}</span>
                                                    <GripVertical className="w-4 h-4" />
                                                </div>
                                                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-cyan-500/30">
                                                    <Image
                                                        src={coach.imagePath}
                                                        alt={coach.name}
                                                        width={40}
                                                        height={40}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setExpandedCoachId(isExpanded ? null : coach.id) }}
                                                    className="flex-1 min-w-0 text-left cursor-pointer"
                                                >
                                                    <h4 className="text-sm font-space-grotesk font-bold text-cyan-400 truncate">{coach.name}</h4>
                                                    <p className="text-[10px] text-neutral-400 font-inter truncate">{coach.tagline}</p>
                                                </button>
                                                <ChevronDown className={cn("w-4 h-4 text-cyan-500/40 transition-transform flex-shrink-0", isExpanded && "rotate-180")} />
                                                <button
                                                    onClick={() => removeCoach(coach.id)}
                                                    className="p-1.5 text-neutral-600 hover:text-red-400 transition-colors flex-shrink-0"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="px-3 pb-3 pt-1 border-t border-cyan-500/20">
                                                            <p className="text-xs text-neutral-400 font-inter leading-relaxed">{coach.bio}</p>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )
                                })}
                                {coachingTeam.length === 0 && (
                                    <p className="text-neutral-600 font-inter text-xs py-4 text-center border border-dashed border-[#222]">
                                        No coaches selected. Add at least one below.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Available to add */}
                        {availableToAdd.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                                    Available Coaches
                                </label>
                                <div className="space-y-2">
                                    {availableToAdd.map((coach) => {
                                        const isExpanded = expandedCoachId === coach.id
                                        return (
                                            <div
                                                key={coach.id}
                                                className="border border-[#222] bg-[#0c0c0c] hover:border-white/20 transition-all"
                                            >
                                                <div className="flex items-center gap-3 p-3">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-[#333] opacity-60">
                                                        <Image
                                                            src={coach.imagePath}
                                                            alt={coach.name}
                                                            width={40}
                                                            height={40}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => setExpandedCoachId(isExpanded ? null : coach.id)}
                                                        className="flex-1 min-w-0 text-left cursor-pointer"
                                                    >
                                                        <h4 className="text-sm font-space-grotesk font-bold text-neutral-300 truncate">{coach.name}</h4>
                                                        <p className="text-[10px] text-neutral-500 font-inter truncate">{coach.tagline}</p>
                                                    </button>
                                                    <ChevronDown className={cn("w-4 h-4 text-neutral-600 transition-transform flex-shrink-0", isExpanded && "rotate-180")} />
                                                    <button
                                                        onClick={() => addCoach(coach.id)}
                                                        className="p-1.5 text-neutral-600 hover:text-cyan-400 transition-colors flex-shrink-0"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="px-3 pb-3 pt-1 border-t border-[#222]">
                                                                <p className="text-xs text-neutral-500 font-inter leading-relaxed">{coach.bio}</p>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Always-active coaches (info only) */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                                Always Active (every athlete)
                            </label>
                            <div className="space-y-2">
                                {ALWAYS_ACTIVE_COACHES.map((coach) => {
                                    const isExpanded = expandedCoachId === coach.id
                                    return (
                                        <div
                                            key={coach.id}
                                            className="border border-[#1a1a1a] bg-[#080808]"
                                        >
                                            <div className="flex items-center gap-3 p-3">
                                                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-[#222] opacity-50">
                                                    <Image
                                                        src={coach.imagePath}
                                                        alt={coach.name}
                                                        width={40}
                                                        height={40}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => setExpandedCoachId(isExpanded ? null : coach.id)}
                                                    className="flex-1 min-w-0 text-left cursor-pointer"
                                                >
                                                    <h4 className="text-sm font-space-grotesk font-bold text-neutral-500 truncate">{coach.name}</h4>
                                                    <p className="text-[10px] text-neutral-600 font-inter truncate">{coach.tagline}</p>
                                                </button>
                                                <ChevronDown className={cn("w-4 h-4 text-neutral-700 transition-transform flex-shrink-0", isExpanded && "rotate-180")} />
                                                <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-600 flex-shrink-0">Always On</span>
                                            </div>
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="px-3 pb-3 pt-1 border-t border-[#1a1a1a]">
                                                            <p className="text-xs text-neutral-600 font-inter leading-relaxed">{coach.bio}</p>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <NavButtons
                            onBack={goBack}
                            onNext={goNext}
                            nextDisabled={coachingTeam.length === 0}
                            nextLabel="Continue"
                        />
                    </div>
                )
            }

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 6b: METHODOLOGY & TRANSPARENCY (Deep only)
            // ═══════════════════════════════════════════════════════════════════
            case 'methodology':
                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Methodology.</h1>
                            <p className="text-neutral-400 font-inter text-sm">The AI selects by default. Override if you have a preference.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Strength Approach</label>
                                <PillSelect
                                    options={[
                                        { id: 'ai_decides' as MethodologyPreference, label: 'AI Decides' },
                                        { id: 'linear_progression' as MethodologyPreference, label: 'Linear' },
                                        { id: '531' as MethodologyPreference, label: '5/3/1' },
                                        { id: 'percentage_based' as MethodologyPreference, label: '%-Based' },
                                    ]}
                                    value={strengthMeth}
                                    onChange={setStrengthMeth}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Hypertrophy Approach</label>
                                <PillSelect
                                    options={[
                                        { id: 'ai_decides' as MethodologyPreference, label: 'AI Decides' },
                                        { id: 'rp_volume' as MethodologyPreference, label: 'RP Volume' },
                                        { id: 'high_frequency' as MethodologyPreference, label: 'High Freq' },
                                        { id: 'traditional_split' as MethodologyPreference, label: 'Trad Split' },
                                    ]}
                                    value={hypertrophyMeth}
                                    onChange={setHypertrophyMeth}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Endurance Approach</label>
                                <PillSelect
                                    options={[
                                        { id: 'ai_decides' as MethodologyPreference, label: 'AI Decides' },
                                        { id: 'polarized_80_20' as MethodologyPreference, label: '80/20' },
                                        { id: 'maf_aerobic' as MethodologyPreference, label: 'MAF' },
                                        { id: 'daniels_formula' as MethodologyPreference, label: "Daniels'" },
                                    ]}
                                    value={enduranceMeth}
                                    onChange={setEnduranceMeth}
                                />
                            </div>

                            <div className="border-t border-[#222] pt-4 space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Programming Transparency</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setTransparency('minimal')}
                                        className={cn(
                                            "flex-1 p-4 border text-left transition-all",
                                            transparency === 'minimal'
                                                ? "border-cyan-500 bg-cyan-950/30"
                                                : "border-[#222] bg-[#0c0c0c] hover:border-[#444]"
                                        )}
                                    >
                                        <p className={cn("text-sm font-space-grotesk font-bold mb-1", transparency === 'minimal' ? "text-cyan-400" : "text-white")}>Just tell me what to do</p>
                                        <p className="text-[10px] text-neutral-500">Clean, minimal session view.</p>
                                    </button>
                                    <button
                                        onClick={() => setTransparency('detailed')}
                                        className={cn(
                                            "flex-1 p-4 border text-left transition-all",
                                            transparency === 'detailed'
                                                ? "border-cyan-500 bg-cyan-950/30"
                                                : "border-[#222] bg-[#0c0c0c] hover:border-[#444]"
                                        )}
                                    >
                                        <p className={cn("text-sm font-space-grotesk font-bold mb-1", transparency === 'detailed' ? "text-cyan-400" : "text-white")}>Show me the science</p>
                                        <p className="text-[10px] text-neutral-500">Expandable rationale per session.</p>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <NavButtons onBack={goBack} onNext={goNext} nextLabel="Continue" />
                    </div>
                )

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 7: INJURIES & LIMITATIONS
            // ═══════════════════════════════════════════════════════════════════
            case 'injuries':
                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Injuries & Limitations.</h1>
                            <p className="text-neutral-400 font-inter text-sm">The AI will route around anything you flag here.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Do you have any current injuries?</label>
                            <div className="flex gap-3">
                                <Button
                                    variant={hasInjuries ? 'default' : 'outline'}
                                    className={cn("flex-1", hasInjuries ? 'bg-cyan-500 text-black hover:bg-cyan-400' : 'border-[#333]')}
                                    onClick={() => setHasInjuries(true)}
                                >
                                    Yes
                                </Button>
                                <Button
                                    variant={!hasInjuries ? 'default' : 'outline'}
                                    className={cn("flex-1", !hasInjuries ? 'bg-cyan-500 text-black hover:bg-cyan-400' : 'border-[#333]')}
                                    onClick={() => { setHasInjuries(false); setInjuries([]) }}
                                >
                                    No
                                </Button>
                            </div>
                        </div>

                        {hasInjuries && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Affected Areas</label>
                                    <div className="flex flex-wrap gap-2">
                                        {BODY_AREAS.map((area) => {
                                            const selected = injuries.some((i) => i.bodyArea === area.id)
                                            return (
                                                <button
                                                    key={area.id}
                                                    onClick={() => selected ? removeInjury(area.id) : addInjury(area.id)}
                                                    className={cn(
                                                        "px-4 py-2 text-xs font-mono uppercase border transition-all",
                                                        selected
                                                            ? "border-orange-500 bg-orange-950/30 text-orange-400"
                                                            : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                                                    )}
                                                >
                                                    {selected && <X className="w-3 h-3 inline mr-1" />}
                                                    {area.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {injuries.length > 0 && (
                                    <div className="space-y-3">
                                        {injuries.map((inj) => (
                                            <div key={inj.bodyArea} className="border border-[#222] bg-[#0a0a0a] p-4 space-y-2">
                                                <p className="text-sm font-space-grotesk font-bold text-orange-400 uppercase">{inj.bodyArea.replace('_', ' ')}</p>
                                                <div className="flex gap-2">
                                                    {(['minor', 'moderate', 'significant'] as InjurySeverity[]).map((sev) => (
                                                        <button
                                                            key={sev}
                                                            onClick={() => updateInjurySeverity(inj.bodyArea, sev)}
                                                            className={cn(
                                                                "flex-1 py-2 text-[10px] font-mono uppercase border transition-all",
                                                                inj.severity === sev
                                                                    ? sev === 'significant' ? "border-red-500 bg-red-950/30 text-red-400"
                                                                        : sev === 'moderate' ? "border-orange-500 bg-orange-950/30 text-orange-400"
                                                                            : "border-yellow-500 bg-yellow-950/30 text-yellow-400"
                                                                    : "border-[#222] bg-[#0c0c0c] text-neutral-600"
                                                            )}
                                                        >
                                                            {sev}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Movements to Avoid</label>
                                    <div className="flex flex-wrap gap-2">
                                        {COMMON_MOVEMENTS_TO_AVOID.map((m) => (
                                            <button
                                                key={m}
                                                onClick={() => toggleMovement(m)}
                                                className={cn(
                                                    "px-3 py-2 text-[10px] font-mono uppercase border transition-all",
                                                    movementsToAvoid.includes(m)
                                                        ? "border-red-500/50 bg-red-950/20 text-red-400"
                                                        : "border-[#222] bg-[#0c0c0c] text-neutral-500 hover:border-[#444]"
                                                )}
                                            >
                                                {movementsToAvoid.includes(m) && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        <NavButtons onBack={goBack} onNext={goNext} nextLabel={hasInjuries ? "Continue" : "No Injuries — Continue"} />
                    </div>
                )

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN: BENCHMARK PATH
            // ═══════════════════════════════════════════════════════════════════
            case 'benchmark_path': {
                // Filter cardio benchmarks to only show modalities the athlete has selected
                const relevantCardioBenchmarks = CARDIO_BENCHMARKS.filter(cb => {
                    // Show if athlete has the relevant equipment or endurance preference
                    if (endurancePrefs.length > 0) return endurancePrefs.includes(cb.enduranceId)
                    // Default: show running always, others only if relevant equipment exists
                    if (cb.enduranceId === 'running') return true
                    if (cb.enduranceId === 'rowing') return equipmentList.includes('rower')
                    if (cb.enduranceId === 'cycling') return equipmentList.includes('stationary_bike')
                    if (cb.enduranceId === 'swimming') return equipmentList.includes('swimming_pool') || equipmentList.includes('open_water')
                    return false
                })

                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Set Your Baseline.</h1>
                            <p className="text-neutral-400 font-inter text-sm">Choose how the AI should determine your training weights and intensities.</p>
                        </div>

                        <div className="space-y-3">
                            {/* Option 1: AI Estimate */}
                            <button
                                onClick={() => setBenchmarkPath('ai_estimated')}
                                className={cn(
                                    "w-full text-left p-5 border transition-all",
                                    benchmarkPath === 'ai_estimated'
                                        ? "border-cyan-500 bg-cyan-950/20"
                                        : "border-[#222] bg-[#0a0a0a] hover:border-[#444]"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "p-2 border shrink-0 mt-0.5",
                                        benchmarkPath === 'ai_estimated' ? "border-cyan-500/50 bg-[#050505]" : "border-[#333] bg-[#111]"
                                    )}>
                                        <Sparkles className={cn("w-5 h-5", benchmarkPath === 'ai_estimated' ? "text-cyan-400" : "text-neutral-500")} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-space-grotesk font-bold text-white mb-1">Let AI Estimate</h3>
                                        <p className="text-[11px] text-neutral-400 font-inter leading-relaxed">
                                            The AI estimates your working weights from your profile — bodyweight, experience, age, and sex. Best for getting started fast.
                                        </p>
                                    </div>
                                    {benchmarkPath === 'ai_estimated' && <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-1" />}
                                </div>
                            </button>

                            {/* Option 2: User Provided */}
                            <button
                                onClick={() => setBenchmarkPath('user_provided')}
                                className={cn(
                                    "w-full text-left p-5 border transition-all",
                                    benchmarkPath === 'user_provided'
                                        ? "border-cyan-500 bg-cyan-950/20"
                                        : "border-[#222] bg-[#0a0a0a] hover:border-[#444]"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "p-2 border shrink-0 mt-0.5",
                                        benchmarkPath === 'user_provided' ? "border-cyan-500/50 bg-[#050505]" : "border-[#333] bg-[#111]"
                                    )}>
                                        <Gauge className={cn("w-5 h-5", benchmarkPath === 'user_provided' ? "text-cyan-400" : "text-neutral-500")} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-space-grotesk font-bold text-white mb-1">I Know My Numbers</h3>
                                        <p className="text-[11px] text-neutral-400 font-inter leading-relaxed">
                                            Enter your current benchmarks now. Fill in what you know — the AI will estimate the rest.
                                        </p>
                                    </div>
                                    {benchmarkPath === 'user_provided' && <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-1" />}
                                </div>
                            </button>

                            {/* Benchmark input form — visible when user_provided is selected */}
                            {benchmarkPath === 'user_provided' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="border border-[#222] bg-[#0a0a0a] p-4 space-y-4">
                                        {/* Strength benchmarks */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Strength (working weight)</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {STRENGTH_BENCHMARKS.map((bench) => (
                                                    <div key={bench.id} className="space-y-1">
                                                        <span className="text-[10px] font-mono text-neutral-400">{bench.name}</span>
                                                        <Input
                                                            type="number"
                                                            placeholder={unitPref === 'metric' ? 'kg' : 'lbs'}
                                                            value={strengthBenchmarks[bench.id] ?? ''}
                                                            onChange={(e) => setStrengthBenchmarks(prev => ({ ...prev, [bench.id]: e.target.value }))}
                                                            className="h-10 text-xs"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Cardio benchmarks */}
                                        {relevantCardioBenchmarks.length > 0 && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Cardio (best time)</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {relevantCardioBenchmarks.map((bench) => (
                                                        <div key={bench.id} className="space-y-1">
                                                            <span className="text-[10px] font-mono text-neutral-400">{bench.name}</span>
                                                            <Input
                                                                type="text"
                                                                placeholder={bench.placeholder}
                                                                value={cardioBenchmarks[bench.id] ?? ''}
                                                                onChange={(e) => setCardioBenchmarks(prev => ({ ...prev, [bench.id]: e.target.value }))}
                                                                className="h-10 text-xs"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-[9px] font-mono text-neutral-600">
                                            All fields optional. Blanks will be AI-estimated.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Option 3: Discovery */}
                            <button
                                onClick={() => setBenchmarkPath('discovery')}
                                className={cn(
                                    "w-full text-left p-5 border transition-all",
                                    benchmarkPath === 'discovery'
                                        ? "border-cyan-500 bg-cyan-950/20"
                                        : "border-[#222] bg-[#0a0a0a] hover:border-[#444]"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "p-2 border shrink-0 mt-0.5",
                                        benchmarkPath === 'discovery' ? "border-cyan-500/50 bg-[#050505]" : "border-[#333] bg-[#111]"
                                    )}>
                                        <Target className={cn("w-5 h-5", benchmarkPath === 'discovery' ? "text-cyan-400" : "text-neutral-500")} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-space-grotesk font-bold text-white mb-1">Test Me First</h3>
                                        <p className="text-[11px] text-neutral-400 font-inter leading-relaxed">
                                            Weeks 1-2 will include benchmark tests woven into your sessions. The AI will ramp you to a 3-5 rep max to find your working weights.
                                        </p>
                                    </div>
                                    {benchmarkPath === 'discovery' && <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-1" />}
                                </div>
                            </button>
                        </div>

                        <NavButtons onBack={goBack} onNext={goNext} nextDisabled={!benchmarkPath} nextLabel="Continue" />
                    </div>
                )
            }

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 7b: BODY COMPOSITION (Deep only, optional)
            // ═══════════════════════════════════════════════════════════════════
            case 'body_comp':
                return (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-space-grotesk font-bold mb-3">Body Composition.</h1>
                            <p className="text-neutral-400 font-inter text-sm">Optional. Provides context for the AI — not a primary driver.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Body Fat % (if known)</label>
                                <Input type="number" placeholder="15" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Body Composition Goal</label>
                                <PillSelect
                                    options={[
                                        { id: 'gain_muscle' as BodyCompGoal, label: 'Gain Muscle' },
                                        { id: 'lose_fat' as BodyCompGoal, label: 'Lose Fat' },
                                        { id: 'recomp' as BodyCompGoal, label: 'Recomp' },
                                        { id: 'maintain' as BodyCompGoal, label: 'Maintain' },
                                    ]}
                                    value={bodyCompGoal}
                                    onChange={setBodyCompGoal}
                                />
                            </div>
                        </div>

                        <NavButtons onBack={goBack} onNext={goNext} nextLabel="Continue" />
                    </div>
                )

            // ═══════════════════════════════════════════════════════════════════
            // SCREEN 8: GENERATING PROGRAM
            // ═══════════════════════════════════════════════════════════════════
            case 'generating':
                return (
                    <div className="space-y-12 text-center mt-8">
                        {isSubmitting ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center space-y-8"
                            >
                                <div className="relative w-32 h-32 flex items-center justify-center">
                                    <div className="absolute inset-0 border border-cyan-500/20 rounded-full animate-[spin_4s_linear_infinite]" />
                                    <div className="absolute inset-2 border border-blue-500/20 rounded-full animate-[spin_3s_linear_infinite_reverse]" />
                                    <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center blur-sm" />
                                    <Sparkles className="w-8 h-8 text-cyan-400 absolute animate-pulse" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-space-grotesk font-bold tracking-widest text-white mb-2 uppercase">Constructing Protocol</h2>
                                    <p className="text-cyan-400/80 font-mono text-xs uppercase animate-pulse">Calibrating your training engine...</p>
                                </div>
                            </motion.div>
                        ) : (
                            <>
                                <div className="relative z-10 p-8 border border-white/5 bg-black/40 backdrop-blur-xl max-w-2xl mx-auto">
                                    <h1 className="text-4xl font-space-grotesk font-bold mb-6 text-white">
                                        Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Build</span>.
                                    </h1>
                                    <div className="text-neutral-300 font-inter text-sm leading-relaxed space-y-3 text-left">
                                        <SummaryRow label="Path" value={path === 'deep' ? 'Deep Calibration' : 'Quick Setup'} />
                                        <SummaryRow label="Focus" value={goalArchetype?.replace('_', ' ') ?? 'Not set'} />
                                        <SummaryRow label="Days/week" value={`${availableDays} days, ${sessionDuration} min`} />
                                        <SummaryRow label="Equipment" value={`${equipmentList.length} items`} />
                                        <SummaryRow label="Coaches" value={`${coachingTeam.length} selected`} />
                                        <SummaryRow label="Injuries" value={hasInjuries ? `${injuries.length} flagged` : 'None'} />
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-4 border border-red-500/50 bg-red-950/20 text-red-400 text-sm font-mono">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-4 max-w-sm mx-auto">
                                    <Button variant="outline" onClick={goBack} className="flex-1 border-[#333] h-14">Back</Button>
                                    <Button onClick={handleComplete} className="flex-[2] h-14 bg-cyan-600 hover:bg-cyan-500 text-black shadow-[0_0_20px_rgba(13,185,242,0.3)]">
                                        Generate Program <ArrowRight className="w-5 h-5 ml-2" />
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )

            default:
                return null
        }
    }

    // ─── Main render ────────────────────────────────────────────────────────

    return (
        <div className="w-full flex flex-col pt-8 pb-24 h-full overflow-y-auto hide-scrollbar">
            {/* Header & Progress */}
            {currentScreen !== 'welcome' && (
                <div className="mb-8 sticky top-0 bg-[#050505]/80 backdrop-blur-md z-50 pt-4 pb-4 border-b border-white/5">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">
                                {path === 'deep' ? 'Deep Calibration' : 'Quick Setup'}
                            </span>
                        </div>
                        <div className="text-xs font-mono text-neutral-500">
                            {screenIndex} / {totalScreens - 1}
                        </div>
                    </div>
                    <Progress value={progressPercent} className="h-[2px]" />
                </div>
            )}

            <div className="flex-1 relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentScreen}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2 }}
                    >
                        {renderScreen()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function NavButtons({
    onBack,
    onNext,
    nextDisabled = false,
    nextLabel = "Continue",
}: {
    onBack: () => void
    onNext: () => void
    nextDisabled?: boolean
    nextLabel?: string
}) {
    return (
        <div className="pt-6 flex gap-4">
            <Button variant="outline" onClick={onBack} className="w-16 px-0">
                <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button onClick={onNext} className="flex-1" disabled={nextDisabled}>
                {nextLabel} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
        </div>
    )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-600">{label}</span>
            <span className="text-sm font-space-grotesk font-bold text-white uppercase">{value}</span>
        </div>
    )
}
