/**
 * Verify Layer 3 endurance VDOT wiring end-to-end — READ-ONLY, no DB writes.
 *
 * Tier 1 (always): reads the athlete's CURRENT endurance capabilities live from
 *   Supabase, runs the new buildSkillInput → vdot-pacer skill → buildPreComputedAddendum
 *   path, and prints the exact VDOT pace block that now gets appended to the endurance
 *   coach prompt. Proves the capability → VDOT → prompt wiring with real data.
 * Tier 2 (--call-ai): feeds the REAL endurance system prompt + REAL VDOT addendum +
 *   REAL EnduranceProgramSchema to the model and prints each generated running session's
 *   zone + target pace. A genuine generation; persists NOTHING.
 *
 * Usage:
 *   npx tsx scripts/verify-endurance-vdot.ts
 *   npx tsx scripts/verify-endurance-vdot.ts --call-ai
 */

import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { buildSkillInput, buildPreComputedAddendum } from '../src/lib/engine/_shared/skill-execution'
import { skillRegistry } from '../src/lib/skills'
import type { AthleteContextPacket, WeekBrief } from '../src/lib/types/coach-context'
import type { MesocycleStrategyValidated } from '../src/lib/ai/schemas/week-brief'
import { EnduranceProgramSchema } from '../src/lib/ai/schemas/week-brief'
import { buildEnduranceProgramSystemPrompt, buildEnduranceProgramUserPrompt } from '../src/lib/ai/prompts/endurance-coach'
import { generateStructuredResponse } from '../src/lib/ai/client'
import { formatPace } from '../src/lib/skills/domains/endurance/vdot-pacer'

function loadEnv() {
  const envPath = `${process.cwd()}/.env.local`
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim()
  }
}

const USER_EMAIL = 'incubatepro@gmail.com'

async function main() {
  loadEnv()
  const callAi = process.argv.includes('--call-ai')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── Resolve the live user + their CURRENT endurance capabilities (read-only) ──
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users?.users.find(u => u.email === USER_EMAIL)
  if (!user) throw new Error(`No auth user for ${USER_EMAIL}`)

  const { data: caps, error } = await supabase
    .from('athlete_capabilities')
    .select('capability_key, family, current_value, unit, source, updated_at, evidence')
    .eq('user_id', user.id)
    .eq('family', 'endurance')
  if (error) throw error

  console.log('\n=== LIVE endurance capabilities (read-only) ===')
  for (const c of caps ?? []) console.log(`  ${c.capability_key}: ${c.current_value} ${c.unit} (${c.source})`)

  const enduranceCaps = (caps ?? []).map(c => ({
    key: c.capability_key,
    label: c.capability_key,
    currentValueSeconds: Number(c.current_value),
    source: c.source,
    updatedAt: c.updated_at,
    evidence: c.evidence ?? {},
  }))

  // ── Minimal ctx + strategy carrying ONLY what the vdot path / prompt read ──
  const ctx = {
    profile: {
      age: null, sex: null, bodyweight_kg: null,
      running_experience: 'intermediate', rucking_experience: null,
      rowing_experience: null, swimming_experience: null, cycling_experience: null,
      equipment_list: [], equipment_usage_intents: null, endurance_modality_preferences: [],
      primary_goal: 'hybrid fitness', goal_archetype: 'HYBRID_PEAKING',
    },
    injuries: [],
    benchmarks: [],
    athleteState: { capabilities: { strength: [], endurance: enduranceCaps } },
  } as unknown as AthleteContextPacket

  const strategy = {
    domainAllocations: [{ coach: 'endurance', sessionsPerWeek: 3, loadBudgetPerSession: 6, weeklyFatigueBudget: 40, constraints: [], methodologyDirective: '80/20 polarized + Daniels VDOT' }],
  } as unknown as MesocycleStrategyValidated

  // ── TIER 1: capability → VDOT → prompt addendum (deterministic) ─────────────
  const input = await buildSkillInput('vdot-pacer', ctx, strategy, 'endurance')
  console.log('\n=== TIER 1: vdot-pacer skill input (was the bug: raceDistanceMeters) ===')
  console.log(' ', JSON.stringify(input))

  if (!input) throw new Error('buildSkillInput returned undefined — capability not picked up')
  const skillResult = skillRegistry.executeSkill('vdot-pacer', input)
  const addendum = buildPreComputedAddendum(new Map([['vdot-pacer', skillResult]]))
  console.log('\n=== TIER 1: VDOT pace block now injected into the endurance prompt ===')
  console.log(addendum.trim())

  if (!callAi) {
    console.log('\n(Run with --call-ai for a real no-persist generation.)')
    return
  }

  // ── TIER 2: real generation with the real addendum, no persistence ──────────
  const brief: WeekBrief = {
    weekNumber: 1, isDeload: false, weekEmphasis: 'Aerobic base', volumePercent: 100,
    sessionsToGenerate: 3, loadBudget: 6, constraints: [],
    methodologyDirective: '80/20 polarized + Daniels VDOT paces',
    otherDomainsThisWeek: [{ domain: 'strength', sessionCount: 3, loadBudget: 7 }],
  }
  const userPrompt = buildEnduranceProgramUserPrompt(ctx, brief, undefined, 4) + addendum

  console.log('\n=== TIER 2: calling the endurance coach (real AI, no DB write)… ===')
  const r = await generateStructuredResponse({
    systemPrompt: buildEnduranceProgramSystemPrompt(),
    userPrompt,
    schema: EnduranceProgramSchema,
    maxRetries: 2,
    maxTokens: 8000,
  })
  if (!r.success) throw new Error(`Generation failed: ${r.error}`)

  console.log(`  methodology: ${r.data.methodologyUsed}`)
  for (const wk of r.data.weeks) {
    console.log(`\n  Week ${wk.weekNumber}${wk.isDeload ? ' (deload)' : ''}:`)
    for (const s of wk.sessions) {
      const pace = s.targetPaceSecPerKm != null ? `${formatPace(s.targetPaceSecPerKm)}/km` : '(zone-only)'
      console.log(`    • ${s.enduranceModality.padEnd(8)} ${String(s.intensityZone).padEnd(10)} ${pace}  ${s.intervalStructure ?? ''}`)
    }
  }
  console.log('\n(No rows written. Verification only.)')
}

main().catch(err => { console.error(err); process.exit(1) })
