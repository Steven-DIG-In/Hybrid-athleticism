/**
 * Single vocabulary for main-lift identity.
 *
 * The training-max loop was severed because the writer keyed on raw
 * `exercise_sets.exercise_name` ("Back Squat") while the readers looked up
 * 'Squat' / 'OHP'. `profiles.training_maxes` is a JSONB map with exact-string
 * lookup, so those never met: squat and overhead-press training maxes were
 * written every session and read by nobody, and generation silently fell back
 * to the onboarding benchmark forever.
 *
 * Every training-max read and write now goes through here.
 *
 * Returns null for anything that is not one of the four main lifts.
 * Accessories progress via the week-to-week LLM loop (which reads last week's
 * actuals directly), not via training maxes — writing TMs for them only
 * polluted the map with "Bench Press (Warm-up)" style junk.
 */

export type MainLiftKey =
    | 'back_squat'
    | 'bench_press'
    | 'deadlift'
    | 'overhead_press'

/**
 * Exact phrases only, matched after qualifier-stripping.
 *
 * Substring matching is unsafe here and would corrupt training maxes:
 * "Romanian Deadlift" contains "deadlift" but is a different lift with a
 * different max, and "Front Squat" / "Bulgarian Split Squat" / "Kettlebell
 * Goblet Squat" are not the back squat.
 */
const MAIN_LIFT_PHRASES: Record<string, MainLiftKey> = {
    'back squat': 'back_squat',
    'squat': 'back_squat',
    'bench press': 'bench_press',
    'bench': 'bench_press',
    'deadlift': 'deadlift',
    'conventional deadlift': 'deadlift',
    'overhead press': 'overhead_press',
    'ohp': 'overhead_press',
    'shoulder press': 'overhead_press',
    'strict press': 'overhead_press',
}

/** Equipment prefixes that do not change lift identity. */
const STRIPPABLE_PREFIXES = ['barbell', 'bb']

export function normalizeExerciseKey(name: string): MainLiftKey | null {
    if (!name) return null

    let s = name
        .toLowerCase()
        // Drop parenthetical qualifiers: "(Warm-up)", "(FSL)", "(Supplemental BBB)".
        .replace(/\([^)]*\)/g, ' ')
        // Drop em/en-dash annotations: "Back Squat — AMRAP". Plain hyphens are
        // left alone so "Single-Leg Romanian Deadlift" stays intact and keeps
        // failing to match, which is the correct outcome for an accessory.
        .replace(/\s*[—–]\s*.*$/, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    for (const prefix of STRIPPABLE_PREFIXES) {
        if (s.startsWith(`${prefix} `)) s = s.slice(prefix.length + 1).trim()
    }

    return MAIN_LIFT_PHRASES[s] ?? null
}
