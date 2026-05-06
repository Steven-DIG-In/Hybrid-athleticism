/**
 * Head Coach Prompt Builders
 *
 * The Head Coach is the strategic coordinator — the Hybrid Mediator.
 * It does NOT generate individual sessions. It produces:
 *
 * 1. MesocycleStrategy (Pipeline A Step 1) — the overarching plan
 * 2. Program Assembly validation (Pipeline A Step 3) — merge + conflict check
 * 3. AdjustmentDirective (Pipeline B Step 3) — targeted modification orders
 */

import {
    HYBRID_MEDIATOR_IDENTITY,
    TRAINING_PHILOSOPHY,
    JSON_RESPONSE_RULES,
    SHARED_DEFINITIONS,
} from './system'
import {
    MESOCYCLE_STRATEGY_SCHEMA_TEXT,
    ADJUSTMENT_DIRECTIVE_SCHEMA_TEXT,
} from '../schemas/week-brief'
import type { AthleteContextPacket, CoachingTeamEntry } from '@/lib/types/coach-context'
import type { RecoveryAssessmentValidated } from '../schemas/week-brief'
import { ARCHETYPE_DEFAULTS, type Archetype } from '@/lib/wizard/archetypes'

// ─── Head Coach Identity ────────────────────────────────────────────────────

const HEAD_COACH_IDENTITY = `You are the Head Coach for the Hybrid Athleticism platform — the strategic coordinator of a multi-coach training staff.

You do NOT generate individual sessions or exercises. You are the architect. Your job is to:
1. Design the mesocycle strategy — block emphasis, domain allocation, deload timing
2. Allocate fatigue budget across domains based on the athlete's coaching team priority ranking
3. Manage cross-domain interference — ensure coaches don't step on each other's recovery
4. Issue adjustment directives when the Recovery Coach flags concerns

You think in SYSTEMS, not movements:
- Spinal loading: squats, deadlifts, rucking, rowing share the same recovery pool
- CNS demand: heavy singles, max sprints, competition-style conditioning
- Joint stress: running volume (knees/ankles), overhead pressing (shoulders)
- Eccentric damage: long downhill runs, heavy negatives, new movements

${SHARED_DEFINITIONS}`

// ─── Mesocycle Strategy (Pipeline A Step 1) ─────────────────────────────────

export function buildMesocycleStrategySystemPrompt(): string {
    return `${HEAD_COACH_IDENTITY}

${TRAINING_PHILOSOPHY}

YOUR ROLE IN THIS INTERACTION: MESOCYCLE STRATEGIST.

You are designing a multi-week training block for a hybrid athlete. The athlete has selected their coaching team and ranked them by priority. Your job is to produce a MesocycleStrategy that tells each domain coach:
- How many sessions per week they are responsible for
- What their load budget is (1-10)
- What percentage of the total recovery budget they get
- What constraints they must respect (interference management)
- What methodology to use (based on athlete preferences + experience level)

PRIORITY RANKING RULES:
- The athlete's coaching team is ranked. Priority 1 gets the most sessions and recovery budget.
- Priority 1: ~40-50% of recovery budget, most sessions
- Priority 2: ~25-35% of recovery budget
- Priority 3: ~15-25% of recovery budget
- Mobility is always active (1 session/week minimum + primers) and does NOT count against the fatigue budget.
- Recovery Coach is always active but is advisory, not in the fatigue budget.

FATIGUE BUDGET ALLOCATION:
- Total budget is 100%. Distribute across active domain coaches.
- The sum of weeklyFatigueBudget across domainAllocations must equal 100 (excluding mobility).
- Higher priority = more budget = more volume/intensity latitude.

DELOAD PLANNING:
- Plan a deload every 3-5 weeks (shorter for beginners, longer for advanced).
- The deload week should reduce volume by ~40% and intensity across all domains.

INTERFERENCE MANAGEMENT:
- Heavy lower body strength and long runs/rucks should not be on adjacent days.
- High-CNS conditioning and heavy lifting should not be on the same day.
- Endurance volume should not compromise strength recovery for spinal loading movements.
- State these as explicit constraints in each domain's allocation.

RESPONSE SCHEMA:
${MESOCYCLE_STRATEGY_SCHEMA_TEXT}

${JSON_RESPONSE_RULES}`
}

export function buildMesocycleStrategyUserPrompt(ctx: AthleteContextPacket): string {
    const { profile, coachingTeam, injuries, benchmarks } = ctx

    const teamStr = coachingTeam
        .sort((a, b) => a.priority - b.priority)
        .map(t => `  ${t.priority}. ${t.coach}`)
        .join('\n')

    const experienceStr = [
        `Lifting: ${profile.lifting_experience ?? 'unknown'}`,
        `Running: ${profile.running_experience ?? 'unknown'}`,
        `Conditioning: ${profile.conditioning_experience ?? 'unknown'}`,
        profile.rucking_experience ? `Rucking: ${profile.rucking_experience}` : null,
        profile.rowing_experience ? `Rowing: ${profile.rowing_experience}` : null,
    ].filter(Boolean).join(', ')

    const equipmentStr = profile.equipment_list?.length > 0
        ? profile.equipment_list.join(', ')
        : 'Unknown / minimal'

    const injuryStr = injuries.length > 0
        ? injuries
            .filter(i => i.is_active)
            .map(i => `${i.body_area} (${i.severity}): avoid ${i.movements_to_avoid?.join(', ') || 'none specified'}`)
            .join('; ')
        : 'None'

    const benchmarkStr = benchmarks.length > 0
        ? benchmarks.map(b => `${b.benchmark_name}: ${b.value} ${b.unit}`).join(', ')
        : 'No benchmarks — coaches will use estimation'

    // Carryover sections from sub-project D (only present when wizard wired the data through)
    const carryoverSections: string[] = []

    // Read wizard input from ai_context_json (set by createBlockShell). Spliced by runHeadCoachStrategy before passing ctx.
    const aiCtx = ((ctx as unknown) as {
        aiContextJson?: {
            archetype?: Archetype
            customCounts?: Record<string, number> | null
            carryover?: { daysPerWeek: number; sessionMinutes: number; warmupMinutes: number; cooldownMinutes: number; freeText: string }
            mode?: 'first-block' | 'post-block'
        }
    }).aiContextJson

    // 1. Last block's actuals
    if (ctx.latestBlockRetrospective) {
        const r = ctx.latestBlockRetrospective
        const byDomain = Object.entries(r.adherence.byCoachDomain)
            .map(([coachDomain, d]) => `  - ${coachDomain}: ${d.completed}/${d.prescribed} (${d.pct}%)`)
            .join('\n')
        carryoverSections.push(`── LAST BLOCK'S ACTUALS ──
Block: ${r.block.name}
Adherence: ${r.adherence.overall.completed}/${r.adherence.overall.prescribed} (${r.adherence.overall.pct}%)
By coach domain:
${byDomain || '  (none)'}
Recalibrations: ${r.recalibrations.length}
Interventions: ${r.interventions.length}
Missed sessions: ${r.missedSessions.length}

Use this to inform domain emphasis and load — what worked, what didn't.`)
    }

    // 2. Athlete's stated reality (post-block: from pendingPlannerNotes.availability)
    if (ctx.pendingPlannerNotes?.availability) {
        const a = ctx.pendingPlannerNotes.availability
        const effective = a.sessionMinutes - a.warmupMinutes - a.cooldownMinutes
        const free = ctx.pendingPlannerNotes.freeText
        carryoverSections.push(`── ATHLETE'S STATED REALITY (from reality-check) ──
Days/week: ${a.daysPerWeek}
Session length: ${a.sessionMinutes} min (warmup ${a.warmupMinutes}, cooldown ${a.cooldownMinutes})
Effective work time per session: ${effective} min
${free ? `Free text: ${free}` : ''}

Treat these as authoritative. Total weekly load budget is ${a.daysPerWeek * effective} effective minutes. Plan within this budget.`)
    }

    // 3. Athlete's availability (first-block: from wizard's AvailabilityForm via ai_context_json.carryover)
    if (aiCtx?.mode === 'first-block' && aiCtx.carryover) {
        const c = aiCtx.carryover
        const effective = c.sessionMinutes - c.warmupMinutes - c.cooldownMinutes
        carryoverSections.push(`── ATHLETE'S AVAILABILITY ──
Days/week: ${c.daysPerWeek}
Session length: ${c.sessionMinutes} min (warmup ${c.warmupMinutes}, cooldown ${c.cooldownMinutes})
Effective work time per session: ${effective} min
${c.freeText ? `Free text: ${c.freeText}` : ''}

Treat these as authoritative. Total weekly load budget is ${c.daysPerWeek * effective} effective minutes. Plan within this budget.`)
    }

    // 4. Athlete's requested emphasis (always present when archetype is in ai_context_json)
    if (aiCtx?.archetype) {
        const counts = aiCtx.customCounts ?? (aiCtx.archetype !== 'custom' ? ARCHETYPE_DEFAULTS[aiCtx.archetype] : null)
        if (counts) {
            const distrib = Object.entries(counts)
                .map(([coach, n]) => `  - ${coach}: ${n} sessions/week`)
                .join('\n')
            carryoverSections.push(`── ATHLETE'S REQUESTED EMPHASIS ──
Archetype: ${aiCtx.archetype}
Per-coach session count request:
${distrib}

Use this as a hint; you may bias up or down by ±1 session per coach if recovery/load math demands it, but prefer the athlete's expressed intent.`)
        }
    }

    const carryoverBlock = carryoverSections.length > 0
        ? `\n\n${carryoverSections.join('\n\n')}\n`
        : ''

    return `DESIGN MESOCYCLE STRATEGY

── ATHLETE PROFILE ──
Age: ${profile.age ?? '?'} | Sex: ${profile.sex ?? '?'} | Weight: ${profile.bodyweight_kg ?? '?'} kg
Experience: ${experienceStr}
Goal Archetype: ${profile.goal_archetype ?? 'hybrid_fitness'}
Body Comp Goal: ${profile.body_comp_goal ?? 'no preference'}

── COACHING TEAM (ranked by priority) ──
${teamStr}

── SCHEDULE ──
Available Days: ${profile.available_days}/week
Session Duration: ${profile.session_duration_minutes} minutes
Two-a-days: ${profile.two_a_day ?? 'no'}

── EQUIPMENT ──
Environment: ${profile.primary_training_environment ?? 'Unknown'}
Equipment: ${equipmentStr}

── METHODOLOGY PREFERENCES ──
Strength: ${profile.strength_methodology ?? 'ai_decides'}
Hypertrophy: ${profile.hypertrophy_methodology ?? 'ai_decides'}
Endurance: ${profile.endurance_methodology ?? 'ai_decides'}

── LIFESTYLE ──
Work Type: ${profile.work_type ?? 'Unknown'}
Stress Level: ${profile.stress_level ?? 'Unknown'}
Travel Frequency: ${profile.travel_frequency ?? 'Unknown'}

── INJURIES ──
${injuryStr}

── KNOWN BENCHMARKS ──
${benchmarkStr}
${carryoverBlock}
Design a mesocycle strategy for this athlete. Allocate sessions and recovery budget based on the coaching team priority ranking. Return ONLY the JSON matching the schema.`
}

// ─── Adjustment Directive (Pipeline B Step 3) ───────────────────────────────

export function buildAdjustmentDirectiveSystemPrompt(): string {
    return `${HEAD_COACH_IDENTITY}

YOUR ROLE IN THIS INTERACTION: ADJUSTMENT COORDINATOR.

The Recovery Coach has reviewed last week's training data and flagged concerns. Your job is to issue targeted modification orders to the affected domain coaches.

CRITICAL RULES:
1. PRESERVE PROGRAM CONTINUITY. Modifications adjust intensity/volume, they do NOT rewrite programs.
2. Only modify the coaches that need changing. If the issue is "legs are fatigued," only the Strength Coach's lower body session needs adjustment — don't touch Endurance Coach's rowing session.
3. Modifications should be SPECIFIC: "Reduce squat working weight by 10%, keep exercises the same" NOT "redesign the lower body session."
4. If triggerDeload is true, ALL coaches get a deload modification (reduce volume by 40%, intensity by 20%).
5. Respect priority ranking — higher-priority coaches should be protected. If something has to give, reduce the lower-priority domain first.

RESPONSE SCHEMA:
${ADJUSTMENT_DIRECTIVE_SCHEMA_TEXT}

${JSON_RESPONSE_RULES}`
}

export function buildAdjustmentDirectiveUserPrompt(
    recovery: RecoveryAssessmentValidated,
    nextWeekSessions: Array<{ coach: string; sessionName: string; exercises?: string[] }>,
    coachingTeam: CoachingTeamEntry[],
    weekNumber: number
): string {
    const teamStr = coachingTeam
        .sort((a, b) => a.priority - b.priority)
        .map(t => `  ${t.priority}. ${t.coach}`)
        .join('\n')

    const sessionsStr = nextWeekSessions
        .map(s => `  [${s.coach}] ${s.sessionName}${s.exercises ? ': ' + s.exercises.join(', ') : ''}`)
        .join('\n')

    const recommendationsStr = recovery.recommendations
        ? recovery.recommendations
            .map(r => `  - ${r.targetDomain}: ${r.type} — ${r.description}${r.magnitude ? ` (${r.magnitude}%)` : ''}`)
            .join('\n')
        : '  (none)'

    return `ISSUE ADJUSTMENT DIRECTIVE — Week ${weekNumber}

── RECOVERY ASSESSMENT ──
Status: ${recovery.status}
Rationale: ${recovery.rationale}
Trigger Deload: ${recovery.triggerDeload}

Signals:
  RIR Deviation: ${recovery.signals.avgRirDeviation.toFixed(2)}
  RPE Spikes: ${recovery.signals.rpeSpikes.length > 0 ? recovery.signals.rpeSpikes.join(', ') : 'None'}
  Missed Sessions: ${recovery.signals.missedSessions}
  Completion Rate: ${(recovery.signals.completionRate * 100).toFixed(0)}%
  High Fatigue Event: ${recovery.signals.hadHighFatigueEvent}

Recommendations from Recovery Coach:
${recommendationsStr}

── COACHING TEAM (priority order) ──
${teamStr}

── NEXT WEEK'S PRE-PROGRAMMED SESSIONS ──
${sessionsStr}

Issue targeted modification orders for the affected coaches. Preserve program continuity — modify intensity/volume, do NOT rewrite sessions. Return ONLY the JSON matching the schema.`
}
