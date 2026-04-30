-- 05_rls_workout_blocks.sql
--
-- pgTAP tests for public.workout_blocks RLS policies
-- (migration 017_rls_workout_blocks.sql).
--
-- Ownership pattern: delegated. workout_blocks has no coach_id of its
-- own; every policy joins through workout_id -> public.workouts and
-- defers ownership to public.is_my_coach(w.coach_id). The tests below
-- exercise each policy (SELECT/INSERT/UPDATE/DELETE) from both the
-- owning coach and a different coach, plus the anonymous role.
--
-- The seed-exercise assertion (section F) pins down a property called
-- out in 017's header comment: workout_blocks.exercise_id is NOT an
-- ownership path, so a block whose exercise is a shared seed row
-- (coach_id IS NULL, is_seed = true) must still be insertable by the
-- workout's owning coach.
--
-- For row-count style assertions on UPDATE/DELETE we wrap the mutation
-- in a CTE with RETURNING 1 and count the result, so the assertion is
-- exactly "the policy let N rows through" rather than an indirect
-- before/after value comparison.
--
-- Run manually via the Supabase SQL Editor. The whole file is wrapped
-- in a single BEGIN; ... ROLLBACK; so it leaves no residue.

BEGIN;

select plan(13);

-- ---------------------------------------------------------------------------
-- Fixtures (transaction-local GUCs, created as postgres so RLS is bypassed)
-- ---------------------------------------------------------------------------
SELECT set_config('test.user_a',     tests.create_user()::text, true);
SELECT set_config('test.coach_a',    tests.create_coach(current_setting('test.user_a')::uuid)::text, true);
SELECT set_config('test.workout_a',  tests.create_workout(current_setting('test.coach_a')::uuid)::text, true);

SELECT set_config('test.user_b',     tests.create_user()::text, true);
SELECT set_config('test.coach_b',    tests.create_coach(current_setting('test.user_b')::uuid)::text, true);
SELECT set_config('test.workout_b',  tests.create_workout(current_setting('test.coach_b')::uuid)::text, true);

-- A custom exercise owned by Coach A (workout_blocks RLS doesn't gate on
-- exercise ownership, so this is just a convenient FK target for setup).
SELECT set_config('test.exercise_a', tests.create_exercise(current_setting('test.coach_a')::uuid)::text, true);

-- The block-under-test (B_A): lives on Coach A's workout. Postgres role
-- bypasses RLS so this insert always succeeds. The CTE-with-RETURNING
-- pattern lets set_config capture the new id without psql meta-commands
-- (this file is run via the Supabase SQL Editor, not psql).
SELECT set_config(
    'test.block_a',
    (WITH ins AS (
         INSERT INTO public.workout_blocks (workout_id, exercise_id, position, notes)
         VALUES (
             current_setting('test.workout_a')::uuid,
             current_setting('test.exercise_a')::uuid,
             1,
             'original'
         )
         RETURNING id
     ) SELECT id::text FROM ins),
    true
);

-- A second block on Coach A's workout, used by the DELETE assertion so
-- B_A stays available for any later checks.
SELECT set_config(
    'test.block_a_extra',
    (WITH ins AS (
         INSERT INTO public.workout_blocks (workout_id, exercise_id, position, notes)
         VALUES (
             current_setting('test.workout_a')::uuid,
             current_setting('test.exercise_a')::uuid,
             2,
             'extra'
         )
         RETURNING id
     ) SELECT id::text FROM ins),
    true
);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- A. Authenticated SELECT (workout_blocks_select_own_coach)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT is(
    (SELECT count(*)::int FROM public.workout_blocks
        WHERE id = current_setting('test.block_a')::uuid),
    1,
    'A1: Coach A can SELECT own block B_A'
);

SELECT tests.authenticate_as(current_setting('test.user_b')::uuid);

SELECT is(
    (SELECT count(*)::int FROM public.workout_blocks
        WHERE id = current_setting('test.block_a')::uuid),
    0,
    'A2: Coach B cannot SELECT Coach A''s block B_A'
);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- B. Authenticated INSERT (workout_blocks_insert_own_coach)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT lives_ok(
    $$ INSERT INTO public.workout_blocks (workout_id, exercise_id, position)
       VALUES (current_setting('test.workout_a')::uuid,
               current_setting('test.exercise_a')::uuid,
               10) $$,
    'B3: Coach A can INSERT a block onto own workout W_A'
);

SELECT tests.authenticate_as(current_setting('test.user_b')::uuid);

SELECT throws_ok(
    $$ INSERT INTO public.workout_blocks (workout_id, exercise_id, position)
       VALUES (current_setting('test.workout_a')::uuid,
               current_setting('test.exercise_a')::uuid,
               11) $$,
    '42501',
    NULL,
    'B4: Coach B cannot INSERT a block onto Coach A''s workout W_A'
);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- C. Authenticated UPDATE (workout_blocks_update_own_coach)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT is(
    (WITH upd AS (
        UPDATE public.workout_blocks
           SET notes = 'updated_by_a'
         WHERE id = current_setting('test.block_a')::uuid
        RETURNING 1
     ) SELECT count(*)::int FROM upd),
    1,
    'C5: Coach A UPDATE on own block B_A affects 1 row'
);

SELECT tests.authenticate_as(current_setting('test.user_b')::uuid);

SELECT is(
    (WITH upd AS (
        UPDATE public.workout_blocks
           SET notes = 'hacked_by_b'
         WHERE id = current_setting('test.block_a')::uuid
        RETURNING 1
     ) SELECT count(*)::int FROM upd),
    0,
    'C6: Coach B UPDATE on Coach A''s block B_A affects 0 rows (USING filters it out)'
);

SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT throws_ok(
    $$ UPDATE public.workout_blocks
          SET workout_id = current_setting('test.workout_b')::uuid
        WHERE id = current_setting('test.block_a')::uuid $$,
    '42501',
    NULL,
    'C7: Coach A cannot reassign B_A''s workout_id to Coach B''s workout (WITH CHECK)'
);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- D. Authenticated DELETE (workout_blocks_delete_own_coach)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT is(
    (WITH del AS (
        DELETE FROM public.workout_blocks
         WHERE id = current_setting('test.block_a_extra')::uuid
        RETURNING 1
     ) SELECT count(*)::int FROM del),
    1,
    'D8: Coach A DELETE on own block affects 1 row'
);

SELECT tests.authenticate_as(current_setting('test.user_b')::uuid);

SELECT is(
    (WITH del AS (
        DELETE FROM public.workout_blocks
         WHERE id = current_setting('test.block_a')::uuid
        RETURNING 1
     ) SELECT count(*)::int FROM del),
    0,
    'D9: Coach B DELETE on Coach A''s block B_A affects 0 rows'
);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- E. Anonymous role
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as_anon();

SELECT is(
    (SELECT count(*)::int FROM public.workout_blocks),
    0,
    'E10: Anon sees 0 workout_blocks'
);

SELECT throws_ok(
    $$ INSERT INTO public.workout_blocks (workout_id, exercise_id, position)
       VALUES (current_setting('test.workout_a')::uuid,
               current_setting('test.exercise_a')::uuid,
               99) $$,
    '42501',
    NULL,
    'E11: Anon cannot INSERT into workout_blocks'
);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- F. Seed exercise reference (per the comment in 017_rls_workout_blocks.sql:
--    exercise_id is NOT an ownership path, so referencing a seed exercise
--    must NOT be blocked by the workout-rooted ownership check)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT lives_ok(
    $$ INSERT INTO public.workout_blocks (workout_id, exercise_id, position)
       VALUES (
           current_setting('test.workout_a')::uuid,
           (SELECT id FROM public.exercises
             WHERE coach_id IS NULL AND is_seed = true
             LIMIT 1),
           20
       ) $$,
    'F12: Coach A can INSERT a block on W_A that references a shared seed exercise'
);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- G. Force RLS
-- ---------------------------------------------------------------------------
SELECT is(
    (SELECT relforcerowsecurity
       FROM pg_class
      WHERE oid = 'public.workout_blocks'::regclass),
    true,
    'G13: force row level security is enabled on workout_blocks'
);

SELECT * FROM finish();

ROLLBACK;
