-- 019_rls_attendance.sql
--
-- Purpose: Enable Row-Level Security and define delegated own-coach
--          policies on public.attendance.
-- Reference: MIGRATION_PLAN.md §5
--
-- Ownership pattern: delegated via workout_id -> public.workouts.coach_id.
-- attendance has no coach_id column of its own; every policy joins
-- through the parent workout via an EXISTS subquery and defers the
-- ownership decision to public.is_my_coach(w.coach_id). The UNIQUE
-- constraint on attendance.workout_id is irrelevant to RLS — it
-- enforces the 1:1 relationship, not access control.
--
-- Naming convention: policies are suffixed _own_coach to leave room for
-- _own_client policies in Phase 3+ when client auth lands. Client-auth
-- policies are explicitly out of scope here.

-- Enable RLS. `force` ensures the table owner is also subject to RLS,
-- preventing accidental data leaks via owner-role bypass.
alter table public.attendance enable row level security;
alter table public.attendance force row level security;

-- SELECT: a coach can read attendance only when the parent workout is theirs.
drop policy if exists attendance_select_own_coach on public.attendance;
create policy attendance_select_own_coach
on public.attendance
for select
to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = attendance.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

-- INSERT: a coach can record attendance only for a workout they own.
drop policy if exists attendance_insert_own_coach on public.attendance;
create policy attendance_insert_own_coach
on public.attendance
for insert
to authenticated
with check (
  exists (
    select 1 from public.workouts w
    where w.id = attendance.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

-- UPDATE: a coach can update only attendance under their own workouts,
-- and cannot move it to a workout they do not own (enforced by
-- WITH CHECK on the post-update workout_id).
drop policy if exists attendance_update_own_coach on public.attendance;
create policy attendance_update_own_coach
on public.attendance
for update
to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = attendance.workout_id
      and public.is_my_coach(w.coach_id)
  )
)
with check (
  exists (
    select 1 from public.workouts w
    where w.id = attendance.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

-- DELETE: a coach can delete only attendance under their own workouts.
drop policy if exists attendance_delete_own_coach on public.attendance;
create policy attendance_delete_own_coach
on public.attendance
for delete
to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = attendance.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

