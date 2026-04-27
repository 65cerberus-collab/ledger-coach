-- ────────────────────────────────────────────────────────────────
-- 008_logs_table.sql
-- ────────────────────────────────────────────────────────────────
-- One log row per (workout, exercise) — the single-entry-per-exercise
-- model from CLAUDE.md. `mode` distinguishes 'asPlanned' (header-level
-- actuals only) from 'modified' (per-set detail in `per_set` JSONB).
-- Uniqueness on (workout_id, exercise_id) is enforced at the DB layer;
-- no plain duplicate of that index exists per the broadened
-- no-redundant-index rule (MIGRATION_PLAN.md §4).
-- exercise_id uses ON DELETE RESTRICT to preserve historical logs.
-- RLS is added in a later migration.

create table public.logs (
  id                 uuid primary key default gen_random_uuid(),
  workout_id         uuid not null references public.workouts(id) on delete cascade,
  exercise_id        uuid not null references public.exercises(id) on delete restrict,
  date               date not null,
  source             text not null default 'coach' check (source in ('coach','client')),
  mode               text not null check (mode in ('asPlanned','modified')),
  actual_sets        int,
  actual_reps        text,
  actual_weight_lb   numeric(7,2),
  per_set            jsonb,
  unit               text not null default 'lb' check (unit in ('lb','kg')),
  completed          boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index logs_exercise_date_idx
  on public.logs(exercise_id, date desc);

create unique index logs_unique_per_exercise_idx
  on public.logs(workout_id, exercise_id);

create trigger logs_set_updated_at
  before update on public.logs
  for each row execute function public.set_updated_at();
