-- ────────────────────────────────────────────────────────────────
-- supabase/tests/08_rls_measurements.sql
-- ────────────────────────────────────────────────────────────────
-- pgTAP coverage for the four delegated own_coach RLS policies on
-- the measurements table (see migration 020_rls_measurements).
--
-- Ownership is delegated through the parent client via client_id;
-- measurements has no coach_id column of its own. Each policy uses
-- an EXISTS subquery against clients and defers the ownership
-- decision to the is_my_coach helper, passed the client's coach_id.
--
-- Run manually via Supabase Dashboard SQL Editor. The whole file
-- runs inside a single transaction and rolls back at the end.
--
-- Note: throws_ok is called with the 4-arg form
--   throws_ok(query, sqlstate, NULL::text, description)
-- The NULL::text in the message slot tells pgTAP to match on
-- SQLSTATE only (skipping the error message comparison) while the
-- 4th argument keeps a custom description in the test name. Without
-- this shape, pgTAP routes the call to a 3-arg overload that treats
-- the 3rd argument as an expected error message and produces
-- spurious failures when the message does not match verbatim.

begin;

select plan(13);

-- ── setup ───────────────────────────────────────────────────────
select tests.clear_authentication();

do $setup$
declare
  v_user_a        uuid;
  v_coach_a       uuid;
  v_client_a      uuid;
  v_measurement_a uuid;
  v_user_b        uuid;
  v_coach_b       uuid;
  v_client_b      uuid;
begin
  v_user_a := tests.create_user();
  perform tests.create_profile(v_user_a);
  v_coach_a  := tests.create_coach(v_user_a);
  v_client_a := tests.create_client(v_coach_a);

  v_user_b := tests.create_user();
  perform tests.create_profile(v_user_b);
  v_coach_b  := tests.create_coach(v_user_b);
  v_client_b := tests.create_client(v_coach_b);

  insert into public.measurements (client_id, date, type, value_lb)
  values (v_client_a, current_date, 'weight', 180.00)
  returning id into v_measurement_a;

  perform set_config('tests.user_a',        v_user_a::text,        true);
  perform set_config('tests.user_b',        v_user_b::text,        true);
  perform set_config('tests.client_a',      v_client_a::text,      true);
  perform set_config('tests.client_b',      v_client_b::text,      true);
  perform set_config('tests.measurement_a', v_measurement_a::text, true);
end
$setup$;

-- ── 1. RLS is enabled and forced ────────────────────────────────
select ok(
  (select relrowsecurity
     from pg_class
    where oid = 'public.measurements'::regclass),
  'rls is enabled on public.measurements'
);

select ok(
  (select relforcerowsecurity
     from pg_class
    where oid = 'public.measurements'::regclass),
  'rls is forced on public.measurements'
);

-- ── 2. SELECT ───────────────────────────────────────────────────
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select is(
  (select count(*)::int
     from public.measurements
    where id = current_setting('tests.measurement_a')::uuid),
  1,
  'select: coach_a sees their own measurement'
);

select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select is(
  (select count(*)::int
     from public.measurements
    where id = current_setting('tests.measurement_a')::uuid),
  0,
  'select: coach_b cannot see coach_a''s measurement'
);

select tests.authenticate_as_anon();

select is(
  (select count(*)::int from public.measurements),
  0,
  'select: anon cannot see any measurements'
);

-- ── 3. INSERT ───────────────────────────────────────────────────
select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select throws_ok(
  format(
    $f$insert into public.measurements (client_id, date, type, value_lb)
       values (%L::uuid, current_date, 'weight', 175.00)$f$,
    current_setting('tests.client_a')
  ),
  '42501'::char(5),
  NULL::text,
  'insert: coach_b cannot insert measurement for coach_a''s client'
);

select tests.authenticate_as_anon();

select throws_ok(
  format(
    $f$insert into public.measurements (client_id, date, type, value_lb)
       values (%L::uuid, current_date, 'weight', 175.00)$f$,
    current_setting('tests.client_a')
  ),
  '42501'::char(5),
  NULL::text,
  'insert: anon cannot insert measurement'
);

select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select lives_ok(
  format(
    $f$insert into public.measurements (client_id, date, type, value_lb)
       values (%L::uuid, current_date, 'weight', 178.00)$f$,
    current_setting('tests.client_a')
  ),
  'insert: coach_a can insert measurement for their own client'
);

-- ── 4. UPDATE ───────────────────────────────────────────────────
with upd as (
  update public.measurements
     set value_lb = 179.00
   where id = current_setting('tests.measurement_a')::uuid
   returning 1
)
select is(
  (select count(*)::int from upd),
  1,
  'update: coach_a can update their own measurement'
);

select tests.authenticate_as(current_setting('tests.user_b')::uuid);

with upd as (
  update public.measurements
     set value_lb = 999.00
   where id = current_setting('tests.measurement_a')::uuid
   returning 1
)
select is(
  (select count(*)::int from upd),
  0,
  'update: coach_b''s update of coach_a''s measurement affects 0 rows'
);

select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select throws_ok(
  format(
    $f$update public.measurements
         set client_id = %L::uuid
       where id = %L::uuid$f$,
    current_setting('tests.client_b'),
    current_setting('tests.measurement_a')
  ),
  '42501'::char(5),
  NULL::text,
  'update: coach_a cannot move measurement to coach_b''s client'
);

-- ── 5. DELETE ───────────────────────────────────────────────────
select tests.authenticate_as(current_setting('tests.user_b')::uuid);

with del as (
  delete from public.measurements
   where id = current_setting('tests.measurement_a')::uuid
   returning 1
)
select is(
  (select count(*)::int from del),
  0,
  'delete: coach_b''s delete of coach_a''s measurement affects 0 rows'
);

select tests.authenticate_as(current_setting('tests.user_a')::uuid);

with del as (
  delete from public.measurements
   where id = current_setting('tests.measurement_a')::uuid
   returning 1
)
select is(
  (select count(*)::int from del),
  1,
  'delete: coach_a can delete their own measurement'
);

-- ── teardown ────────────────────────────────────────────────────
select tests.clear_authentication();
select * from finish();

rollback;
