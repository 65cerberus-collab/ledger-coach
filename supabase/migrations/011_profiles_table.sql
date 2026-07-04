-- ────────────────────────────────────────────────────────────────
-- 011_profiles_table.sql
-- ────────────────────────────────────────────────────────────────
-- User-level metadata, kept separate from coaches so non-coach
-- account types (future client logins, etc.) can also have profile
-- rows. PK is user_id directly — no separate uuid PK — and the FK
-- target is auth.users with ON DELETE CASCADE, mirroring the
-- coaches.user_id pattern.
-- schema_version mirrors the localStorage SCHEMA_VERSION (currently 7
-- per CLAUDE.md), used to gate sync against client/server skew.
-- RLS is added in a later migration.

create table public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  schema_version int not null default 7,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
