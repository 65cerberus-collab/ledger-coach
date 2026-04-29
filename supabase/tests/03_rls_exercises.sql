-- 03_rls_exercises.sql
--
-- pgTAP tests for public.exercises RLS policies (migration 015_rls_exercises.sql).
--
-- Ownership pattern: hybrid. [exercises.coach](http://exercises.coach)_id is NULLABLE.
--   - coach_id IS NULL  → shared seed library, readable by every authenticated
--     coach, immutable to all coaches (227 rows pre-installed live).
--   - coach_id NOT NULL → custom exercise owned by that coach.
--
-- Seed-row immutability is emergent from [public.is](http://public.is)_my_coach(NULL) returning
-- false, NOT from an explicit "coach_id IS NOT NULL" guard in the mutation
-- policies. Assertions 8, 12, 15, and 17 pin down this property.
--
-- Assertion 15 covers the "promote to seed" case: a coach attempts to
-- reassign their own custom to coach_id = NULL. We set is_seed = true in the
-- same UPDATE so the row stays consistent with any (coach_id IS NULL <=>
-- is_seed) CHECK constraint that may exist; that way the failure is
-- unambiguously the RLS WITH CHECK (42501), not a CHECK violation (23514).
--
-- Seed count is captured into test.seed_count at fixture time (rather than
-- hard-coded to 227) so the file stays valid as the seed library grows.
-- Original names are captured (rather than reconstructed from helper
-- formulas) so the "unchanged" assertions don't depend on naming details.
--
-- Run manually via the Supabase SQL Editor. The whole file is wrapped in a
-- single BEGIN; ... ROLLBACK; so it leaves no residue.

BEGIN;

select plan(19);

-- ---------------------------------------------------------------------------
-- Fixtures (transaction-local GUCs)
-- ---------------------------------------------------------------------------
SELECT set_config('test.user_a',      tests.create_user()::text, true);
SELECT set_config('[test.coach](http://test.coach)_a',     tests.create_coach(current_setting('test.user_a')::uuid)::text, true);
SELECT set_config('test.exercise_a1', tests.create_exercise(current_setting('[test.coach](http://test.coach)_a')::uuid)::text, true);

SELECT set_config('test.user_b',      tests.create_user()::text, true);
SELECT set_config('[test.coach](http://test.coach)_b',     tests.create_coach(current_setting('test.user_b')::uuid)::text, true);
SELECT set_config('test.exercise_b1', tests.create_exercise(current_setting('[test.coach](http://test.coach)_b')::uuid)::text, true);

-- Capture original custom names for "unchanged" assertions.
SELECT set_config('test.exercise_a1_name',
    (SELECT name FROM public.exercises WHERE id = current_setting('test.exercise_a1')::uuid),
    true);
SELECT set_config('test.exercise_b1_name',
    (SELECT name FROM public.exercises WHERE id = current_setting('test.exercise_b1')::uuid),
    true);

-- Capture seed-library state.
SELECT set_config('test.seed_count',
    (SELECT count(*)::text FROM public.exercises WHERE coach_id IS NULL),
    true);
SELECT set_config('test.seed_id',
    (SELECT id::text FROM public.exercises WHERE coach_id IS NULL LIMIT 1),
    true);
SELECT set_config('test.seed_orig_name',
    (SELECT name FROM public.exercises WHERE id = current_setting('test.seed_id')::uuid),
    true);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- 1. Sanity check (postgres role bypasses RLS)
-- ---------------------------------------------------------------------------
SELECT is(
    (SELECT count(*)::int FROM public.exercises),
    current_setting('test.seed_count')::int + 2,
    'Sanity: postgres sees seed library plus both fixture customs'
);

-- ---------------------------------------------------------------------------
-- SELECT policies (assertions 2-5)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT is(
    (SELECT count(*)::int FROM public.exercises WHERE coach_id IS NULL),
    current_setting('test.seed_count')::int,
    'Coach A sees all seed-library exercises'
);

SELECT is(
    (SELECT count(*)::int FROM public.exercises WHERE coach_id IS NOT NULL),
    1,
    'Coach A sees exactly 1 custom exercise (own only)'
);

SELECT is(
    (SELECT count(*)::int FROM public.exercises WHERE id = current_setting('test.exercise_b1')::uuid),
    0,
    'Coach A cannot see Coach B''s custom exercise'
);

SELECT tests.authenticate_as_anon();

SELECT is(
    (SELECT count(*)::int FROM public.exercises),
    0,
    'Anon sees 0 exercises (policy is to authenticated)'
);

-- ---------------------------------------------------------------------------
-- INSERT policies (assertions 6-9)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

INSERT INTO public.exercises(coach_id, name, movement, is_seed)
VALUES (current_setting('[test.coach](http://test.coach)_a')::uuid, 'A2 custom', 'pull', false);

SELECT is(
    (SELECT count(*)::int FROM public.exercises WHERE coach_id = current_setting('[test.coach](http://test.coach)_a')::uuid),
    2,
    'Coach A inserted own custom exercise'
);

SELECT throws_ok(
    $$ INSERT INTO public.exercises(coach_id, name, movement, is_seed) VALUES (current_setting('[test.coach](http://test.coach)_b')::uuid, 'fake', 'push', false) $$,
    '42501',
    NULL,
    'Coach A cannot insert pointing to Coach B'
);

-- Pins down "no explicit IS NOT NULL guard needed": is_my_coach(NULL)=false
-- so WITH CHECK rejects seed-shaped inserts.
SELECT throws_ok(
    $$ INSERT INTO public.exercises(coach_id, name, movement, is_seed) VALUES (NULL, 'fake seed', 'push', true) $$,
    '42501',
    NULL,
    'Coach A cannot insert seed-shaped row (coach_id IS NULL)'
);

SELECT tests.authenticate_as_anon();

SELECT throws_ok(
    $$ INSERT INTO public.exercises(coach_id, name, movement, is_seed) VALUES (gen_random_uuid(), 'fake', 'push', false) $$,
    '42501',
    NULL,
    'Anon cannot insert'
);

-- ---------------------------------------------------------------------------
-- UPDATE policies (assertions 10-15)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

UPDATE public.exercises
SET name = 'updated_name'
WHERE id = current_setting('test.exercise_a1')::uuid;

SELECT is(
    (SELECT name FROM public.exercises WHERE id = current_setting('test.exercise_a1')::uuid),
    'updated_name',
    'Coach A updated own custom exercise name'
);

-- A's update of B's custom: silently filtered by USING (no error).
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

UPDATE public.exercises
SET name = 'hacked'
WHERE id = current_setting('test.exercise_b1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT name FROM public.exercises WHERE id = current_setting('test.exercise_b1')::uuid),
    current_setting('test.exercise_b1_name'),
    'Coach B custom unchanged after Coach A''s attempted update'
);

-- A's update of seed row: silently filtered (USING is_my_coach(NULL)=false).
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

UPDATE public.exercises
SET name = 'hacked seed'
WHERE id = current_setting('test.seed_id')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT name FROM public.exercises WHERE id = current_setting('test.seed_id')::uuid),
    current_setting('test.seed_orig_name'),
    'Seed row unchanged after Coach A''s attempted update'
);

-- Anon update of A's custom: silently filtered.
SELECT tests.authenticate_as_anon();

UPDATE public.exercises
SET name = 'hacked'
WHERE id = current_setting('test.exercise_a1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT name FROM public.exercises WHERE id = current_setting('test.exercise_a1')::uuid),
    'updated_name',
    'Coach A custom unchanged after anon attempted update'
);

-- WITH CHECK guard: A cannot reassign own custom to Coach B.
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT throws_ok(
    $$ UPDATE public.exercises SET coach_id = current_setting('[test.coach](http://test.coach)_b')::uuid WHERE id = current_setting('test.exercise_a1')::uuid $$,
    '42501',
    NULL,
    'Coach A cannot reassign own custom to Coach B (WITH CHECK)'
);

-- WITH CHECK guard: A cannot promote own custom to seed.
-- Setting is_seed=true alongside coach_id=NULL keeps the row consistent
-- with any (coach_id IS NULL <=> is_seed) CHECK constraint, so the failure
-- is unambiguously RLS WITH CHECK (42501) and not CHECK violation (23514).
SELECT throws_ok(
    $$ UPDATE public.exercises SET coach_id = NULL, is_seed = true WHERE id = current_setting('test.exercise_a1')::uuid $$,
    '42501',
    NULL,
    'Coach A cannot promote own custom to seed (coach_id NULL, WITH CHECK)'
);

-- ---------------------------------------------------------------------------
-- DELETE policies — non-destructive (assertions 16-18)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

DELETE FROM public.exercises
WHERE id = current_setting('test.exercise_b1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.exercises WHERE id = current_setting('test.exercise_b1')::uuid),
    1,
    'Coach B custom still exists after Coach A''s attempted delete'
);

-- Seed delete silently filtered (USING is_my_coach(NULL)=false).
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

DELETE FROM public.exercises
WHERE id = current_setting('test.seed_id')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.exercises WHERE id = current_setting('test.seed_id')::uuid),
    1,
    'Seed row still exists after Coach A''s attempted delete'
);

SELECT tests.authenticate_as_anon();

DELETE FROM public.exercises
WHERE id = current_setting('test.exercise_a1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.exercises WHERE id = current_setting('test.exercise_a1')::uuid),
    1,
    'Coach A custom still exists after anon attempted delete'
);

-- ---------------------------------------------------------------------------
-- DELETE policy — destructive (assertion 19, runs LAST)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

DELETE FROM public.exercises
WHERE id = current_setting('test.exercise_a1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.exercises WHERE id = current_setting('test.exercise_a1')::uuid),
    0,
    'Coach A successfully deleted own custom exercise'
);

-- ---------------------------------------------------------------------------
SELECT * FROM finish();

ROLLBACK;
