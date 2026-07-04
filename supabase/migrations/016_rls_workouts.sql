-- 016_rls_workouts.sql
--
-- Purpose: Enable Row-Level Security and define own-coach policies on
--          public.workouts.
-- Reference: MIGRATION_PLAN.md §5
--
-- Ownership pattern: direct (workouts.coach_id is NOT NULL and
-- references public.coaches). Templates (client_id NULL,
-- is_template = true) and self-directed sessions still carry a
-- coach_id, so the same own-coach check covers all workout shapes.
--
-- Naming convention: policies are suffixed _own_coach to leave room for
-- _own_client policies in Phase 3+ when client auth lands. Client-auth
-- policies are explicitly out of scope here.

-- Enable RLS. `force` ensures the table owner is also subject to RLS,
-- preventing accidental data leaks via owner-role bypass.
alter table public.workouts enable row level security;
alter table public.workouts force row level security;

-- SELECT: a coach can read only workouts that belong to them.
drop policy if exists workouts_select_own_coach on public.workouts;
create policy workouts_select_own_coach
on public.workouts
for select
to authenticated
using (public.is_my_coach(coach_id));

-- INSERT: a coach can create a workout only under their own coach_id.
drop policy if exists workouts_insert_own_coach on public.workouts;
create policy workouts_insert_own_coach
on public.workouts
for insert
to authenticated
with check (public.is_my_coach(coach_id));

-- UPDATE: a coach can update only their own workouts, and cannot
-- reassign coach_id to another coach mid-update (enforced by WITH CHECK).
drop policy if exists workouts_update_own_coach on public.workouts;
create policy workouts_update_own_coach
on public.workouts
for update
to authenticated
using (public.is_my_coach(coach_id))
with check (public.is_my_coach(coach_id));

-- DELETE: a coach can delete only their own workouts.
drop policy if exists workouts_delete_own_coach on public.workouts;
create policy workouts_delete_own_coach
on public.workouts
for delete
to authenticated
using (public.is_my_coach(coach_id));

