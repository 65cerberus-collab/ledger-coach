-- Migration 025: Add completed_at to workouts
-- Tracks when a coach marks a session complete.
-- NULL = not completed; timestamp = completed at that moment.
-- Reversible: coaches can un-complete by setting back to NULL.

alter table public.workouts
  add column completed_at timestamptz;

comment on column public.workouts.completed_at is
  'When the coach marked this session complete. NULL = in progress or ready. Reversible.';
