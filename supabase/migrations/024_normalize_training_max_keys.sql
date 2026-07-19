-- Rekey profiles.training_maxes onto canonical main-lift keys.
--
-- The writer stored raw exercise names ("Back Squat", "Overhead Press") while
-- the readers looked up 'Squat' / 'OHP'. profiles.training_maxes is a JSONB map
-- with exact-string lookup, so squat and overhead-press training maxes were
-- written every session and read by nobody: generation silently fell back to
-- the onboarding benchmark estimate, forever. See src/lib/training/exercise-key.ts.
--
-- NON-DESTRUCTIVE: entries that are not main lifts (Barbell Row, Front Squat,
-- Romanian Deadlift, ...) are preserved untouched. They are unread by any
-- caller but this migration is not the place to delete training history.

with expanded as (
    select
        p.id as user_id,
        e.key as src_key,
        e.value as entry,
        case
            when lower(regexp_replace(e.key, '\([^)]*\)', '', 'g')) ~ '^\s*(barbell\s+)?(back\s+)?squat\s*$'
                then 'back_squat'
            when lower(regexp_replace(e.key, '\([^)]*\)', '', 'g')) ~ '^\s*(barbell\s+)?bench( press)?\s*$'
                then 'bench_press'
            when lower(regexp_replace(e.key, '\([^)]*\)', '', 'g')) ~ '^\s*(barbell\s+)?(conventional\s+)?deadlift\s*$'
                then 'deadlift'
            when lower(regexp_replace(e.key, '\([^)]*\)', '', 'g')) ~ '^\s*(barbell\s+)?(overhead press|ohp|shoulder press|strict press)\s*$'
                then 'overhead_press'
            else null
        end as canonical_key
    from profiles p,
         lateral jsonb_each(coalesce(p.training_maxes, '{}'::jsonb)) e
),
winners as (
    select distinct on (user_id, canonical_key)
        user_id, canonical_key, entry
    from expanded
    where canonical_key is not null
    -- Unqualified names win over parenthetical variants REGARDLESS of recency.
    -- Live data proves why: "Overhead Press" = 49.5 (2026-04-24) but
    -- "Overhead Press (Supplemental BBB)" = 39 (2026-06-20). Ordering by
    -- recency alone would crown the supplemental BBB load as the OHP training
    -- max — a silent 21% regression baked into every future 5/3/1 wave.
    order by user_id, canonical_key, (src_key ~ '\(') asc, (entry->>'updatedAt') desc nulls last
),
rekeyed as (
    select user_id, jsonb_object_agg(canonical_key, entry) as main_lifts
    from winners group by user_id
),
preserved as (
    select user_id, jsonb_object_agg(src_key, entry) as others
    from expanded where canonical_key is null group by user_id
)
update profiles p
set training_maxes =
        coalesce((select others from preserved where user_id = p.id), '{}'::jsonb)
     || coalesce((select main_lifts from rekeyed where user_id = p.id), '{}'::jsonb)
where exists (select 1 from expanded where user_id = p.id);
