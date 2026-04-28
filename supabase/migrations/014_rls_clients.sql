-- 014_rls_clients.sql
--
-- Purpose: Enable Row-Level Security and define own-coach policies on
--          public.clients.
-- Reference: MIGRATION_PLAN.md §5
--
-- Ownership pattern: direct (clients.coach_id is NOT NULL and references
-- public.coaches). All policies delegate the ownership check to
-- public.is_my_coach(coach_id) defined in 012_auth_helpers.sql.
--
-- Naming convention: policies are suffixed _own_coach to leave room for
-- _own_client policies in Phase 3+ when client auth lands. Client-auth
-- policies are explicitly out of scope here.

-- Enable RLS. `force` ensures the table owner is also subject to RLS,
-- preventing accidental data leaks via owner-role bypass.
alter table public.clients enable row level security;
alter table public.clients force row level security;

-- SELECT: a coach can read only clients that belong to them.
drop policy if exists clients_select_own_coach on public.clients;
create policy clients_select_own_coach
on public.clients
for select
to authenticated
using (public.is_my_coach(coach_id));

-- INSERT: a coach can create a client only under their own coach_id.
drop policy if exists clients_insert_own_coach on public.clients;
create policy clients_insert_own_coach
on public.clients
for insert
to authenticated
with check (public.is_my_coach(coach_id));

-- UPDATE: a coach can update only their own clients, and cannot reassign
-- coach_id to another coach mid-update (enforced by WITH CHECK).
drop policy if exists clients_update_own_coach on public.clients;
create policy clients_update_own_coach
on public.clients
for update
to authenticated
using (public.is_my_coach(coach_id))
with check (public.is_my_coach(coach_id));

-- DELETE: a coach can delete only their own clients.
drop policy if exists clients_delete_own_coach on public.clients;
create policy clients_delete_own_coach
on public.clients
for delete
to authenticated
using (public.is_my_coach(coach_id));

