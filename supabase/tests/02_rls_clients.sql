-- 02_rls_clients.sql
--
-- pgTAP tests for public.clients RLS policies (migration 014_rls_clients.sql).
--
-- Ownership pattern: direct ([clients.coach](http://clients.coach)_id is NOT NULL and references
-- public.coaches). All four policies delegate to [public.is](http://public.is)_my_coach(coach_id),
-- so naming uses the _own_coach suffix convention.
--
-- Assertion 11 covers the WITH CHECK guard on UPDATE: a coach cannot reassign
-- one of their own clients to another coach mid-update. This is the one case
-- unique to delegated own-coach tables and absent from 01_rls_coaches.sql.
--
-- The destructive DELETE (assertion 14) is intentionally run LAST so that
-- earlier UPDATE/DELETE-shielding assertions still have client_a1 available.
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
SELECT set_config('test.user_a',    tests.create_user()::text, true);
SELECT set_config('[test.coach](http://test.coach)_a',   tests.create_coach(current_setting('test.user_a')::uuid)::text, true);
SELECT set_config('test.client_a1', tests.create_client(current_setting('[test.coach](http://test.coach)_a')::uuid)::text, true);

SELECT set_config('test.user_b',    tests.create_user()::text, true);
SELECT set_config('[test.coach](http://test.coach)_b',   tests.create_coach(current_setting('test.user_b')::uuid)::text, true);
SELECT set_config('test.client_b1', tests.create_client(current_setting('[test.coach](http://test.coach)_b')::uuid)::text, true);

SELECT tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- 1. Sanity check (postgres role bypasses RLS)
-- ---------------------------------------------------------------------------
SELECT is(
    (SELECT count(*)::int FROM public.clients),
    2,
    'Sanity: postgres sees both fixture clients'
);

-- ---------------------------------------------------------------------------
-- SELECT policies (assertions 2-4)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT is(
    (SELECT count(*)::int FROM public.clients),
    1,
    'Coach A sees exactly 1 client'
);

SELECT is(
    (SELECT count(*)::int FROM public.clients WHERE id = current_setting('test.client_b1')::uuid),
    0,
    'Coach A cannot see Coach B''s client'
);

SELECT tests.authenticate_as_anon();

SELECT is(
    (SELECT count(*)::int FROM public.clients),
    0,
    'Anon sees 0 clients'
);

-- ---------------------------------------------------------------------------
-- INSERT policies (assertions 5-7)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

INSERT INTO public.clients(coach_id, name, level)
VALUES (current_setting('[test.coach](http://test.coach)_a')::uuid, 'Client A2', 'beginner');

SELECT is(
    (SELECT count(*)::int FROM public.clients WHERE coach_id = current_setting('[test.coach](http://test.coach)_a')::uuid),
    2,
    'Coach A inserted own client'
);

SELECT throws_ok(
    $$ INSERT INTO public.clients(coach_id, name, level) VALUES (current_setting('[test.coach](http://test.coach)_b')::uuid, 'fake', 'beginner') $$,
    '42501',
    NULL,
    'Coach A cannot insert pointing to Coach B'
);

SELECT tests.authenticate_as_anon();

SELECT throws_ok(
    $$ INSERT INTO public.clients(coach_id, name, level) VALUES (gen_random_uuid(), 'fake', 'beginner') $$,
    '42501',
    NULL,
    'Anon cannot insert'
);

-- ---------------------------------------------------------------------------
-- UPDATE policies (assertions 8-11)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

UPDATE public.clients
SET name = 'updated_name'
WHERE id = current_setting('test.client_a1')::uuid;

SELECT is(
    (SELECT name FROM public.clients WHERE id = current_setting('test.client_a1')::uuid),
    'updated_name',
    'Coach A updated own client name'
);

-- A attempts to update B's client (silently filtered by RLS, no error)
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

UPDATE public.clients
SET name = 'hacked'
WHERE id = current_setting('test.client_b1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT name FROM public.clients WHERE id = current_setting('test.client_b1')::uuid),
    'Test Client ' || substr(current_setting('[test.coach](http://test.coach)_b'), 1, 8),
    'Coach B client name unchanged after A''s attempted update'
);

-- Anon attempts to update A's client
SELECT tests.authenticate_as_anon();

UPDATE public.clients
SET name = 'hacked'
WHERE id = current_setting('test.client_a1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT name FROM public.clients WHERE id = current_setting('test.client_a1')::uuid),
    'updated_name',
    'Coach A client name unchanged after anon update'
);

-- WITH CHECK guard: A cannot reassign own client to Coach B mid-update.
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

SELECT throws_ok(
    $$ UPDATE public.clients SET coach_id = current_setting('[test.coach](http://test.coach)_b')::uuid WHERE id = current_setting('test.client_a1')::uuid $$,
    '42501',
    NULL,
    'Coach A cannot reassign own client to Coach B (WITH CHECK)'
);

-- ---------------------------------------------------------------------------
-- DELETE policies — non-destructive (assertions 12-13)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

DELETE FROM public.clients
WHERE id = current_setting('test.client_b1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.clients WHERE id = current_setting('test.client_b1')::uuid),
    1,
    'Coach B client still exists after A''s attempted delete'
);

SELECT tests.authenticate_as_anon();

DELETE FROM public.clients
WHERE id = current_setting('test.client_a1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.clients WHERE id = current_setting('test.client_a1')::uuid),
    1,
    'Coach A client still exists after anon delete'
);

-- ---------------------------------------------------------------------------
-- DELETE policy — destructive (assertion 14, runs LAST)
-- ---------------------------------------------------------------------------
SELECT tests.authenticate_as(current_setting('test.user_a')::uuid);

DELETE FROM public.clients
WHERE id = current_setting('test.client_a1')::uuid;

SELECT tests.clear_authentication();

SELECT is(
    (SELECT count(*)::int FROM public.clients WHERE id = current_setting('test.client_a1')::uuid),
    0,
    'Coach A successfully deleted own client'
);

-- ---------------------------------------------------------------------------
SELECT * FROM finish();

ROLLBACK;
