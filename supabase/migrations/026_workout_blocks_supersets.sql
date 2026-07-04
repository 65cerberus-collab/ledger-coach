-- ────────────────────────────────────────────────────────────────
-- 026_workout_blocks_supersets.sql
-- ────────────────────────────────────────────────────────────────
-- Phase 4 primitive #3: superset support.
-- Adds group_id + group_position to workout_blocks.
-- Two blocks with the same group_id form a superset.
-- group_position is 1 or 2 (CHECK constraint enforces cap of 2).
-- Both columns nullable: null = solo block (default).
-- Additive only. Existing rows untouched. RLS unchanged.

alter table public.workout_blocks
  add column group_id uuid,
  add column group_position smallint
    check (group_position is null or group_position in (1, 2));
