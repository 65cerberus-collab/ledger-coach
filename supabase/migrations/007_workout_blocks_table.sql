-- ────────────────────────────────────────────────────────────────
-- 007_workout_blocks_table.sql
-- ────────────────────────────────────────────────────────────────
-- Exercises within a workout, ordered by `position`. Splitting blocks
-- out of the workouts JSON enables relational queries like "did this
-- client do this exercise recently?" — see MIGRATION_PLAN.md §4.2.
-- exercise_id uses ON DELETE RESTRICT: an exercise that's been used in
-- a block cannot be hard-deleted (matches the soft-delete pattern).
-- RLS is added in a later migration.

create table public.workout_blocks (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id) on delete restrict,
  position     int not null,
  sets         int,
  reps         text,
  weight_lb    numeric(7,2),
  rest_seconds int,
  unit         text not null default 'lb' check (unit in ('lb','kg')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index workout_blocks_workout_id_position_idx
  on public.workout_blocks(workout_id, position);

create trigger workout_blocks_set_updated_at
  before update on public.workout_blocks
  for each row execute function public.set_updated_at();
