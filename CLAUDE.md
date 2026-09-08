# Hybrid-Athleticism

Personal multi-agent AI coaching platform. Single real user (Steven, Supabase auth `incubatepro@gmail.com`); the architecture is multi-user ready but only one athlete exists — **his rows are live production training data**.

- **Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase (Postgres, RLS, Vault, Storage), `@anthropic-ai/sdk`, Vitest 4, Tailwind 4.
- **GitHub:** `Steven-DIG-In/Hybrid-athleticism` · **Supabase project:** `kuqgtholljrxnbxtmrnz` (EU-West-1).

## Commands

- `npm run dev` — Next dev server on port 3001 (not 3000).
- `npm test` — `vitest run`; suite is 476 passing + 1 todo. `npm run test:watch` for watch mode. Tests live in `src/**/__tests__/`, mock Supabase via `vi.mock` + `vi.hoisted` — no DB access.
- `npm run build` / `npm run lint` — standard Next build and eslint.
- One-off probes live in `scripts/` (`test-engine.ts`, `introspect-db.ts`, …) — run with `npx tsx`.

## Database and deploy

- Migrations are plain SQL in `supabase/migrations/` (001–026), applied through the Supabase MCP — there is no local Supabase CLI stack. After a migration, regenerate types via MCP and re-append the hand-written alias block (it gets clobbered; see memory feedback `supabase-type-regen-clobbers-aliases`).
- Env in `.env.local` (see `.env.example`): Supabase URL/anon/service-role, `ANTHROPIC_API_KEY`, `CRON_SECRET`.
- Deploy = push to `main`; Vercel auto-deploys (no local `.vercel/` link). `vercel.json` runs one cron: `/api/cron/garmin-sync` daily 07:00. Vercel Hobby plan — route `maxDuration` caps at 300.

## Architecture

- Three layers: **runtime skills** (`src/lib/skills/` — deterministic formulas: 531 progression, VDOT pacer, volume landmarks), **coach configs** (`src/lib/coaches/configs/` — persona + methodology + assigned skills), **generic orchestrator** (`src/lib/ai/orchestrator.ts` — config-driven, writes decisions to `agent_activity`).
- Block model: `mesocycles` (4–8 week blocks) → `microcycles` (weeks) → `session_inventory` (AI-generated sessions). Generation pipeline lives in `src/lib/engine/`; the canonical per-week path is `generateWeekInventory()` in `src/lib/actions/inventory-generation.actions.ts`.
- **Prescription/execution ownership is enforced by Postgres column grants** (migration 026), not convention: `exercise_sets.target_*` are write-once (UPDATE revoked), `actual_*`/`logged_at` are the athlete's. Guard test: `__tests__/prescription-ownership.test.ts`.
- `src/core/` is a retired rebuild — do not put new work there. The one live piece is `src/core/domains/endurance/` (immutable endurance prescriptions, wired into generation and `/data/endurance`). Everything else ships in `src/lib/`.
- **Check-in/readiness loop — wired 2026-09-07** (was the known half-built area). All three stages existed with ZERO callers: `checkAndTriggerCheckIn`, `submitSelfReport` and `runCheckInCycle`. Consequence: `athlete_self_reports` stayed empty, all 14 `check_in_windows` sat at `open`, `getReadiness` could only ever return `UNKNOWN`, and `runCheckInCycle` ran on its neutral fallbacks — pinning ~35% of the recovery weighting (sleep/energy/stress/motivation/soreness) to a constant. Now: `/dashboard/check-in` form → `completeWeeklyCheckIn` (report → trigger → cycle, in that order — the trigger writes the completion counters the cycle reads). The due-check (`getDueCheckIn`) is READ-ONLY by design; viewing the dashboard must never advance the coaching cycle. The scheduling rule is pure and unit-tested in `src/lib/check-in/trigger.ts`.

## Gotchas

- **Never run destructive integration tests** that delete or wipe rows scoped to the live user — Steven is actively training. Unit-test with mocked clients, or seed additive-only rows and clean only those by id.
- `session_inventory.completed_at` is only stamped from 2026-07-26; older completed rows have it null. Always check `status === 'completed'`, never `completed_at`.
- `mesocycles.end_date` is `GENERATED ALWAYS` — it cannot be moved by a week rebase (`rebaseMicrocyclesFromWeek`), so date-keyed nudges can fire early.
- Files with `'use server'` reject non-async exports — sync helpers and types go in a `*.helpers.ts` sibling.
- The live interventions table is `ai_coach_interventions` (not `agent_interventions`); modality enums are uppercase (`LIFTING`, `CARDIO`, …) — lowercase comparisons silently match nothing.
- Allocation signal is `training_day`, not `scheduled_date` (which stays null on inventory even after auto-allocate).
- Coach prompts must demand intent, not example workouts — literal examples in a directive get reproduced verbatim every week (the 2026-07-26 conditioning-variety bug).

## Memory

- Cross-AI: `~/.claude/memory/projects/hybrid-athleticism.md`
- Auto-memory entries are tagged `project_hybrid_athleticism_*` under `~/.claude/projects/-Users-steven-Vibe-Projects/memory/` (ranked backlog: `project_hybrid_athleticism_audit_backlog.md`)
