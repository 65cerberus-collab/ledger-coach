-- ────────────────────────────────────────────────────────────────
-- 00_helpers.sql
-- ────────────────────────────────────────────────────────────────
-- Purpose: pgTAP test-suite foundation. Installs the `tests` schema
--          containing auth-simulation helpers and fixture creators
--          that per-table RLS test files (01_*.sql … 09_*.sql) call
--          inside their own BEGIN/ROLLBACK transactions.
--
-- How to apply: paste this file ONCE into the Supabase SQL Editor and
--               run it, just like a migration. It is NOT wrapped in
--               BEGIN/ROLLBACK — its effects must persist. The script
--               is fully idempotent (CREATE OR REPLACE / IF NOT
--               EXISTS) and safe to re-run.
--
-- Date: 2026-04-28
--
-- Functions installed in `tests`:
--   authenticate_as(uuid)     — simulate a signed-in coach via JWT GUCs + role.
--   authenticate_as_anon()    — simulate an unauthenticated request.
--   clear_authentication()    — drop back to postgres (for privileged setup).
--   create_user(text)         — insert a row in auth.users; returns user_id.
--   create_coach(uuid)        — insert public.coaches; returns coaches.id.
--   create_client(uuid)       — insert public.clients; returns clients.id.
--   create_workout(uuid)      — insert public.workouts; returns workouts.id.
--   create_exercise(uuid)     — insert custom public.exercises; returns exercises.id.
-- ────────────────────────────────────────────────────────────────

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;

grant usage on schema tests to postgres, authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────
-- Auth simulation (SECURITY INVOKER)
-- ────────────────────────────────────────────────────────────────
-- These run with the caller's privileges and mutate the GUCs that
-- auth.uid() and the `authenticated`/`anon` roles read from. Use
-- set_config(..., true) (transaction-local) plus SET LOCAL ROLE so
-- the effect is wholly contained within the surrounding transaction
-- the test file opens with BEGIN.

create or replace function tests.authenticate_as(user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', user_id::text,
      'role', 'authenticated'
    )::text,
    true
  );
  set local role authenticated;
end;
$$;

comment on function tests.authenticate_as(uuid) is
  'Simulate an authenticated request from the given auth.users.id. Sets request.jwt.claims (so auth.uid() returns user_id) and SET LOCAL ROLE authenticated so RLS policies fire as if the request came from that user. Transaction-local: effects are reverted at COMMIT/ROLLBACK.';

create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
end;
$$;

comment on function tests.authenticate_as_anon() is
  'Simulate an unauthenticated request. Clears request.jwt.claims (auth.uid() returns NULL) and SET LOCAL ROLE anon.';

create or replace function tests.clear_authentication()
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  set local role postgres;
end;
$$;

comment on function tests.clear_authentication() is
  'Drop back to the postgres role for privileged fixture setup (e.g. between authenticated assertions). Clears request.jwt.claims and SET LOCAL ROLE postgres.';

-- ────────────────────────────────────────────────────────────────
-- Fixture creators (SECURITY DEFINER)
-- ────────────────────────────────────────────────────────────────
-- These run with the function owner's privileges (postgres in
-- Supabase) so they can bypass RLS during setup and insert into
-- auth.users. Test files call them from any role.

create or replace function tests.create_user(email text default null)
returns uuid
language plpgsql
security definer
set search_path = auth, pg_temp
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email   text := coalesce(
    email,
    'test_' || replace(v_user_id::text, '-', '') || '@example.test'
  );
begin
  -- Populate every column auth.users may demand as NOT NULL across
  -- supported Supabase versions. Defaults are deliberately defensive
  -- so this works even if newer GoTrue revisions tighten constraints.
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    false,
    false
  );

  return v_user_id;
end;
$$;

comment on function tests.create_user(text) is
  'Insert a row into auth.users with sensible test defaults; returns the new user_id. SECURITY DEFINER so it bypasses RLS / privilege restrictions on auth.users.';

create or replace function tests.create_coach(user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id  uuid := user_id;
  v_coach_id uuid;
begin
  if v_user_id is null then
    v_user_id := tests.create_user();
  end if;

  insert into public.coaches (user_id, name)
  values (v_user_id, 'Test Coach ' || substr(v_user_id::text, 1, 8))
  returning id into v_coach_id;

  return v_coach_id;
end;
$$;

comment on function tests.create_coach(uuid) is
  'Insert a public.coaches row tied to the given auth user (or a freshly created one if NULL); returns coaches.id (NOT user_id).';

create or replace function tests.create_client(coach_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client_id uuid;
begin
  insert into public.clients (coach_id, name, level)
  values (coach_id, 'Test Client ' || substr(coach_id::text, 1, 8), 'beginner')
  returning id into v_client_id;

  return v_client_id;
end;
$$;

comment on function tests.create_client(uuid) is
  'Insert a public.clients row owned by the given coach_id with sensible test defaults; returns clients.id.';

create or replace function tests.create_workout(coach_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workout_id uuid;
begin
  insert into public.workouts (coach_id, name, date)
  values (coach_id, 'Test Workout ' || substr(coach_id::text, 1, 8), current_date)
  returning id into v_workout_id;

  return v_workout_id;
end;
$$;

comment on function tests.create_workout(uuid) is
  'Insert a public.workouts row owned by the given coach_id (no client, not a template); returns workouts.id.';

create or replace function tests.create_exercise(coach_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exercise_id uuid;
begin
  insert into public.exercises (coach_id, name, movement, is_seed)
  values (
    coach_id,
    'Test Exercise ' || replace(gen_random_uuid()::text, '-', ''),
    'push',
    false
  )
  returning id into v_exercise_id;

  return v_exercise_id;
end;
$$;

comment on function tests.create_exercise(uuid) is
  'Insert a custom (is_seed=false) public.exercises row owned by the given coach_id; returns exercises.id. Seed library exercises are pre-installed and should be referenced via SELECT, not via this helper.';

-- ────────────────────────────────────────────────────────────────
-- Install complete. Verify with:
--   SELECT proname FROM pg_proc
--    WHERE pronamespace = 'tests'::regnamespace
--    ORDER BY proname;
-- Expected rows:
--   authenticate_as
--   authenticate_as_anon
--   clear_authentication
--   create_client
--   create_coach
--   create_exercise
--   create_user
--   create_workout
-- ────────────────────────────────────────────────────────────────
