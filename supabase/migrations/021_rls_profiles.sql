-- 021_rls_profiles.sql
--
-- Purpose: Enable Row-Level Security and define own-row policies on
--          public.profiles.
-- Reference: MIGRATION_PLAN.md §5
--
-- Ownership pattern: auth-user direct. profiles is rooted at auth.users
-- (its primary key is user_id, FK -> auth.users), not at public.coaches.
-- This file therefore diverges from the is_my_coach pattern used in
-- 014-020 and instead checks user_id = auth.uid() directly, mirroring
-- 013_rls_coaches.sql. The divergence is intentional: profiles is
-- designed to support future non-coach account types (e.g., client
-- logins in Phase 3+), so its access rule is independent of the
-- coach ownership tree.
--
-- Naming-convention exception: because profiles is auth-user rooted
-- rather than coach rooted, policies are suffixed _own (not _own_coach).

-- Enable RLS. `force` ensures the table owner is also subject to RLS,
-- preventing accidental data leaks via owner-role bypass.
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- SELECT: a user can read only their own profile row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

-- INSERT: a user can create only a profile row keyed to their own auth user.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

-- UPDATE: a user can update only their own profile row, and cannot
-- reassign user_id to another auth user mid-update (enforced by
-- WITH CHECK).
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- DELETE: a user can delete only their own profile row.
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
on public.profiles
for delete
to authenticated
using (user_id = auth.uid());

