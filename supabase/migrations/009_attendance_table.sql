-- ────────────────────────────────────────────────────────────────
-- 009_attendance_table.sql
-- ────────────────────────────────────────────────────────────────
-- One attendance row per workout (1:1 enforced by UNIQUE on
-- workout_id). Tracks whether a scheduled session was attended,
-- missed, or cancelled. RLS is added in a later migration.

create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts(id) on delete cascade unique,
  status      text not null check (status in ('present','missed','cancelled')),
  date        date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- No explicit index on workout_id: the UNIQUE constraint already
-- creates a btree index (no-redundant-index rule, MIGRATION_PLAN.md §4).

create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();
