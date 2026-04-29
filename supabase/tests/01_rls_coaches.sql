-- 01_rls_coaches.sql
--
-- pgTAP tests for public.coaches RLS policies (migration 013_rls_coaches.sql).
--
-- coaches is the ROOT of the RLS ownership tree: every other table's policy
-- ultimately resolves ownership through coaches. Therefore these tests cannot
-- use the is_my_coach() helper (it would be circular) and instead assert
-- against auth.uid() = coaches.user_id directly.
--
-- The destructive DELETE (assertion 14) is intentionally run LAST so that
-- earlier UPDATE/DELETE-shielding assertions still have Coach A available.
--
-- Run manually via the Supabase SQL Editor. The whole file is wrapped in a
-- single BEGIN; ... ROLLBACK; so it leaves no residue. Fixture UUIDs are
-- stored via set_config(..., true) (transaction-local GUCs) because temp
-- tables are not reliably visible across statements in the SQL Editor.

BEGIN;

select plan(14);

-- ---------------------------------------------------------------------------
-- Fixtures (stored as transaction-local GUCs)
-- ---------------------------------------------------------------------------
SELECT set_config('test.user_a',  tests.create_user()::text, true);
SELECT set_config('test.coach_a', tests.create_coach(current_setting('test.user_a')::uuid)::text, true);

SELECT set_config('test.user_b',  tests.create_user()::text, true);
SELECT set_config('test.coach_b', tests.create_coach(current_setting('test.user_b')::uuid)::text, true);

SELECT set_config('test.user_c',  tests.create_user()::text, true);
-- No coach for user_c; user_c is used to test INSERT.

-- Initialize TAP results accumulator. The Supabase SQL Editor only displays
-- the last query's result, so we collect every is()/throws_ok() output into
-- a single GUC and emit it just before finish() (which returns 0 rows on
-- pass and would otherwise hide all 14 assertion lines).
SELECT set_config('test.results', '', true);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- 1. Sanity check (postgres role bypasses RLS)
-- ---------------------------------------------------------------------------
SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT count(*)::int FROM public.coaches),
        2,
        'Sanity: postgres sees both fixture coaches'
    ),
    true
);

-- ---------------------------------------------------------------------------
-- SELECT policies (assertions 2-4)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT count(*)::int FROM public.coaches),
        1,
        'Coach A sees exactly 1 row'
    ),
    true
);

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT count(*)::int FROM public.coaches WHERE id = current_setting('test.coach_b')::uuid),
        0,
        'Coach A cannot see Coach B'
    ),
    true
);

SELECT tests.authenticate_as_anon();

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT count(*)::int FROM public.coaches),
        0,
        'Anon sees 0 rows'
    ),
    true
);

-- ---------------------------------------------------------------------------
-- INSERT policies (assertions 5-7)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_c')::uuid);

INSERT INTO public.coaches(user_id, name)
VALUES (current_setting('test.user_c')::uuid, 'Coach C');

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT count(*)::int FROM public.coaches WHERE user_id = current_setting('test.user_c')::uuid),
        1,
        'Coach C inserted own row'
    ),
    true
);

SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || throws_ok(
        $$ INSERT INTO public.coaches(user_id, name) VALUES (current_setting('test.user_b')::uuid, 'fake') $$,
        '42501',
        NULL,
        'Coach A cannot insert pointing to User B'
    ),
    true
);

SELECT tests.authenticate_as_anon();

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || throws_ok(
        $$ INSERT INTO public.coaches(user_id, name) VALUES (gen_random_uuid(), 'fake') $$,
        '42501',
        NULL,
        'Anon cannot insert'
    ),
    true
);

-- ---------------------------------------------------------------------------
-- UPDATE policies (assertions 8-10)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

UPDATE public.coaches
SET name = 'updated_name'
WHERE id = current_setting('test.coach_a')::uuid;

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT name FROM public.coaches WHERE id = current_setting('test.coach_a')::uuid),
        'updated_name',
        'Coach A updated own name'
    ),
    true
);

-- A attempts to update B's row (silently filtered out by RLS, no error)
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

UPDATE public.coaches
SET name = 'hacked'
WHERE id = current_setting('test.coach_b')::uuid;

SELECT tests.clear_authentication();

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT name FROM public.coaches WHERE id = current_setting('test.coach_b')::uuid),
        'Test Coach ' || substr(current_setting('test.user_b'), 1, 8),
        'Coach B name unchanged after A''s attempted update'
    ),
    true
);

-- Anon attempts to update A's row
SELECT tests.authenticate_as_anon();

UPDATE public.coaches
SET name = 'hacked'
WHERE id = current_setting('test.coach_a')::uuid;

SELECT tests.clear_authentication();

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT name FROM public.coaches WHERE id = current_setting('test.coach_a')::uuid),
        'updated_name',
        'Coach A name unchanged after anon update'
    ),
    true
);

-- ---------------------------------------------------------------------------
-- DELETE policies — non-destructive (assertions 11-12)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

DELETE FROM public.coaches
WHERE id = current_setting('test.coach_b')::uuid;

SELECT tests.clear_authentication();

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT count(*)::int FROM public.coaches WHERE id = current_setting('test.coach_b')::uuid),
        1,
        'Coach B still exists after A''s attempted delete'
    ),
    true
);

SELECT tests.authenticate_as_anon();

DELETE FROM public.coaches
WHERE id = current_setting('test.coach_a')::uuid;

SELECT tests.clear_authentication();

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT count(*)::int FROM public.coaches WHERE id = current_setting('test.coach_a')::uuid),
        1,
        'Coach A still exists after anon delete'
    ),
    true
);

-- ---------------------------------------------------------------------------
-- UNIQUE constraint on coaches.user_id (assertion 13)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || throws_ok(
        $$ INSERT INTO public.coaches(user_id, name) VALUES (current_setting('test.user_a')::uuid, 'duplicate') $$,
        '23505',
        NULL,
        'Cannot insert second coach row for same user_id (UNIQUE)'
    ),
    true
);

-- ---------------------------------------------------------------------------
-- DELETE policy — destructive (assertion 14, runs LAST)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

DELETE FROM public.coaches
WHERE id = current_setting('test.coach_a')::uuid;

SELECT tests.clear_authentication();

SELECT set_config(
    'test.results',
    current_setting('test.results') || E'\n' || is(
        (SELECT count(*)::int FROM public.coaches WHERE id = current_setting('test.coach_a')::uuid),
        0,
        'Coach A successfully deleted own row'
    ),
    true
);

-- ---------------------------------------------------------------------------
-- Emit accumulated TAP output as the second-to-last query so the SQL Editor
-- displays all 14 assertion lines (finish() returns 0 rows on full pass).
SELECT current_setting('test.results') AS tap_output;

SELECT * FROM finish();

ROLLBACK;
