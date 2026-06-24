-- ────────────────────────────────────────────────────────────────
-- 033_measurement_model_library.sql
-- ────────────────────────────────────────────────────────────────
-- Measurement model, exercise-library layer (see MEASUREMENT_MODEL.md).
-- Brings public.exercises onto the same reps / time / distance model
-- that migration 032 gave workout_blocks and set_logs, so a library
-- exercise carries a default measurement type plus default
-- reps / duration / distance and a default side.
--
--   * default_reps becomes a clean smallint (no free text, no ranges)
--   * default_work_type names the type: 'reps' | 'time' | 'distance'
--   * default_duration_seconds holds the default hold for time work
--   * default distance is stored canonically in METERS, with a
--     per-exercise display unit (m or yd), mirroring workout_blocks
--   * default_side is the prescription side: bilateral | unilateral
--
-- The existing free-text default_reps values (e.g. '45s', '10/leg',
-- '40m', '20min') are parsed in place into these columns. The rulings
-- were taken from the live data, not memory:
--   'Ns'   -> time, N seconds          'Nm'   -> distance, N meters
--   'Nmin' -> time, N*60 seconds       '/side' | '/leg' -> unilateral
--   'N'    -> reps, N                   'N each'         -> unilateral
--
-- Run ONCE in the Supabase SQL Editor at cutover, AFTER 032. RLS on
-- exercises (015) is row-level and already covers the new columns; no
-- policy changes are needed. The seed file
-- supabase/seed/seed_exercises.sql is rewritten to the post-033 shape
-- in this same PR so fresh databases seed correctly.
-- ────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════
-- PART A — add the measurement columns
-- ════════════════════════════════════════════════════════════════
-- Mirror 029 (work_type), 028 (side) and 032 (distance) conventions:
-- text + CHECK, NOT NULL with a sensible default so existing rows are
-- backfilled implicitly. Numeric defaults (duration/distance) are
-- nullable — only meaningful for their matching type.
alter table public.exercises
  add column default_work_type text not null default 'reps'
    check (default_work_type in ('reps','time','distance')),
  add column default_duration_seconds integer,
  add column default_distance_m numeric(8,2),
  add column default_distance_unit text not null default 'm'
    check (default_distance_unit in ('m','yd')),
  add column default_side text not null default 'bilateral'
    check (default_side in ('bilateral','unilateral'));


-- ════════════════════════════════════════════════════════════════
-- PART B — parse legacy free-text default_reps into the new columns
-- ════════════════════════════════════════════════════════════════
-- Each UPDATE reads the ORIGINAL default_reps text (every SET right-
-- hand side sees the pre-update row), classifies it by pattern, and
-- writes the structured columns. Patterns are mutually exclusive
-- (verified against the full live value set), so order is not load-
-- bearing; the `default_work_type = 'reps'` guard is belt-and-braces
-- so a row can never be reclassified twice.
-- substring(... from '^\d+') pulls the leading integer.

-- B1. DISTANCE: 'Nm' (bilateral) or 'Nm/side' | 'Nm/leg' (unilateral).
--     Canonical meters; display unit 'm'. default_reps cleared.
update public.exercises
set
  default_work_type     = 'distance',
  default_distance_m    = substring(default_reps from '^\d+')::numeric,
  default_distance_unit = 'm',
  default_side          = case
                            when default_reps ~ '/\s*(side|leg)' then 'unilateral'
                            else 'bilateral'
                          end,
  default_reps          = null
where default_work_type = 'reps'
  and btrim(default_reps) ~ '^\d+\s*m(\s*/\s*(side|leg))?\s*$';

-- B2. TIME (minutes): 'Nmin' -> N*60 seconds. default_reps cleared.
update public.exercises
set
  default_work_type        = 'time',
  default_duration_seconds = substring(default_reps from '^\d+')::int * 60,
  default_side             = 'bilateral',
  default_reps             = null
where default_work_type = 'reps'
  and btrim(default_reps) ~ '^\d+\s*min\s*$';

-- B3. TIME (seconds): 'Ns' (bilateral) or 'Ns/side' | 'Ns/leg' |
--     'Ns each' (unilateral). default_reps cleared.
update public.exercises
set
  default_work_type        = 'time',
  default_duration_seconds = substring(default_reps from '^\d+')::int,
  default_side             = case
                               when default_reps ~ '(each|/\s*(side|leg))' then 'unilateral'
                               else 'bilateral'
                             end,
  default_reps             = null
where default_work_type = 'reps'
  and btrim(default_reps) ~ '^\d+\s*s(ec)?(\s*(each|/\s*(side|leg)))?\s*$';

-- B4. REPS (unilateral): 'N/side' | 'N/leg' | 'N/arm'. Stays rep-type;
--     side becomes unilateral; default_reps is reduced to the leading
--     integer (still text here — Part D casts it to smallint).
update public.exercises
set
  default_side = 'unilateral',
  default_reps = substring(default_reps from '^\d+')
where default_work_type = 'reps'
  and btrim(default_reps) ~ '^\d+\s*/\s*(side|leg|arm)\s*$';


-- ════════════════════════════════════════════════════════════════
-- PART C — safety net for any unexpected free-text default_reps
-- ════════════════════════════════════════════════════════════════
-- The live library currently has zero values outside B1-B4, but the
-- old free-text reps editor is still in production until cutover, so a
-- custom exercise could acquire something like '8-12' or 'AMRAP' in
-- the meantime. Rather than fail the cast in Part D, preserve the
-- original in notes and clear default_reps (work_type stays 'reps').
-- Mirrors how migration 030 parked legacy side intent in notes.
-- Blank/whitespace default_reps is left for Part D's nullif to clear,
-- so it never produces an empty "Legacy default reps:" note.
update public.exercises
set
  notes = case
            when notes is null or notes = ''
              then 'Legacy default reps: ' || default_reps
            else notes || E'\n' || 'Legacy default reps: ' || default_reps
          end,
  default_reps = null
where default_reps is not null
  and btrim(default_reps) <> ''
  and btrim(default_reps) !~ '^\d+$';


-- ════════════════════════════════════════════════════════════════
-- PART D — default_reps text -> smallint
-- ════════════════════════════════════════════════════════════════
-- After B and C, every remaining non-null default_reps is a pure
-- integer string; time/distance rows are NULL. nullif(btrim(),'')
-- maps any blank to NULL.
alter table public.exercises
  alter column default_reps type smallint
  using nullif(btrim(default_reps), '')::smallint;


-- ════════════════════════════════════════════════════════════════
-- PART E — column documentation
-- ════════════════════════════════════════════════════════════════
comment on column public.exercises.default_work_type is
  'Default measurement type for this library exercise: reps | time | distance. Copied onto workout_blocks.work_type when the exercise is added to a workout.';
comment on column public.exercises.default_duration_seconds is
  'Default hold in seconds for time-type exercises (nullable; only meaningful when default_work_type = ''time'').';
comment on column public.exercises.default_distance_m is
  'Default distance in canonical meters for distance-type exercises (nullable; only meaningful when default_work_type = ''distance''). Displayed/entered in default_distance_unit.';
comment on column public.exercises.default_distance_unit is
  'Display/entry unit for this exercise''s default distance: m or yd. Stored distance is always meters.';
comment on column public.exercises.default_side is
  'Default prescription side: bilateral or unilateral. Unilateral expands to left+right at log time, exactly like workout_blocks.side.';
