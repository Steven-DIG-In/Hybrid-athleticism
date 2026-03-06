/**
 * Exercise Library
 *
 * Comprehensive exercise database with RP-style metadata:
 * - Stimulus-to-Fatigue Ratio (SFR): Higher = more muscle stimulus per unit fatigue
 * - Systemic fatigue: How much it taxes the whole body
 * - Equipment requirements
 * - Movement patterns for balanced programming
 */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'traps'
  | 'forearms'

export type Equipment =
  | 'barbell'
  | 'dumbbells'
  | 'cable_machine'
  | 'pull_up_bar'
  | 'bench'
  | 'squat_rack'
  | 'leg_press'
  | 'machines'
  | 'kettlebells'
  | 'bands'
  | 'bodyweight'
  | 'ez_bar'
  | 'rowing_machine'
  | 'air_bike'
  | 'spin_bike'
  | 'gymnastic_rings'
  | 'dip_station'

export type MovementPattern = 'push' | 'pull' | 'squat' | 'hinge' | 'lunge' | 'carry' | 'rotation' | 'core'
export type ExerciseCategory = 'compound' | 'isolation' | 'machine' | 'bodyweight' | 'cable'
export type FatigueLevel = 'low' | 'medium' | 'high'

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  movementPattern: MovementPattern
  primaryMuscles: MuscleGroup[]
  secondaryMuscles: MuscleGroup[]
  equipment: Equipment[]
  stimulusToFatigueRatio: number // 1-10, higher = better
  systemicFatigue: FatigueLevel
  repRangeMin: number
  repRangeMax: number
  cues: string[]
  isUnilateral: boolean
}

/**
 * Master exercise library
 * SFR ratings based on RP principles:
 * - Isolation exercises generally have higher SFR
 * - Machine exercises often have better SFR than free weights
 * - Compound exercises have lower SFR but more total muscle stimulus
 */
export const EXERCISE_LIBRARY: Exercise[] = [
  // === CHEST ===
  {
    id: 'bench_press',
    name: 'Barbell Bench Press',
    category: 'compound',
    movementPattern: 'push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['barbell', 'bench'],
    stimulusToFatigueRatio: 6,
    systemicFatigue: 'high',
    repRangeMin: 5,
    repRangeMax: 12,
    cues: ['Arch back slightly', 'Retract scapula', 'Bar path slight diagonal'],
    isUnilateral: false,
  },
  {
    id: 'db_bench_press',
    name: 'Dumbbell Bench Press',
    category: 'compound',
    movementPattern: 'push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['dumbbells', 'bench'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'medium',
    repRangeMin: 6,
    repRangeMax: 15,
    cues: ['Full stretch at bottom', 'Press up and slightly in'],
    isUnilateral: false,
  },
  {
    id: 'incline_db_press',
    name: 'Incline Dumbbell Press',
    category: 'compound',
    movementPattern: 'push',
    primaryMuscles: ['chest', 'front_delts'],
    secondaryMuscles: ['triceps'],
    equipment: ['dumbbells', 'bench'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'medium',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['30-45 degree incline', 'Focus on upper chest stretch'],
    isUnilateral: false,
  },
  {
    id: 'cable_fly',
    name: 'Cable Fly',
    category: 'cable',
    movementPattern: 'push',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    equipment: ['cable_machine'],
    stimulusToFatigueRatio: 9,
    systemicFatigue: 'low',
    repRangeMin: 10,
    repRangeMax: 20,
    cues: ['Slight bend in elbows', 'Squeeze at peak contraction'],
    isUnilateral: false,
  },
  {
    id: 'push_ups',
    name: 'Push-Ups',
    category: 'bodyweight',
    movementPattern: 'push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps', 'core'],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 25,
    cues: ['Full range of motion', 'Core tight'],
    isUnilateral: false,
  },
  {
    id: 'dips',
    name: 'Dips',
    category: 'bodyweight',
    movementPattern: 'push',
    primaryMuscles: ['chest', 'triceps'],
    secondaryMuscles: ['front_delts'],
    equipment: ['dip_station'],
    stimulusToFatigueRatio: 6,
    systemicFatigue: 'medium',
    repRangeMin: 6,
    repRangeMax: 15,
    cues: ['Lean forward for chest', 'Upright for triceps'],
    isUnilateral: false,
  },

  // === BACK ===
  {
    id: 'barbell_row',
    name: 'Barbell Row',
    category: 'compound',
    movementPattern: 'pull',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps', 'rear_delts'],
    equipment: ['barbell'],
    stimulusToFatigueRatio: 5,
    systemicFatigue: 'high',
    repRangeMin: 6,
    repRangeMax: 12,
    cues: ['Hinge at hips', 'Pull to lower chest', 'Squeeze shoulder blades'],
    isUnilateral: false,
  },
  {
    id: 'db_row',
    name: 'Dumbbell Row',
    category: 'compound',
    movementPattern: 'pull',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps', 'rear_delts'],
    equipment: ['dumbbells'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Full stretch at bottom', 'Pull to hip'],
    isUnilateral: true,
  },
  {
    id: 'pull_ups',
    name: 'Pull-Ups',
    category: 'bodyweight',
    movementPattern: 'pull',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    equipment: ['pull_up_bar'],
    stimulusToFatigueRatio: 6,
    systemicFatigue: 'medium',
    repRangeMin: 5,
    repRangeMax: 15,
    cues: ['Full dead hang at bottom', 'Chin over bar'],
    isUnilateral: false,
  },
  {
    id: 'lat_pulldown',
    name: 'Lat Pulldown',
    category: 'cable',
    movementPattern: 'pull',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    equipment: ['cable_machine'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Lean back slightly', 'Pull to upper chest'],
    isUnilateral: false,
  },
  {
    id: 'cable_row',
    name: 'Seated Cable Row',
    category: 'cable',
    movementPattern: 'pull',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps', 'rear_delts'],
    equipment: ['cable_machine'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Full stretch forward', 'Pull to belly button'],
    isUnilateral: false,
  },

  // === SHOULDERS ===
  {
    id: 'ohp',
    name: 'Overhead Press',
    category: 'compound',
    movementPattern: 'push',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['triceps', 'side_delts'],
    equipment: ['barbell'],
    stimulusToFatigueRatio: 5,
    systemicFatigue: 'high',
    repRangeMin: 5,
    repRangeMax: 10,
    cues: ['Brace core', 'Press straight up', 'Head through at top'],
    isUnilateral: false,
  },
  {
    id: 'db_shoulder_press',
    name: 'Dumbbell Shoulder Press',
    category: 'compound',
    movementPattern: 'push',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['triceps', 'side_delts'],
    equipment: ['dumbbells'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'medium',
    repRangeMin: 8,
    repRangeMax: 12,
    cues: ['Seated or standing', 'Full range of motion'],
    isUnilateral: false,
  },
  {
    id: 'lateral_raise',
    name: 'Lateral Raise',
    category: 'isolation',
    movementPattern: 'push',
    primaryMuscles: ['side_delts'],
    secondaryMuscles: [],
    equipment: ['dumbbells'],
    stimulusToFatigueRatio: 9,
    systemicFatigue: 'low',
    repRangeMin: 12,
    repRangeMax: 20,
    cues: ['Lead with elbows', 'Slight forward lean'],
    isUnilateral: false,
  },
  {
    id: 'cable_lateral_raise',
    name: 'Cable Lateral Raise',
    category: 'cable',
    movementPattern: 'push',
    primaryMuscles: ['side_delts'],
    secondaryMuscles: [],
    equipment: ['cable_machine'],
    stimulusToFatigueRatio: 10,
    systemicFatigue: 'low',
    repRangeMin: 12,
    repRangeMax: 20,
    cues: ['Constant tension', 'Control the negative'],
    isUnilateral: true,
  },
  {
    id: 'face_pull',
    name: 'Face Pull',
    category: 'cable',
    movementPattern: 'pull',
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: ['traps'],
    equipment: ['cable_machine'],
    stimulusToFatigueRatio: 9,
    systemicFatigue: 'low',
    repRangeMin: 12,
    repRangeMax: 20,
    cues: ['Pull to face level', 'External rotate at end'],
    isUnilateral: false,
  },
  {
    id: 'reverse_fly',
    name: 'Reverse Fly',
    category: 'isolation',
    movementPattern: 'pull',
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: [],
    equipment: ['dumbbells'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 12,
    repRangeMax: 20,
    cues: ['Bent over position', 'Lead with elbows'],
    isUnilateral: false,
  },

  // === ARMS ===
  {
    id: 'barbell_curl',
    name: 'Barbell Curl',
    category: 'isolation',
    movementPattern: 'pull',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: ['barbell'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Keep elbows pinned', 'Control the negative'],
    isUnilateral: false,
  },
  {
    id: 'db_curl',
    name: 'Dumbbell Curl',
    category: 'isolation',
    movementPattern: 'pull',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: ['dumbbells'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Supinate at top', 'Full stretch at bottom'],
    isUnilateral: false,
  },
  {
    id: 'hammer_curl',
    name: 'Hammer Curl',
    category: 'isolation',
    movementPattern: 'pull',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: ['dumbbells'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Neutral grip', 'Targets brachialis'],
    isUnilateral: false,
  },
  {
    id: 'cable_curl',
    name: 'Cable Curl',
    category: 'cable',
    movementPattern: 'pull',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    equipment: ['cable_machine'],
    stimulusToFatigueRatio: 9,
    systemicFatigue: 'low',
    repRangeMin: 10,
    repRangeMax: 15,
    cues: ['Constant tension', 'Squeeze at top'],
    isUnilateral: false,
  },
  {
    id: 'tricep_pushdown',
    name: 'Tricep Pushdown',
    category: 'cable',
    movementPattern: 'push',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['cable_machine'],
    stimulusToFatigueRatio: 9,
    systemicFatigue: 'low',
    repRangeMin: 10,
    repRangeMax: 20,
    cues: ['Elbows pinned to sides', 'Full extension'],
    isUnilateral: false,
  },
  {
    id: 'overhead_tricep_ext',
    name: 'Overhead Tricep Extension',
    category: 'isolation',
    movementPattern: 'push',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['cable_machine'],
    stimulusToFatigueRatio: 9,
    systemicFatigue: 'low',
    repRangeMin: 10,
    repRangeMax: 15,
    cues: ['Stretch at bottom', 'Targets long head'],
    isUnilateral: false,
  },
  {
    id: 'skull_crushers',
    name: 'Skull Crushers',
    category: 'isolation',
    movementPattern: 'push',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['dumbbells'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Lower to forehead', 'Keep elbows in'],
    isUnilateral: false,
  },

  // === LEGS - QUADS ===
  {
    id: 'squat',
    name: 'Barbell Back Squat',
    category: 'compound',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'core'],
    equipment: ['barbell'],
    stimulusToFatigueRatio: 4,
    systemicFatigue: 'high',
    repRangeMin: 5,
    repRangeMax: 12,
    cues: ['Brace core', 'Knees track over toes', 'Depth to parallel or below'],
    isUnilateral: false,
  },
  {
    id: 'front_squat',
    name: 'Front Squat',
    category: 'compound',
    movementPattern: 'squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'core'],
    equipment: ['barbell'],
    stimulusToFatigueRatio: 5,
    systemicFatigue: 'high',
    repRangeMin: 5,
    repRangeMax: 10,
    cues: ['Elbows high', 'Upright torso', 'More quad dominant'],
    isUnilateral: false,
  },
  {
    id: 'leg_press',
    name: 'Leg Press',
    category: 'machine',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['leg_press'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'medium',
    repRangeMin: 8,
    repRangeMax: 20,
    cues: ['Full depth', 'Don\'t lock knees'],
    isUnilateral: false,
  },
  {
    id: 'leg_extension',
    name: 'Leg Extension',
    category: 'machine',
    movementPattern: 'squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    equipment: ['machines'],
    stimulusToFatigueRatio: 9,
    systemicFatigue: 'low',
    repRangeMin: 10,
    repRangeMax: 20,
    cues: ['Full contraction at top', 'Control the negative'],
    isUnilateral: false,
  },
  {
    id: 'walking_lunge',
    name: 'Walking Lunge',
    category: 'compound',
    movementPattern: 'lunge',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['dumbbells'],
    stimulusToFatigueRatio: 6,
    systemicFatigue: 'medium',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Long stride', 'Front knee tracks over toe'],
    isUnilateral: true,
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat',
    category: 'compound',
    movementPattern: 'lunge',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['dumbbells'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'medium',
    repRangeMin: 8,
    repRangeMax: 12,
    cues: ['Rear foot elevated', 'Torso upright'],
    isUnilateral: true,
  },

  // === LEGS - HAMSTRINGS/GLUTES ===
  {
    id: 'rdl',
    name: 'Romanian Deadlift',
    category: 'compound',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['back'],
    equipment: ['barbell'],
    stimulusToFatigueRatio: 5,
    systemicFatigue: 'high',
    repRangeMin: 6,
    repRangeMax: 12,
    cues: ['Hinge at hips', 'Slight knee bend', 'Feel hamstring stretch'],
    isUnilateral: false,
  },
  {
    id: 'db_rdl',
    name: 'Dumbbell RDL',
    category: 'compound',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['back'],
    equipment: ['dumbbells'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'medium',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Weights close to legs', 'Push hips back'],
    isUnilateral: false,
  },
  {
    id: 'leg_curl',
    name: 'Leg Curl',
    category: 'machine',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    equipment: ['machines'],
    stimulusToFatigueRatio: 9,
    systemicFatigue: 'low',
    repRangeMin: 10,
    repRangeMax: 15,
    cues: ['Full range of motion', 'Squeeze at top'],
    isUnilateral: false,
  },
  {
    id: 'hip_thrust',
    name: 'Hip Thrust',
    category: 'compound',
    movementPattern: 'hinge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['bench'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'medium',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Back on bench', 'Drive through heels', 'Squeeze at top'],
    isUnilateral: false,
  },
  {
    id: 'cable_pull_through',
    name: 'Cable Pull Through',
    category: 'cable',
    movementPattern: 'hinge',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: [],
    equipment: ['cable_machine'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 12,
    repRangeMax: 20,
    cues: ['Hinge pattern', 'Squeeze glutes at top'],
    isUnilateral: false,
  },

  // === CALVES ===
  {
    id: 'standing_calf_raise',
    name: 'Standing Calf Raise',
    category: 'isolation',
    movementPattern: 'squat',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['machines'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 10,
    repRangeMax: 20,
    cues: ['Full stretch at bottom', 'Pause at top'],
    isUnilateral: false,
  },
  {
    id: 'seated_calf_raise',
    name: 'Seated Calf Raise',
    category: 'isolation',
    movementPattern: 'squat',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['machines'],
    stimulusToFatigueRatio: 9,
    systemicFatigue: 'low',
    repRangeMin: 12,
    repRangeMax: 20,
    cues: ['Targets soleus', 'Slow negatives'],
    isUnilateral: false,
  },

  // === CORE ===
  {
    id: 'cable_crunch',
    name: 'Cable Crunch',
    category: 'cable',
    movementPattern: 'core',
    primaryMuscles: ['core'],
    secondaryMuscles: [],
    equipment: ['cable_machine'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 12,
    repRangeMax: 20,
    cues: ['Crunch down', 'Don\'t pull with arms'],
    isUnilateral: false,
  },
  {
    id: 'hanging_leg_raise',
    name: 'Hanging Leg Raise',
    category: 'bodyweight',
    movementPattern: 'core',
    primaryMuscles: ['core'],
    secondaryMuscles: [],
    equipment: ['pull_up_bar'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Control the swing', 'Legs to parallel or higher'],
    isUnilateral: false,
  },
  {
    id: 'plank',
    name: 'Plank',
    category: 'bodyweight',
    movementPattern: 'core',
    primaryMuscles: ['core'],
    secondaryMuscles: [],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 6,
    systemicFatigue: 'low',
    repRangeMin: 30,
    repRangeMax: 60,
    cues: ['Straight line from head to heels', 'Brace abs'],
    isUnilateral: false,
  },
  {
    id: 'ab_wheel',
    name: 'Ab Wheel Rollout',
    category: 'bodyweight',
    movementPattern: 'core',
    primaryMuscles: ['core'],
    secondaryMuscles: [],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Keep core tight', 'Don\'t let hips sag'],
    isUnilateral: false,
  },

  // === ADDITIONAL BODYWEIGHT EXERCISES ===
  // These ensure users with minimal equipment still get complete workouts

  {
    id: 'pike_pushup',
    name: 'Pike Push-Up',
    category: 'bodyweight',
    movementPattern: 'push',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['triceps', 'chest'],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Hips high', 'Head toward floor', 'Vertical pressing motion'],
    isUnilateral: false,
  },
  {
    id: 'diamond_pushup',
    name: 'Diamond Push-Up',
    category: 'bodyweight',
    movementPattern: 'push',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['chest', 'front_delts'],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 20,
    cues: ['Hands form diamond shape', 'Elbows close to body', 'Full extension'],
    isUnilateral: false,
  },
  {
    id: 'wide_pushup',
    name: 'Wide Push-Up',
    category: 'bodyweight',
    movementPattern: 'push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 20,
    cues: ['Hands wider than shoulders', 'Feel stretch in chest', 'Core tight'],
    isUnilateral: false,
  },
  {
    id: 'incline_pushup',
    name: 'Incline Push-Up',
    category: 'bodyweight',
    movementPattern: 'push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 6,
    systemicFatigue: 'low',
    repRangeMin: 10,
    repRangeMax: 25,
    cues: ['Hands on elevated surface', 'Good for beginners', 'Full range of motion'],
    isUnilateral: false,
  },
  {
    id: 'bodyweight_squat',
    name: 'Bodyweight Squat',
    category: 'bodyweight',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 5,
    systemicFatigue: 'low',
    repRangeMin: 15,
    repRangeMax: 30,
    cues: ['Knees track over toes', 'Depth to parallel', 'Core braced'],
    isUnilateral: false,
  },
  {
    id: 'reverse_lunge',
    name: 'Reverse Lunge',
    category: 'bodyweight',
    movementPattern: 'lunge',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 6,
    systemicFatigue: 'low',
    repRangeMin: 10,
    repRangeMax: 15,
    cues: ['Step back', 'Knee to floor', 'Upright torso'],
    isUnilateral: true,
  },
  {
    id: 'glute_bridge',
    name: 'Glute Bridge',
    category: 'bodyweight',
    movementPattern: 'hinge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 12,
    repRangeMax: 20,
    cues: ['Drive through heels', 'Squeeze at top', 'Full hip extension'],
    isUnilateral: false,
  },
  {
    id: 'single_leg_rdl',
    name: 'Single Leg Romanian Deadlift',
    category: 'bodyweight',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['core'],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 12,
    cues: ['Hinge at hips', 'Back leg extends', 'Feel hamstring stretch'],
    isUnilateral: true,
  },
  {
    id: 'inverted_row',
    name: 'Inverted Row',
    category: 'bodyweight',
    movementPattern: 'pull',
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps', 'rear_delts'],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 8,
    repRangeMax: 15,
    cues: ['Body straight', 'Pull chest to bar', 'Squeeze shoulder blades'],
    isUnilateral: false,
  },
  {
    id: 'bodyweight_tricep_ext',
    name: 'Bodyweight Tricep Extension',
    category: 'bodyweight',
    movementPattern: 'push',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'low',
    repRangeMin: 10,
    repRangeMax: 15,
    cues: ['Hands on elevated surface', 'Lower forehead to hands', 'Keep elbows in'],
    isUnilateral: false,
  },
  {
    id: 'chin_up',
    name: 'Chin-Up',
    category: 'bodyweight',
    movementPattern: 'pull',
    primaryMuscles: ['biceps', 'back'],
    secondaryMuscles: [],
    equipment: ['pull_up_bar'],
    stimulusToFatigueRatio: 7,
    systemicFatigue: 'medium',
    repRangeMin: 5,
    repRangeMax: 12,
    cues: ['Supinated grip', 'Chin over bar', 'More bicep focus'],
    isUnilateral: false,
  },
  {
    id: 'lateral_raise_band',
    name: 'Banded Lateral Raise',
    category: 'isolation',
    movementPattern: 'push',
    primaryMuscles: ['side_delts'],
    secondaryMuscles: [],
    equipment: ['bands'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 12,
    repRangeMax: 20,
    cues: ['Stand on band', 'Lead with elbows', 'Control the movement'],
    isUnilateral: false,
  },
  {
    id: 'side_lying_lateral_raise',
    name: 'Side Lying Lateral Raise',
    category: 'bodyweight',
    movementPattern: 'push',
    primaryMuscles: ['side_delts'],
    secondaryMuscles: [],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 6,
    systemicFatigue: 'low',
    repRangeMin: 12,
    repRangeMax: 20,
    cues: ['Lie on side', 'Raise arm to ceiling', 'Control movement'],
    isUnilateral: true,
  },
  {
    id: 'band_pull_apart',
    name: 'Band Pull Apart',
    category: 'isolation',
    movementPattern: 'pull',
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: ['traps'],
    equipment: ['bands'],
    stimulusToFatigueRatio: 8,
    systemicFatigue: 'low',
    repRangeMin: 15,
    repRangeMax: 25,
    cues: ['Arms straight', 'Pull band apart', 'Squeeze shoulder blades'],
    isUnilateral: false,
  },
  {
    id: 'bodyweight_calf_raise',
    name: 'Bodyweight Calf Raise',
    category: 'bodyweight',
    movementPattern: 'squat',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['bodyweight'],
    stimulusToFatigueRatio: 6,
    systemicFatigue: 'low',
    repRangeMin: 15,
    repRangeMax: 30,
    cues: ['Full stretch at bottom', 'Rise onto toes', 'Pause at top'],
    isUnilateral: false,
  },
]

/**
 * Get an exercise by its ID
 */
export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISE_LIBRARY.find(ex => ex.id === id)
}

/**
 * Get exercises filtered by user's available equipment
 * Uses a scoring system - exercises that match more equipment get higher scores
 * Requires at least 50% of equipment to match for an exercise to be included
 */
export function getExercisesByEquipment(userEquipment: Equipment[]): Exercise[] {
  return EXERCISE_LIBRARY.filter(exercise => {
    if (exercise.equipment.length === 0) return true
    const matchCount = exercise.equipment.filter(eq => userEquipment.includes(eq)).length
    // Require at least half the equipment, or all if only 1-2 items needed
    const threshold = exercise.equipment.length <= 2 ? exercise.equipment.length : Math.ceil(exercise.equipment.length / 2)
    return matchCount >= threshold
  })
}

/**
 * Get exercises for a specific muscle group, sorted by SFR
 */
export function getExercisesForMuscle(
  muscle: MuscleGroup,
  userEquipment: Equipment[],
  options?: {
    includePrimary?: boolean
    includeSecondary?: boolean
    minSFR?: number
  }
): Exercise[] {
  const { includePrimary = true, includeSecondary = true, minSFR = 0 } = options || {}

  return EXERCISE_LIBRARY
    .filter(exercise => {
      // Check equipment - more lenient matching
      if (exercise.equipment.length > 0) {
        const matchCount = exercise.equipment.filter(eq => userEquipment.includes(eq)).length
        // For exercises needing 1-2 equipment pieces, require all
        // For exercises needing 3+, require at least 2
        const threshold = exercise.equipment.length <= 2 ? exercise.equipment.length : 2
        if (matchCount < threshold) {
          return false
        }
      }

      // Check muscle involvement
      const isPrimary = exercise.primaryMuscles.includes(muscle)
      const isSecondary = exercise.secondaryMuscles.includes(muscle)

      if (includePrimary && isPrimary) return true
      if (includeSecondary && isSecondary) return true
      return false
    })
    .filter(ex => ex.stimulusToFatigueRatio >= minSFR)
    .sort((a, b) => b.stimulusToFatigueRatio - a.stimulusToFatigueRatio)
}

/**
 * Get a balanced selection of exercises for a muscle
 * Returns mix of compound and isolation movements
 */
export function getBalancedExercisesForMuscle(
  muscle: MuscleGroup,
  userEquipment: Equipment[],
  count: number = 3
): Exercise[] {
  const available = getExercisesForMuscle(muscle, userEquipment, { includePrimary: true })

  if (available.length <= count) return available

  // Try to get a compound and isolations
  const compounds = available.filter(ex => ex.category === 'compound')
  const isolations = available.filter(ex => ex.category !== 'compound')

  const selected: Exercise[] = []

  // Add best compound if available
  if (compounds.length > 0) {
    selected.push(compounds[0])
  }

  // Fill rest with highest SFR exercises
  for (const ex of isolations) {
    if (selected.length >= count) break
    if (!selected.find(s => s.id === ex.id)) {
      selected.push(ex)
    }
  }

  // If still need more, add more compounds
  for (const ex of compounds) {
    if (selected.length >= count) break
    if (!selected.find(s => s.id === ex.id)) {
      selected.push(ex)
    }
  }

  return selected
}
