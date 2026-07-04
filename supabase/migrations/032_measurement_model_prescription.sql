-- ────────────────────────────────────────────────────────────────
-- 032_measurement_model_prescription.sql
-- ────────────────────────────────────────────────────────────────
-- Measurement model, prescription + actuals shape (see
-- MEASUREMENT_MODEL.md). Brings workout_blocks and set_logs onto the
-- reps / time / distance model:
--
--   * reps becomes a clean integer (no free text, no ranges)
--   * work_type gains 'distance' alongside 'reps' and 'time'
--   * distance is stored canonically in METERS, with a per-block
--     display unit (m or yd), mirroring how weight uses lb/kg
--   * set_logs gains a distance actual so logged sets can record
--     reps OR seconds OR meters
--
-- Run ONCE in the Supabase SQL Editor at cutover, after 031. No RLS
-- changes are needed: the existing workout_blocks and set_logs table
-- policies already cover the new columns. Side is intentionally NOT
-- touched here — it stays bilateral/unilateral as migration 030 left
-- it; concrete left/right lives only on set_logs.
-- ────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════
-- PART A — workout_blocks: superset-safe garbage cleanup
-- ════════════════════════════════════════════════════════════════
-- A handful of legacy blocks hold non-numeric reps shorthand
-- (e.g. '45s', '10/leg'). They predate the structured time/side
-- columns and are being deleted rather than converted. "Garbage" =
-- reps is present but not a pure integer.

-- A1. Dissolve any superset that contains a to-be-deleted block first,
-- so the surviving partner is not left pointing at a half-group. This
-- nulls the group fields on every block sharing a group_id with a
-- garbage block (the garbage block itself and its partner).
update public.workout_blocks
set group_id = null, group_position = null
where group_id in (
  select group_id
  from public.workout_blocks
  where group_id is not null
    and reps is not null
    and btrim(reps) !~ '^\d+$'
);

-- A2. Delete the garbage blocks.
delete from public.workout_blocks
where reps is not null
  and btrim(reps) !~ '^\d+$';


-- ════════════════════════════════════════════════════════════════
-- PART B — workout_blocks: reps text -> smallint
-- ════════════════════════════════════════════════════════════════
-- After A2, every remaining non-null reps is a pure integer string,
-- so the cast is safe. nullif(btrim(...),'') maps any blank/whitespace
-- to NULL (time/distance blocks legitimately have no reps).
alter table public.workout_blocks
  alter column reps type smallint
  using nullif(btrim(reps), '')::smallint;


-- ════════════════════════════════════════════════════════════════
-- PART C — workout_blocks: add distance + extend the type
-- ════════════════════════════════════════════════════════════════

-- C1. Widen work_type to allow 'distance'. The CHECK from 029 was
-- declared inline and auto-named workout_blocks_work_type_check; drop
-- and re-add the widened version (same pattern 030 used for side).
alter table public.workout_blocks
  drop constraint workout_blocks_work_type_check;
alter table public.workout_blocks
  add constraint workout_blocks_work_type_check
  check (work_type in ('reps','time','distance'));

-- C2. Canonical distance in METERS (nullable; only meaningful when
-- work_type='distance' — coherence enforced in the app, exactly like
-- duration_seconds is for 'time').
alter table public.workout_blocks
  add column distance_m numeric(8,2);

-- C3. Per-block display/entry unit for distance. The stored value
-- stays meters; this only controls how it is shown and entered,
-- mirroring how `unit` (lb/kg) works for weight.
alter table public.workout_blocks
  add column distance_unit text not null default 'm'
  check (distance_unit in ('m','yd'));

comment on column public.workout_blocks.distance_m is
  'Prescribed distance in canonical meters (nullable; set only for distance-type blocks). Displayed/entered in distance_unit.';
comment on column public.workout_blocks.distance_unit is
  'Display/entry unit for this block''s distance: m or yd. Stored distance is always meters.';


-- ════════════════════════════════════════════════════════════════
-- PART D — set_logs: add the distance actual
-- ════════════════════════════════════════════════════════════════
-- One performed set records exactly one of reps / duration_seconds /
-- distance_m, matching its block's type (coherence in the app). No
-- unit column here: the display unit comes from the prescribing block,
-- exactly as weight_lb carries no unit (that lives on the parent log).
alter table public.set_logs
  add column distance_m numeric(8,2);

comment on column public.set_logs.distance_m is
  'Distance performed for this set, canonical meters (nullable; set only for distance-type blocks). Display unit comes from the prescribing block.';
