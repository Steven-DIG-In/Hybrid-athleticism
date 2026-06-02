-- supabase/migrations/022_backfill_athlete_capabilities.sql
-- One-time, non-destructive backfill of athlete_capabilities from existing sources.
-- Mirrors src/lib/athlete/capability-registry.ts. Latest benchmark per key wins;
-- profiles.training_maxes (recalibrated strength) overrides benchmark-derived rows.

-- 1) From latest benchmark per (user, mapped key).
WITH mapped AS (
  SELECT
    b.user_id,
    CASE lower(btrim(b.benchmark_name))
      WHEN 'back squat' THEN 'back_squat'
      WHEN 'bench press' THEN 'bench_press'
      WHEN 'deadlift' THEN 'deadlift'
      WHEN 'overhead press' THEN 'overhead_press'
      WHEN 'run 5km' THEN 'run_5k'
      WHEN 'run 5k' THEN 'run_5k'
      WHEN 'row 2000m' THEN 'row_2000m'
      WHEN 'swim 1km' THEN 'swim_1k'
      ELSE NULL
    END AS capability_key,
    b.value,
    b.created_at
  FROM public.athlete_benchmarks b
),
latest AS (
  SELECT DISTINCT ON (user_id, capability_key)
    user_id, capability_key, value
  FROM mapped
  WHERE capability_key IS NOT NULL
  ORDER BY user_id, capability_key, created_at DESC
)
INSERT INTO public.athlete_capabilities (user_id, capability_key, family, current_value, unit, source, evidence)
SELECT
  l.user_id,
  l.capability_key,
  CASE WHEN l.capability_key IN ('back_squat','bench_press','deadlift','overhead_press') THEN 'strength' ELSE 'endurance' END,
  l.value,
  CASE WHEN l.capability_key IN ('back_squat','bench_press','deadlift','overhead_press') THEN 'kg' ELSE 'seconds' END,
  'onboarding',
  jsonb_build_object('backfill', 'benchmark')
FROM latest l
ON CONFLICT (user_id, capability_key) DO NOTHING;

-- 2) From profiles.training_maxes JSON (strength only). Overrides benchmark rows.
WITH tm AS (
  SELECT
    p.id AS user_id,
    CASE lower(btrim(kv.key))
      WHEN 'squat' THEN 'back_squat'
      WHEN 'back squat' THEN 'back_squat'
      WHEN 'bench' THEN 'bench_press'
      WHEN 'bench press' THEN 'bench_press'
      WHEN 'deadlift' THEN 'deadlift'
      WHEN 'overhead press' THEN 'overhead_press'
      WHEN 'ohp' THEN 'overhead_press'
      ELSE NULL
    END AS capability_key,
    (kv.value->>'trainingMaxKg')::numeric AS value
  FROM public.profiles p,
       LATERAL jsonb_each(COALESCE(p.training_maxes, '{}'::jsonb)) AS kv
)
INSERT INTO public.athlete_capabilities (user_id, capability_key, family, current_value, unit, source, evidence)
SELECT user_id, capability_key, 'strength', value, 'kg', 'recalibration', jsonb_build_object('backfill', 'training_max')
FROM tm
WHERE capability_key IS NOT NULL AND value IS NOT NULL
ON CONFLICT (user_id, capability_key)
DO UPDATE SET current_value = EXCLUDED.current_value, source = EXCLUDED.source, evidence = EXCLUDED.evidence, updated_at = now();
