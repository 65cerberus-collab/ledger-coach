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
-- single BEGIN; ... ROLLBACK; so it leaves no residue.

BEGIN;

select plan(14);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE fixture(name text PRIMARY KEY, id uuid) ON COMMIT DROP;

INSERT INTO fixture VALUES ('user_a',  tests.create_user());
INSERT INTO fixture VALUES ('coach_a', tests.create_coach((SELECT id FROM fixture WHERE name = 'user_a')));

INSERT INTO fixture VALUES ('user_b',  tests.create_user());
INSERT INTO fixture VALUES ('coach_b', tests.create_coach((SELECT id FROM fixture WHERE name = 'user_b')));

INSERT INTO fixture VALUES ('user_c',  tests.create_user());
-- No coach for user_c; user_c is used to test INSERT.

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- 1. Sanity check (postgres role bypasses RLS)
-- ---------------------------------------------------------------------------
SELECT is(
    (SELECT count(*)::int FROM public.coaches),
    2,
    'Sanity: postgres sees both fixture coaches'
);

-- ---------------------------------------------------------------------------
-- SELECT policies (assertions 2-4)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as((SELECT id FROM fixture WHERE name = 'user_a'));

SELECT is(
    (SELECT count(*)::int FROM public.coaches),
    1,
    'Coach A sees exactly 1 row'
);

SELECT is(
    (SELECT count(*)::int FROM public.coaches WHERE id = (SELECT id FROM fixture WHERE name = 'coach_b')),
    0,
    'Coach A cannot see Coach B'
);

SELECT tests.authenticate_as_anon();

SELECT is(
    (SELECT count(*)::int FROM public.coaches),
    0,
    'Anon sees 0 rows'
);

-- ---------------------------------------------------------------------------
-- INSERT policies (assertions 5-7)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as((SELECT id FROM fixture WHERE name = 'user_c'));

INSERT INTO public.coaches(user_id, name)
VALUES ((SELECT id FROM fixture WHERE name = 'user_c'), 'Coach C');

SELECT is(
    (SELECT count(*)::int FROM public.coaches WHERE user_id = (SELECT id FROM fixture WHERE name = 'user_c')),
    1,
    'Coach C inserted own row'
);

SELECT tests.authenticate_as((SELECT id FROM fixture WHERE name = 'user_a'));

SELECT throws_ok(
    $$ INSERT INTO public.coaches(user_id, name) VALUES ((SELECT id FROM fixture WHERE name = 'user_b'), 'fake') $$,
    '42501',
    NULL,
    'Coach A cannot insert pointing to User B'
);

SELECT tests.authenticate_as_anon();

SELECT throws_ok(
    $$ INSERT INTO public.coaches(user_id, name) VALUES (gen_random_uuid(), 'fake') $$,
    '42501',
    NULL,
    'Anon cannot insert'
);

-- ---------------------------------------------------------------------------
-- UPDATE policies (assertions 8-10)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as((SELECT id FROM fixture WHERE name = 'user_a'));

UPDATE public.coaches
SET name = 'updated_name'
WHERE id = (SELECT id FROM fixture WHERE name = 'coach_a');

SELECT is(
    (SELECT name FROM public.coaches WHERE id = (SELECT id FROM fixture WHERE name = 'coach_a')),
    'updated_name',
    'Coach A updated own name'
);

-- A attempts to update B's row (silently filtered out by RLS, no error)
SELECT tests.authenticate_as((SELECT id FROM fixture WHERE name = 'user_a'));

UPDATE public.coaches
SET name = 'hacked'
WHERE id = (SELECT id FROM fixture WHERE name = 'coach_b');

SELECT tests.clear_authentication();

SELECT is(
    (SELECT name FROM public.coaches WHERE id = (SELECT id FROM fixture WHERE name = 'coach_b')),
    'Test Coach ' || substr((SELECT id FROM fixture WHERE name = 'user_b')::text, 1, 8),
    'Coach B name unchanged after A''s attempted update'
);

-- Anon attempts to update A's row
SELECT tests.authenticate_as_anon();

UPDATE public.coaches
SET name = 'hacked'
WHERE id = (SELECT id FROM fixture WHERE name = 'coach_a');

SELECT tests.clear_authentication();

SELECT is(
    (SELECT name FROM public.coaches WHERE id = (SELECT id FROM fixture WHERE name = 'coach_a')),
    'updated_name',
    'Coach A name unchanged after anon update'
);

-- ---------------------------------------------------------------------------
-- DELETE policies — non-destructive (assertions 11-12)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as((SELECT id FROM fixture WHERE name = 'user_a'));

DELETE FROM public.coaches
WHERE id = (SELECT id FROM fixture WHERE name = 'coach_b');

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.coaches WHERE id = (SELECT id FROM fixture WHERE name = 'coach_b')),
    1,
    'Coach B still exists after A''s attempted delete'
);

SELECT tests.authenticate_as_anon();

DELETE FROM public.coaches
WHERE id = (SELECT id FROM fixture WHERE name = 'coach_a');

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.coaches WHERE id = (SELECT id FROM fixture WHERE name = 'coach_a')),
    1,
    'Coach A still exists after anon delete'
);

-- ---------------------------------------------------------------------------
-- UNIQUE constraint on coaches.user_id (assertion 13)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as((SELECT id FROM fixture WHERE name = 'user_a'));

SELECT throws_ok(
    $$ INSERT INTO public.coaches(user_id, name) VALUES ((SELECT id FROM fixture WHERE name = 'user_a'), 'duplicate') $$,
    '23505',
    NULL,
    'Cannot insert second coach row for same user_id (UNIQUE)'
);

-- ---------------------------------------------------------------------------
-- DELETE policy — destructive (assertion 14, runs LAST)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as((SELECT id FROM fixture WHERE name = 'user_a'));

DELETE FROM public.coaches
WHERE id = (SELECT id FROM fixture WHERE name = 'coach_a');

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.coaches WHERE id = (SELECT id FROM fixture WHERE name = 'coach_a')),
    0,
    'Coach A successfully deleted own row'
);

-- ---------------------------------------------------------------------------
SELECT * FROM finish();

ROLLBACK;
