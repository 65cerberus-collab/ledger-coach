-- ────────────────────────────────────────────────────────────────
-- supabase/tests/07_rls_attendance.sql
-- ────────────────────────────────────────────────────────────────
-- pgTAP coverage for the four delegated own_coach RLS policies on
-- the attendance table (see migration 019_rls_attendance).
--
-- Ownership is delegated through the parent workout via workout_id;
-- attendance has no coach_id column of its own. Each policy uses an
-- EXISTS subquery against workouts and defers the ownership decision
-- to the is_my_coach helper, passed the workout's coach_id.
--
-- Run manually via Supabase Dashboard SQL Editor. The whole file
-- runs inside a single transaction and rolls back at the end.

begin;

select plan(13);

-- ── setup ───────────────────────────────────────────────────────
select tests.clear_authentication();

do $setup$
declare
  v_user_a       uuid;
  v_coach_a      uuid;
  v_workout_a    uuid;
  v_workout_a2   uuid;
  v_attendance_a uuid;
  v_user_b       uuid;
  v_coach_b      uuid;
  v_workout_b    uuid;
begin
  v_user_a := tests.create_user();
  perform tests.create_profile(v_user_a);
  v_coach_a    := tests.create_coach(v_user_a);
  v_workout_a  := tests.create_workout(v_coach_a);
  v_workout_a2 := tests.create_workout(v_coach_a);

  v_user_b := tests.create_user();
  perform tests.create_profile(v_user_b);
  v_coach_b   := tests.create_coach(v_user_b);
  v_workout_b := tests.create_workout(v_coach_b);

  insert into public.attendance (workout_id, status, date)
  values (v_workout_a, 'present', current_date)
  returning id into v_attendance_a;

  perform set_config('tests.user_a',       v_user_a::text,       true);
  perform set_config('tests.user_b',       v_user_b::text,       true);
  perform set_config('tests.workout_a2',   v_workout_a2::text,   true);
  perform set_config('tests.workout_b',    v_workout_b::text,    true);
  perform set_config('tests.attendance_a', v_attendance_a::text, true);
end
$setup$;

-- ── 1. RLS is enabled and forced ────────────────────────────────
select ok(
  (select relrowsecurity
     from pg_class
    where oid = 'public.attendance'::regclass),
  'rls is enabled on public.attendance'
);

select ok(
  (select relforcerowsecurity
     from pg_class
    where oid = 'public.attendance'::regclass),
  'rls is forced on public.attendance'
);

-- ── 2. SELECT ───────────────────────────────────────────────────
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select is(
  (select count(*)::int
     from public.attendance
    where id = current_setting('tests.attendance_a')::uuid),
  1,
  'select: coach_a sees their own attendance row'
);

select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select is(
  (select count(*)::int
     from public.attendance
    where id = current_setting('tests.attendance_a')::uuid),
  0,
  'select: coach_b cannot see coach_a''s attendance row'
);

select tests.authenticate_as_anon();

select is(
  (select count(*)::int from public.attendance),
  0,
  'select: anon cannot see any attendance rows'
);

-- ── 3. INSERT ───────────────────────────────────────────────────
select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select throws_ok(
  format(
    $f$insert into public.attendance (workout_id, status, date)
       values (%L::uuid, 'missed', current_date)$f$,
    current_setting('tests.workout_a2')
  ),
  '42501',
  'insert: coach_b cannot insert attendance for coach_a''s workout'
);

select tests.authenticate_as_anon();

select throws_ok(
  format(
    $f$insert into public.attendance (workout_id, status, date)
       values (%L::uuid, 'missed', current_date)$f$,
    current_setting('tests.workout_a2')
  ),
  '42501',
  'insert: anon cannot insert attendance'
);

select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select lives_ok(
  format(
    $f$insert into public.attendance (workout_id, status, date)
       values (%L::uuid, 'present', current_date)$f$,
    current_setting('tests.workout_a2')
  ),
  'insert: coach_a can insert attendance for their own workout'
);

-- ── 4. UPDATE ───────────────────────────────────────────────────
with upd as (
  update public.attendance
     set status = 'missed'
   where id = current_setting('tests.attendance_a')::uuid
   returning 1
)
select is(
  (select count(*)::int from upd),
  1,
  'update: coach_a can update their own attendance row'
);

select tests.authenticate_as(current_setting('tests.user_b')::uuid);

with upd as (
  update public.attendance
     set status = 'cancelled'
   where id = current_setting('tests.attendance_a')::uuid
   returning 1
)
select is(
  (select count(*)::int from upd),
  0,
  'update: coach_b''s update of coach_a''s row affects 0 rows'
);

select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select throws_ok(
  format(
    $f$update public.attendance
         set workout_id = %L::uuid
       where id = %L::uuid$f$,
    current_setting('tests.workout_b'),
    current_setting('tests.attendance_a')
  ),
  '42501',
  'update: coach_a cannot move attendance to coach_b''s workout'
);

-- ── 5. DELETE ───────────────────────────────────────────────────
select tests.authenticate_as(current_setting('tests.user_b')::uuid);

with del as (
  delete from public.attendance
   where id = current_setting('tests.attendance_a')::uuid
   returning 1
)
select is(
  (select count(*)::int from del),
  0,
  'delete: coach_b''s delete of coach_a''s row affects 0 rows'
);

select tests.authenticate_as(current_setting('tests.user_a')::uuid);

with del as (
  delete from public.attendance
   where id = current_setting('tests.attendance_a')::uuid
   returning 1
)
select is(
  (select count(*)::int from del),
  1,
  'delete: coach_a can delete their own attendance row'
);

-- ── teardown ────────────────────────────────────────────────────
select tests.clear_authentication();
select * from finish();

rollback;
