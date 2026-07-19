-- Surface the 5/3/1 max-effort set as structured data.
--
-- The 531-progression skill has always emitted `isAmrap` per set, but no AI
-- schema and no column carried it, so the top set reached the athlete as a flat
-- rep target with the "+" mentioned only in free-text notes. `grep -i amrap`
-- across the app matched nothing but the *conditioning* format enum.
alter table exercise_sets
    add column if not exists is_amrap boolean not null default false;

comment on column exercise_sets.is_amrap is
    'True for max-effort (AMRAP / "+") sets — target_reps is a floor, not a cap.';

-- Backfill from the notes the coach has been writing all along.
update exercise_sets
set is_amrap = true
where is_amrap = false
  and notes is not null
  and (notes ilike '%amrap%' or notes ilike '%max effort%');
