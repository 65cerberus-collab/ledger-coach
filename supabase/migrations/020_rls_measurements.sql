-- 020_rls_measurements.sql
--
-- Purpose: Enable Row-Level Security and define delegated own-coach
--          policies on public.measurements.
-- Reference: MIGRATION_PLAN.md §5
--
-- Ownership pattern: delegated via client_id -> public.clients.coach_id.
-- measurements has no coach_id column of its own; every policy joins
-- through the parent client via an EXISTS subquery and defers the
-- ownership decision to public.is_my_coach(c.coach_id). Unlike the
-- workout-rooted children (017-019), measurements ride on clients.
--
-- Naming convention: policies are suffixed _own_coach to leave room for
-- _own_client policies in Phase 3+ when client auth lands. Client-auth
-- policies are explicitly out of scope here.

-- Enable RLS. `force` ensures the table owner is also subject to RLS,
-- preventing accidental data leaks via owner-role bypass.
alter table public.measurements enable row level security;
alter table public.measurements force row level security;

-- SELECT: a coach can read measurements only when the parent client is theirs.
drop policy if exists measurements_select_own_coach on public.measurements;
create policy measurements_select_own_coach
on public.measurements
for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = measurements.client_id
      and public.is_my_coach(c.coach_id)
  )
);

-- INSERT: a coach can record a measurement only for a client they own.
drop policy if exists measurements_insert_own_coach on public.measurements;
create policy measurements_insert_own_coach
on public.measurements
for insert
to authenticated
with check (
  exists (
    select 1 from public.clients c
    where c.id = measurements.client_id
      and public.is_my_coach(c.coach_id)
  )
);

-- UPDATE: a coach can update only measurements under their own clients,
-- and cannot move a measurement to a client they do not own (enforced
-- by WITH CHECK on the post-update client_id).
drop policy if exists measurements_update_own_coach on public.measurements;
create policy measurements_update_own_coach
on public.measurements
for update
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = measurements.client_id
      and public.is_my_coach(c.coach_id)
  )
)
with check (
  exists (
    select 1 from public.clients c
    where c.id = measurements.client_id
      and public.is_my_coach(c.coach_id)
  )
);

-- DELETE: a coach can delete only measurements under their own clients.
drop policy if exists measurements_delete_own_coach on public.measurements;
create policy measurements_delete_own_coach
on public.measurements
for delete
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = measurements.client_id
      and public.is_my_coach(c.coach_id)
  )
);

