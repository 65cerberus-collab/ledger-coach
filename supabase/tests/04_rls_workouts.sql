-- 04_rls_workouts.sql
--
-- pgTAP tests for public.workouts RLS policies (migration 016_rls_workouts.sql).
--
-- Ownership pattern: direct ([workouts.coach](http://workouts.coach)_id is NOT NULL and references
-- public.coaches). Templates, self-directed sessions, and client-attached
-- workouts all gate on coach_id alone -- the migration explicitly states
-- "the same own-coach check covers all workout shapes" -- so there is no
-- separate is_template/is_self_directed/client_id policy variation to test.
--
-- Helper rows (tests.create_workout) come back as is_self_directed=true.
-- Assertion 5's raw INSERT uses is_self_directed=false, is_template=false
-- to exercise a different workout shape than the fixture rows.
--
-- Assertion 11 covers the WITH CHECK guard on UPDATE: a coach cannot
-- reassign one of their own workouts to another coach mid-update.
--
-- The destructive DELETE (assertion 14) is intentionally run LAST so that
-- earlier UPDATE/DELETE-shielding assertions still have workout_a1 available.
--
-- Run manually via the Supabase SQL Editor. The whole file is wrapped in a
-- single BEGIN; ... ROLLBACK; so it leaves no residue.

BEGIN;

select plan(14);

-- ---------------------------------------------------------------------------
-- Fixtures (transaction-local GUCs)
-- ---------------------------------------------------------------------------
SELECT set_config('test.user_a',     tests.create_user()::text, true);
SELECT set_config('[test.coach](http://test.coach)_a',    tests.create_coach(current_setting('test.user_a')::uuid)::text, true);
SELECT set_config('test.workout_a1', tests.create_workout(current_setting('[test.coach](http://test.coach)_a')::uuid)::text, true);

SELECT set_config('test.user_b',     tests.create_user()::text, true);
SELECT set_config('[test.coach](http://test.coach)_b',    tests.create_coach(current_setting('test.user_b')::uuid)::text, true);
SELECT set_config('test.workout_b1', tests.create_workout(current_setting('[test.coach](http://test.coach)_b')::uuid)::text, true);

-- Capture original workout names for "unchanged" assertions.
SELECT set_config('test.workout_a1_name',
    (SELECT name FROM public.workouts WHERE id = current_setting('test.workout_a1')::uuid),
    true);
SELECT set_config('test.workout_b1_name',
    (SELECT name FROM public.workouts WHERE id = current_setting('test.workout_b1')::uuid),
    true);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- 1. Sanity check (postgres role bypasses RLS)
-- ---------------------------------------------------------------------------
SELECT is(
    (SELECT count(*)::int FROM public.workouts),
    2,
    'Sanity: postgres sees both fixture workouts'
);

-- ---------------------------------------------------------------------------
-- SELECT policies (assertions 2-4)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT is(
    (SELECT count(*)::int FROM public.workouts),
    1,
    'Coach A sees exactly 1 workout'
);

SELECT is(
    (SELECT count(*)::int FROM public.workouts WHERE id = current_setting('test.workout_b1')::uuid),
    0,
    'Coach A cannot see Coach B''s workout'
);

SELECT tests.authenticate_as_anon();

SELECT is(
    (SELECT count(*)::int FROM public.workouts),
    0,
    'Anon sees 0 workouts'
);

-- ---------------------------------------------------------------------------
-- INSERT policies (assertions 5-7)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

INSERT INTO public.workouts(coach_id, name, date, is_self_directed, is_template)
VALUES (current_setting('[test.coach](http://test.coach)_a')::uuid, 'A2 workout', current_date, false, false);

SELECT is(
    (SELECT count(*)::int FROM public.workouts WHERE coach_id = current_setting('[test.coach](http://test.coach)_a')::uuid),
    2,
    'Coach A inserted own workout (different shape than fixture)'
);

SELECT throws_ok(
    $$ INSERT INTO public.workouts(coach_id, name, date, is_self_directed, is_template) VALUES (current_setting('[test.coach](http://test.coach)_b')::uuid, 'fake', current_date, false, false) $$,
    '42501',
    NULL,
    'Coach A cannot insert pointing to Coach B'
);

SELECT tests.authenticate_as_anon();

SELECT throws_ok(
    $$ INSERT INTO public.workouts(coach_id, name, date, is_self_directed, is_template) VALUES (gen_random_uuid(), 'fake', current_date, false, false) $$,
    '42501',
    NULL,
    'Anon cannot insert'
);

-- ---------------------------------------------------------------------------
-- UPDATE policies (assertions 8-11)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

UPDATE public.workouts
SET name = 'updated_name'
WHERE id = current_setting('test.workout_a1')::uuid;

SELECT is(
    (SELECT name FROM public.workouts WHERE id = current_setting('test.workout_a1')::uuid),
    'updated_name',
    'Coach A updated own workout name'
);

SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

UPDATE public.workouts
SET name = 'hacked'
WHERE id = current_setting('test.workout_b1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT name FROM public.workouts WHERE id = current_setting('test.workout_b1')::uuid),
    current_setting('test.workout_b1_name'),
    'Coach B workout unchanged after Coach A''s attempted update'
);

SELECT tests.authenticate_as_anon();

UPDATE public.workouts
SET name = 'hacked'
WHERE id = current_setting('test.workout_a1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT name FROM public.workouts WHERE id = current_setting('test.workout_a1')::uuid),
    'updated_name',
    'Coach A workout unchanged after anon attempted update'
);

SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT throws_ok(
    $$ UPDATE public.workouts SET coach_id = current_setting('[test.coach](http://test.coach)_b')::uuid WHERE id = current_setting('test.workout_a1')::uuid $$,
    '42501',
    NULL,
    'Coach A cannot reassign own workout to Coach B (WITH CHECK)'
);

-- ---------------------------------------------------------------------------
-- DELETE policies (assertions 12-14)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

DELETE FROM public.workouts
WHERE id = current_setting('test.workout_b1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.workouts WHERE id = current_setting('test.workout_b1')::uuid),
    1,
    'Coach B workout still exists after Coach A''s attempted delete'
);

SELECT tests.authenticate_as_anon();

DELETE FROM public.workouts
WHERE id = current_setting('test.workout_a1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.workouts WHERE id = current_setting('test.workout_a1')::uuid),
    1,
    'Coach A workout still exists after anon attempted delete'
);

SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

DELETE FROM public.workouts
WHERE id = current_setting('test.workout_a1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.workouts WHERE id = current_setting('test.workout_a1')::uuid),
    0,
    'Coach A successfully deleted own workout'
);

SELECT * FROM finish();

ROLLBACK;
