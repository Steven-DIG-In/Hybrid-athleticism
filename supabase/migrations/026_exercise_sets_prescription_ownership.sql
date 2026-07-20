-- Make prescription/execution ownership structural instead of conventional.
--
-- `exercise_sets` interleaves plan and actual in one flat row, and RLS granted
-- blanket UPDATE on every column. Nothing but comments stopped the execution
-- surface from writing prescription columns — and the convention had already
-- failed: `updateExerciseSet` wrote `notes: input.notes ?? null`, and because
-- the logger never passes notes, completing a set NULLED the coach's note
-- (tempo cues, "AMRAP set, push for 3-5 reps", benchmark markers).
--
-- Column-level privileges move the rule from four comments and two runtime
-- null-checks into something Postgres enforces.
--
-- The boundary: THE NUMBERS ARE WRITE-ONCE, THE MOVEMENT CAN BE SWAPPED.
--   * target_reps / target_weight_kg / target_rir / is_amrap — generation only,
--     set at INSERT, never updatable afterwards.
--   * actual_* / rir_actual / rpe_actual / is_pr / logged_at — execution only.
--   * exercise_name / muscle_group — updatable, because `swapExercise` is a
--     sanctioned athlete-initiated substitution ("no barbell today").
--   * notes — generation-owned commentary, no longer updatable at all.
--
-- INSERT is untouched: generation writes complete rows, which is how the
-- prescription legitimately gets created.

-- anon has no business updating training data at all.
revoke update on public.exercise_sets from anon;

revoke update on public.exercise_sets from authenticated;

grant update (
    -- execution truth
    actual_reps,
    actual_weight_kg,
    rir_actual,
    rpe_actual,
    is_pr,
    logged_at,
    -- sanctioned prescription edit: exercise substitution
    exercise_name,
    muscle_group
) on public.exercise_sets to authenticated;

comment on column public.exercise_sets.target_weight_kg is
    'Prescription. Write-once at generation — UPDATE is revoked for authenticated (migration 026).';
comment on column public.exercise_sets.target_reps is
    'Prescription. Write-once at generation — UPDATE is revoked for authenticated (migration 026).';
comment on column public.exercise_sets.target_rir is
    'Prescription. Write-once at generation — UPDATE is revoked for authenticated (migration 026).';
comment on column public.exercise_sets.notes is
    'Generation-owned commentary (tempo, AMRAP, benchmark markers). UPDATE revoked (migration 026).';
