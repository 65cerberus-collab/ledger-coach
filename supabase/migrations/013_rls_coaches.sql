-- 013_rls_coaches.sql
--
-- Purpose: Enable Row-Level Security and define own-row policies on
--          public.coaches.
-- Reference: MIGRATION_PLAN.md §5
--
-- public.coaches is the ROOT of the ownership tree: every other RLS policy
-- in migrations 014-021 checks coach ownership via public.is_my_coach().
-- The policies in this file cannot use is_my_coach() without creating a
-- circular dependency, so they check user_id = auth.uid() directly.

-- Enable RLS. `force` ensures the table owner is also subject to RLS,
-- preventing accidental data leaks via owner-role bypass.
alter table public.coaches enable row level security;
alter table public.coaches force row level security;

-- SELECT: a coach can read only their own coaches row.
drop policy if exists coaches_select_own on public.coaches;
create policy coaches_select_own
on public.coaches
for select
to authenticated
using (user_id = auth.uid());

-- INSERT: a coach can create only a row that points to their own auth user.
drop policy if exists coaches_insert_own on public.coaches;
create policy coaches_insert_own
on public.coaches
for insert
to authenticated
with check (user_id = auth.uid());

-- UPDATE: a coach can update only their own row, and cannot reassign
-- user_id to another auth user mid-update (enforced by WITH CHECK).
drop policy if exists coaches_update_own on public.coaches;
create policy coaches_update_own
on public.coaches
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- DELETE: a coach can delete only their own row.
drop policy if exists coaches_delete_own on public.coaches;
create policy coaches_delete_own
on public.coaches
for delete
to authenticated
using (user_id = auth.uid());

