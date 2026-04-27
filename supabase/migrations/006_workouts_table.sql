-- ────────────────────────────────────────────────────────────────
-- 006_workouts_table.sql
-- ────────────────────────────────────────────────────────────────
-- A workout is either:
--   - a planned/logged session for a client (client_id NOT NULL,
--     is_template = false),
--   - a template (client_id NULL, is_template = true), or
--   - a self-directed session by the coach (is_self_directed = true).
-- The visibility column is reserved for the future template marketplace
-- (MIGRATION_PLAN.md §3.6) and defaults to 'private' so single-coach
-- behavior is preserved. RLS is added in a later migration.

create table public.workouts (
  id                uuid primary key default gen_random_uuid(),
  coach_id          uuid not null references public.coaches(id) on delete cascade,
  client_id         uuid references public.clients(id) on delete cascade,
  name              text,
  date              date,
  is_template       boolean not null default false,
  is_self_directed  boolean not null default false,
  visibility        text not null default 'private' check (visibility in ('private','unlisted','public')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index workouts_coach_id_idx
  on public.workouts(coach_id);

create index workouts_client_id_date_idx
  on public.workouts(client_id, date desc)
  where client_id is not null;

create index workouts_template_idx
  on public.workouts(coach_id)
  where is_template = true;

create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();
