/**
 * Coaching Staff — Identity & Bios
 *
 * Character profiles for each AI coach on the platform.
 * Used in the "Build Your Team" onboarding screen and coach cards throughout the app.
 *
 * Mobility + Recovery are always active (not selectable).
 * Nutrition Coach is Phase 5 (selectable when available).
 * Gymnastics Coach is Phase 6 (future).
 */

export interface CoachProfile {
    id: string
    name: string
    title: string
    tagline: string
    bio: string
    gender: 'male' | 'female'
    alwaysActive: boolean
    domain: string
    /** Path to coach avatar image in /public */
    imagePath: string
    /** Phase in which this coach becomes available */
    availablePhase: number
}

// ─── Selectable Coaches (athlete chooses + ranks these) ─────────────────────

export const STRENGTH_COACH: CoachProfile = {
    id: 'strength',
    name: 'Marcus Cole',
    title: 'Strength Coach',
    tagline: 'Builds raw strength with proven barbell programming.',
    bio: 'Marcus is a no-nonsense strength specialist who lives by the barbell. With a background in powerlifting coaching and Wendler\'s 5/3/1 methodology, he designs programs that put kilos on your squat, bench, deadlift, and press — week after week. He believes in program consistency, trusting the process, and never skipping a deload.',
    gender: 'male',
    alwaysActive: false,
    domain: 'strength',
    imagePath: '/MarcusCole.png',
    availablePhase: 1,
}

export const HYPERTROPHY_COACH: CoachProfile = {
    id: 'hypertrophy',
    name: 'Dr. Adriana Voss',
    title: 'Hypertrophy Coach',
    tagline: 'Maximizes muscle growth with science-backed volume management.',
    bio: 'Adriana holds a PhD in exercise science and is deeply rooted in Renaissance Periodization methodology. She tracks volume landmarks (MEV, MAV, MRV) per muscle group with surgical precision, prescribes tempo and rest periods that maximize time under tension, and designs splits that ensure every muscle gets the stimulus it needs to grow.',
    gender: 'female',
    alwaysActive: false,
    domain: 'hypertrophy',
    imagePath: '/Dr Adriana Voss.png',
    availablePhase: 3,
}

export const ENDURANCE_COACH: CoachProfile = {
    id: 'endurance',
    name: 'Nadia Okafor',
    title: 'Endurance Coach',
    tagline: 'Programs your runs, rucks, and rows with pace-based science.',
    bio: 'Nadia is a former collegiate distance runner turned hybrid endurance coach. She programs across running, rucking, rowing, swimming, and cycling using Daniels\' VDOT paces and 80/20 polarized training. Her philosophy: the easy days should be genuinely easy, and the hard days should earn their intensity. She\'ll build your aerobic engine without wrecking your recovery.',
    gender: 'female',
    alwaysActive: false,
    domain: 'endurance',
    imagePath: '/Nadia Okafor.png',
    availablePhase: 2,
}

export const CONDITIONING_COACH: CoachProfile = {
    id: 'conditioning',
    name: 'Kai Reeves',
    title: 'Conditioning Coach',
    tagline: 'Designs metcons, HIIT, and circuits that build real work capacity.',
    bio: 'Kai is a former competitive CrossFit athlete who now specializes in metabolic conditioning for hybrid athletes. He designs AMRAPs, EMOMs, chippers, and interval protocols that target specific energy systems — from 10-second phosphagen bursts to 20-minute oxidative grinds. His workouts are creative, scalable, and always respect the CNS budget the Head Coach sets.',
    gender: 'male',
    alwaysActive: false,
    domain: 'conditioning',
    imagePath: '/Kai.png',
    availablePhase: 4,
}

export const NUTRITION_COACH: CoachProfile = {
    id: 'nutrition',
    name: 'Leah Sato',
    title: 'Nutrition Coach',
    tagline: 'Fuels your workouts with session-specific macro guidance.',
    bio: 'Leah is a registered sports dietitian who believes nutrition should serve your training, not the other way around. She provides pre-, during-, and post-workout fueling recommendations tailored to each session type — high carbs before heavy legs, protein timing for hypertrophy days, and strategic carb periodization across the week. No fad diets. Just fuel that performs.',
    gender: 'female',
    alwaysActive: false,
    domain: 'nutrition',
    imagePath: '/Leah Sato.png',
    availablePhase: 5,
}

// ─── Always-Active Coaches (not selectable, always running) ─────────────────

export const MOBILITY_COACH: CoachProfile = {
    id: 'mobility',
    name: 'Sofia Nguyen',
    title: 'Mobility Coach',
    tagline: 'Keeps your joints healthy and your movement quality sharp.',
    bio: 'Sofia is a Functional Range Conditioning (FRC) practitioner and former physical therapist. She designs standalone mobility sessions and session-specific primers that prepare your body for what\'s coming — hip and ankle prep before squats, thoracic work before pressing, and targeted recovery for desk workers. She works behind the scenes on every training day.',
    gender: 'female',
    alwaysActive: true,
    domain: 'mobility',
    imagePath: '/Sofia Ngyen.png',
    availablePhase: 4,
}

export const RECOVERY_COACH: CoachProfile = {
    id: 'recovery',
    name: 'James Whitfield',
    title: 'Recovery Coach',
    tagline: 'Monitors your fatigue signals and protects your progress.',
    bio: 'James is a sports scientist who reviews your training data every week — RPE trends, RIR deviations, missed sessions, and external stress. He issues a GREEN, YELLOW, or RED status that determines whether you continue as programmed or get an adjusted plan. Think of him as the team\'s data-driven safety net who ensures you push hard without tipping into overtraining.',
    gender: 'male',
    alwaysActive: true,
    domain: 'recovery',
    imagePath: '/James.png',
    availablePhase: 1,
}

// ─── Registry ───────────────────────────────────────────────────────────────

export const ALL_COACHES: CoachProfile[] = [
    STRENGTH_COACH,
    HYPERTROPHY_COACH,
    ENDURANCE_COACH,
    CONDITIONING_COACH,
    NUTRITION_COACH,
    MOBILITY_COACH,
    RECOVERY_COACH,
]

export const SELECTABLE_COACHES = ALL_COACHES.filter(c => !c.alwaysActive)
export const ALWAYS_ACTIVE_COACHES = ALL_COACHES.filter(c => c.alwaysActive)

/**
 * Get the default coaching team for a goal archetype.
 * Returns coach IDs in priority order.
 */
export function getDefaultTeamForGoal(goalArchetype: string): string[] {
    switch (goalArchetype) {
        case 'hybrid_fitness':
            return ['strength', 'endurance', 'conditioning']
        case 'strength_focus':
            return ['strength', 'hypertrophy']
        case 'endurance_focus':
            return ['endurance', 'strength']
        case 'conditioning_focus':
            return ['conditioning', 'strength', 'endurance']
        case 'longevity':
            return ['strength', 'endurance']
        default:
            return ['strength', 'endurance', 'conditioning']
    }
}
