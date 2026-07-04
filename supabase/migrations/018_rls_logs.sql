-- 018_rls_logs.sql
--
-- Purpose: Enable Row-Level Security and define delegated own-coach
--          policies on public.logs.
-- Reference: MIGRATION_PLAN.md §5
--
-- Ownership pattern: delegated via workout_id -> public.workouts.coach_id.
-- logs has no coach_id column of its own; every policy joins through the
-- parent workout via an EXISTS subquery and defers the ownership
-- decision to public.is_my_coach(w.coach_id).
--
-- Note: logs.exercise_id is also a foreign key, but it is NOT an
-- ownership path. Seed exercises have coach_id IS NULL, so a check
-- against exercises.coach_id would incorrectly reject logs that
-- legitimately reference a shared seed exercise. Only workout_id
-- determines ownership here.
--
-- Future-phase note: logs.source can be 'client', which will need a
-- second policy branch (logs_<verb>_own_client) when client auth lands
-- in Phase 3+. That branch is intentionally not added here.
--
-- Naming convention: policies are suffixed _own_coach to leave room for
-- _own_client policies in Phase 3+ when client auth lands. Client-auth
-- policies are explicitly out of scope here.

-- Enable RLS. `force` ensures the table owner is also subject to RLS,
-- preventing accidental data leaks via owner-role bypass.
alter table public.logs enable row level security;
alter table public.logs force row level security;

-- SELECT: a coach can read logs only when the parent workout is theirs.
drop policy if exists logs_select_own_coach on public.logs;
create policy logs_select_own_coach
on public.logs
for select
to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = logs.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

-- INSERT: a coach can write a log only against a workout they own.
drop policy if exists logs_insert_own_coach on public.logs;
create policy logs_insert_own_coach
on public.logs
for insert
to authenticated
with check (
  exists (
    select 1 from public.workouts w
    where w.id = logs.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

-- UPDATE: a coach can update only logs under their own workouts, and
-- cannot move a log to a workout they do not own (enforced by
-- WITH CHECK on the post-update workout_id).
drop policy if exists logs_update_own_coach on public.logs;
create policy logs_update_own_coach
on public.logs
for update
to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = logs.workout_id
      and public.is_my_coach(w.coach_id)
  )
)
with check (
  exists (
    select 1 from public.workouts w
    where w.id = logs.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

-- DELETE: a coach can delete only logs under their own workouts.
drop policy if exists logs_delete_own_coach on public.logs;
create policy logs_delete_own_coach
on public.logs
for delete
to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = logs.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

