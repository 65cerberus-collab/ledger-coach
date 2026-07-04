-- 017_rls_workout_blocks.sql
--
-- Purpose: Enable Row-Level Security and define delegated own-coach
--          policies on public.workout_blocks.
-- Reference: MIGRATION_PLAN.md §5
--
-- Ownership pattern: delegated via workout_id -> public.workouts.coach_id.
-- workout_blocks has no coach_id column of its own; every policy joins
-- through the parent workout via an EXISTS subquery and defers the
-- ownership decision to public.is_my_coach(w.coach_id).
--
-- Note: workout_blocks.exercise_id is also a foreign key, but it is NOT
-- an ownership path. Seed exercises have coach_id IS NULL, so a check
-- against exercises.coach_id would incorrectly reject blocks that
-- legitimately reference a shared seed exercise. Only workout_id
-- determines ownership here.
--
-- Naming convention: policies are suffixed _own_coach to leave room for
-- _own_client policies in Phase 3+ when client auth lands. Client-auth
-- policies are explicitly out of scope here.

-- Enable RLS. `force` ensures the table owner is also subject to RLS,
-- preventing accidental data leaks via owner-role bypass.
alter table public.workout_blocks enable row level security;
alter table public.workout_blocks force row level security;

-- SELECT: a coach can read blocks only when the parent workout is theirs.
drop policy if exists workout_blocks_select_own_coach on public.workout_blocks;
create policy workout_blocks_select_own_coach
on public.workout_blocks
for select
to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_blocks.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

-- INSERT: a coach can add a block only to a workout they own.
drop policy if exists workout_blocks_insert_own_coach on public.workout_blocks;
create policy workout_blocks_insert_own_coach
on public.workout_blocks
for insert
to authenticated
with check (
  exists (
    select 1 from public.workouts w
    where w.id = workout_blocks.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

-- UPDATE: a coach can update only blocks under their own workouts, and
-- cannot move a block to a workout they do not own (enforced by
-- WITH CHECK on the post-update workout_id).
drop policy if exists workout_blocks_update_own_coach on public.workout_blocks;
create policy workout_blocks_update_own_coach
on public.workout_blocks
for update
to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_blocks.workout_id
      and public.is_my_coach(w.coach_id)
  )
)
with check (
  exists (
    select 1 from public.workouts w
    where w.id = workout_blocks.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

-- DELETE: a coach can delete only blocks under their own workouts.
drop policy if exists workout_blocks_delete_own_coach on public.workout_blocks;
create policy workout_blocks_delete_own_coach
on public.workout_blocks
for delete
to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_blocks.workout_id
      and public.is_my_coach(w.coach_id)
  )
);

