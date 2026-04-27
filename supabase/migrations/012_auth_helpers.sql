-- 012_auth_helpers.sql
--
-- Purpose: Auth/RLS helper functions for coach-owned tables.
-- Reference: MIGRATION_PLAN.md §5.1
--
-- Defines public.is_my_coach(uuid), the predicate used by every RLS policy
-- in migrations 013-021 to verify that a given coach_id belongs to the
-- currently authenticated user.

create or replace function public.is_my_coach(coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- When auth.uid() is null (unauthenticated), user_id = null never matches,
  -- so EXISTS naturally returns false. No explicit IS NOT NULL guard needed.
  select exists (
    select 1
    from public.coaches
    where id = coach_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_my_coach(uuid) from public;
grant execute on function public.is_my_coach(uuid) to authenticated;

comment on function public.is_my_coach(uuid) is
  'Returns true iff the given coach_id corresponds to a public.coaches row owned by the currently authenticated user (auth.uid()). Returns false for unauthenticated sessions or unknown coach_ids. Intended for use in RLS policies on coach-owned tables (clients, exercises, workouts, etc.). STABLE + SECURITY DEFINER so the planner can cache results per query and so the function can read public.coaches independent of the caller''s RLS context.';

