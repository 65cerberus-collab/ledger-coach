-- ────────────────────────────────────────────────────────────────
-- 09_rls_profiles.sql
-- ────────────────────────────────────────────────────────────────
-- pgTAP RLS test suite for public.profiles.
--
-- Reference:
--   supabase/migrations/021_rls_profiles.sql  (policies under test)
--   supabase/migrations/011_profiles_table.sql (schema)
--   supabase/tests/00_helpers.sql              (fixture creators)
--
-- Ownership pattern: auth-user direct (user_id = auth.uid()).
-- This file therefore uses the <table>_<verb>_own naming exception
-- (matching 01_rls_coaches.sql), not _own_coach.
--
-- Policies under test:
--   profiles_select_own  SELECT TO authenticated USING  (user_id = auth.uid())
--   profiles_insert_own  INSERT TO authenticated WITH CHECK (user_id = auth.uid())
--   profiles_update_own  UPDATE TO authenticated USING (...) WITH CHECK (...)
--   profiles_delete_own  DELETE TO authenticated USING  (user_id = auth.uid())
--
-- Verb-level RLS expectations (relevant to the T6/T12 asymmetry):
--   INSERT with no matching policy  → 42501 (errors; cannot be filtered)
--   UPDATE/DELETE w/ no matching policy → 0 rows affected (silently filtered)
--   SELECT with no matching policy  → 0 rows visible (silently filtered)
--
-- How to apply: paste this file into the Supabase SQL Editor with the
-- RLS toggle off (postgres superuser). The outer BEGIN plus the closing
-- RAISE EXCEPTION guarantee no fixture data persists.
-- ────────────────────────────────────────────────────────────────

begin;

select plan(12);

-- ────────────────────────────────────────────────────────────────
-- Result accumulator
-- ────────────────────────────────────────────────────────────────
-- The SQL Editor renders only the last statement's result, so each
-- assertion's text return is captured into a temp table and surfaced
-- as a bundle by the closing DO block. Grants are needed because
-- INSERTs run under the role the test is authenticated as.
create temp table tap_results (line_no serial primary key, result text);
grant insert, select on tap_results to authenticated, anon;
grant usage on sequence tap_results_line_no_seq to authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- Fixtures
-- ────────────────────────────────────────────────────────────────
-- Three users; profiles for A and B only. C is intentionally
-- profile-less so T4 can insert without colliding with the user_id PK.
create temp table fx (user_a uuid, user_b uuid, user_c uuid);
grant select on fx to public;

insert into fx (user_a, user_b, user_c) values (
  tests.create_user(),
  tests.create_user(),
  tests.create_user()
);

-- create_profile is SECURITY DEFINER → bypasses RLS for setup.
select tests.create_profile((select user_a from fx));
select tests.create_profile((select user_b from fx));

-- ────────────────────────────────────────────────────────────────
-- SELECT (T1–T3)
-- ────────────────────────────────────────────────────────────────

select tests.authenticate_as((select user_a from fx));

-- T1: A sees exactly own row.
insert into tap_results (result)
select is(
  (select count(*)::int from public.profiles),
  1,
  'T1 SELECT: user_a sees exactly one profile row (own)'
);

-- T2: A cannot see B's row.
insert into tap_results (result)
select is(
  (select count(*)::int from public.profiles
    where user_id = (select user_b from fx)),
  0,
  'T2 SELECT: user_a cannot see user_b''s profile'
);

select tests.clear_authentication();
select tests.authenticate_as_anon();

-- T3: anon sees nothing (no TO anon select policy).
insert into tap_results (result)
select is(
  (select count(*)::int from public.profiles),
  0,
  'T3 SELECT: anon sees zero profile rows'
);

select tests.clear_authentication();

-- ────────────────────────────────────────────────────────────────
-- INSERT (T4–T6)
-- ────────────────────────────────────────────────────────────────

select tests.authenticate_as((select user_c from fx));

-- T4: C inserts own profile (top-level CTE returning row count).
with ins as (
  insert into public.profiles (user_id)
  values ((select user_c from fx))
  returning 1
)
insert into tap_results (result)
select is(
  (select count(*)::int from ins),
  1,
  'T4 INSERT: user_c inserts own profile (1 row written)'
);

-- T5: C cannot insert with A's user_id (with-check → 42501).
insert into tap_results (result)
select throws_ok(
  $q$ insert into public.profiles (user_id) values ((select user_a from fx)) $q$,
  '42501'::char(5),
  null::text,
  'T5 INSERT: user_c cannot insert with user_id = user_a (with-check)'
);

select tests.clear_authentication();
select tests.authenticate_as_anon();

-- T6: anon insert errors (no TO anon insert policy → 42501).
-- Asymmetric with T12: INSERT cannot be silently filtered.
insert into tap_results (result)
select throws_ok(
  $q$ insert into public.profiles (user_id) values ((select user_c from fx)) $q$,
  '42501'::char(5),
  null::text,
  'T6 INSERT: anon cannot insert (no TO anon insert policy)'
);

select tests.clear_authentication();

-- ────────────────────────────────────────────────────────────────
-- UPDATE (T7–T9)
-- ────────────────────────────────────────────────────────────────

select tests.authenticate_as((select user_a from fx));

-- T7: A updates own row's schema_version (top-level CTE).
with upd as (
  update public.profiles
     set schema_version = 8
   where user_id = (select user_a from fx)
  returning 1
)
insert into tap_results (result)
select is(
  (select count(*)::int from upd),
  1,
  'T7 UPDATE: user_a updates own profile (1 row affected)'
);

-- T8: A cannot reassign user_id mid-update (with-check → 42501).
insert into tap_results (result)
select throws_ok(
  $q$
    update public.profiles
       set user_id = (select user_b from fx)
     where user_id = (select user_a from fx)
  $q$,
  '42501'::char(5),
  null::text,
  'T8 UPDATE: user_a cannot reassign own user_id to user_b (with-check)'
);

-- T9: A's update of B's row affects 0 rows (USING filters silently).
with upd as (
  update public.profiles
     set schema_version = 9
   where user_id = (select user_b from fx)
  returning 1
)
insert into tap_results (result)
select is(
  (select count(*)::int from upd),
  0,
  'T9 UPDATE: user_a''s update of user_b''s row affects 0 rows (filtered)'
);

select tests.clear_authentication();

-- ────────────────────────────────────────────────────────────────
-- DELETE (T10–T12)
-- ────────────────────────────────────────────────────────────────

select tests.authenticate_as((select user_a from fx));

-- T10: A's delete of B's row affects 0 rows (USING filters silently).
with del as (
  delete from public.profiles
   where user_id = (select user_b from fx)
  returning 1
)
insert into tap_results (result)
select is(
  (select count(*)::int from del),
  0,
  'T10 DELETE: user_a''s delete of user_b''s row affects 0 rows (filtered)'
);

-- T11: A deletes own row.
with del as (
  delete from public.profiles
   where user_id = (select user_a from fx)
  returning 1
)
insert into tap_results (result)
select is(
  (select count(*)::int from del),
  1,
  'T11 DELETE: user_a deletes own profile (1 row affected)'
);

select tests.clear_authentication();
select tests.authenticate_as_anon();

-- T12: anon delete affects 0 rows (no TO anon delete policy → silently
-- filtered by the absent USING; asymmetric with T6, where INSERT errors).
with del as (
  delete from public.profiles
   where user_id = (select user_b from fx)
  returning 1
)
insert into tap_results (result)
select is(
  (select count(*)::int from del),
  0,
  'T12 DELETE: anon delete affects 0 rows (filtered)'
);

select tests.clear_authentication();

-- ────────────────────────────────────────────────────────────────
-- Surface accumulated TAP output
-- ────────────────────────────────────────────────────────────────
-- RAISE EXCEPTION bundles every assertion line plus finish()'s summary
-- into a single visible payload AND triggers transaction rollback in
-- one move. The trailing ROLLBACK is unreachable but kept as
-- documentation of intent.

do $$
declare
  v_line   text;
  v_bundle text := E'\npgTAP results for 09_rls_profiles.sql\n';
begin
  for v_line in select result from tap_results order by line_no loop
    v_bundle := v_bundle || v_line || E'\n';
  end loop;

  for v_line in select * from finish() loop
    v_bundle := v_bundle || v_line || E'\n';
  end loop;

  raise exception E'%', v_bundle;
end;
$$;

rollback;
