-- ────────────────────────────────────────────────────────────────
-- 010_measurements_table.sql
-- ────────────────────────────────────────────────────────────────
-- Per-client body metrics: bodyweight, body fat %, and circumferences.
-- Canonical units (per CLAUDE.md and the Phase 0 unit flip):
--   value_lb   pounds          — used when type = 'weight'
--   value_in   inches          — used for circumference types
--                                (waist, hips, chest, armL/R, thighL/R)
--   value_pct  unitless percent — used when type = 'bodyFat'
-- The `unit` column records the user's display preference at write
-- time ('lb'|'kg'|'in'|'cm') for round-tripping; storage stays canonical.
-- Append-only per the sync model (MIGRATION_PLAN.md §7.2).
-- RLS is added in a later migration.

create table public.measurements (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  date        date not null,
  type        text not null check (type in ('weight','bodyFat','waist','hips','chest','armL','armR','thighL','thighR')),
  value_lb    numeric(7,2),
  value_in    numeric(6,2),
  value_pct   numeric(5,2),
  unit        text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index measurements_client_type_date_idx
  on public.measurements(client_id, type, date desc);

create trigger measurements_set_updated_at
  before update on public.measurements
  for each row execute function public.set_updated_at();
