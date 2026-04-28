-- 015_rls_exercises.sql
--
-- Purpose: Enable Row-Level Security and define own-coach policies on
--          public.exercises, including read access to shared seed rows.
-- Reference: MIGRATION_PLAN.md §5
--
-- Ownership pattern: direct, but exercises.coach_id is NULLABLE. Rows
-- with coach_id IS NULL are shared/seeded library entries readable by
-- every authenticated coach (MIGRATION_PLAN.md §4.2 / §5.3); rows with
-- coach_id NOT NULL are custom exercises owned by that coach.
--
-- Mutation policies rely on public.is_my_coach(NULL) returning false to
-- prevent coaches from inserting, updating, or deleting seed rows. No
-- explicit `coach_id IS NOT NULL` guard is needed.
--
-- Naming convention: policies are suffixed _own_coach to leave room for
-- _own_client policies in Phase 3+ when client auth lands. Client-auth
-- policies are explicitly out of scope here.

-- Enable RLS. `force` ensures the table owner is also subject to RLS,
-- preventing accidental data leaks via owner-role bypass.
alter table public.exercises enable row level security;
alter table public.exercises force row level security;

-- SELECT: a coach can read shared seed rows (coach_id IS NULL) plus
-- their own custom exercises. The NULL branch is what makes the
-- ~230-row seeded library visible to every authenticated coach.
drop policy if exists exercises_select_own_coach on public.exercises;
create policy exercises_select_own_coach
on public.exercises
for select
to authenticated
using (coach_id is null or public.is_my_coach(coach_id));

-- INSERT: a coach can create a custom exercise only under their own
-- coach_id. Seed rows are inserted server-side by a script that
-- bypasses RLS, never via this policy.
drop policy if exists exercises_insert_own_coach on public.exercises;
create policy exercises_insert_own_coach
on public.exercises
for insert
to authenticated
with check (public.is_my_coach(coach_id));

-- UPDATE: a coach can update only their own custom exercises, and
-- cannot reassign coach_id (to another coach or to NULL) mid-update.
-- is_my_coach(NULL) returns false, so seed rows remain immutable here.
drop policy if exists exercises_update_own_coach on public.exercises;
create policy exercises_update_own_coach
on public.exercises
for update
to authenticated
using (public.is_my_coach(coach_id))
with check (public.is_my_coach(coach_id));

-- DELETE: a coach can delete only their own custom exercises.
-- is_my_coach(NULL) returns false, so seed rows are not deletable here.
drop policy if exists exercises_delete_own_coach on public.exercises;
create policy exercises_delete_own_coach
on public.exercises
for delete
to authenticated
using (public.is_my_coach(coach_id));

