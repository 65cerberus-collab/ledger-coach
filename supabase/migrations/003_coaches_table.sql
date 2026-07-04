-- ────────────────────────────────────────────────────────────────
-- 003_coaches_table.sql
-- ────────────────────────────────────────────────────────────────
-- One row per coach. Tied 1:1 to a Supabase auth user (Option A —
-- see MIGRATION_PLAN.md §3.1). RLS is added in a later migration.

create table public.coaches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade unique,
  name          text not null,
  archived      boolean not null default false,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger coaches_set_updated_at
  before update on public.coaches
  for each row execute function public.set_updated_at();
