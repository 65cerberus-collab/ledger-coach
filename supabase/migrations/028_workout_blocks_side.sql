-- ────────────────────────────────────────────────────────────────
-- 028_workout_blocks_side.sql
-- ────────────────────────────────────────────────────────────────
-- Phase 4 primitive #1: unilateral / single-limb support.
-- Adds a `side` column to workout_blocks describing how the
-- exercise is performed: bilateral (both limbs at once),
-- left-only, right-only, or alternating (per-set).
--
-- Pattern matches existing enum-like columns in the repo
-- (`unit`, `visibility`, `movement`, `source`, `mode`):
-- text + CHECK constraint, not a native CREATE TYPE.
--
-- NOT NULL with DEFAULT 'bilateral' means existing rows are
-- backfilled implicitly; no separate UPDATE is needed. RLS
-- policies on workout_blocks (017) are row-level and cover the
-- new column without modification.

alter table public.workout_blocks
  add column side text not null default 'bilateral'
  check (side in ('bilateral','left','right','alternating'));
