-- ────────────────────────────────────────────────────────────────
-- 06_rls_logs.sql
-- ────────────────────────────────────────────────────────────────
-- pgTAP RLS tests for public.logs.
-- Reference: 018_rls_logs.sql (delegated own_coach policies via
-- workouts.coach_id + public.is_my_coach()).
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
-- No helper exists for logs — fixture rows are inserted directly
-- (postgres role bypasses RLS).

begin;

select plan(16);

-- ─────────────────────────────────────────────────────────────
-- Fixtures (created as postgres; SECURITY DEFINER helpers + superuser
-- bypass RLS, so all of this setup runs unimpeded).
--
-- The temp table fx is granted to public so that subqueries against
-- it (e.g. `(select v from fx where k = 'user_a')`) succeed when
-- evaluated under the `authenticated` and `anon` roles inside the
-- role-switched test bodies. By default only the creating role can
-- read a temp table, which would cause every cross-role read of fx
-- to fail with 42501 and abort the transaction.
-- ─────────────────────────────────────────────────────────────

create temp table fx (k text primary key, v uuid);
grant select on fx to public;

-- Two users, two profiles, two coaches, two workouts.
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

-- Three exercises: one for each coach plus a second for Coach A so we
-- can exercise the INSERT path without colliding with the unique
-- (workout_id, exercise_id) index on the pre-existing log_a.
insert into fx (k, v) values
  ('exercise_a',  tests.create_exercise((select v from fx where k = 'coach_a'))),
  ('exercise_a2', tests.create_exercise((select v from fx where k = 'coach_a'))),
  ('exercise_b',  tests.create_exercise((select v from fx where k = 'coach_b')));

-- A seed exercise (coach_id IS NULL) pulled from the 227 already loaded
-- by seed_exercises.sql. Used to verify the policy comment that
-- exercise_id is NOT an ownership path.
insert into fx (k, v) values
  ('exercise_seed', (
    select id from public.exercises
    where coach_id is null and is_seed = true
    limit 1
  ));

-- Pre-allocate ids for the two pre-existing logs so we can reference
-- them by id throughout the tests.
insert into fx (k, v) values
  ('log_a', gen_random_uuid()),
  ('log_b', gen_random_uuid());

insert into public.logs (id, workout_id, exercise_id, date, mode, notes) values
  ((select v from fx where k = 'log_a'),
   (select v from fx where k = 'workout_a'),
   (select v from fx where k = 'exercise_a'),
   current_date, 'asPlanned', 'log_a original'),
  ((select v from fx where k = 'log_b'),
   (select v from fx where k = 'workout_b'),
   (select v from fx where k = 'exercise_b'),
   current_date, 'asPlanned', 'log_b original');

-- ─────────────────────────────────────────────────────────────
-- T1: RLS is enabled on public.logs.
-- ─────────────────────────────────────────────────────────────
select is(
  (select rowsecurity from pg_tables
   where schemaname = 'public' and tablename = 'logs'),
  true,
  'RLS is enabled on public.logs'
);

-- ─────────────────────────────────────────────────────────────
-- T2: Exactly the four expected own_coach policies exist.
-- ─────────────────────────────────────────────────────────────
select policies_are(
  'public', 'logs',
  array[
    'logs_select_own_coach',
    'logs_insert_own_coach',
    'logs_update_own_coach',
    'logs_delete_own_coach'
  ],
  'public.logs has exactly the four expected own_coach policies'
);

-- ─────────────────────────────────────────────────────────────
-- SELECT: visibility is scoped to own coach.
-- ─────────────────────────────────────────────────────────────

-- T3: Coach A sees only their own log.
select tests.authenticate_as((select v from fx where k = 'user_a'));
select set_eq(
  $$ select id from public.logs $$,
  format($$ select %L::uuid $$, (select v from fx where k = 'log_a')),
  'Coach A sees only their own log via SELECT'
);

-- T4: Coach B sees only their own log.
select tests.authenticate_as((select v from fx where k = 'user_b'));
select set_eq(
  $$ select id from public.logs $$,
  format($$ select %L::uuid $$, (select v from fx where k = 'log_b')),
  'Coach B sees only their own log via SELECT'
);

-- T5: anon sees nothing.
select tests.authenticate_as_anon();
select is_empty(
  $$ select id from public.logs $$,
  'Anon role sees no logs via SELECT'
);

-- ─────────────────────────────────────────────────────────────
-- INSERT: must reference a workout the coach owns.
-- ─────────────────────────────────────────────────────────────

select tests.authenticate_as((select v from fx where k = 'user_a'));

-- T6: Coach A can INSERT a log against their own workout.
select lives_ok(
  format(
    $sql$ insert into public.logs (workout_id, exercise_id, date, mode)
          values (%L, %L, current_date, 'asPlanned') $sql$,
    (select v from fx where k = 'workout_a'),
    (select v from fx where k = 'exercise_a2')
  ),
  'Coach A can INSERT a log against their own workout'
);

-- T7: Coach A can INSERT a log referencing a SEED exercise
-- (coach_id IS NULL). Verifies the policy comment that exercise_id is
-- not an ownership path.
select lives_ok(
  format(
    $sql$ insert into public.logs (workout_id, exercise_id, date, mode)
          values (%L, %L, current_date, 'asPlanned') $sql$,
    (select v from fx where k = 'workout_a'),
    (select v from fx where k = 'exercise_seed')
  ),
  'Coach A can INSERT a log referencing a seed exercise (coach_id IS NULL)'
);

-- T8: Coach A is blocked from INSERTing against Coach B's workout.
select throws_ok(
  format(
    $sql$ insert into public.logs (workout_id, exercise_id, date, mode)
          values (%L, %L, current_date, 'asPlanned') $sql$,
    (select v from fx where k = 'workout_b'),
    (select v from fx where k = 'exercise_a')
  ),
  '42501',
  null,
  'Coach A is blocked from INSERTing a log against Coach B''s workout (42501)'
);

-- T9: anon is blocked from INSERT.
select tests.authenticate_as_anon();
select throws_ok(
  format(
    $sql$ insert into public.logs (workout_id, exercise_id, date, mode)
          values (%L, %L, current_date, 'asPlanned') $sql$,
    (select v from fx where k = 'workout_a'),
    (select v from fx where k = 'exercise_a')
  ),
  '42501',
  null,
  'Anon role is blocked from INSERTing logs (42501)'
);

-- ─────────────────────────────────────────────────────────────
-- UPDATE: USING scopes visibility; WITH CHECK guards post-update
-- workout_id.
-- ─────────────────────────────────────────────────────────────

-- T10: Coach A can UPDATE their own log.
select tests.authenticate_as((select v from fx where k = 'user_a'));
update public.logs set notes = 'log_a updated by A'
  where id = (select v from fx where k = 'log_a');

select tests.clear_authentication();
select is(
  (select notes from public.logs
   where id = (select v from fx where k = 'log_a')),
  'log_a updated by A',
  'Coach A can UPDATE their own log'
);

-- T11: Coach A's UPDATE on Coach B's log silently affects 0 rows
-- (USING hides it).
select tests.authenticate_as((select v from fx where k = 'user_a'));
update public.logs set notes = 'log_b hijacked by A'
  where id = (select v from fx where k = 'log_b');

select tests.clear_authentication();
select is(
  (select notes from public.logs
   where id = (select v from fx where k = 'log_b')),
  'log_b original',
  'Coach A cannot UPDATE Coach B''s log (RLS hides it)'
);

-- T12: Coach A cannot move their own log to Coach B's workout
-- (WITH CHECK on post-update workout_id fires → 42501).
select tests.authenticate_as((select v from fx where k = 'user_a'));
select throws_ok(
  format(
    $sql$ update public.logs set workout_id = %L where id = %L $sql$,
    (select v from fx where k = 'workout_b'),
    (select v from fx where k = 'log_a')
  ),
  '42501',
  null,
  'Coach A cannot move their own log to Coach B''s workout (WITH CHECK, 42501)'
);

-- T13: anon UPDATE silently affects 0 rows.
select tests.authenticate_as_anon();
update public.logs set notes = 'anon hijacked'
  where id = (select v from fx where k = 'log_a');

select tests.clear_authentication();
select is(
  (select notes from public.logs
   where id = (select v from fx where k = 'log_a')),
  'log_a updated by A',
  'Anon role cannot UPDATE logs (RLS hides them)'
);

-- ─────────────────────────────────────────────────────────────
-- DELETE: scoped to own coach via USING.
-- ─────────────────────────────────────────────────────────────

-- T14: anon DELETE silently affects 0 rows.
select tests.authenticate_as_anon();
delete from public.logs where id = (select v from fx where k = 'log_a');

select tests.clear_authentication();
select isnt_empty(
  format($sql$ select 1 from public.logs where id = %L $sql$,
         (select v from fx where k = 'log_a')),
  'Anon role cannot DELETE logs (RLS hides them)'
);

-- T15: Coach A's DELETE on Coach B's log silently affects 0 rows.
select tests.authenticate_as((select v from fx where k = 'user_a'));
delete from public.logs where id = (select v from fx where k = 'log_b');

select tests.clear_authentication();
select isnt_empty(
  format($sql$ select 1 from public.logs where id = %L $sql$,
         (select v from fx where k = 'log_b')),
  'Coach A cannot DELETE Coach B''s log (RLS hides it)'
);

-- T16: Coach A can DELETE their own log.
select tests.authenticate_as((select v from fx where k = 'user_a'));
delete from public.logs where id = (select v from fx where k = 'log_a');

select tests.clear_authentication();
select is_empty(
  format($sql$ select 1 from public.logs where id = %L $sql$,
         (select v from fx where k = 'log_a')),
  'Coach A can DELETE their own log'
);

select * from finish();

rollback;
