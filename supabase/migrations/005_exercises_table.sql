-- ────────────────────────────────────────────────────────────────
-- 005_exercises_table.sql
-- ────────────────────────────────────────────────────────────────
-- Shared library + custom additions (MIGRATION_PLAN.md §4.2).
--   coach_id IS NULL  → seeded/shared row, readable by all coaches.
--   coach_id NOT NULL → custom row owned by that coach.
-- Two partial unique indexes enforce case-insensitive uniqueness within
-- each scope: globally for shared rows, per-coach for custom rows.
-- RLS is added in a later migration.

create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  coach_id          uuid references public.coaches(id) on delete cascade,
  name              text not null,
  movement          text not null check (movement in ('push','pull','squat','hinge','core','cardio','mobility','stretch')),
  muscles           text[] not null default '{}',
  equipment         text[] not null default '{}',
  difficulty        text check (difficulty in ('beginner','intermediate','advanced')),
  tags              text[] not null default '{}',
  contraindications text[] not null default '{}',
  default_sets      int,
  default_reps      text,
  default_rest      int,
  notes             text,
  is_seed           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index exercises_coach_id_idx
  on public.exercises(coach_id);

create unique index exercises_global_name_idx
  on public.exercises(lower(name))
  where coach_id is null;

create unique index exercises_per_coach_name_idx
  on public.exercises(coach_id, lower(name))
  where coach_id is not null;

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();
