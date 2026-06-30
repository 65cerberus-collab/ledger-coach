-- ────────────────────────────────────────────────────────────────
-- 10_rls_set_logs.sql
-- ────────────────────────────────────────────────────────────────
-- pgTAP RLS tests for public.set_logs.
-- Reference: 031_per_set_logging.sql PART C (delegated own_coach
-- policies via logs -> workouts.coach_id + public.is_my_coach()).
--
-- Wrapped in BEGIN / ROLLBACK so nothing persists. Run manually via
-- the Supabase SQL Editor. CI is deferred to Phase 3+.
--
-- Helpers used (from supabase/tests/00_helpers.sql):
--   tests.authenticate_as(uuid), tests.authenticate_as_anon(),
--   tests.clear_authentication(),
--   tests.create_user(), tests.create_profile(uuid),
--   tests.create_coach(uuid), tests.create_workout(uuid),
--   tests.create_exercise(uuid).
-- No helper exists for workout_blocks, logs, or set_logs — those
-- fixture rows are inserted directly (postgres role bypasses RLS).
-- This file assumes 031 has been applied: logs carries block_id +
-- modified and no longer has mode / per_set / actual_* / completed.

begin;

select plan(15);

-- ─────────────────────────────────────────────────────────────
-- Fixtures (created as postgres; SECURITY DEFINER helpers + superuser
-- bypass RLS, so all of this setup runs unimpeded).
--
-- fx is granted to public so subqueries against it succeed when
-- evaluated under the authenticated / anon roles inside the
-- role-switched test bodies.
-- ─────────────────────────────────────────────────────────────

create temp table fx (k text primary key, v uuid);
grant select on fx to public;

-- Two users, two profiles, two coaches, two workouts, two exercises.
insert into fx (k, v) values
  ('user_a', tests.create_user()),
  ('user_b', tests.create_user());

insert into fx (k, v) values
  ('profile_a', tests.create_profile((select v from fx where k = 'user_a'))),
  ('profile_b', tests.create_profile((select v from fx where k = 'user_b')));

insert into fx (k, v) values
  ('coach_a', tests.create_coach((select v from fx where k = 'user_a'))),
  ('coach_b', tests.create_coach((select v from fx where k = 'user_b')));

insert into fx (k, v) values
  ('workout_a', tests.create_workout((select v from fx where k = 'coach_a'))),
  ('workout_b', tests.create_workout((select v from fx where k = 'coach_b')));

insert into fx (k, v) values
  ('exercise_a', tests.create_exercise((select v from fx where k = 'coach_a'))),
  ('exercise_b', tests.create_exercise((select v from fx where k = 'coach_b')));

-- One block per coach's workout (workout_blocks side/work_type/unit
-- all have safe defaults, so only workout_id/exercise_id/position
-- need supplying).
insert into fx (k, v) values
  ('block_a', gen_random_uuid()),
  ('block_b', gen_random_uuid());

insert into public.workout_blocks (id, workout_id, exercise_id, position) values
  ((select v from fx where k = 'block_a'),
   (select v from fx where k = 'workout_a'),
   (select v from fx where k = 'exercise_a'), 1),
  ((select v from fx where k = 'block_b'),
   (select v from fx where k = 'workout_b'),
   (select v from fx where k = 'exercise_b'), 1);

-- One parent log per block (new 031 shape: block_id required,
-- modified defaults false; no mode / per_set / actual_* / completed).
insert into fx (k, v) values
  ('log_a', gen_random_uuid()),
  ('log_b', gen_random_uuid());

insert into public.logs (id, workout_id, exercise_id, block_id, date) values
  ((select v from fx where k = 'log_a'),
   (select v from fx where k = 'workout_a'),
   (select v from fx where k = 'exercise_a'),
   (select v from fx where k = 'block_a'),
   current_date),
  ((select v from fx where k = 'log_b'),
   (select v from fx where k = 'workout_b'),
   (select v from fx where k = 'exercise_b'),
   (select v from fx where k = 'block_b'),
   current_date);

-- One pre-existing set_log child per log.
insert into fx (k, v) values
  ('setlog_a', gen_random_uuid()),
  ('setlog_b', gen_random_uuid());

insert into public.set_logs (id, log_id, set_number, side, reps, weight_lb) values
  ((select v from fx where k = 'setlog_a'),
   (select v from fx where k = 'log_a'), 1, 'bilateral', 10, 100.00),
  ((select v from fx where k = 'setlog_b'),
   (select v from fx where k = 'log_b'), 1, 'bilateral', 10, 100.00);

-- ─────────────────────────────────────────────────────────────
-- T1: RLS is enabled on public.set_logs.
-- ─────────────────────────────────────────────────────────────
select is(
  (select rowsecurity from pg_tables
   where schemaname = 'public' and tablename = 'set_logs'),
  true,
  'RLS is enabled on public.set_logs'
);

-- ─────────────────────────────────────────────────────────────
-- T2: Exactly the four expected own_coach policies exist.
-- ─────────────────────────────────────────────────────────────
select policies_are(
  'public', 'set_logs',
  array[
    'set_logs_select_own_coach',
    'set_logs_insert_own_coach',
    'set_logs_update_own_coach',
    'set_logs_delete_own_coach'
  ],
  'public.set_logs has exactly the four expected own_coach policies'
);

-- ─────────────────────────────────────────────────────────────
-- SELECT: visibility scoped to own coach (two hops up).
-- ─────────────────────────────────────────────────────────────

-- T3: Coach A sees only their own set_log.
select tests.authenticate_as((select v from fx where k = 'user_a'));
select set_eq(
  $$ select id from public.set_logs $$,
  format($$ select %L::uuid $$, (select v from fx where k = 'setlog_a')),
  'Coach A sees only their own set_log via SELECT'
);

-- T4: Coach B sees only their own set_log.
select tests.authenticate_as((select v from fx where k = 'user_b'));
select set_eq(
  $$ select id from public.set_logs $$,
  format($$ select %L::uuid $$, (select v from fx where k = 'setlog_b')),
  'Coach B sees only their own set_log via SELECT'
);

-- T5: anon sees nothing.
select tests.authenticate_as_anon();
select is_empty(
  $$ select id from public.set_logs $$,
  'Anon role sees no set_logs via SELECT'
);

-- ─────────────────────────────────────────────────────────────
-- INSERT: must attach to a log under a workout the coach owns.
-- ─────────────────────────────────────────────────────────────

select tests.authenticate_as((select v from fx where k = 'user_a'));

-- T6: Coach A can INSERT a set_log under their own log (set 2 so it
-- does not collide with the pre-existing (log_a, 1, bilateral) row).
select lives_ok(
  format(
    $sql$ insert into public.set_logs (log_id, set_number, side, reps, weight_lb)
          values (%L, 2, 'bilateral', 8, 105.00) $sql$,
    (select v from fx where k = 'log_a')
  ),
  'Coach A can INSERT a set_log under their own log'
);

-- T7: Coach A is blocked from INSERTing under Coach B's log.
select throws_ok(
  format(
    $sql$ insert into public.set_logs (log_id, set_number, side, reps, weight_lb)
          values (%L, 2, 'bilateral', 8, 105.00) $sql$,
    (select v from fx where k = 'log_b')
  ),
  '42501'::char(5),
  null::text,
  'Coach A is blocked from INSERTing a set_log under Coach B''s log (42501)'
);

-- T8: anon is blocked from INSERT.
select tests.authenticate_as_anon();
select throws_ok(
  format(
    $sql$ insert into public.set_logs (log_id, set_number, side, reps, weight_lb)
          values (%L, 3, 'bilateral', 8, 105.00) $sql$,
    (select v from fx where k = 'log_a')
  ),
  '42501'::char(5),
  null::text,
  'Anon role is blocked from INSERTing set_logs (42501)'
);

-- ─────────────────────────────────────────────────────────────
-- UPDATE: USING scopes visibility; WITH CHECK guards post-update
-- log_id (no re-parenting onto another coach's log).
-- ─────────────────────────────────────────────────────────────

-- T9: Coach A can UPDATE their own set_log.
select tests.authenticate_as((select v from fx where k = 'user_a'));
update public.set_logs set reps = 12
  where id = (select v from fx where k = 'setlog_a');

select tests.clear_authentication();
select is(
  (select reps from public.set_logs
   where id = (select v from fx where k = 'setlog_a')),
  12::smallint,
  'Coach A can UPDATE their own set_log'
);

-- T10: Coach A's UPDATE on Coach B's set_log silently affects 0 rows.
select tests.authenticate_as((select v from fx where k = 'user_a'));
update public.set_logs set reps = 99
  where id = (select v from fx where k = 'setlog_b');

select tests.clear_authentication();
select is(
  (select reps from public.set_logs
   where id = (select v from fx where k = 'setlog_b')),
  10::smallint,
  'Coach A cannot UPDATE Coach B''s set_log (RLS hides it)'
);

-- T11: Coach A cannot re-parent their set_log onto Coach B's log
-- (WITH CHECK on post-update log_id fires → 42501).
select tests.authenticate_as((select v from fx where k = 'user_a'));
select throws_ok(
  format(
    $sql$ update public.set_logs set log_id = %L where id = %L $sql$,
    (select v from fx where k = 'log_b'),
    (select v from fx where k = 'setlog_a')
  ),
  '42501'::char(5),
  null::text,
  'Coach A cannot re-parent their set_log onto Coach B''s log (WITH CHECK, 42501)'
);

-- T12: anon UPDATE silently affects 0 rows.
select tests.authenticate_as_anon();
update public.set_logs set reps = 77
  where id = (select v from fx where k = 'setlog_a');

select tests.clear_authentication();
select is(
  (select reps from public.set_logs
   where id = (select v from fx where k = 'setlog_a')),
  12::smallint,
  'Anon role cannot UPDATE set_logs (RLS hides them)'
);

-- ─────────────────────────────────────────────────────────────
-- DELETE: scoped to own coach via USING.
-- ─────────────────────────────────────────────────────────────

-- T13: anon DELETE silently affects 0 rows.
select tests.authenticate_as_anon();
delete from public.set_logs where id = (select v from fx where k = 'setlog_a');

select tests.clear_authentication();
select isnt_empty(
  format($sql$ select 1 from public.set_logs where id = %L $sql$,
         (select v from fx where k = 'setlog_a')),
  'Anon role cannot DELETE set_logs (RLS hides them)'
);

-- T14: Coach A's DELETE on Coach B's set_log silently affects 0 rows.
select tests.authenticate_as((select v from fx where k = 'user_a'));
delete from public.set_logs where id = (select v from fx where k = 'setlog_b');

select tests.clear_authentication();
select isnt_empty(
  format($sql$ select 1 from public.set_logs where id = %L $sql$,
         (select v from fx where k = 'setlog_b')),
  'Coach A cannot DELETE Coach B''s set_log (RLS hides it)'
);

-- T15: Coach A can DELETE their own set_log.
select tests.authenticate_as((select v from fx where k = 'user_a'));
delete from public.set_logs where id = (select v from fx where k = 'setlog_a');

select tests.clear_authentication();
select is_empty(
  format($sql$ select 1 from public.set_logs where id = %L $sql$,
         (select v from fx where k = 'setlog_a')),
  'Coach A can DELETE their own set_log'
);

select * from finish();

rollback;
