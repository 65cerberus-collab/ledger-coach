-- ────────────────────────────────────────────────────────────────
-- 004_clients_table.sql
-- ────────────────────────────────────────────────────────────────
-- One client per row, owned by exactly one coach. Soft-deletable via
-- archived/archived_at. RLS is added in a later migration.

create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.coaches(id) on delete cascade,
  name          text not null,
  age           int,
  level         text check (level in ('beginner','intermediate','advanced')),
  goals         text,
  injuries      text[] not null default '{}',
  equipment     text[] not null default '{}',
  archived      boolean not null default false,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index clients_coach_id_idx on public.clients(coach_id);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();
