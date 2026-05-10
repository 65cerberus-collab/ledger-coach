-- ────────────────────────────────────────────────────────────────
-- 029_workout_blocks_work_type.sql
-- ────────────────────────────────────────────────────────────────
-- Phase 4 primitive #2: isometric / time-based work support.
-- Adds a `work_type` column to workout_blocks describing whether
-- the block is rep-based ('reps') or time/isometric-based ('time'),
-- plus a `duration_seconds` integer for the held duration of a
-- time-based block (only meaningful when work_type='time').
--
-- Pattern matches primitive #1 (mig 028) and existing enum-like
-- columns in the repo (text + CHECK constraint, not native
-- CREATE TYPE).
--
-- NOT NULL with DEFAULT 'reps' means existing rows are backfilled
-- implicitly; no separate UPDATE is needed. duration_seconds is
-- nullable on purpose — only relevant for time-based blocks.
-- RLS policies on workout_blocks (017) are row-level and cover
-- the new columns without modification.

alter table public.workout_blocks
  add column work_type text not null default 'reps'
    check (work_type in ('reps','time')),
  add column duration_seconds integer;
